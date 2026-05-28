module Api
  module V1
    class AiController < ApplicationController
      # GET /api/v1/ai/health
      # No-auth-needed check that ANTHROPIC_API_KEY is present and not the
      # placeholder. Returned as { configured, reason, models } so the admin
      # can render a banner before users hit a 422 on the first action.
      def health
        key = ENV["ANTHROPIC_API_KEY"].to_s
        configured =
          if key.blank?              then [false, "missing"]
          elsif key == "SET_ME_LATER" then [false, "placeholder"]
          else                              [true,  "ok"]
          end

        render json: {
          data: {
            configured: configured[0],
            reason:     configured[1],
            models: {
              sonnet: Ai::BaseService::SONNET,
              haiku:  Ai::BaseService::HAIKU
            }
          }
        }
      end

      # GET /api/v1/ai/cost-report?days=30
      #
      # Per-workspace AI consumption: total cost (USD) + per-day series
      # for chart + per-job-type breakdown. Powers the AI Lab "consumo"
      # panel and the dashboard cost gauge. No PlanFeatures gate — every
      # workspace can see its own usage regardless of plan.
      def cost_report
        days = (params[:days] || 30).to_i.clamp(1, 365)
        cutoff = days.days.ago.beginning_of_day

        scope = current_workspace.ai_jobs.where("created_at >= ?", cutoff)

        total_cost   = scope.sum(:cost_usd).to_f.round(6)
        total_jobs   = scope.count
        total_tokens = scope.sum("COALESCE(input_tokens,0) + COALESCE(output_tokens,0)").to_i
        failed_count = scope.where(status: "failed").count

        daily = scope
          .group("DATE(created_at)")
          .order("DATE(created_at)")
          .pluck(Arel.sql("DATE(created_at)"),
                 Arel.sql("COALESCE(SUM(cost_usd), 0)"),
                 Arel.sql("COUNT(*)"))
          .map { |date, cost, jobs| { date: date.to_s, cost_usd: cost.to_f.round(6), jobs: jobs.to_i } }

        by_type = scope
          .group(:job_type)
          .order(Arel.sql("SUM(cost_usd) DESC NULLS LAST"))
          .pluck(:job_type,
                 Arel.sql("COALESCE(SUM(cost_usd), 0)"),
                 Arel.sql("COUNT(*)"))
          .map { |job_type, cost, jobs| { job_type: job_type, cost_usd: cost.to_f.round(6), jobs: jobs.to_i } }

        # Soft monthly cap per plan — wires the UI gauge. T4 enforces.
        plan_cap = case current_workspace.plan
                   when "free"       then 0.50
                   when "starter"    then 5.00
                   when "pro"        then 50.00
                   when "enterprise" then nil
                   end

        month_start = Time.current.beginning_of_month
        month_cost  = current_workspace.ai_jobs
                                       .where("created_at >= ?", month_start)
                                       .sum(:cost_usd).to_f.round(6)

        render json: {
          data: {
            window_days:  days,
            total_cost:   total_cost,
            total_jobs:   total_jobs,
            total_tokens: total_tokens,
            failed_count: failed_count,
            month_cost:   month_cost,
            plan_cap_monthly_usd: plan_cap,
            daily:        daily,
            by_type:      by_type,
          },
        }
      end

      # POST /api/v1/ai/moderate
      def moderate
        require_write!

        review_id = params.require(:review_id)
        review = current_workspace.reviews.find(review_id)

        raw = Ai::ModerateService.new(current_workspace).call(review)

        # Normalise the shape so the admin doesn't have to know about the
        # internal Claude JSON. `suggestion` from the prompt is exposed as
        # `recommendation`; `flagged_reason` becomes a single-element array
        # when present, matching the React typings.
        result = {
          review_id:            review.id,
          quality_score:        raw[:quality_score].to_i,
          sentiment:            raw[:sentiment].to_s,
          topics:               Array(raw[:topics]),
          is_synthetic:         raw[:is_synthetic] ? true : false,
          synthetic_confidence: raw[:is_synthetic] ? 0.9 : 0.0,
          moderation_flags:     raw[:flagged_reason].present? ? [raw[:flagged_reason]] : [],
          recommendation:       raw[:suggestion].to_s.presence || "review",
          reason:               raw[:reason]
        }

        render json: { data: result }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/generate
      def generate
        require_write!

        product_id  = params[:product_id]
        template    = params.require(:template)
        count       = (params[:count] || 3).to_i.clamp(1, 10)

        product = product_id ? current_workspace.products.find(product_id) : nil
        result  = Ai::GenerateService.new(current_workspace).call(template: template, product: product, count: count)

        render json: { data: result }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/bulk-create-reviews
      # Body: {
      #   product_id, count (1..50), language?, tone?,
      #   rating_min? (1..5), rating_max? (1..5),
      #   status? (pending|approved), date_spread_days? (0..365)
      # }
      #
      # Generates `count` AI reviews for the product and PERSISTS them. Each
      # row gets source="manual", ai_is_synthetic=true, and metadata.ai_generated=true
      # so the audit trail makes the origin obvious. Returns the created
      # reviews so the UI can preview/edit immediately.
      def bulk_create_reviews
        require_write!
        require_feature!(:ai_bulk_generate_reviews)

        product_id = params.require(:product_id)
        product    = current_workspace.products.find(product_id)
        # Per-request cap stays at 50 to keep latency predictable. The
        # admin client chunks larger jobs (10 per call) and aggregates,
        # which surfaces real progress instead of one long opaque wait.
        count      = (params[:count] || 5).to_i.clamp(1, 50)
        target_status = %w[pending approved].include?(params[:status]) ? params[:status] : "approved"
        spread_days   = (params[:date_spread_days] || 30).to_i.clamp(0, 365)
        tone          = params[:tone].to_s.presence || "positive, authentic, varied"
        language      = params[:language].to_s.presence || current_workspace.default_locale

        template = "Avaliação em #{language}. Tom: #{tone}. Produto: #{product.title}."

        # GenerateService internally chunks the Claude calls so the model
        # never has to emit > CHUNK_SIZE variants in a single response.
        # That alone resolves the "Expected array of variants" crash that
        # used to fire on large batches when the model hit max_tokens and
        # truncated mid-array.
        generated = Ai::GenerateService.new(current_workspace).call(
          template: template,
          product:  product,
          count:    count
        )

        if generated.empty?
          render json: {
            error: "ai_empty",
            message: "Claude não retornou variantes válidas. Tente novamente em alguns segundos.",
          }, status: :bad_gateway
          return
        end

        created = []
        ActiveRecord::Base.transaction do
          ActiveRecord::Base.connection.execute(
            ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", current_workspace.id.to_s])
          )

          generated.each_with_index do |v, idx|
            # Spread the created_at across the requested window so the AI batch
            # doesn't show up as 50 reviews on the same minute.
            backdate = Time.current - rand(0..spread_days).days - rand(0..23).hours - rand(0..59).minutes
            review = current_workspace.reviews.create!(
              product:        product,
              rating:         (v[:rating] || 5).to_i.clamp(1, 5),
              title:          v[:title].to_s[0, 200],
              body:           v[:body].to_s[0, 4_000],
              author_name:    fake_author_name(idx),
              source:         "manual",
              status:         target_status,
              language:       language,
              ai_is_synthetic: true,
              metadata:       { ai_generated: true, tone: tone, generated_at: Time.current.iso8601 },
              created_at:     backdate,
              updated_at:     backdate,
              approved_at:    target_status == "approved" ? backdate : nil
            )
            created << review
          end
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "ai.bulk_created_reviews",
          metadata: { product_id: product.id, count: created.length, status: target_status }
        )

        render json: {
          data: created.map { |r|
            {
              id: r.id, rating: r.rating, title: r.title, body: r.body,
              author_name: r.author_name, status: r.status,
              created_at: r.created_at&.iso8601
            }
          },
          meta: { created: created.length, requested: count, product_id: product.id }
        }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
      rescue ActiveRecord::RecordNotFound => e
        render json: { error: "not_found", message: e.message }, status: :not_found
      rescue => e
        Rails.logger.error("[ai.bulk_create_reviews] #{e.class}: #{e.message}")
        Sentry.capture_exception(e) if defined?(Sentry)
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/bulk-create-questions-all
      # Body: {
      #   count_per_product (1..30, default 10),
      #   status? (pending|published, default published),
      #   language? (default workspace.default_locale)
      # }
      #
      # Fans out BulkGenerateQaJob for every active product in the workspace.
      # Each job fetches WC product details (description, attributes, etc.)
      # and feeds them to Claude so the Q&A is anchored in real product data.
      # Returns immediately with the job count — generation runs in Sidekiq.
      def bulk_create_questions_all
        require_write!

        count    = (params[:count_per_product] || 10).to_i.clamp(1, 30)
        status   = %w[pending published].include?(params[:status]) ? params[:status] : "published"
        language = params[:language].to_s.presence || current_workspace.default_locale

        product_ids = current_workspace.products.where(active: true).pluck(:id)

        product_ids.each do |pid|
          BulkGenerateQaJob.perform_later(
            current_workspace.id,
            pid,
            count: count,
            status: status,
            language: language
          )
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "ai.bulk_create_questions_all_dispatched",
          metadata: { products: product_ids.length, count_per_product: count, status: status }
        )

        render json: {
          message: "Bulk Q&A generation queued for #{product_ids.length} products (#{count} pairs each).",
          meta: {
            products_queued: product_ids.length,
            count_per_product: count,
            total_pairs_expected: product_ids.length * count,
            status: status
          }
        }
      end

      # POST /api/v1/ai/bulk-create-questions
      # Body: { product_id, count (1..30), language?, status? (pending|published) }
      #
      # Generates plausible product questions + answers via Claude and persists
      # them as Question rows. answered_at + answer present so they show up
      # in the storefront Q&A panel immediately.
      def bulk_create_questions
        require_write!
        require_feature!(:ai_bulk_generate_qa)

        product_id = params.require(:product_id)
        product    = current_workspace.products.find(product_id)
        count      = (params[:count] || 5).to_i.clamp(1, 30)
        target_status = %w[pending published].include?(params[:status]) ? params[:status] : "published"
        language   = params[:language].to_s.presence || current_workspace.default_locale

        pairs = Ai::GenerateService.new(current_workspace).generate_qa_pairs(
          product:  product,
          count:    count,
          language: language
        )

        created = []
        ActiveRecord::Base.transaction do
          ActiveRecord::Base.connection.execute(
            ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", current_workspace.id.to_s])
          )

          pairs.each_with_index do |qa, idx|
            q = current_workspace.questions.create!(
              product:        product,
              author_name:    fake_author_name(idx),
              body:           qa[:question].to_s[0, 1_000],
              answer:         qa[:answer].to_s[0, 5_000],
              status:         target_status,
              answered_at:    target_status == "published" ? Time.current : nil
            )
            created << q
          end
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "ai.bulk_created_questions",
          metadata: { product_id: product.id, count: created.length }
        )

        render json: {
          data: created.map { |q|
            { id: q.id, body: q.body, answer: q.answer, author_name: q.author_name, status: q.status }
          },
          meta: { created: created.length, requested: count, product_id: product.id }
        }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
      rescue ActiveRecord::RecordNotFound => e
        render json: { error: "not_found", message: e.message }, status: :not_found
      rescue => e
        Rails.logger.error("[ai.bulk_create_questions] #{e.class}: #{e.message}")
        Sentry.capture_exception(e) if defined?(Sentry)
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/generate-variants
      def generate_variants
        require_write!

        review_id = params.require(:review_id)
        count     = (params[:count] || 3).to_i.clamp(1, 10)
        review    = current_workspace.reviews.find(review_id)

        result = Ai::GenerateService.new(current_workspace).call(
          template: review.body.to_s,
          product: review.product,
          count: count
        )

        render json: { data: result }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/reply
      def reply
        require_write!

        review_id = params.require(:review_id)
        review    = current_workspace.reviews.find(review_id)

        result = Ai::ReplyService.new(current_workspace).call(review)

        render json: { data: { reply: result[:reply] } }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/auto-reply
      def auto_reply
        require_write!

        review_id = params.require(:review_id)
        review    = current_workspace.reviews.find(review_id)

        result = Ai::ReplyService.new(current_workspace).call(review)

        # Persist as a reply
        reply = review.replies.create!(
          workspace: current_workspace,
          body: result[:reply],
          author_name: current_workspace.name,
          is_ai_generated: true,
          is_published: true
        )

        # `reply` is the canonical field — admins read result.reply for both
        # /ai/reply (preview only) and /ai/auto-reply (persisted). reply_id
        # surfaces for callers that want to navigate to it.
        render json: { data: { reply: reply.body, reply_id: reply.id } }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/ai/duplicates
      def duplicates
        clusters = current_workspace.reviews
                                    .where.not(ai_dup_cluster_id: nil)
                                    .group(:ai_dup_cluster_id)
                                    .count
                                    .sort_by { |_, v| -v }
                                    .first(20)

        render json: {
          data: clusters.map { |cluster_id, count| { cluster_id: cluster_id, count: count } }
        }
      end

      # GET /api/v1/ai/duplicate-clusters
      def duplicate_clusters
        pagy, clusters = paginate(
          current_workspace.reviews
                           .select("ai_dup_cluster_id, COUNT(*) as cluster_count, MIN(created_at) as earliest_at")
                           .where.not(ai_dup_cluster_id: nil)
                           .group(:ai_dup_cluster_id)
                           .order("cluster_count DESC")
        )

        render json: {
          data: clusters.map { |c|
            {
              cluster_id: c.ai_dup_cluster_id,
              count: c.cluster_count,
              earliest_at: c.earliest_at&.iso8601
            }
          },
          meta: pagination_meta(pagy)
        }
      end

      # POST /api/v1/ai/dedup
      def dedup
        require_write!
        require_feature!(:ai_dedup)

        review_id = params.require(:review_id)
        review = current_workspace.reviews.find(review_id)

        AiDedupJob.perform_later(review.id)

        render json: { message: "Dedup job queued", review_id: review.id }
      end

      # POST /api/v1/ai/generate-summary-topics
      # Body: { product_id, mode? ("replace"|"append"), async? }
      #
      # mode=replace (default) wipes source=ai topics and seeds ONE new one.
      # mode=append adds ONE more topic on top of existing ai topics, telling
      # Claude which titles are already taken so it doesn't duplicate.
      #
      # Hard cap: MAX_AI_TOPICS_PER_PRODUCT (5) AI topics per product. The
      # controller returns 409 when an append would exceed the cap so the
      # frontend can render "Limite de 5 sumários atingido" instead of
      # eating a silent no-op.
      #
      # Runs INLINE by default (~15-20 s response time but the merchant sees
      # results immediately, which is the right UX for a single-product
      # action). Pass `async=true` to fall back to Sidekiq enqueue.
      def generate_summary_topics
        require_write!
        require_feature!(:ai_summary_topics)
        product = current_workspace.products.find(params.require(:product_id))

        # Pre-flight ANTHROPIC_API_KEY check. The job-level rescue swallows
        # the same error (correct behaviour for async Sidekiq retries), so
        # without this guard the merchant would get a 200 with no topics
        # and never learn the API key is missing.
        key = ENV["ANTHROPIC_API_KEY"].to_s
        if key.blank? || key == "SET_ME_LATER"
          render json: {
            error:   "missing_api_key",
            message: "ANTHROPIC_API_KEY not configured",
          }, status: :service_unavailable
          return
        end

        mode = params[:mode].to_s == "append" ? :append : :replace

        if mode == :append
          existing = product.ai_summary_topics.where(source: "ai").count
          if existing >= AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT
            render json: {
              error:   "limit_reached",
              message: "Limite de #{AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT} sumários de IA por produto atingido.",
              limit:   AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT,
              current: existing,
            }, status: :conflict
            return
          end
        end

        if ActiveModel::Type::Boolean.new.cast(params[:async])
          AiGenerateSummaryTopicsJob.perform_later(product.id, mode: mode)
          render json: { message: "Summary topic extraction queued", product_id: product.id, mode: mode }
          return
        end

        # Pre-flight: count reviews with body length >= 40 (the floor
        # `Ai::SummaryTopicsService#pick_reviews` filters by). If zero,
        # Claude would just return [] and the merchant would see a misleading
        # "Sumário gerado" toast with nothing on screen — same path that
        # confused merchants on products like "Kit Blindagem Capilar
        # (home care)" where every review had body="".
        eligible = current_workspace.reviews
                                    .where(product_id: product.id, status: "approved")
                                    .where("LENGTH(body) >= ?", 40)
                                    .count

        before_count = product.ai_summary_topics.where(source: "ai").count

        begin
          AiGenerateSummaryTopicsJob.new.perform(product.id, mode: mode)
        rescue Ai::BaseService::MissingApiKeyError => e
          # Defense-in-depth: should never fire after the pre-flight check
          # above, but keeps the contract intact if BaseService starts
          # raising for other reasons (e.g. revoked key mid-flight).
          render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
          return
        end

        topics = current_workspace.ai_summary_topics
                                  .where(product_id: product.id)
                                  .ordered
                                  .includes(:reviews)

        ai_count_after = topics.count { |t| t.source == "ai" }
        added = ai_count_after - before_count

        # Distinguish "Claude returned 0" from "produto sem reviews válidos".
        # Frontend uses `reason` to swap the toast from generic-success to
        # a clear "produto sem material" warning.
        no_op_reason =
          if added <= 0
            if eligible.zero?
              "no_eligible_reviews"
            else
              "ai_returned_empty"
            end
          end

        render json: {
          message: "Summary topics generated",
          product_id: product.id,
          mode: mode,
          count: topics.length,
          ai_count: ai_count_after,
          ai_added: [added, 0].max,
          ai_limit: AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT,
          eligible_reviews: eligible,
          reason: no_op_reason,
          data: topics.map { |t| {
            id: t.id, title: t.title, source: t.source,
            review_count: t.review_count, stars_avg: t.stars_avg,
            ai_summary: t.ai_summary, generated_at: t.generated_at&.iso8601,
            position: t.position,
          } },
        }
      end

      # POST /api/v1/ai/generate-summary-topics-bulk
      # Body: { product_ids?: [...]  } (omit to enqueue for ALL products with
      # at least MIN_REVIEWS_FOR_BULK approved reviews)
      MIN_REVIEWS_FOR_BULK = 5
      def generate_summary_topics_bulk
        require_write!

        ids = Array(params[:product_ids]).compact_blank
        scope = if ids.any?
                  current_workspace.products.where(id: ids)
                else
                  # Only products with enough material to extract meaningful topics.
                  current_workspace.products
                                   .joins(:reviews)
                                   .where(reviews: { status: "approved" })
                                   .group("products.id")
                                   .having("COUNT(reviews.id) >= ?", MIN_REVIEWS_FOR_BULK)
                end

        queued_ids = scope.pluck(:id)
        queued_ids.each { |pid| AiGenerateSummaryTopicsJob.perform_later(pid) }

        render json: {
          message: "Bulk summary topic extraction queued for #{queued_ids.length} product(s).",
          queued:  queued_ids.length,
        }
      end

      # GET /api/v1/ai_summaries — index of products with summary status,
      # used by the admin /ai-summaries dashboard. Lives under /ai because
      # it crosses Product + AiSummaryTopic and the topics controller is
      # scoped to a single product.
      def summaries_index
        rows = current_workspace.products.left_outer_joins(:reviews)
                                .left_outer_joins(:ai_summary_topics)
                                .select(
                                  "products.id, products.title, products.handle, products.image_url, " \
                                  "COUNT(DISTINCT reviews.id) FILTER (WHERE reviews.status = 'approved') AS approved_count, " \
                                  "COUNT(DISTINCT ai_summary_topics.id) AS topic_count, " \
                                  "MAX(ai_summary_topics.generated_at) AS last_generated_at, " \
                                  "BOOL_OR(ai_summary_topics.source = 'ai') AS has_ai_topic"
                                )
                                .group("products.id")
                                .order("approved_count DESC")
                                .limit(500)

        render json: {
          data: rows.map { |p|
            {
              id:                p.id,
              title:             p.title,
              handle:            p.handle,
              image_url:         p.image_url,
              approved_reviews:  p.approved_count.to_i,
              topic_count:       p.topic_count.to_i,
              last_generated_at: p.last_generated_at&.iso8601,
              has_ai_topic:      !!p.has_ai_topic,
              status: topic_status(p),
            }
          }
        }
      end

      # POST /api/v1/ai/moderate-pending
      # Enqueue AiModerateJob for every review still in `pending` status in
      # the current workspace. Caps to MAX_BULK_MODERATE per call so a single
      # click can't flood Sidekiq.
      def moderate_pending
        require_write!

        cap = 500
        ids = current_workspace.reviews.where(status: "pending").limit(cap).pluck(:id)
        ids.each { |id| AiModerateJob.perform_later(id) }

        render json: {
          message: "Moderation queued for #{ids.length} pending review(s).",
          queued:  ids.length,
        }
      end

      # POST /api/v1/ai/cleanup-duplicates
      def cleanup_duplicates
        require_write!

        cluster_ids = params[:cluster_ids] || []
        AiCleanupDuplicatesJob.perform_later(
          workspace_id: current_workspace.id,
          cluster_ids: cluster_ids
        )

        render json: { message: "Cleanup job queued", clusters: cluster_ids.length }
      end

      # POST /api/v1/ai/embed
      def embed
        require_write!

        review_id = params.require(:review_id)
        review = current_workspace.reviews.find(review_id)

        AiEmbedJob.perform_later(review.id)

        render json: { message: "Embed job queued", review_id: review.id }
      end

      # POST /api/v1/ai/embed-batch
      def embed_batch
        require_write!

        review_ids = params[:review_ids] || current_workspace.reviews.where(embedding: nil).limit(100).pluck(:id)
        review_ids.each { |id| AiEmbedJob.perform_later(id) }

        render json: { message: "Batch embed queued", count: review_ids.length }
      end

      # POST /api/v1/ai/find-similar
      def find_similar
        review_id = params.require(:review_id)
        limit     = (params[:limit] || 10).to_i.clamp(1, 50)
        threshold = (params[:threshold] || 0.85).to_f

        review = current_workspace.reviews.find(review_id)

        unless review.embedding.present?
          render json: { error: "no_embedding", message: "Review has no embedding yet." }, status: :unprocessable_entity
          return
        end

        similar = review.nearest_neighbors(:embedding, distance: "cosine")
                        .where(workspace_id: current_workspace.id)
                        .where.not(id: review.id)
                        .limit(limit)

        render json: {
          data: similar.map { |r|
            {
              id: r.id,
              title: r.title,
              body: r.body&.truncate(200),
              rating: r.rating,
              status: r.status,
              neighbor_distance: r.neighbor_distance
            }
          }
        }
      end

      private

      # Status label for the ai_summaries dashboard. Reflects whether the
      # product has enough reviews to extract, has been processed, or is
      # waiting for the merchant to hit "Gerar para todos".
      def topic_status(row)
        approved = row.approved_count.to_i
        return "insufficient" if approved < MIN_REVIEWS_FOR_BULK
        return "generated"    if row.topic_count.to_i > 0
        "pending"
      end

      # Generate a plausible Brazilian first-name + surname for AI reviews.
      # Pool is large enough that 50 reviews in a batch never collide.
      FIRST_NAMES = %w[
        Ana Beatriz Carla Daniela Eduarda Fernanda Gabriela Helena Isabela
        Julia Karina Larissa Mariana Nicole Olivia Patricia Renata Sofia Vanessa Yasmin
        Bruno Carlos Daniel Eduardo Felipe Gabriel Henrique Igor Joao Leonardo
        Marcos Nicolas Otavio Pedro Rafael Samuel Thiago Vitor William
      ].freeze

      LAST_NAMES = %w[
        Silva Santos Oliveira Souza Pereira Lima Costa Almeida Ferreira Rodrigues
        Carvalho Gomes Martins Araujo Ribeiro Alves Monteiro Barbosa Cardoso Dias
        Fernandes Moraes Nascimento Pinto Reis Vieira Cunha Teixeira Mendes Castro
      ].freeze

      def fake_author_name(seed)
        first = FIRST_NAMES[(seed + rand(0..1000)) % FIRST_NAMES.length]
        last  = LAST_NAMES[(seed * 7 + rand(0..1000)) % LAST_NAMES.length]
        "#{first} #{last[0]}."
      end
    end
  end
end
