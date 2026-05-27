require "rails_helper"
require "json_schemer"
require "json"

# Cross-stack contract test: the JSON shape returned by
# `Workspace#widget_config` MUST match the canonical schema at
# packages/shared/widget-config.schema.json. The matching TS contract
# test (apps/widget/test/widget-config.contract.spec.ts) imports the
# same schema and validates a sample object built from the WidgetConfig
# interface, so any rename / removal / type change on either side
# trips the schema and fails CI.
RSpec.describe "Contract · Workspace#widget_config matches the shared JSON schema" do
  let(:schema_path) do
    Rails.root.join("../../packages/shared/widget-config.schema.json")
  end

  let(:schemer) do
    JSONSchemer.schema(JSON.parse(File.read(schema_path)))
  end

  it "the schema file is present and parseable" do
    expect(schema_path).to exist
    expect { schemer }.not_to raise_error
  end

  it "a default workspace serialises to a payload that validates" do
    ws = create(:workspace)

    payload = ws.widget_config.deep_stringify_keys
    errors = schemer.validate(payload).to_a

    expect(errors).to be_empty, <<~MSG
      widget_config failed schema validation:
      #{errors.map { |e| "  • #{e['data_pointer']}: #{e['error']}" }.join("\n")}
      Payload was:
      #{JSON.pretty_generate(payload)}
    MSG
  end

  it "a workspace with a custom brand icon validates (star_icon_url is a string)" do
    ws = create(:workspace, rating_icon_filled: "https://cdn.example.com/test-bucket/foo.svg")

    payload = ws.widget_config.deep_stringify_keys
    errors = schemer.validate(payload).to_a

    expect(errors).to be_empty
    expect(payload["star_icon_url"]).to be_a(String)
  end

  it "fails the schema when a required key is missing (sanity check)" do
    bad = create(:workspace).widget_config.deep_stringify_keys.except("layout")
    expect(schemer.valid?(bad)).to be(false)
  end
end
