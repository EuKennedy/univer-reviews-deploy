module Ai
  class BaseService
    SONNET = "claude-sonnet-4-6"
    HAIKU  = "claude-haiku-4-5-20251001"

    # Cost per 1M tokens (USD)
    COST = {
      SONNET => { input: 3.0,  output: 15.0 },
      HAIKU  => { input: 0.80, output: 4.0  }
    }.freeze

    def initialize(workspace)
      @workspace = workspace
      @client    = Anthropic::Client.new(api_key: ENV.fetch("ANTHROPIC_API_KEY"))
    end

    private

    def call_claude(model:, system:, messages:, max_tokens: 1024, review_id: nil)
      started_at = Time.current

      response = @client.messages(
        model: model,
        max_tokens: max_tokens,
        system: system,
        messages: messages
      )

      duration_ms = ((Time.current - started_at) * 1000).to_i
      text = response.content.first.text

      log_job(
        model: model,
        input_tokens:  response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        duration_ms: duration_ms,
        review_id: review_id,
        result: { content: text }
      )

      text
    rescue => e
      log_job(model: model, status: "failed", error: e.message, duration_ms: 0)
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
      # Strip markdown code fences if present
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
