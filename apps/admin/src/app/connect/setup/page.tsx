/**
 * `/connect/setup?t=<JWT>` — Univercart Connect magic-link landing.
 *
 * Buyer clicks the link Univercart e-mailed them after purchasing a
 * UniverReviews plan. Univercart's email points here with a 72h HS256
 * JWT in the `t` query param. Our job: verify the JWT, ask Univercart
 * to redeem the JTI (so it can't be reused), then hand the buyer off
 * to Better Auth's magic-link verify flow which creates the session
 * cookie and lands them on their workspace dashboard.
 *
 * This is a server component on purpose. The secret used to verify the
 * JWT (UNIVERCART_JWT_SECRET) and the API key used to call
 * /api/v1/connect/redeem (CONNECT_PROXY_SECRET) must never reach the
 * browser. Server render also lets us redirect cleanly without flashing
 * a half-rendered UI to the buyer.
 *
 * Flow:
 *   1. Parse + verify the JWT.
 *   2. POST our Rails proxy /api/v1/connect/redeem/:jti, which forwards
 *      to Univercart and returns 200/404/410. 410 = token reused or
 *      expired; surface a friendly error.
 *   3. Look up the auth.user row by email (the webhook should have
 *      created it). If missing, redirect to /login?error=user_not_provisioned.
 *   4. Insert a fresh row in auth.verification (the Better Auth magic-link
 *      plugin's storage). Identifier = a one-shot token we generate;
 *      value = JSON({ email, name }).
 *   5. Find the buyer's workspace slug for the post-login destination.
 *   6. Redirect to /api/auth/magic-link/verify?token=<our-token>&callbackURL=…
 *      where Better Auth validates the verification row, mints the
 *      session cookie, and redirects the buyer onward.
 *
 * On any failure we redirect to /login with an `error=<code>` so the
 * login page can show a tailored toast. We never render UI here.
 */

import { redirect } from 'next/navigation'
import { randomBytes } from 'node:crypto'
import { eq, sql as drizzleSql } from 'drizzle-orm'
import { db, sql } from '@/lib/db'
import { user as authUser, verification as authVerification } from '@/lib/db/schema'
import { verifyUnivercartJwt } from '@/lib/univercart-jwt'

interface PageProps {
  searchParams: Promise<{ t?: string | string[] }>
}

const PARTNER_SLUG = process.env.UNIVERCART_PARTNER_SLUG || 'univerreviews'
const RAILS_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.univerreviews.com'

export default async function ConnectSetupPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tokenParam = Array.isArray(params.t) ? params.t[0] : params.t
  if (!tokenParam) {
    redirect('/login?error=missing_token')
  }

  // ── 1. Verify JWT ────────────────────────────────────────────────────
  const secret = process.env.UNIVERCART_JWT_SECRET
  if (!secret) {
    // Misconfigured deployment. Refuse to ride a half-configured login
    // flow — silent fallthrough here would mean buyers signing in with
    // an unverified token.
    console.error('[connect/setup] UNIVERCART_JWT_SECRET not configured')
    redirect('/login?error=connect_misconfigured')
  }

  const claims = verifyUnivercartJwt(tokenParam, secret, PARTNER_SLUG)
  if (!claims) {
    redirect('/login?error=invalid_token')
  }

  // ── 2. Redeem JTI via Rails proxy ────────────────────────────────────
  // Server-to-server only; CONNECT_PROXY_SECRET fences off the route.
  const proxySecret = process.env.CONNECT_PROXY_SECRET
  if (!proxySecret) {
    console.error('[connect/setup] CONNECT_PROXY_SECRET not configured')
    redirect('/login?error=connect_misconfigured')
  }

  let redeemStatus = 0
  try {
    const res = await fetch(`${RAILS_BASE}/api/v1/connect/redeem/${claims.jti}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Connect-Proxy-Secret': proxySecret,
      },
      cache: 'no-store',
    })
    redeemStatus = res.status
  } catch (err) {
    console.error('[connect/setup] redeem proxy failed', err)
    redirect('/login?error=redeem_failed')
  }

  if (redeemStatus !== 200) {
    // 410 = token already used or expired. Both terminal; the buyer can
    // ask the founder to fire a fresh magic-link via Univercart admin.
    if (redeemStatus === 410) {
      redirect('/login?error=token_already_used')
    }
    if (redeemStatus === 404) {
      redirect('/login?error=token_unknown')
    }
    redirect('/login?error=redeem_failed')
  }

  // ── 3. Find the user the webhook should have provisioned ─────────────
  const email = claims.email.toLowerCase()
  const userRows = await db
    .select({ id: authUser.id, email: authUser.email, name: authUser.name })
    .from(authUser)
    .where(drizzleSql`LOWER(${authUser.email}) = ${email}`)
    .limit(1)

  if (userRows.length === 0) {
    // Webhook hasn't processed yet (race condition: Univercart sometimes
    // fires the email faster than the webhook delivery). Better than 500
    // is sending the buyer to /login with a friendly error; they can
    // refresh in a few seconds.
    console.warn(`[connect/setup] no auth.user for ${email} (webhook race?)`)
    redirect('/login?error=user_not_provisioned')
  }
  const targetUser = userRows[0]

  // ── 4. Mint a one-shot Better Auth verification row ──────────────────
  // Mirrors the contract used by Payment::MagicLinkIssuer on the Rails
  // side: identifier = the raw token (storeToken: "plain" in Better
  // Auth's magic-link plugin), value = JSON({ email }).
  //
  // 5-minute TTL: the buyer is one redirect away from /api/auth/magic-
  // link/verify, so anything longer is just exposure surface.
  const ourToken = randomBytes(32).toString('hex')
  await db.insert(authVerification).values({
    id: crypto.randomUUID(),
    identifier: ourToken,
    value: JSON.stringify({ email: targetUser.email, name: targetUser.name }),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // ── 5. Pick the buyer's workspace as the landing page ────────────────
  const wsRows = await sql<Array<{ slug: string }>>`
    SELECT w.slug
    FROM public.workspaces w
    INNER JOIN public.workspace_users wu
      ON wu.workspace_id = w.id
     AND wu.better_auth_user_id = ${targetUser.id}
    ORDER BY wu.created_at ASC
    LIMIT 1
  `
  const callback = wsRows.length > 0 ? `/${wsRows[0].slug}/dashboard` : '/'

  // ── 6. Hand off to Better Auth ───────────────────────────────────────
  // Better Auth's magic-link plugin handles the verification → session
  // cookie → redirect chain. We just point at it.
  const verifyUrl =
    `/api/auth/magic-link/verify?token=${encodeURIComponent(ourToken)}` +
    `&callbackURL=${encodeURIComponent(callback)}`

  redirect(verifyUrl)
}
