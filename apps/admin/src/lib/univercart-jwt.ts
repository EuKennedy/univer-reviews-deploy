/**
 * Univercart Connect magic-link JWT verifier.
 *
 * Univercart e-mails buyers a `https://dash.univerreviews.com/connect/setup?t=<JWT>`
 * link after they purchase a plan. The JWT is HS256-signed with a secret
 * shared between Univercart and us (`UNIVERCART_JWT_SECRET`).
 *
 * We verify here using Node's built-in `crypto` rather than pulling in a
 * full JWT library — the spec is tiny (header.payload.sig, base64url,
 * HMAC-SHA-256), security-critical, and adding a dependency for ~40 lines
 * of code creates more attack surface than it removes.
 *
 * Verification is constant-time on the signature compare and rejects:
 *   - malformed JWT shape (≠ 3 parts)
 *   - non-HS256 algorithm
 *   - signature mismatch
 *   - missing/wrong iss / aud
 *   - expired exp (with optional skew tolerance)
 *
 * Returns the typed claims on success, null on any failure. We DO NOT
 * surface the failure reason to the caller — that would leak which check
 * the attacker failed.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface UnivercartMagicLinkClaims {
  /** externalUserId — Univercart subscription id (`sub_<…>`). */
  sub: string
  email: string
  name: string
  /** entry | medium | ultra (matches our workspaces.plan slugs). */
  role: string
  /** Issuer; must equal `"univercart"`. */
  iss: 'univercart'
  /** Audience; must equal the configured partner slug. */
  aud: string
  /** Unix seconds — expires after 72h per Univercart spec. */
  exp: number
  /** Unix seconds — issued at. */
  iat: number
  /** Single-use token id; submitted to Univercart's /v1/tokens/:jti/redeem. */
  jti: string
}

/**
 * Decodes a base64url-encoded segment back into a UTF-8 Buffer.
 *
 * base64url ≠ base64: the URL-safe alphabet swaps `+/` for `-_` and may
 * omit `=` padding. We pad up before calling Node's Buffer because Node
 * is strict about it under the `base64` mode.
 */
function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, 'base64')
}

export function verifyUnivercartJwt(
  jwt: string,
  secret: string,
  partnerSlug: string,
  opts: { skewSeconds?: number } = {},
): UnivercartMagicLinkClaims | null {
  if (!jwt || !secret || !partnerSlug) return null

  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts

  // Verify algorithm BEFORE checking the signature. A maliciously crafted
  // token claiming alg="none" must be rejected even if its signature
  // happens to match (which it can't, but never trust the header field
  // either way).
  let header: { alg?: string; typ?: string }
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString('utf8'))
  } catch {
    return null
  }
  if (header.alg !== 'HS256') return null

  // Constant-time signature compare. timingSafeEqual requires equal-length
  // buffers; mismatch length is itself a failure mode.
  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest()
  const provided = b64urlDecode(sigB64)
  if (expected.length !== provided.length) return null
  if (!timingSafeEqual(expected, provided)) return null

  let claims: UnivercartMagicLinkClaims
  try {
    claims = JSON.parse(b64urlDecode(payloadB64).toString('utf8'))
  } catch {
    return null
  }

  if (claims.iss !== 'univercart') return null
  if (claims.aud !== partnerSlug) return null

  const skew = opts.skewSeconds ?? 30
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || claims.exp + skew < nowSeconds) return null
  if (typeof claims.iat !== 'number' || claims.iat - skew > nowSeconds) return null

  if (typeof claims.sub !== 'string' || claims.sub.length === 0) return null
  if (typeof claims.email !== 'string' || !claims.email.includes('@')) return null
  if (typeof claims.jti !== 'string' || claims.jti.length === 0) return null

  return claims
}
