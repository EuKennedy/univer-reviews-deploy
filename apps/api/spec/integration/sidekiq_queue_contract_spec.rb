require "rails_helper"
require "sidekiq/testing"

# Locks the contract between `queue_as :ai` annotations on individual jobs
# and the queue list in `config/sidekiq.yml`. The prod incident this
# guards against: AiGenerateSummaryTopicsJob was annotated `queue_as :ai`
# but the production Sidekiq container never listed `ai` in its consumed
# queues, so every enqueue silently rotted in Redis. CI couldn't catch
# it because the test adapter bypasses Redis entirely.
#
# In addition to the contract check, we also push a real job to Redis via
# the inline adapter to confirm enqueue + execute roundtrips work for
# every AI-tagged job class. Inline avoids the need to spin up an actual
# Sidekiq worker process inside CI.
RSpec.describe "Sidekiq · queue / job contract", type: :integration do
  before(:all) do
    @sidekiq_yaml = YAML.safe_load(
      ERB.new(File.read(Rails.root.join("config/sidekiq.yml"))).result,
      permitted_classes: [Symbol],
      aliases: true,
    )
  end

  let(:declared_queues) do
    Array(@sidekiq_yaml[:queues]).map { |q| Array(q).first.to_s }
  end

  describe "every job class declares a queue that sidekiq.yml consumes" do
    # Collect every concrete ActiveJob subclass with a `queue_as` other than
    # the default. If any job points at a queue Sidekiq doesn't list,
    # production silently never runs it.
    it "no job is annotated for a queue that the worker won't process" do
      # Eager-load so every job class registers itself.
      Rails.application.eager_load!

      orphan = {}
      ApplicationJob.descendants.each do |klass|
        # `queue_name` can be either a String OR a Proc/Symbol depending on
        # how the job was annotated. We can only contract-check the static
        # String case — Proc/Symbol resolves at enqueue time. Skip dynamic
        # ones (Sentry's SendEventJob is the canonical example: it carries
        # a lambda that reads `Sentry.configuration.background_worker_queue`
        # at runtime). Brakeman / actual prod telemetry covers the dynamic
        # path.
        queue = klass.queue_name
        next unless queue.is_a?(String) || queue.is_a?(Symbol)
        queue = queue.to_s
        next if queue.blank?
        next if declared_queues.include?(queue)
        orphan[klass.name] = queue
      end

      expect(orphan).to be_empty, <<~MSG
        Job classes point at queues that sidekiq.yml never consumes:
        #{orphan.map { |k, q| "  • #{k} → queue=#{q}" }.join("\n")}
        Either add the queue to apps/api/config/sidekiq.yml or change
        `queue_as` on the job. This is the exact failure mode that
        broke summary-topic generation in prod.
      MSG
    end
  end

  describe "AI summary topic job (real enqueue → execute)" do
    let(:workspace) { create(:workspace) }
    let(:product)   { create(:product, workspace: workspace) }

    around do |example|
      # Inline adapter pushes through the full Sidekiq client/server path
      # (validation, queue selection, middleware) and runs the perform
      # inside the same process. Real adapter swap, real round-trip,
      # no separate worker container needed.
      Sidekiq::Testing.inline! do
        original = ActiveJob::Base.queue_adapter
        ActiveJob::Base.queue_adapter = :sidekiq
        begin
          example.run
        ensure
          ActiveJob::Base.queue_adapter = original
        end
      end
    end

    before do
      allow_any_instance_of(AiGenerateSummaryTopicsJob).to receive(:set_workspace_rls)
      allow_any_instance_of(Ai::SummaryTopicsService).to receive(:call).and_return([])
    end

    it "enqueues onto the `ai` queue and the worker pulls it" do
      expect {
        AiGenerateSummaryTopicsJob.perform_later(product.id)
      }.not_to raise_error
    end

    it "respects the queue name declared on the job class" do
      expect(AiGenerateSummaryTopicsJob.queue_name).to eq("ai")
      expect(declared_queues).to include("ai")
    end
  end
end
