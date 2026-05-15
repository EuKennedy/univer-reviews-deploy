module Api
  module V1
    class CatalogHealthController < ApplicationController
      # GET /api/v1/catalog-health
      def index
        ws = current_workspace

        total_products   = ws.products.count
        active_products  = ws.products.active.count
        products_with_reviews = ws.products
                                  .joins(:reviews)
                                  .where(reviews: { status: "approved" })
                                  .distinct.count

        products_no_reviews = active_products - products_with_reviews
        stale_products = ws.products.active.where("last_synced_at < ? OR last_synced_at IS NULL", 24.hours.ago).count

        # Rating health
        avg_rating = ws.reviews.where(status: "approved").average(:rating)&.round(2) || 0.0
        low_rated  = ws.products.joins(:reviews).where(reviews: { status: "approved" })
                       .group("products.id, products.title")
                       .having("AVG(reviews.rating) < 3.0")
                       .count.length

        render json: {
          data: {
            total_products: total_products,
            active_products: active_products,
            products_with_reviews: products_with_reviews,
            products_no_reviews: products_no_reviews,
            stale_products: stale_products,
            avg_rating: avg_rating,
            low_rated_products: low_rated,
            health_score: calculate_health_score(active_products, products_with_reviews, avg_rating)
          }
        }
      end

      # GET /api/v1/catalog-health/by-product
      def by_product
        scope = current_workspace.products.active

        products = scope.select("products.*, COUNT(DISTINCT reviews.id) as reviews_count, AVG(reviews.rating) as avg_rating")
                        .left_joins(:reviews)
                        .where("reviews.status = 'approved' OR reviews.id IS NULL")
                        .group("products.id")
                        .order("reviews_count ASC")

        pagy, rows = paginate(products)

        render json: {
          data: rows.map { |p|
            {
              id: p.id, title: p.title, handle: p.handle,
              image_url: p.image_url,
              reviews_count: p.reviews_count.to_i,
              avg_rating: p.avg_rating ? p.avg_rating.to_f.round(2) : nil,
              last_synced_at: p.last_synced_at&.iso8601,
              health: p.reviews_count.to_i.zero? ? "no_reviews" :
                      p.avg_rating.to_f < 3.0 ? "low_rated" : "ok"
            }
          },
          meta: pagination_meta(pagy)
        }
      end

      private

      def calculate_health_score(active, with_reviews, avg_rating)
        return 0 if active.zero?

        coverage_score = [(with_reviews.to_f / active * 50).round, 50].min
        rating_score   = [(avg_rating / 5.0 * 50).round, 50].min
        coverage_score + rating_score
      end
    end
  end
end
