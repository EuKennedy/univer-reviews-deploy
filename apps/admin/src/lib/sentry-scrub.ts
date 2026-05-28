/**
 * PII scrub helpers for Sentry beforeSend hooks.
 *
 * Centralized so the server, edge, and browser runtimes can share the
 * same redaction logic. We don't currently have @sentry/nextjs wired
 * (deferred to a follow-up commit — needs DSN provisioned), but the
 * scrub helpers are ready to plug in.
 *
 * Mirrors apps/api/config/initializers/sentry.rb so a vulnerability
 * fixed on one side propagates everywhere.
 */
const REDACT = '[REDACTED]'
const FILTERED = '[FILTERED]'

const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'oldpassword', 'passwordhash', 'password_confirmation',
  'token', 'accesstoken', 'refreshtoken', 'idtoken', 'authtoken',
  'apikey', 'api_key', 'secret', 'jwtsecret', 'webhooksecret',
  'authorization', 'cookie', 'setcookie',
  'creditcard', 'cvc', 'cvv', 'cpf', 'cnpj', 'rg', 'ssn',
])

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED-EMAIL]'],
  [/\b\d{2,3}\s?9?\d{4}-?\d{4}\b/g, '[REDACTED-PHONE]'],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[REDACTED-CPF]'],
  [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[REDACTED-CNPJ]'],
]

export function redactString(s: string): string {
  return PII_PATTERNS.reduce<string>((acc, [pat, rep]) => acc.replace(pat, rep), s)
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = FILTERED
      } else {
        out[k] = scrubValue(v, depth + 1)
      }
    }
    return out
  }
  return value
}

/**
 * Drop-in for a Sentry beforeSend hook. Usage:
 *
 *   Sentry.init({
 *     dsn: process.env.SENTRY_DSN,
 *     sendDefaultPii: false,
 *     beforeSend(event) { return scrubSentryEvent(event) },
 *   })
 */
export function scrubSentryEvent<E extends Record<string, unknown>>(event: E): E {
  const e = event as Record<string, unknown>
  const req = e.request as { headers?: Record<string, string>; data?: unknown } | undefined
  if (req?.headers) {
    for (const h of ['cookie', 'authorization', 'x-api-key', 'x-univer-api-key']) {
      delete req.headers[h]
    }
  }
  if (req?.data !== undefined) {
    req.data = scrubValue(req.data)
  }
  if (typeof e.message === 'string') e.message = redactString(e.message)
  const exception = e.exception as { values?: Array<{ value?: string }> } | undefined
  exception?.values?.forEach((ex) => {
    if (ex.value) ex.value = redactString(ex.value)
  })
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs.map((b) => {
      const bc = b as { data?: unknown; message?: unknown }
      if (bc.data) bc.data = scrubValue(bc.data)
      if (typeof bc.message === 'string') bc.message = redactString(bc.message)
      return bc
    })
  }
  if (e.extra) e.extra = scrubValue(e.extra)
  const user = e.user as { email?: string; username?: string; ip_address?: string } | undefined
  if (user) {
    delete user.email
    delete user.username
    delete user.ip_address
  }
  return event
}
