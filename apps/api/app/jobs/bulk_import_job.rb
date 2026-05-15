class BulkImportJob < ApplicationJob
  queue_as :imports

  def perform(import_id, reviews_data)
    import = Import.find_by(id: import_id)
    return unless import

    set_workspace_rls(import.workspace_id)
    import.start!

    workspace   = import.workspace
    ok_count    = 0
    error_count = 0

    reviews_data.each do |data|
      data = data.with_indifferent_access

      review = workspace.reviews.new(
        rating:              data[:rating].to_i,
        title:               data[:title],
        body:                data[:body],
        author_name:         data[:author_name],
        author_email:        data[:author_email]&.downcase,
        author_country:      data[:author_country],
        source:              data[:source] || "api",
        status:              "pending",
        is_verified_purchase: data[:is_verified_purchase] || false,
        language:            data[:language] || workspace.default_locale,
        imported_at:         Time.current
      )

      if data[:product_id].present?
        review.product_id = data[:product_id]
      elsif data[:product_handle].present?
        review.product = workspace.products.find_by(handle: data[:product_handle])
      end

      review.save!
      ok_count += 1
      AiModerateJob.perform_later(review.id)
    rescue => e
      error_count += 1
      import.append_log("warn", "Row error: #{e.message}")
    end

    import.update_column(:total_rows, reviews_data.length)
    import.finish!(ok: ok_count, errors: error_count)
  rescue => e
    Import.find_by(id: import_id)&.fail!(e.message)
    raise
  end
end
