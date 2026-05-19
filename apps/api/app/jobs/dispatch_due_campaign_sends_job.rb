class DispatchDueCampaignSendsJob < ApplicationJob
  queue_as :default

  PER_WORKSPACE_THROTTLE = 200
  PER_WORKSPACE_BATCH    = 100

  def perform
    Workspace.active.find_each do |workspace|
      with_workspace_rls(workspace.id) do
        dispatched = 0
        CampaignSend.due.where(workspace_id: workspace.id).limit(PER_WORKSPACE_BATCH).each do |send|
          break if dispatched >= PER_WORKSPACE_THROTTLE
          CampaignSendJob.perform_later(send.id)
          dispatched += 1
        end
        Rails.logger.info("DispatchDueCampaignSendsJob: workspace=#{workspace.id} dispatched=#{dispatched}") if dispatched.positive?
      end
    end
  end
end
