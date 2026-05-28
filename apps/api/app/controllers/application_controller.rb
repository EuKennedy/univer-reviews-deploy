class ApplicationController < ActionController::API
  include Pagy::Backend
  include ActionController::Cookies

  # Each authenticated request runs inside a transaction so that
  # SET LOCAL app.workspace_id persists for the entire request lifetime.
  # Without this, SET LOCAL (which is transaction-scoped) has no effect and
  # RLS policies either see a stale workspace_id from a pooled connection
  # or no workspace_id at all, breaking row-level isolation.
  around_action :request_transaction, unless: :skip_authentication?
  before_action :set_current_workspace

  rescue_from ActiveRecord::RecordNotFound,    with: :not_found
  rescue_from ActiveRecord::RecordInvalid,     with: :unprocessable
  rescue_from ActionController::ParameterMissing, with: :bad_request
  rescue_from UnauthorizedError,               with: :unauthorized
  rescue_from ForbiddenError,                  with: :forbidden
  rescue_from TenantError,                     with: :tenant_error
  rescue_from PlanFeatures::FeatureLocked,     with: :feature_locked

  # Root
  def root
    render json: { service: "UniverReviews API", version: "v1", status: "ok" }
  end

  # Health
  def health
    db_ok = ActiveRecord::Base.connection.execute("SELECT 1").any?
    render json: { status: "ok", db: db_ok ? "ok" : "degraded", ts: Time.current.iso8601 }
  rescue => e
    render json: { status: "degraded", error: e.message }, status: :service_unavailable
  end

  private

  SESSION_COOKIE = "better-auth.session_token".freeze

  def set_current_workspace
    return if skip_authentication?

    bearer = extract_bearer_token
    session_token = extract_session_token

    if session_token.present?
      authenticate_better_auth_session!(session_token)
    elsif bearer.present?
      # Bearer header with token — could be Better Auth bearer plugin OR a raw API key.
      # Better Auth tokens are signed JWT-ish (3 dots) OR opaque; try session first.
      ba_user = lookup_better_auth_session(bearer)
      if ba_user
        assign_from_better_auth(ba_user[:user], ba_user[:session])
      else
        authenticate_api_key!(bearer)
      end
    elsif request.headers["X-Univer-Api-Key"].present?
      authenticate_api_key!(request.headers["X-Univer-Api-Key"])
    else
      raise UnauthorizedError, "Missing credentials"
    end

    raise UnauthorizedError if @current_workspace.nil? || @current_workspace.suspended?

    set_rls_workspace(@current_workspace.id)
  end

  def authenticate_better_auth_session!(token)
    found = lookup_better_auth_session(token)
    raise UnauthorizedError, "Invalid or expired session" unless found
    assign_from_better_auth(found[:user], found[:session])
  end

  def lookup_better_auth_session(token)
    # Cookie value is signed: `<token>.<signature>`. Better Auth stores the raw token
    # in `auth.session.token`. Strip the signature suffix (everything after the first dot)
    # only if the prefix matches a real session row.
    candidates = [token]
    candidates << token.split(".", 2).first if token.include?(".")

    session = BetterAuth::Session.where(token: candidates.uniq).first
    return nil unless session
    return nil if session.expired?

    user = session.user
    return nil unless user

    { user: user, session: session }
  end

  def assign_from_better_auth(ba_user, ba_session)
    @current_ba_user    = ba_user
    @current_ba_session = ba_session

    # workspace_users has FORCE ROW LEVEL SECURITY (app.workspace_id isolation).
    # At this point app.workspace_id is not yet set — we're in the auth bootstrap.
    # Disable row security temporarily so we can locate the user across tenants,
    # then re-enable it after set_rls_workspace pins the correct workspace.
    # Requires BYPASSRLS privilege or superuser — gracefully ignored otherwise.
    conn = ActiveRecord::Base.connection
    begin
      conn.execute("SET LOCAL row_security = off")
    rescue => e
      Rails.logger.warn("[auth] cannot bypass RLS in assign_from_better_auth: #{e.message}")
    end

    # Workspace resolution has THREE possible signals (priority order):
    #   1) Explicit URL slug:  /api/v1/* path under a "/:workspace_slug/..." prefix
    #      (we accept it via X-Univer-Workspace-Slug for now; the admin already
    #      reads workspaces from the path so adding the header is cheap)
    #   2) Better Auth session active_organization_id mapping
    #   3) The user's only linked workspace_user (when they belong to exactly one)
    #
    # We deliberately REMOVED the "fall back to any workspace_user" path.
    # Previously, a user who belonged to two workspaces and had no
    # active_organization_id silently landed in whichever was first in the
    # index — same class as the lizzon bug. Now: if we can't disambiguate,
    # fail closed with 401 and surface the available slugs so the client
    # can re-request with the right header.
    workspace =
      if ba_session.respond_to?(:active_organization_id) && ba_session.active_organization_id.present?
        Workspace.find_by(better_auth_org_id: ba_session.active_organization_id)
      end

    slug_hint = request.headers["X-Univer-Workspace-Slug"].to_s.strip
    if workspace.nil? && slug_hint.present?
      workspace = Workspace.find_by(slug: slug_hint)
    end

    if workspace
      @current_user      = WorkspaceUser.find_by(better_auth_user_id: ba_user.id, workspace_id: workspace.id)
      @current_workspace = workspace if @current_user
    else
      memberships = WorkspaceUser.where(better_auth_user_id: ba_user.id).limit(2).to_a
      if memberships.length == 1
        @current_user      = memberships.first
        @current_workspace = @current_user.workspace
      elsif memberships.length > 1
        raise UnauthorizedError,
              "User belongs to multiple workspaces; specify X-Univer-Workspace-Slug or set active_organization_id."
      end
    end

    raise UnauthorizedError, "User not provisioned to any workspace" unless @current_workspace
    raise UnauthorizedError, "User not a member of this workspace"   unless @current_user
  end

  def authenticate_api_key!(api_key)
    key_hash = Digest::SHA256.hexdigest(api_key)
    @api_key_record = WorkspaceApiKey.active.find_by(key_hash: key_hash)
    raise UnauthorizedError, "Invalid API key" unless @api_key_record

    @current_workspace = @api_key_record.workspace
    @api_key_record.touch(:last_used_at)
  end

  def extract_session_token
    cookies[SESSION_COOKIE] || cookies["__Secure-#{SESSION_COOKIE}"]
  end

  def request_transaction(&block)
    ActiveRecord::Base.transaction(&block)
  end

  def set_rls_workspace(workspace_id)
    # SET LOCAL requires an active transaction (request_transaction wraps every
    # authenticated request). Setting it outside a transaction silently degrades
    # to a session SET, leaking workspace context across pooled connections.
    conn = ActiveRecord::Base.connection
    conn.execute(
      ActiveRecord::Base.sanitize_sql(
        ["SET LOCAL app.workspace_id = ?", workspace_id.to_s]
      )
    )
    # Re-enable RLS now that workspace context is established.
    # assign_from_better_auth turned it off during the auth bootstrap.
    conn.execute("SET LOCAL row_security = on")
  end

  def current_workspace
    @current_workspace
  end

  def current_user
    @current_user
  end

  def current_better_auth_user
    @current_ba_user
  end

  def current_api_key
    @api_key_record
  end

  def extract_bearer_token
    auth_header = request.headers["Authorization"]
    return nil unless auth_header&.start_with?("Bearer ")
    auth_header.split(" ", 2).last
  end

  def skip_authentication?
    action_name.in?(%w[root health])
  end

  def require_write!
    return if current_user&.can_write?
    return if current_api_key&.write?
    raise ForbiddenError, "Insufficient permissions for write action"
  end

  # Pagy helper: returns [pagy, records]
  def paginate(scope)
    limit = [params[:per_page].to_i.then { |v| v.positive? ? v : 25 }, 100].min
    pagy(scope, page: params[:page], limit: limit)
  end

  def pagination_meta(pagy)
    {
      current_page: pagy.page,
      total_pages:  pagy.pages,
      total_count:  pagy.count,
      per_page:     pagy.limit
    }
  end

  def render_collection(records, pagy, serializer_method: :as_json)
    render json: {
      data: records.map { |r| serialize(r) },
      meta: pagination_meta(pagy)
    }
  end

  def serialize(record)
    record.as_json
  end

  # Error handlers
  def not_found(error = nil)
    render json: {
      error: "not_found",
      message: error&.message || "Resource not found"
    }, status: :not_found
  end

  def unprocessable(error)
    render json: {
      error: "unprocessable_entity",
      message: error.message,
      issues: error.record&.errors&.full_messages
    }, status: :unprocessable_entity
  end

  def bad_request(error)
    render json: {
      error: "bad_request",
      message: error.message
    }, status: :bad_request
  end

  def unauthorized(error = nil)
    render json: {
      error: "unauthorized",
      message: error&.message || "Authentication required"
    }, status: :unauthorized
  end

  def forbidden(error = nil)
    render json: {
      error: "forbidden",
      message: error&.message || "You do not have permission to perform this action"
    }, status: :forbidden
  end

  def tenant_error(error = nil)
    render json: {
      error: "tenant_error",
      message: error&.message || "Workspace not found"
    }, status: :not_found
  end

  # PlanFeatures::FeatureLocked → 402 Payment Required + upgrade hint.
  # Frontend renders a paywall modal that deep-links to /billing with
  # the suggested plan pre-selected.
  def feature_locked(error)
    render json: error.to_json_payload, status: :payment_required
  end

  # Public helper for controllers to gate an action behind a plan
  # feature. Raises PlanFeatures::FeatureLocked which is rescued above.
  #
  # Usage:
  #   def create
  #     require_feature!(:ai_summary_topics)
  #     ...
  #   end
  def require_feature!(feature)
    PlanFeatures.require!(feature, current_workspace)
  end
end
