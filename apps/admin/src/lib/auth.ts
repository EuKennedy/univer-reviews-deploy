/**
 * Better Auth server config — single source of truth for authentication.
 *
 * Stack:
 * - Drizzle adapter (Postgres, schema `auth.*`)
 * - emailAndPassword (primary) + magicLink (alternative) + organization (= workspaces) + admin
 * - Resend for transactional email
 * - 7-day sessions, cookie cache for low-latency middleware checks
 *
 * Rails reads the same `auth.session` table directly to validate API requests,
 * keeping latency <2ms (no HTTP roundtrip).
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, magicLink, organization, bearer } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'

import { db, sql } from './db'
import * as authSchema from './db/schema'
import {
  invitationTemplate,
  magicLinkTemplate,
  sendEmail,
  verificationTemplate,
} from './email/resend'

const baseURL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000'
const trustedOrigins = [
  baseURL,
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',') || []),
].filter(Boolean)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
      organization: authSchema.organization,
      member: authSchema.member,
      invitation: authSchema.invitation,
      team: authSchema.teams,
    },
  }),

  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,

  // ─── Session ───────────────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh expiry once per 24h of activity
    // cookieCache DISABLED. With it enabled, Better Auth serialises session +
    // user into a signed `__Secure-better-auth.session_data` cookie and short-
    // circuits getSession() reads against that cookie (5min window). Any time
    // BETTER_AUTH_SECRET rotates, the user/session schema changes, or the
    // session row is deleted server-side, the cached cookie remains in the
    // browser with stale/unverifiable data — middleware treats the session as
    // partially valid and loops between /login and the redirect target.
    //
    // The cost of disabling is one extra DB roundtrip per middleware-protected
    // request (~1-2ms). For MVP that's acceptable; revisit if it shows up in
    // p95 latency at scale.
    cookieCache: {
      enabled: false,
    },
  },

  // ─── Cross-subdomain cookies ───────────────────────────────────────────────
  // Sessions are issued by dash.univerreviews.com but consumed by api.univerreviews.com
  // (Rails reads the session row directly). Without this, the browser does not
  // send the cookie to the API subdomain and every authenticated call returns 401.
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: process.env.COOKIE_DOMAIN || '.univerreviews.com',
    },
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    },
  },

  // ─── Social providers ──────────────────────────────────────────────────────
  socialProviders: {
    google: {
      enabled: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      // Always show the consent screen so users can switch Google accounts
      prompt: 'select_account',
    },
  },

  // ─── Account linking ───────────────────────────────────────────────────────
  account: {
    accountLinking: {
      enabled: true,
      // Allow linking Google → existing credential account by matching email.
      // This lets pre-provisioned users (backfilled from Rails) sign in with
      // Google without manual linking.
      trustedProviders: ['google'],
    },
  },

  // ─── Email + Password ──────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // verify in background, do not block login
    minPasswordLength: 8,
    autoSignIn: true,
    password: {
      // Backfilled users have bcrypt hashes from Rails (BCrypt::Password.create).
      // Better Auth's default scrypt won't verify those, so we override.
      hash: async (password: string) => {
        const bcrypt = await import('bcryptjs')
        return bcrypt.hash(password, 12)
      },
      verify: async ({ password, hash }: { password: string; hash: string }) => {
        const bcrypt = await import('bcryptjs')
        return bcrypt.compare(password, hash)
      },
    },
  },

  // ─── Email verification ────────────────────────────────────────────────────
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { subject, html } = verificationTemplate({ url, email: user.email })
      await sendEmail({ to: user.email, subject, html })
    },
  },

  // ─── Plugins ───────────────────────────────────────────────────────────────
  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 min
      // Magic-link é canal de RE-acesso, não de cadastro. Sem esta flag
      // qualquer e-mail digitado vira conta nova — abre vetor de
      // squatting e gera spam de e-mails de verificação. Cadastro é
      // feito exclusivamente via emailAndPassword (ou convite).
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        const { subject, html } = magicLinkTemplate({ url, email })
        await sendEmail({ to: email, subject, html })
      },
    }),

    organization({
      allowUserToCreateOrganization: false, // workspaces created via Rails admin flow
      organizationLimit: 10,
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      sendInvitationEmail: async ({ email, invitation, inviter, organization }) => {
        const inviteUrl = `${baseURL}/invite/${invitation.id}`
        const { subject, html } = invitationTemplate({
          url: inviteUrl,
          inviterName: inviter.user.name,
          organizationName: organization.name,
        })
        await sendEmail({ to: email, subject, html })
      },
    }),

    admin({
      defaultRole: 'user',
      // adminRoles defaults to ['admin']. Workspace ownership is tracked in the
      // Rails `workspace_users.role` column (owner/admin/editor/etc), not in the
      // Better Auth user table — Rails handles per-workspace authorization.
    }),

    bearer(), // allow `Authorization: Bearer <token>` for programmatic clients
    nextCookies(), // must be last
  ],

  // ─── Hooks: sync Better Auth user → Rails WorkspaceUser ───────────────────
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          const email = createdUser.email.toLowerCase()
          const name = createdUser.name || email.split('@')[0]

          try {
            await sql.begin(async (tx) => {
              // workspace_users has FORCE ROW LEVEL SECURITY (workspace_id isolation).
              // This hook runs with no workspace context — bypass RLS so the email
              // lookup can find rows across all tenants. Without this, the UPDATE
              // returns 0 rows and every user gets incorrectly provisioned into the
              // first workspace in the DB (the "lizzon bug").
              try {
                await tx`SET LOCAL row_security = off`
              } catch (_) {
                // DB role lacks BYPASSRLS — log and fall through. The UPDATE below
                // may still return rows if the connection already has app.workspace_id set,
                // but likely won't. A DBA should grant BYPASSRLS to the app role.
                console.warn('[auth] cannot bypass RLS in databaseHook — grant BYPASSRLS to app DB role')
              }

              // 1. Link an existing Rails workspace_user by email.
              const linked = await tx<{ id: string; workspace_id: string }[]>`
                UPDATE public.workspace_users
                SET better_auth_user_id = ${createdUser.id}
                WHERE LOWER(email) = ${email} AND better_auth_user_id IS NULL
                RETURNING id, workspace_id
              `

              if (linked.length > 0) {
                console.info(`[auth] linked WorkspaceUser ${linked[0].id} → ${createdUser.id}`)
                return
              }

              // 2. No existing workspace_user found.
              //    Two-tier fallback:
              //      a) AUTOPROVISION_WORKSPACE_ID env set → invite into that ws
              //         (used for single-tenant pilots like lizzon).
              //      b) Otherwise → create a brand-new workspace for this user
              //         and make them owner. Default SaaS sign-up path.
              //    We NEVER fall back to "first workspace in DB" — in a multi-tenant SaaS
              //    that silently puts every new user into an arbitrary customer's tenant.
              const targetWorkspaceId = process.env.AUTOPROVISION_WORKSPACE_ID

              if (targetWorkspaceId) {
                const existingOwner = await tx<{ id: string }[]>`
                  SELECT id FROM public.workspace_users
                  WHERE workspace_id = ${targetWorkspaceId} AND role = 'owner'
                  LIMIT 1
                `
                const role = existingOwner.length === 0
                  ? 'owner'
                  : (process.env.AUTOPROVISION_ROLE || 'viewer')

                await tx`
                  INSERT INTO public.workspace_users (workspace_id, email, name, role, better_auth_user_id, created_at, updated_at)
                  VALUES (${targetWorkspaceId}, ${email}, ${name}, ${role}, ${createdUser.id}, NOW(), NOW())
                  ON CONFLICT DO NOTHING
                `
                console.info(`[auth] auto-provisioned ${email} into workspace ${targetWorkspaceId} as ${role}`)
                return
              }

              // (b) Brand-new workspace. Derive slug from email local-part +
              //     a short random suffix to avoid collisions. Slug must
              //     match /\A[a-z0-9-]+\z/ (Rails Workspace#slug validator).
              const localPart = email.split('@')[0] || 'user'
              const baseSlug = localPart
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 24)
              // 6-char suffix from crypto.randomUUID for collision safety.
              const suffix = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36)).replace(/[^a-z0-9]/g, '').slice(0, 6)
              const slug = `${baseSlug || 'workspace'}-${suffix}`
              const wsName = name || localPart || 'Meu workspace'

              // Brand-new workspaces start on the entry tier with status="trial"
              // so the merchant has a working dashboard while the external
              // payment platform completes the first charge. Post-T1.3 there is
              // no free tier — the trial status is what gates billing, not the plan.
              const newWs = await tx<{ id: string }[]>`
                INSERT INTO public.workspaces (slug, name, plan, status, brand_color, default_locale, default_currency, created_at, updated_at)
                VALUES (
                  ${slug},
                  ${wsName},
                  'entry',
                  'trial',
                  '#d4a850',
                  'pt-BR',
                  'BRL',
                  NOW(),
                  NOW()
                )
                RETURNING id
              `

              if (newWs.length === 0) {
                console.error(`[auth] workspace creation returned no row for ${email}`)
                return
              }

              const newWsId = newWs[0].id

              await tx`
                INSERT INTO public.workspace_users (workspace_id, email, name, role, better_auth_user_id, created_at, updated_at)
                VALUES (${newWsId}, ${email}, ${name}, 'owner', ${createdUser.id}, NOW(), NOW())
              `

              console.info(`[auth] created new workspace ${slug} (${newWsId}) for ${email} as owner`)
            })
          } catch (e) {
            console.error('[auth] WorkspaceUser sync failed:', e)
          }
        },
      },
    },
  },

  // ─── Rate limiting ─────────────────────────────────────────────────────────
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },
})

export type Session = typeof auth.$Infer.Session
