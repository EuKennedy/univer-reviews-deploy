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
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5min in-memory cache for getSession() in middleware
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
              //    ONLY auto-provision if AUTOPROVISION_WORKSPACE_ID is explicitly set.
              //    NEVER fall back to "first workspace in DB" — in a multi-tenant SaaS
              //    that silently puts every new user into an arbitrary customer's tenant.
              const targetWorkspaceId = process.env.AUTOPROVISION_WORKSPACE_ID
              if (!targetWorkspaceId) {
                console.warn(`[auth] no workspace_user for ${email} — user will see error=no_workspace on login. Set AUTOPROVISION_WORKSPACE_ID or pre-create a workspace_user.`)
                return
              }

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
