class ApplicationController < ActionController::API
  include Pagy::Backend

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

  def set_current_workspace
    return if skip_authentication?

    api_key = extract_api_key
    raise UnauthorizedError unless api_key

    key_hash = Digest::SHA256.hexdigest(api_key)
    @api_key_record = WorkspaceApiKey.active.find_by(key_hash: key_hash)
    raise UnauthorizedError unless @api_key_record

    @current_workspace = @api_key_record.workspace
    raise UnauthorizedError if @current_workspace.suspended?

    @api_key_record.touch(:last_used_at)

    set_rls_workspace(@current_workspace.id)
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

  def current_api_key
    @api_key_record
  end

  def extract_api_key
    auth_header = request.headers["Authorization"]
    if auth_header&.start_with?("Bearer ")
      auth_header.split(" ").last
    else
      request.headers["X-Univer-Api-Key"]
    end
  end

  def skip_authentication?
    false
  end

  def require_write!
    raise ForbiddenError, "API key lacks write scope" unless current_api_key&.write?
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
