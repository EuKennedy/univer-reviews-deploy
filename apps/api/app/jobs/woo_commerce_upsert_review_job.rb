class WooCommerceUpsertReviewJob < ApplicationJob
  queue_as :imports

  def perform(workspace_id, review_data)
    workspace = Workspace.find_by(id: workspace_id)
    return unless workspace

    set_workspace_rls(workspace_id)

    product = workspace.products.find_by(
      platform: "woocommerce",
      platform_product_id: review_data["product_id"].to_s
    )

    review = workspace.reviews.find_or_initialize_by(
      source: "woo",
      external_id: review_data["id"].to_s
    )

    review.assign_attributes(
      product:             product,
      rating:              review_data["rating"].to_i,
      body:                review_data["review"]&.gsub(/<\/?[^>]*>/, ""),
      author_name:         review_data["reviewer"],
      author_email:        review_data["reviewer_email"]&.downcase,
      is_verified_purchase: review_data["verified"],
      status:              review.new_record? ? "pending" : review.status,
      imported_at:         Time.current
    )

    review.save!
    AiModerateJob.perform_later(review.id) if review.previously_new_record?
  end
end
