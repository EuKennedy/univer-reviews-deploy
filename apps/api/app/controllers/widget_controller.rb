class WidgetController < ApplicationController
  skip_before_action :set_current_workspace

  def serve
    widget_path = Rails.root.join("public", "widget.js")

    if widget_path.exist?
      response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=3600"
      response.headers["Content-Type"] = "application/javascript"
      send_file widget_path, type: "application/javascript", disposition: "inline"
    else
      render plain: "// UniverReviews Widget - not compiled yet\n", content_type: "application/javascript"
    end
  end

  private

  def skip_authentication?
    true
  end
end
