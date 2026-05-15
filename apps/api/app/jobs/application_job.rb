class ApplicationJob < ActiveJob::Base
  # Discard jobs on unrecoverable errors
  discard_on ActiveJob::DeserializationError

  # Retry transient failures with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Set RLS for every job that has a workspace context
  def set_workspace_rls(workspace_id)
    return unless workspace_id.present?
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", workspace_id.to_s])
    )
  rescue => e
    Rails.logger.error("Failed to set RLS in job: #{e.message}")
  end
end
