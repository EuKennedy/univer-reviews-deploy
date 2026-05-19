require "rails_helper"

RSpec.describe PlatformEvents::Processor do
  let(:workspace) { create(:workspace) }

  before do
    # Disable RLS for the test transaction — we already filter by workspace_id
    # in every query and don't want SET LOCAL races inside DatabaseCleaner.
    allow(ActiveRecord::Base.connection).to receive(:execute).and_call_original
  end

  def make_event(event_type:, order_id: "ORD-1", email: "buyer@example.com")
    create(:platform_event,
           workspace: workspace,
           event_type: event_type,
           external_order_id: order_id,
           customer_email: email)
  end

  it "creates a CampaignSend per listening campaign and schedules with delay" do
    c1 = create(:campaign, workspace: workspace, trigger_events: %w[order_completed], trigger_after_minutes: 60)
    c2 = create(:campaign, workspace: workspace, trigger_events: %w[order_completed], trigger_after_minutes: 0)
    create(:campaign, workspace: workspace, trigger_events: %w[order_delivered]) # should not fire

    event = make_event(event_type: "order_completed")

    sends = described_class.process(event)

    expect(sends.size).to eq(2)
    send_for_c1 = sends.find { |s| s.campaign_id == c1.id }
    send_for_c2 = sends.find { |s| s.campaign_id == c2.id }

    expect(send_for_c1.scheduled_at).to be_within(2.seconds).of(event.received_at + 60.minutes)
    expect(send_for_c2.scheduled_at).to be_within(2.seconds).of(event.received_at)
    expect(sends.map(&:recipient_email).uniq).to eq([event.customer_email])
  end

  it "is idempotent — same (order, email) twice yields one send per campaign" do
    create(:campaign, workspace: workspace, trigger_events: %w[order_completed])
    event = make_event(event_type: "order_completed")

    first  = described_class.process(event)
    second = described_class.process(event)

    expect(first.size).to eq(1)
    expect(second.size).to eq(1)
    expect(second.first.id).to eq(first.first.id)
    expect(CampaignSend.count).to eq(1)
  end

  it "anti-dup across event types — order_completed + order_delivered same order = ONE send per campaign" do
    create(:campaign, workspace: workspace, trigger_events: %w[order_completed order_delivered])

    completed = make_event(event_type: "order_completed", order_id: "X-99")
    delivered = make_event(event_type: "order_delivered", order_id: "X-99")

    described_class.process(completed)
    described_class.process(delivered)

    expect(CampaignSend.where(external_order_id: "X-99").count).to eq(1)
  end

  it "skips events without customer_email" do
    create(:campaign, workspace: workspace, trigger_events: %w[order_completed])
    event = build(:platform_event, workspace: workspace, customer_email: nil)
    event.save!(validate: false)
    sends = described_class.process(event)
    expect(sends).to eq([])
  end

  it "ignores inactive or wrong-type campaigns" do
    create(:campaign, workspace: workspace, trigger_events: %w[order_completed], status: "paused")
    create(:campaign, workspace: workspace, trigger_events: %w[order_completed], type: "whatsapp")

    event = make_event(event_type: "order_completed")
    sends = described_class.process(event)
    expect(sends).to eq([])
  end
end
