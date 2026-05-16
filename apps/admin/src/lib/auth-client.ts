/**
 * Better Auth client SDK — used in React components and hooks.
 *
 * Provides:
 *   authClient.signIn.email({ email, password })
 *   authClient.signIn.magicLink({ email })
 *   authClient.signUp.email({ email, password, name })
 *   authClient.signOut()
 *   authClient.useSession()
 *   authClient.organization.*
 */
import { createAuthClient } from 'better-auth/react'
import {
  adminClient,
  magicLinkClient,
  organizationClient,
} from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000',
  plugins: [magicLinkClient(), organizationClient(), adminClient()],
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  organization,
} = authClient
