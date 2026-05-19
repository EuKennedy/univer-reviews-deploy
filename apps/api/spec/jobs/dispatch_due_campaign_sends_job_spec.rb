require "rails_helper"

RSpec.describe DispatchDueCampaignSendsJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:campaign)  { create(:campaign, workspace: workspace) }

  it "enqueues CampaignSendJob only for queued sends with scheduled_at <= now" do
    due       = create(:campaign_send, workspace: workspace, campaign: campaign, status: "queued", scheduled_at: 5.minutes.ago)
    not_due   = create(:campaign_send, workspace: workspace, campaign: campaign, status: "queued", scheduled_at: 30.minutes.from_now)
    sent      = create(:campaign_send, workspace: workspace, campaign: campaign, status: "sent", scheduled_at: 5.minutes.ago)
    bounced   = create(:campaign_send, workspace: workspace, campaign: campaign, status: "bounced", scheduled_at: 5.minutes.ago)

    expect {
      described_class.new.perform
    }.to have_enqueued_job(CampaignSendJob).with(due.id)

    enqueued_ids = ActiveJob::Base.queue_adapter.enqueued_jobs
      .select { |j| j[:job] == CampaignSendJob }
      .flat_map { |j| j[:args] }
    expect(enqueued_ids).to include(due.id)
    expect(enqueued_ids).not_to include(not_due.id, sent.id, bounced.id)
  end

  it "respects the per-workspace throttle cap" do
    stub_const("DispatchDueCampaignSendsJob::PER_WORKSPACE_THROTTLE", 3)
    stub_const("DispatchDueCampaignSendsJob::PER_WORKSPACE_BATCH", 10)

    5.times { create(:campaign_send, workspace: workspace, campaign: campaign, status: "queued", scheduled_at: 1.minute.ago) }

    described_class.new.perform

    count = ActiveJob::Base.queue_adapter.enqueued_jobs.count { |j| j[:job] == CampaignSendJob }
    expect(count).to eq(3)
  end

  it "skips suspended workspaces" do
    suspended_ws = create(:workspace, :suspended)
    suspended_campaign = create(:campaign, workspace: suspended_ws)
    create(:campaign_send, workspace: suspended_ws, campaign: suspended_campaign, status: "queued", scheduled_at: 1.minute.ago)

    described_class.new.perform

    count = ActiveJob::Base.queue_adapter.enqueued_jobs.count { |j| j[:job] == CampaignSendJob }
    expect(count).to eq(0)
  end
end
