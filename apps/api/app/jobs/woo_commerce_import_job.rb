class WooCommerceImportJob < ApplicationJob
  queue_as :imports

  def perform(workspace_id, import_id)
    workspace = Workspace.find_by(id: workspace_id)
    return unless workspace

    set_workspace_rls(workspace_id)

    import = import_id ? workspace.imports.find_by(id: import_id) : nil
    import&.start!

    domain = workspace.woocommerce_domain
    unless domain&.woo_store_url.present?
      import&.fail!("No WooCommerce configuration found")
      return
    end

    adapter = Integrations::WooCommerceAdapter.new(
      store_url:       domain.woo_store_url,
      consumer_key:    domain.woo_consumer_key,
      consumer_secret: domain.woo_consumer_secret
    )

    ok_count    = 0
    error_count = 0
    total       = 0

    adapter.all_reviews do |batch|
      total += batch.length

      batch.each do |woo_review|
        import_review(workspace, woo_review)
        ok_count += 1
      rescue => e
        error_count += 1
        import&.append_log("warn", "Review #{woo_review["id"]}: #{e.message}")
      end
    end

    import&.finish!(ok: ok_count, errors: error_count)
    Rails.logger.info("WooCommerceImportJob: imported #{ok_count}/#{total} reviews for workspace #{workspace_id}")
  rescue => e
    import&.fail!(e.message)
    Rails.logger.error("WooCommerceImportJob failed: #{e.message}")
    raise
  end

  private

  def import_review(workspace, woo_review)
    # Find associated product
    product = workspace.products.find_by(
      platform: "woocommerce",
      platform_product_id: woo_review["product_id"].to_s
    )

    review = workspace.reviews.find_or_initialize_by(
      source: "woo",
      external_id: woo_review["id"].to_s
    )

    return if review.persisted? && review.status != "pending"

    review.assign_attributes(
      product:             product,
      rating:              woo_review["rating"].to_i,
      title:               nil,
      body:                woo_review["review"]&.gsub(/<\/?[^>]*>/, "")&.strip,
      author_name:         woo_review["reviewer"],
      author_email:        woo_review["reviewer_email"]&.downcase,
      is_verified_purchase: woo_review["verified"],
      status:              "pending",
      imported_at:         Time.current
    )

    review.save!
    AiModerateJob.perform_later(review.id) if ENV["ANTHROPIC_API_KEY"].present? && ENV["ANTHROPIC_API_KEY"] != "SET_ME_LATER"
  end
end
