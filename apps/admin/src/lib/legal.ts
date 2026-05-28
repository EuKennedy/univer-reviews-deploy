/**
 * UniverReviews — versionado de termos + privacidade.
 *
 * Toda mudança nas páginas /termos ou /privacidade DEVE bumpar a versão
 * correspondente aqui. O LegalReAcceptBanner (montado no
 * dashboard layout) compara estes valores com user.acceptedTermsVersion
 * e user.acceptedPrivacyVersion — se forem diferentes, o banner bloqueia
 * a navegação até o usuário aceitar.
 *
 * Versões usam formato YYYY-MM-DD (semantic-date). Não relacione com
 * versões do produto.
 */
export const LEGAL_VERSIONS = {
  terms: '2026-05-27',
  privacy: '2026-05-27',
} as const

export type LegalDocument = keyof typeof LEGAL_VERSIONS

export interface LegalChange {
  version: string
  date: string
  highlights: string[]
}

export const TERMS_CHANGELOG: LegalChange[] = [
  {
    version: '2026-05-27',
    date: '2026-05-27',
    highlights: ['Versão inicial publicada — primeira abertura pública do UniverReviews.'],
  },
]

export const PRIVACY_CHANGELOG: LegalChange[] = [
  {
    version: '2026-05-27',
    date: '2026-05-27',
    highlights: ['Versão inicial publicada com lista de sub-operadores e direitos do titular (LGPD Art. 18).'],
  },
]

/**
 * Branding constants para os documentos legais. Centralizado pra
 * facilitar troca de razão social / contatos sem caçar tokens
 * espalhados pelas páginas.
 */
export const BRAND = {
  product: 'UniverReviews',
  company: 'UniverTech',
  domain: 'univerreviews.com',
  supportEmail: 'suporte@univerreviews.com',
  privacyEmail: 'privacidade@univerreviews.com',
  // Foro contratual — ajustar se a sede mudar.
  legalForum: 'Belo Horizonte/MG',
} as const

/**
 * Sub-operadores (Art. 39 LGPD). Manter sincronizado com `/privacidade`.
 * Cada item lista o que o operador processa, pra transparência total.
 */
export const SUB_PROCESSORS = [
  { name: 'Coolify',    purpose: 'Hospedagem da infraestrutura (servidores + DB Postgres)' },
  { name: 'Anthropic',  purpose: 'Modelos de IA (Claude Haiku/Sonnet) — moderação, sumários, sugestões' },
  { name: 'Resend',     purpose: 'Envio de e-mails transacionais (verificação, magic-link, campanhas)' },
  { name: 'Stripe',     purpose: 'Processamento de pagamentos e gestão de assinaturas' },
  { name: 'Cloudflare', purpose: 'CDN + proteção DDoS para domínios da plataforma' },
  { name: 'Sentry',     purpose: 'Monitoramento de erros (com PII anonimizada antes do envio)' },
  { name: 'MinIO/S3',   purpose: 'Armazenamento de mídias enviadas pelos clientes (fotos, vídeos, logos)' },
] as const

/**
 * Helper: usuário precisa re-aceitar?
 */
export function needsReAcceptance(
  acceptedTerms: string | null | undefined,
  acceptedPrivacy: string | null | undefined,
): boolean {
  return (
    acceptedTerms !== LEGAL_VERSIONS.terms ||
    acceptedPrivacy !== LEGAL_VERSIONS.privacy
  )
}
