class BulkImportJob < ApplicationJob
  queue_as :imports

  BATCH_SIZE = 200

  def perform(import_id, reviews_data)
    import = Import.find_by(id: import_id)
    return unless import

    workspace_id = import.workspace_id
    with_workspace_rls(workspace_id) { import.start! }

    workspace   = import.workspace
    ok_count    = 0
    error_count = 0
    has_ai      = ENV["ANTHROPIC_API_KEY"].present? && ENV["ANTHROPIC_API_KEY"] != "SET_ME_LATER"

    # Process in batches so RLS scope stays active across each insert without
    # holding a single huge transaction open for 16k rows.
    reviews_data.each_slice(BATCH_SIZE) do |batch|
      with_workspace_rls(workspace_id) do
        batch.each do |raw|
          begin
            data = raw.is_a?(Hash) ? raw.with_indifferent_access : raw.to_h.with_indifferent_access

            review = workspace.reviews.new(
              rating:              data[:rating].to_i,
              title:               data[:title],
              body:                data[:body].to_s,
              author_name:         data[:author_name].presence || "Anônimo",
              author_email:        data[:author_email]&.downcase,
              author_country:      data[:author_country],
              source:              data[:source] || "api",
              status:              valid_status(data[:status]),
              is_verified_purchase: data[:is_verified_purchase] || false,
              is_featured:         data[:is_featured] || false,
              language:            data[:language] || workspace.default_locale,
              external_id:         data[:external_id],
              imported_at:         Time.current
            )
            if data[:created_at].present?
              parsed = parse_time(data[:created_at])
              review.created_at = parsed if parsed
            end
            if data[:product_id].present?
              review.product_id = data[:product_id]
            elsif data[:product_handle].present?
              review.product = workspace.products.find_by(handle: data[:product_handle])
            end

            review.save!
            ok_count += 1
            # Only burn AI tokens on rows that arrive unmoderated.
            AiModerateJob.perform_later(review.id) if has_ai && review.status == "pending"
          rescue => e
            error_count += 1
            import.append_log("warn", "Row error: #{e.message}")
          end
        end
      end
    end

    with_workspace_rls(workspace_id) do
      import.update_column(:total_rows, reviews_data.length)
      import.finish!(ok: ok_count, errors: error_count)
    end
  rescue => e
    Import.find_by(id: import_id)&.fail!(e.message)
    raise
  end

  private

  def valid_status(s)
    %w[pending approved rejected hidden spam].include?(s.to_s) ? s.to_s : "pending"
  end

  def parse_time(v)
    return v if v.is_a?(Time) || v.is_a?(ActiveSupport::TimeWithZone)
    Time.zone.parse(v.to_s)
  rescue
    nil
  end
end
