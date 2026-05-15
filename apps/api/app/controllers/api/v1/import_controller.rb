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
