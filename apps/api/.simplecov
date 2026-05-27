# SimpleCov config. Loaded automatically by `require "simplecov"` and by
# the explicit start block at the top of spec/rails_helper.rb.
#
# Premium-CI standard: every PR must keep line coverage ≥ 70%. Below
# that, the rspec job fails. Bump the floor as the codebase climbs.
SimpleCov.start "rails" do
  enable_coverage :branch
  add_filter "/spec/"
  add_filter "/config/"
  add_filter "/db/"
  add_filter "/bin/"
  add_filter "/vendor/"

  # Groups so the HTML report is readable on a 5,000-line codebase.
  add_group "Controllers", "app/controllers"
  add_group "Models",      "app/models"
  add_group "Services",    "app/services"
  add_group "Jobs",        "app/jobs"
  add_group "Mailers",     "app/mailers"
  add_group "Lib",         "lib"

  # Hard floor. Below this, the test run exits non-zero — CI catches it.
  # Branch coverage is informational for now; line is the gate.
  minimum_coverage line: 70

  # Per-file floor: stops a single 100% file from masking a 0% file.
  minimum_coverage_by_file line: 30

  # JSON output for CI annotation / artifact upload.
  require "simplecov-html"
  formatter SimpleCov::Formatter::MultiFormatter.new([
    SimpleCov::Formatter::HTMLFormatter,
  ])

  # The `coverage/` directory is gitignored at the repo root.
  coverage_dir "coverage"
end
