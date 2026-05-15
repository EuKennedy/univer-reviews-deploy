# CORS is configured in config/application.rb to keep all middleware setup in one place.
# This file is intentionally minimal.
#
# Summary of policy:
#   - /api/v1/public/* and /widget.js — open CORS (widget usage on any storefront)
#   - /api/*                          — restricted to known frontends and *.univerreviews.com
