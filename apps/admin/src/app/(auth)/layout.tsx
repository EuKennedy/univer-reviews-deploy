import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

/**
 * Server-side guard for the (auth) route group.
 *
 * Reverse-protect: if the visitor is ALREADY signed in and hits
 * /login or /invite, send them straight to the root resolver which
 * lands them on their dashboard (or the onboarding wizard for fresh
 * accounts). Showing a logged-in user the login form is a UX bug — they
 * stare at it confused, click around, sometimes accidentally sign in
 * with a different email and create a duplicate account.
 *
 * Side bonus: cleans up the "back-button after logout shows login but
 * session still alive" footgun on stale tabs.
 */
export default async function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect('/')
  }
  return <>{children}</>
}
