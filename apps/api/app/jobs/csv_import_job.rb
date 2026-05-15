require "csv"

class CsvImportJob < ApplicationJob
  queue_as :imports

  COLUMN_MAPS = {
    "judge_me" => {
      rating: "rating", body: "body", author_name: "reviewer_name",
      author_email: "email", title: "title", created_at: "created_at"
    },
    "yotpo" => {
      rating: "score", body: "content", author_name: "display_name",
      author_email: "email", title: "title", created_at: "date"
    },
    "loox" => {
      rating: "rating", body: "body", author_name: "name",
      author_email: "email", title: nil, created_at: "created_at"
    },
    "stamped" => {
      rating: "reviewRating", body: "reviewBody", author_name: "author",
      author_email: "email", title: "reviewTitle", created_at: "dateCreated"
    },
    "reviews_io" => {
      rating: "rating", body: "review", author_name: "reviewer_name",
      author_email: "reviewer_email", title: nil, created_at: "date_created"
    }
  }.freeze

  def perform(import_id, csv_content, format: "csv")
    import = Import.find_by(id: import_id)
    return unless import

    set_workspace_rls(import.workspace_id)
    import.start!

    workspace   = import.workspace
    col_map     = COLUMN_MAPS[format] || {}
    ok_count    = 0
    error_count = 0
    rows        = CSV.parse(csv_content, headers: true)

    import.update_column(:total_rows, rows.length)

    rows.each do |row|
      rating = row[col_map[:rating] || "rating"].to_i
      next if rating.zero?

      workspace.reviews.create!(
        rating:       rating.clamp(1, 5),
        title:        col_map[:title] ? row[col_map[:title]] : nil,
        body:         row[col_map[:body] || "body"],
        author_name:  row[col_map[:author_name] || "author_name"],
        author_email: row[col_map[:author_email] || "email"]&.downcase,
        source:       format == "csv" ? "csv" : "ryviu_import",
        status:       "pending",
        imported_at:  Time.current
      )

      ok_count += 1
    rescue => e
      error_count += 1
      import.append_log("warn", "CSV row error: #{e.message}")
    end

    import.finish!(ok: ok_count, errors: error_count)
  rescue CSV::MalformedCSVError => e
    Import.find_by(id: import_id)&.fail!("Malformed CSV: #{e.message}")
  rescue => e
    Import.find_by(id: import_id)&.fail!(e.message)
    raise
  end
end
