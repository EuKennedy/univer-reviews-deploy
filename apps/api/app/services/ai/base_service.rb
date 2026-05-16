module Ai
  class BaseService
    SONNET = "claude-sonnet-4-6".freeze
    HAIKU  = "claude-haiku-4-5-20251001".freeze

    API_URL = "https://api.anthropic.com/v1/messages".freeze
    API_VERSION = "2023-06-01".freeze

    COST = {
      SONNET => { input: 3.0,  output: 15.0 },
      HAIKU  => { input: 0.80, output: 4.0  }
    }.freeze

    class MissingApiKeyError < StandardError; end

    def initialize(workspace)
      @workspace = workspace
      @api_key = ENV["ANTHROPIC_API_KEY"]
      if @api_key.blank? || @api_key == "SET_ME_LATER"
        raise MissingApiKeyError, "ANTHROPIC_API_KEY not configured"
      end
    end

    private

    def http_client
      @http_client ||= Faraday.new(url: API_URL) do |f|
        f.request :json
        f.response :json
        f.response :raise_error
        f.request :retry, max: 2, interval: 0.5, backoff_factor: 2
        f.options.timeout = 60
        f.options.open_timeout = 10
      end
    end

    def call_claude(model:, system:, messages:, max_tokens: 1024, review_id: nil)
      started_at = Time.current

      response = http_client.post do |req|
        req.headers["x-api-key"] = @api_key
        req.headers["anthropic-version"] = API_VERSION
        req.headers["content-type"] = "application/json"
        req.body = {
          model: model,
          max_tokens: max_tokens,
          system: system,
          messages: messages
        }
      end

      body = response.body
      duration_ms = ((Time.current - started_at) * 1000).to_i
      text = body.dig("content", 0, "text") || ""
      usage = body["usage"] || {}

      log_job(
        model: model,
        input_tokens:  usage["input_tokens"].to_i,
        output_tokens: usage["output_tokens"].to_i,
        duration_ms: duration_ms,
        review_id: review_id,
        result: { content: text }
      )

      text
    rescue Faraday::Error => e
      Rails.logger.error("Anthropic API error: #{e.message}")
      log_job(model: model, status: "failed", error: e.message, duration_ms: 0, review_id: review_id)
      raise
    end

    def log_job(model:, input_tokens: 0, output_tokens: 0, duration_ms:,
                result: nil, status: "done", error: nil, review_id: nil)
      cost = calculate_cost(model, input_tokens, output_tokens)

      AiJob.create!(
        workspace:        @workspace,
        job_type:         self.class::JOB_TYPE,
        model:            model,
        input_tokens:     input_tokens,
        output_tokens:    output_tokens,
        cost_usd:         cost,
        target_review_id: review_id,
        status:           status,
        result:           result,
        error:            error,
        duration_ms:      duration_ms,
        finished_at:      Time.current
      )
    rescue => e
      Rails.logger.error("Failed to log AI job: #{e.message}")
    end

    def calculate_cost(model, input_tokens, output_tokens)
      rates = COST[model] || { input: 0, output: 0 }
      ((input_tokens * rates[:input] + output_tokens * rates[:output]) / 1_000_000.0).round(8)
    end

    def parse_json_response(text)
      clean = text.gsub(/```(?:json)?\n?/, "").strip
      JSON.parse(clean, symbolize_names: true)
    rescue JSON::ParserError => e
      Rails.logger.error("AI JSON parse error: #{e.message}\nRaw: #{text}")
      {}
    end

    def workspace_voice_context
      return "" unless @workspace.brand_voice_md.present?
      "\n\n## Brand Voice Guidelines\n#{@workspace.brand_voice_md}"
    end
  end
end
