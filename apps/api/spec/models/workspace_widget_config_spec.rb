require "rails_helper"

# Locks the public widget_config contract — the storefront widget and the
# admin AppearanceTab both depend on these exact keys. Adding a key without
# updating both sides will fail this spec.
RSpec.describe Workspace, "#widget_config" do
  let(:workspace) { create(:workspace) }

  it "exposes the full set of customization keys with sensible defaults" do
    cfg = workspace.widget_config

    expect(cfg).to include(
      layout:               anything,
      locale:               anything,
      theme_color:          anything,
      star_color:           anything,
      star_shape:           anything,
      star_icon_url:        nil,
      star_icon_empty_url:  nil,
      show_qa:              anything,
      show_write_review:    anything,
      per_page:             anything,
      custom_css:           anything,
    )
  end

  it "surfaces rating_icon_filled as star_icon_url when set" do
    url = "https://cdn.example.com/test-bucket/foo/icon.svg"
    workspace.update!(rating_icon_filled: url)

    expect(workspace.widget_config[:star_icon_url]).to eq(url)
  end

  it "leaves star_icon_url nil when the workspace has no custom icon" do
    expect(workspace.widget_config[:star_icon_url]).to be_nil
  end

  it "falls back to defaults when fields are blank" do
    workspace.update!(brand_color: nil)
    cfg = workspace.widget_config
    expect(cfg[:theme_color]).to eq("#d4a850")
    expect(cfg[:star_color]).to  eq(workspace.widget_star_color.presence || "#fbbf24")
    expect(cfg[:star_shape]).to  eq("star")
  end
end
