require "rails_helper"

RSpec.describe CampaignSendJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:campaign)  { create(:campaign, workspace: workspace) }
  let(:send_rec)  do
    create(:campaign_send,
           workspace: workspace,
           campaign: campaign,
           recipient_email: "to@example.com",
           status: "queued")
  end

  before do
    Resend.api_key = "test_key"
  end

  it "renders + sends via Resend, persists message_id and rendered_html (success path)" do
    stub_request(:post, "https://api.resend.com/emails")
      .to_return(
        status: 200,
        body: { id: "msg_abc123" }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

    described_class.new.perform(send_rec.id)

    send_rec.reload
    expect(send_rec.status).to eq("sent")
    expect(send_rec.resend_message_id).to eq("msg_abc123")
    expect(send_rec.rendered_html).to be_present
    expect(send_rec.subject).to be_present
    expect(send_rec.sent_at).to be_present
  end

  it "skips when status is not queued" do
    send_rec.update_columns(status: "sent")
    expect(Resend::Emails).not_to receive(:send)
    described_class.new.perform(send_rec.id)
    expect(send_rec.reload.status).to eq("sent")
  end

  it "retries on Resend failure and finally marks bounced after MAX_ATTEMPTS" do
    stub_request(:post, "https://api.resend.com/emails")
      .to_return(status: 500, body: { error: "boom" }.to_json)

    # attempt=MAX_ATTEMPTS — no further enqueue, just mark bounced
    described_class.new.perform(send_rec.id, attempt: CampaignSendJob::MAX_ATTEMPTS)

    send_rec.reload
    expect(send_rec.status).to eq("bounced")
    expect(send_rec.bounced_at).to be_present
  end

  it "re-enqueues itself with incremented attempt on first failure" do
    stub_request(:post, "https://api.resend.com/emails").to_return(status: 500, body: "{}")

    expect {
      described_class.new.perform(send_rec.id, attempt: 1)
    }.to have_enqueued_job(described_class).with(send_rec.id, attempt: 2)

    expect(send_rec.reload.status).to eq("queued")
  end
end
