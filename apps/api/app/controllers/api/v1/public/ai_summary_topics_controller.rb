module Api
  module V1
    module Public
      # Storefront-facing endpoint for the "Sumário de IA" preset=topics.
      # Resolves product like the rest of the public endpoints (UUID OR
      # handle OR platform_product_id) and returns the topics with each
      # topic's reviews already attached, so the widget renders one fetch
      # without N+1.
      #
      # Group-aware: if the product belongs to a ProductGroup, we look up
      # topics on every member — falling back to the primary product when
      # the variation itself has no curated topics. This means a merchant
      # only needs to curate topics on the canonical SKU and the entire
      # group inherits.
      class AiSummaryTopicsController < ApplicationController
        skip_before_action :set_current_workspace
        before_action :resolve_workspace

        # GET /api/v1/public/ai-summary-topics/:product_id
        def index
          product = resolve_product(params[:product_id])
          raise ActiveRecord::RecordNotFound unless product

          topics = topics_for(product)

          render json: {
            data: topics.map { |t| serialize(t) },
            meta: {
              product_id:       product.id,
              product_group_id: product.product_group_id,
              total_topics:     topics.length,
            },
          }
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        private

        def topics_for(product)
          scope = @workspace.ai_summary_topics
                            .includes(ai_summary_topic_reviews: :review)
                            .where(product_id: product.id)
                            .order(:position)

          return scope.to_a if scope.exists?

          # Fall back to siblings in the same ProductGroup (primary first).
          if product.product_group_id.present?
            sibling = @workspace.products
                                .where(product_group_id: product.product_group_id)
                                .where.not(id: product.id)
                                .order(Arel.sql("CASE id WHEN '#{ActiveRecord::Base.connection.quote_string(product.product_group&.primary_product_id.to_s)}' THEN 0 ELSE 1 END, created_at"))
                                .pluck(:id)

            @workspace.ai_summary_topics
                      .includes(ai_summary_topic_reviews: :review)
                      .where(product_id: sibling)
                      .order(:position)
                      .to_a
                      .group_by(&:title) # dedupe titles across siblings
                      .values
                      .map(&:first)
          else
            []
          end
        end

        def serialize(topic)
          reviews = topic.ai_summary_topic_reviews
                        .sort_by { |jr| [jr.pinned ? 0 : 1, jr.position] }
                        .map(&:review)
                        .compact
                        .select { |r| r.status == "approved" }

          {
            id:           topic.id,
            title:        topic.title,
            ai_summary:   topic.ai_summary,
            review_count: topic.review_count,
            stars_avg:    topic.stars_avg,
            reviews: reviews.map { |r|
              {
                id:           r.id,
                rating:       r.rating,
                title:        r.title,
                body:         r.body,
                author_name:  r.author_name,
                created_at:   r.created_at&.iso8601,
              }
            },
          }
        end

        def resolve_product(identifier)
          ident = identifier.to_s
          return nil if ident.blank?
          if ident.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
            p = @workspace.products.find_by(id: ident)
            return p if p
          end
          p = @workspace.products.find_by(handle: ident)
          return p if p
          @workspace.products.find_by(platform_product_id: ident)
        end

        def resolve_workspace
          domain_header = request.headers["X-Univer-Domain"] ||
                          request.headers["Origin"]&.gsub(/https?:\/\//, "")&.split("/")&.first
          domain_record = WorkspaceDomain.find_by(domain: domain_header&.downcase&.strip)
          unless domain_record
            render json: { error: "workspace_not_found" }, status: :not_found
            return
          end
          @workspace = domain_record.workspace
          set_rls_workspace(@workspace.id)
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end
