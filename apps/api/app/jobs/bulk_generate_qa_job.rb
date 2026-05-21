class BulkGenerateQaJob < ApplicationJob
  queue_as :default

  # Generate Q&A pairs for ONE product. Fired in a fan-out from
  # BulkGenerateQaAllProductsJob OR directly from a per-product UI action.
  #
  # When the workspace has a connected WooCommerce store and the product has
  # an external_id, we GET the live product detail from the WC REST API so
  # Claude has the actual page description, attributes, and categories to
  # anchor its answers on. Without WC, the prompt still works with the bare
  # title + handle but Q&A quality drops.
  def perform(workspace_id, product_id, count: 10, status: "published", language: nil)
    workspace = Workspace.find_by(id: workspace_id)
    return unless workspace

    product = workspace.products.find_by(id: product_id)
    return unless product

    target_status = %w[pending published].include?(status) ? status : "published"
    language ||= workspace.default_locale

    enriched = fetch_enriched_context(workspace, product)

    with_workspace_rls(workspace.id) do
      pairs = Ai::GenerateService.new(workspace).generate_qa_pairs(
        product:  product,
        count:    count,
        language: language,
        enriched: enriched
      )

      pairs.each_with_index do |qa, idx|
        product.workspace.questions.create!(
          product:        product,
          author_name:    fake_author_name(idx),
          body:           qa[:question].to_s[0, 1_000],
          answer:         qa[:answer].to_s[0, 5_000],
          status:         target_status,
          answered_at:    target_status == "published" ? Time.current : nil
        )
      end

      AuditLog.record(
        workspace: workspace,
        action: "ai.bulk_created_questions_async",
        metadata: { product_id: product.id, count: pairs.length }
      )
    end
  rescue => e
    Rails.logger.error("[bulk_generate_qa] workspace=#{workspace_id} product=#{product_id} #{e.class}: #{e.message}")
    Sentry.capture_exception(e) if defined?(Sentry)
  end

  private

  FIRST_NAMES = %w[
    Ana Beatriz Carla Daniela Eduarda Fernanda Gabriela Helena Isabela
    Julia Karina Larissa Mariana Nicole Olivia Patricia Renata Sofia Vanessa Yasmin
    Bruno Carlos Daniel Eduardo Felipe Gabriel Henrique Igor Joao Leonardo
    Marcos Nicolas Otavio Pedro Rafael Samuel Thiago Vitor William
  ].freeze
  LAST_NAMES = %w[
    Silva Santos Oliveira Souza Pereira Lima Costa Almeida Ferreira Rodrigues
    Carvalho Gomes Martins Araujo Ribeiro Alves Monteiro Barbosa Cardoso Dias
    Fernandes Moraes Nascimento Pinto Reis Vieira Cunha Teixeira Mendes Castro
  ].freeze

  def fake_author_name(seed)
    first = FIRST_NAMES[(seed + rand(0..1000)) % FIRST_NAMES.length]
    last  = LAST_NAMES[(seed * 7 + rand(0..1000)) % LAST_NAMES.length]
    "#{first} #{last[0]}."
  end

  # Pull description / short_description / categories / attributes / tags
  # from the merchant's WooCommerce store via the REST API. Falls back to
  # nil silently if the workspace has no WC connection or the call fails —
  # Claude still gets the bare title + handle in that case.
  def fetch_enriched_context(workspace, product)
    return nil unless product.external_id.present?
    domain = workspace.workspace_domains.where(platform: "woocommerce").first
    return nil unless domain&.platform_meta.is_a?(Hash)
    meta = domain.platform_meta
    return nil if meta["store_url"].blank? || meta["consumer_key"].blank? || meta["consumer_secret"].blank?

    adapter = Integrations::WooCommerceAdapter.new(
      store_url:       meta["store_url"],
      consumer_key:    meta["consumer_key"],
      consumer_secret: meta["consumer_secret"]
    )
    wc = adapter.product(id: product.external_id)
    return nil unless wc.is_a?(Hash)

    {
      description:        wc["description"],
      short_description:  wc["short_description"],
      categories:         Array(wc["categories"]).map { |c| c.is_a?(Hash) ? c["name"] : c.to_s }.compact,
      tags:               Array(wc["tags"]).map { |t| t.is_a?(Hash) ? t["name"] : t.to_s }.compact,
      attributes:         Array(wc["attributes"]).map { |a|
        next unless a.is_a?(Hash)
        name = a["name"].to_s
        opts = Array(a["options"]).join(", ")
        opts.present? ? "#{name}: #{opts}" : name
      }.compact,
      price:              wc["price"]
    }
  rescue => e
    Rails.logger.warn("[bulk_generate_qa] enrich failed product=#{product.id}: #{e.class}: #{e.message}")
    nil
  end
end
