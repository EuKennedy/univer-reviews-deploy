require "csv"

# Exports a workspace's reviews to CSV using the same filter shape as
# Api::V1::ReviewsController#index. Streams the rows into a single CSV string
# (capped at MAX_ROWS = 50_000 so an unfiltered export can't DoS the API).
#
# Filters accepted (all optional, AND-combined):
#
#   status   — "pending" | "approved" | "rejected" | "hidden" | "spam"
#   rating   — 1..5 (integer-coerced)
#   source   — Review::SOURCES member
#   q        — substring match against body / title / author_name (ILIKE)
#   from     — ISO8601 lower bound for created_at
#   to       — ISO8601 upper bound for created_at
#
# Columns emitted (in order):
#
#   id, rating, title, body, author_name, author_email, status, source,
#   is_verified_purchase, product_handle, product_title, helpful_count,
#   created_at, approved_at
#
# `body` has CR/LF stripped so each review remains exactly one CSV row when
# loaded into Excel / Google Sheets. The CSV library handles commas, quotes
# and embedded delimiters via standard RFC 4180 escaping.
class ReviewCsvExporter
  MAX_ROWS = 50_000

  HEADERS = %w[
    id
    rating
    title
    body
    author_name
    author_email
    status
    source
    is_verified_purchase
    product_handle
    product_title
    helpful_count
    created_at
    approved_at
  ].freeze

  def initialize(workspace)
    @workspace = workspace
  end

  def to_csv(params = {})
    scope = filtered_scope(params).includes(:product).limit(MAX_ROWS)

    CSV.generate do |csv|
      csv << HEADERS
      scope.find_each(batch_size: 1_000) do |review|
        csv << row_for(review)
      end
    end
  end

  private

  def filtered_scope(params)
    scope = @workspace.reviews

    scope = scope.where(status: params[:status])      if params[:status].present?
    scope = scope.where(rating: params[:rating].to_i) if params[:rating].present?
    scope = scope.where(source: params[:source])      if params[:source].present?

    if params[:q].present?
      q = "%#{params[:q]}%"
      scope = scope.where("body ILIKE ? OR author_name ILIKE ? OR title ILIKE ?", q, q, q)
    end

    if params[:from].present?
      begin
        scope = scope.where("created_at >= ?", Time.zone.parse(params[:from].to_s))
      rescue ArgumentError, TypeError
        # Ignore unparseable bounds — caller gets the full range.
      end
    end

    if params[:to].present?
      begin
        scope = scope.where("created_at <= ?", Time.zone.parse(params[:to].to_s))
      rescue ArgumentError, TypeError
        # Ignore unparseable bounds.
      end
    end

    scope.order(created_at: :desc)
  end

  def row_for(review)
    [
      review.id,
      review.rating,
      review.title,
      strip_newlines(review.body),
      review.author_name,
      review.author_email,
      review.status,
      review.source,
      review.is_verified_purchase ? "true" : "false",
      review.product&.handle,
      review.product&.title,
      review.helpful_count,
      review.created_at&.iso8601,
      review.approved_at&.iso8601
    ]
  end

  def strip_newlines(text)
    return nil if text.nil?
    text.to_s.gsub(/\r\n|\r|\n/, " ").squeeze(" ").strip
  end
end
