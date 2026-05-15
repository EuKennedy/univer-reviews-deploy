module RequestHelpers
  def auth_headers(api_key_record, raw_key)
    { "Authorization" => "Bearer #{raw_key}" }
  end

  def json_response
    JSON.parse(response.body, symbolize_names: true)
  end

  def set_workspace_rls(workspace_id)
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", workspace_id.to_s])
    )
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end
