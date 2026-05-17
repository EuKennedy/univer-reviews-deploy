class ApplicationJob < ActiveJob::Base
  # Discard jobs on unrecoverable errors
  discard_on ActiveJob::DeserializationError

  # Retry transient failures with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Run a block with RLS scoped to the given workspace.
  #
  # `SET LOCAL` only persists inside an open transaction — calling it before a
  # loop of `save!` (each of which opens its own implicit transaction) is a
  # no-op for every save after the first. Every write the job performs has to
  # happen *inside* the same transaction where `SET LOCAL` was issued, otherwise
  # the RLS policy compares against an empty `app.workspace_id` and silently
  # rejects the row.
  def with_workspace_rls(workspace_id)
    raise ArgumentError, "workspace_id required" if workspace_id.blank?
    ActiveRecord::Base.transaction do
      ActiveRecord::Base.connection.execute(
        ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", workspace_id.to_s])
      )
      yield
    end
  end

  # Legacy alias — DO NOT use for jobs that issue multiple writes. Kept for
  # backwards compatibility with existing callers that only fire one statement.
  def set_workspace_rls(workspace_id)
    return if workspace_id.blank?
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", workspace_id.to_s])
    )
  rescue => e
    Rails.logger.error("Failed to set RLS in job: #{e.message}")
  end
end
