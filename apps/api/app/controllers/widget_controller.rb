class WidgetController < ApplicationController
  skip_before_action :set_current_workspace

  def serve
    widget_path = Rails.root.join("public", "widget.js")

    if widget_path.exist?
      # Short Cache-Control so a new widget.js deploy reaches every storefront
      # within ~5 minutes instead of being trapped in Cloudflare's edge cache
      # for hours after every deploy. The plugin already busts the cache via
      # ?ver=<plugin_version>, but that only helps when the plugin itself is
      # also bumped — pure-widget changes (e.g. a new web component) would
      # otherwise sit dark on every CDN PoP for 24h.
      response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
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
