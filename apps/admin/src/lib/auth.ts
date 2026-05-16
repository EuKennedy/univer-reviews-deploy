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

import { eq } from 'drizzle-orm'

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
      adminRoles: ['admin', 'owner'],
    }),

    bearer(), // allow `Authorization: Bearer <token>` for programmatic clients
    nextCookies(), // must be last
  ],

  // ─── Hooks: enforce access control + sync Rails WorkspaceUser ─────────────
  databaseHooks: {
    user: {
      // Gate: only allow user creation if the email is already provisioned in
      // Rails (workspace_users) OR has a pending invitation. Prevents random
      // Google sign-ins from creating orphan accounts.
      create: {
        before: async (incoming) => {
          const email = incoming.email.toLowerCase()

          const existing = await sql<
            { id: string; workspace_id: string }[]
          >`SELECT id, workspace_id FROM public.workspace_users WHERE LOWER(email) = ${email} LIMIT 1`

          const invited = await db
            .select({ id: authSchema.invitation.id })
            .from(authSchema.invitation)
            .where(eq(authSchema.invitation.email, email))
            .limit(1)

          if (existing.length === 0 && invited.length === 0) {
            throw new Error(
              'Acesso não autorizado. Solicite um convite ao administrador.'
            )
          }

          return { data: incoming }
        },
        after: async (createdUser) => {
          // Link to existing Rails WorkspaceUser by email match.
          const email = createdUser.email.toLowerCase()
          try {
            await sql`
              UPDATE public.workspace_users
              SET better_auth_user_id = ${createdUser.id}
              WHERE LOWER(email) = ${email} AND better_auth_user_id IS NULL
            `
          } catch (e) {
            console.warn('[auth] WorkspaceUser link skipped:', e)
          }
          console.info(`[auth] user created: ${createdUser.id} (${createdUser.email})`)
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
