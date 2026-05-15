require "oj"

Oj.optimize_rails

Oj.default_options = {
  mode: :compat,
  time_format: :ruby,
  use_to_json: true
}
