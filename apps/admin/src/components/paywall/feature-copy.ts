/**
 * Feature copy registry — single source of truth for the marketing
 * blurbs shown inside the paywall modal.
 *
 * Why this exists: the backend's 402 response includes the bare feature
 * key (e.g. `ai_bulk_generate_qa`) which is great for routing but lousy
 * for humans. The merchant reading the modal wants to know *what they
 * lose* by not upgrading — that's editorial copy, not a config flag —
 * so we own it on the frontend and keep the backend payload terse.
 *
 * Keys MUST mirror the symbols referenced by `PlanFeatures.require!`
 * in `apps/api/app/lib/plan_features.rb`. When a new gated feature
 * lands on the backend, add a matching entry here — otherwise the
 * modal falls back to the generic copy at the bottom of this file.
 *
 * Plan names mirror the backend tier table (`free` → `starter` →
 * `pro` → `enterprise`). Agent C may rename plans later (entry / medium
 * / ultra) — when that lands, update this file and the modal copy will
 * pick up the new labels automatically.
 */

export type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'

export interface FeatureCopy {
  /** Short noun phrase shown in the modal title row (e.g. "Q&A em massa"). */
  label: string
  /** 1–2 sentence explanation of what the feature does for the merchant. */
  description: string
  /**
   * The minimum plan that unlocks this feature. The backend already
   * returns `required_plan` in the 402 payload — we use this only as a
   * fallback when the payload is malformed / partial.
   */
  planNeeded: PlanKey
  /**
   * 3–4 bullet points listing what the merchant unlocks by upgrading.
   * Shown in the plan-comparison mini-card.
   */
  unlocks: string[]
}

export const PLAN_LABELS: Record<PlanKey, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

/**
 * Backend feature symbols → editorial copy. Keys match the symbols
 * raised by `PlanFeatures::FeatureLocked` (see `plan_features.rb`).
 */
