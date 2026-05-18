module Api
  module V1
    class ImportController < ApplicationController
      before_action :require_write!

      # POST /api/v1/import/bulk
      def bulk
        data = parse_body_as_json
        return unless data

        reviews_data = data[:reviews] || data
        unless reviews_data.is_a?(Array)
          render json: { error: "bad_request", message: "Expected an array of reviews" }, status: :bad_request
          return
        end

        import = current_workspace.imports.create!(
          source: "api",
          total_rows: reviews_data.length
        )

        BulkImportJob.perform_later(import.id, reviews_data.map(&:to_h))
        render json: { data: { import_id: import.id, total_rows: reviews_data.length, status: "queued" } },
               status: :accepted
      end

      # POST /api/v1/import/ryviu
      # Accepts the raw Ryviu admin payload (POST /ajax/data/load-all-reviews)
      # and maps it onto our review schema. The Ryviu app does not expose a
      # bulk export, so this is how we onboard stores already on Ryviu.
      #
      # Pass ?inline=true to run the import synchronously inside the request
      # instead of enqueuing — useful when diagnosing why a queued job didn't
      # fire (Sidekiq down, queue misconfigured, etc.).
      def ryviu
        payload = parse_body_as_json
        return unless payload
        rows = payload.is_a?(Hash) ? (payload[:reviews] || payload[:reviewResults] || []) : payload
        unless rows.is_a?(Array)
          render json: { error: "bad_request", message: "Expected array of Ryviu rows" }, status: :bad_request
          return
        end

        mapped = rows.map { |r| map_ryviu_row(r.is_a?(Hash) ? r.deep_symbolize_keys : {}) }.compact

        if ActiveModel::Type::Boolean.new.cast(params[:inline])
          render json: run_inline_bulk_import(mapped)
          return
        end

        import = current_workspace.imports.create!(
          source: "ryviu",
          total_rows: mapped.length
        )
        BulkImportJob.perform_later(import.id, mapped)

        render json: { data: { import_id: import.id, total_rows: mapped.length, status: "queued" } },
               status: :accepted
      end

      # POST /api/v1/import/woocommerce
      def woocommerce
        import = current_workspace.imports.create!(source: "woocommerce")
        WooCommerceImportJob.perform_later(current_workspace.id, import.id)
        render json: { data: { import_id: import.id, status: "queued" } }, status: :accepted
      end

      # POST /api/v1/import/judge-me
      def judge_me
        file = params[:file]
        unless file.present?
          render json: { error: "bad_request", message: "file param required" }, status: :bad_request
          return
        end

        import = current_workspace.imports.create!(source: "judge_me", filename: file.original_filename)
        CsvImportJob.perform_later(import.id, file.read, format: "judge_me")
        render json: { data: { import_id: import.id, status: "queued" } }, status: :accepted
      end

      # POST /api/v1/import/yotpo
      def yotpo
        file = params[:file]
        import = current_workspace.imports.create!(source: "yotpo", filename: file&.original_filename)
        CsvImportJob.perform_later(import.id, file.read, format: "yotpo")
        render json: { data: { import_id: import.id, status: "queued" } }, status: :accepted
      end

      # POST /api/v1/import/loox
      def loox
        file = params[:file]
        import = current_workspace.imports.create!(source: "loox", filename: file&.original_filename)
        CsvImportJob.perform_later(import.id, file.read, format: "loox")
        render json: { data: { import_id: import.id, status: "queued" } }, status: :accepted
      end

      # POST /api/v1/import/stamped
      def stamped
        file = params[:file]
        import = current_workspace.imports.create!(source: "stamped", filename: file&.original_filename)
        CsvImportJob.perform_later(import.id, file.read, format: "stamped")
        render json: { data: { import_id: import.id, status: "queued" } }, status: :accepted
      end

      # POST /api/v1/import/reviews-io
      def reviews_io
        file = params[:file]
        import = current_workspace.imports.create!(source: "reviews_io", filename: file&.original_filename)
        CsvImportJob.perform_later(import.id, file.read, format: "reviews_io")
        render json: { data: { import_id: import.id, status: "queued" } }, status: :accepted
      end

      private

      # Sync version of BulkImportJob — runs in the HTTP request so the caller
      # gets the actual per-row outcome (counts + first 20 errors) instead of
      # an opaque import_id that may never get processed.
      def run_inline_bulk_import(rows)
        workspace = current_workspace
        ws_id     = workspace.id
        ok        = 0
        failed    = 0
        errors    = []
        has_ai    = ENV["ANTHROPIC_API_KEY"].present? && ENV["ANTHROPIC_API_KEY"] != "SET_ME_LATER"

        # 200-row batches, each in its own transaction so SET LOCAL RLS persists.
        rows.each_slice(200) do |batch|
          ActiveRecord::Base.transaction do
            ActiveRecord::Base.connection.execute(
              ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", ws_id.to_s])
            )
            batch.each do |raw|
              begin
                data = raw.with_indifferent_access
                review = workspace.reviews.new(
                  rating:              data[:rating].to_i,
                  title:               data[:title],
                  body:                data[:body].to_s,
                  author_name:         data[:author_name].presence || "Anônimo",
                  author_email:        data[:author_email]&.downcase,
                  author_country:      data[:author_country],
                  source:              data[:source] || "api",
                  status:              %w[pending approved rejected hidden spam].include?(data[:status].to_s) ? data[:status].to_s : "pending",
                  is_verified_purchase: data[:is_verified_purchase] || false,
                  language:            data[:language] || workspace.default_locale,
                  external_id:         data[:external_id],
                  imported_at:         Time.current
                )
                review.created_at = Time.zone.parse(data[:created_at].to_s) rescue nil if data[:created_at].present?
                if data[:product_handle].present?
                  review.product = workspace.products.find_by(handle: data[:product_handle])
                end
                review.save!
                ok += 1
                AiModerateJob.perform_later(review.id) if has_ai && review.status == "pending"
              rescue => e
                failed += 1
                errors << { external_id: data[:external_id], error: "#{e.class}: #{e.message}" } if errors.length < 20
              end
            end
          end
        end

        { ok: failed.zero?, total: rows.length, synced: ok, failed: failed, errors: errors }
      end

      def map_ryviu_row(row)
        data = row[:data] || {}
        # Ryviu stores `active` as 1=published, 0=despublished
        active = row[:active].to_i == 1
        handle = row[:handle].presence || row.dig(:productInfo, :handle)

        body_text = data[:body_text].presence || strip_html(data[:body_html])
        rating = data[:rating].to_i
        return nil if rating < 1 || rating > 5

        {
          rating: rating,
          title: data[:title].presence,
          body: body_text.to_s,
          author_name: data[:author].presence || 'Anônimo',
          author_email: data[:email].presence,
          author_country: data[:country].presence,
          source: 'ryviu_import',
          is_verified_purchase: data[:realCustomer].to_s == '1',
          language: data[:lang].presence || 'pt-BR',
          product_handle: handle,
          # Pre-set status: respect Ryviu's published flag so historical
          # reviews skip moderation if they were already vetted there.
          status: active ? 'approved' : 'pending',
          # Use Ryviu's per-review key, not data_id (which is the product). Was
          # the source of a nasty bug: dedup-by-data_id collapsed thousands of
          # unique reviews into a single row.
          external_id: "ryviu:#{row[:key] || row[:review_key] || row[:data_id]}",
          created_at: row[:created_at],
        }
      end

      def strip_html(s)
        return '' if s.blank?
        s.to_s.gsub(/<\/?[^>]*>/, '').strip
      end

      def parse_body_as_json
        body = request.body.read
        JSON.parse(body, symbolize_names: true)
      rescue JSON::ParserError
        render json: { error: "bad_request", message: "Invalid JSON body" }, status: :bad_request
        nil
      end
    end
  end
end
