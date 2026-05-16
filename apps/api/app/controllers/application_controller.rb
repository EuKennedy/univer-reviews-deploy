class ApplicationController < ActionController::API
  include Pagy::Backend
  include ActionController::Cookies

  before_action :set_current_workspace

  rescue_from ActiveRecord::RecordNotFound,    with: :not_found
  rescue_from ActiveRecord::RecordInvalid,     with: :unprocessable
  rescue_from ActionController::ParameterMissing, with: :bad_request
  rescue_from UnauthorizedError,               with: :unauthorized
  rescue_from ForbiddenError,                  with: :forbidden
  rescue_from TenantError,                     with: :tenant_error

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

    # Resolve workspace from session's active_organization_id mapping → workspaces.better_auth_org_id.
    workspace =
      if ba_session.respond_to?(:active_organization_id) && ba_session.active_organization_id.present?
        Workspace.find_by(better_auth_org_id: ba_session.active_organization_id)
      end

    # Fall back: pick the user's first linked workspace_user.
    @current_user      = WorkspaceUser.find_by(better_auth_user_id: ba_user.id, workspace_id: workspace&.id) ||
                         WorkspaceUser.find_by(better_auth_user_id: ba_user.id)
    @current_workspace = @current_user&.workspace || workspace

    raise UnauthorizedError, "User not provisioned to any workspace" unless @current_workspace
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

  def set_rls_workspace(workspace_id)
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(
        ["SET LOCAL app.workspace_id = ?", workspace_id.to_s]
      )
    )
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
    false
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
end
