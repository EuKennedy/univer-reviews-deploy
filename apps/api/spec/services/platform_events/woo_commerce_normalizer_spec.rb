require "rails_helper"

RSpec.describe PlatformEvents::WooCommerceNormalizer do
  let(:base_payload) do
    {
      "id"     => 4421,
      "number" => "4421",
      "status" => "completed",
      "total"  => "129.90",
      "currency" => "BRL",
      "billing" => {
        "first_name" => "Joao",
        "last_name"  => "Silva",
        "email"      => "joao@example.com"
      },
      "line_items" => [
        { "name" => "Camisa Bordada", "slug" => "camisa-bordada", "product_id" => 11 },
        { "name" => "Pulseira", "product_id" => 22 }
      ]
    }
  end

  it "maps order.completed → order_completed" do
    attrs = described_class.normalize(base_payload, "order.completed")
    expect(attrs[:event_type]).to eq("order_completed")
    expect(attrs[:platform]).to eq("woocommerce")
    expect(attrs[:external_order_id]).to eq("4421")
    expect(attrs[:customer_email]).to eq("joao@example.com")
    expect(attrs[:customer_name]).to eq("Joao Silva")
    expect(attrs[:product_handles]).to include("camisa-bordada", "pulseira")
    expect(attrs[:order_total]).to eq("129.90")
    expect(attrs[:currency]).to eq("BRL")
  end

  it "maps order.updated with status=completed → order_completed" do
    attrs = described_class.normalize(base_payload.merge("status" => "completed"), "order.updated")
    expect(attrs[:event_type]).to eq("order_completed")
  end

  it "maps custom status=delivered → order_delivered" do
    payload = base_payload.merge("status" => "delivered")
    attrs   = described_class.normalize(payload, "order.updated")
    expect(attrs[:event_type]).to eq("order_delivered")
  end

  it "maps order.refunded → order_refunded" do
    attrs = described_class.normalize(base_payload.merge("status" => "refunded"), "order.refunded")
    expect(attrs[:event_type]).to eq("order_refunded")
  end

  it "returns nil for unsupported status" do
    payload = base_payload.merge("status" => "on-hold")
    attrs   = described_class.normalize(payload, "order.updated")
    expect(attrs).to be_nil
  end

  it "tolerates missing email — sets customer_email to nil but still normalizes" do
    payload = base_payload.deep_dup
    payload["billing"]["email"] = nil
    attrs   = described_class.normalize(payload, "order.completed")
    expect(attrs).not_to be_nil
    expect(attrs[:customer_email]).to be_nil
    expect(attrs[:event_type]).to eq("order_completed")
  end

  it "falls back to id when number is blank" do
    payload = base_payload.merge("number" => nil)
    attrs   = described_class.normalize(payload, "order.completed")
    expect(attrs[:external_order_id]).to eq("4421")
  end
end
