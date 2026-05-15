class WooCommerceUpsertProductJob < ApplicationJob
  queue_as :imports

  def perform(workspace_id, product_data)
    workspace = Workspace.find_by(id: workspace_id)
    return unless workspace

    set_workspace_rls(workspace_id)

    product = workspace.products.find_or_initialize_by(
      platform: "woocommerce",
      platform_product_id: product_data["id"].to_s
    )

    product.assign_attributes(
      title:          product_data["name"],
      handle:         product_data["slug"],
      image_url:      product_data.dig("images", 0, "src"),
      price:          product_data["price"].to_f,
      currency:       "BRL",
      active:         product_data["status"] == "publish",
      last_synced_at: Time.current
    )

    product.save!
  end
end