export const FEATURE_COPY: Record<string, FeatureCopy> = {
  ai_summary_topics: {
    label: 'Sumário com IA por produto',
    description:
      'A IA lê as avaliações de cada produto e gera tópicos editoriais (ex: "cabelo fica mais brilhoso") que aparecem no widget como um carrossel resumido.',
    planNeeded: 'pro',
    unlocks: [
      'Até 5 sumários gerados por IA por produto',
      'Carrossel "Sumário de IA" no widget público',
      'Edição manual e geração sob demanda',
      'Métricas de qualidade por tópico',
    ],
  },

  ai_bulk_generate_reviews: {
    label: 'Geração em massa de avaliações',
    description:
      'Crie dezenas de avaliações realistas para produtos novos ou recém-lançados em um único clique — a IA varia tom, autor, idioma e nota.',
    planNeeded: 'pro',
    unlocks: [
      'Geração ilimitada (dentro do cap mensal de IA)',
      'Controle de tom, idioma e distribuição de nota',
      'Datas espalhadas automaticamente',
      'Status configurável (pendente ou aprovado)',
    ],
  },

  ai_bulk_generate_qa: {
    label: 'Q&A em massa com IA',
    description:
      'Gera 10 perguntas + respostas realistas por produto, em lote para o catálogo inteiro. Sai do zero pra ter uma página de FAQ rica em minutos.',
    planNeeded: 'pro',
    unlocks: [
      'Até 10 pares Q&A por produto, em lote',
      'Distribuição automática pelo catálogo ativo',
      'Status configurável (pendente ou publicado)',
      'Idioma e estilo controlados via prompt',
    ],
  },

  ai_dedup: {
    label: 'Detecção de duplicatas com IA',
    description:
      'Identifica avaliações idênticas ou parafraseadas usando embeddings semânticos — mata duplicatas que palavra-chave não pega.',
    planNeeded: 'pro',
    unlocks: [
      'Clusters de duplicatas por similaridade vetorial',
      'Limpeza em massa com 1 clique',
      'Marca verificadas vs sintéticas',
      'Histórico de ações no audit log',
    ],
  },

  custom_brand_icon: {
    label: 'Ícone de estrela customizado',
    description:
      'Substitua a estrela padrão por um SVG/PNG da sua marca — coração, troféu, logo. Aplica no widget em todas as lojas.',
    planNeeded: 'pro',
    unlocks: [
      'Upload de SVG/PNG (até 500 KB)',
      'Aplicação automática em todos os widgets',
      'Coloração via token da marca',
      'Reverter para estrela padrão a qualquer momento',
    ],
  },

  widget_custom_css: {
    label: 'CSS customizado no widget',
    description:
      'Injete CSS arbitrário no widget público para casar pixel-perfect com o tema da sua loja, sem mexer no tema do WordPress.',
    planNeeded: 'pro',
    unlocks: [
      'Editor de CSS no painel de configuração',
      'Pré-visualização em tempo real',
      'Versionamento das mudanças',
      'Rollback com 1 clique',
    ],
  },

  campaign_analytics_pro: {
    label: 'Analytics avançado de campanhas',
    description:
      'Funil completo (envio → entrega → abertura → clique → conversão) com filtros e exportação CSV para alimentar BI externo.',
    planNeeded: 'pro',
    unlocks: [
      'Funil multi-etapa por campanha',
      'Atribuição até a venda',
      'Filtros por segmento e período',
      'Exportação CSV agendada',
    ],
  },

  loyalty_program: {
    label: 'Programa de fidelidade',
    description:
      'Recompense quem deixa avaliação com pontos, cupom ou cashback — regras configuráveis por tipo de mídia, verificação e qualidade.',
    planNeeded: 'pro',
    unlocks: [
      'Regras por tipo de avaliação (texto / foto / vídeo)',
      'Pontos extras para compras verificadas',
      'Cupom único por cliente',
      'Ledger de concessões auditável',
    ],
  },

  api_keys: {
    label: 'API keys do workspace',
    description:
      'Crie chaves de API com escopo (leitura, escrita) para integrar avaliações em sistemas externos — ERP, BI, app mobile.',
    planNeeded: 'pro',
    unlocks: [
      'Chaves nomeadas com escopo configurável',
      'Revogação imediata',
      'Logs de uso por chave',
      'Limite de 10 chaves ativas por workspace',
    ],
  },

  multi_domain: {
    label: 'Múltiplos domínios',
    description:
      'Conecte mais de uma loja ao mesmo workspace — bom para quem opera duas marcas ou um marketplace com sub-domínios.',
    planNeeded: 'pro',
    unlocks: [
      'Até 5 domínios (Pro) ou ilimitado (Enterprise)',
      'Identificação automática da loja por origem',
      'Branding compartilhado entre domínios',
      'Permissões por domínio para a equipe',
    ],
  },

  whitelabel: {
    label: 'Whitelabel completo',
    description:
      'Remova toda menção à UniverReviews — domínio próprio para o painel, e-mails da sua marca, branding totalmente customizado.',
    planNeeded: 'enterprise',
    unlocks: [
      'Painel em domínio próprio (dash.suamarca.com)',
      'E-mails transacionais com seu DKIM',
      'Logo e cores da sua marca em toda a UI',
      'Sem rodapé "powered by"',
    ],
  },

  sso: {
    label: 'Single Sign-On (SSO)',
    description:
      'SAML/OIDC para grandes equipes — provisionamento automático, expiração de sessão centralizada, log único.',
    planNeeded: 'enterprise',
    unlocks: [
      'SAML 2.0 e OpenID Connect',
      'Provisionamento e desprovisionamento via SCIM',
      'Política de senha herdada do IdP',
      'Audit log centralizado',
    ],
  },
}

/**
 * Resolve copy for any feature key — falls back to generic phrasing
 * when the backend ships a feature we haven't curated yet.
 */
export function resolveFeatureCopy(
  featureKey: string | undefined | null,
  fallbackPlan: PlanKey = 'pro',
): FeatureCopy {
  if (featureKey && FEATURE_COPY[featureKey]) {
    return FEATURE_COPY[featureKey]
  }
  return {
    label: 'Este recurso',
    description: `Está disponível a partir do plano ${PLAN_LABELS[fallbackPlan]}.`,
    planNeeded: fallbackPlan,
    unlocks: [
      'Tudo do plano atual',
      'Recursos avançados de IA',
      'Suporte prioritário',
    ],
  }
}
