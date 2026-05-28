import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { SuperShell } from '@/components/super/SuperShell'

interface SuperLayoutProps {
  children: React.ReactNode
}

/**
 * Server-side guard for every /super/* route.
 *
 * Super admin = `session.user.role === 'admin'` in Better Auth (the admin
 * plugin handles that role). We resolve the session here BEFORE rendering
 * anything client-side.
 *
 * Returns 404 (not 401/403) on a missing session or non-admin role —
 * we don't want unauthenticated visitors or normal merchants to learn that
 * /super exists. The Rails super-admin API uses the same defense.
 *
 * This is intentionally NOT routed through the `/[workspace]` tree: the
 * founder operates cross-tenant, so binding the request to a workspace
 * slug would be wrong.
 */
export default async function SuperLayout({ children }: SuperLayoutProps) {
  const session = await auth.api.getSession({ headers: await headers() })

  // 404 (not 403) because we don't want anonymous visitors OR signed-in
  // non-admins to discover that the /super route exists at all.
  if (!session?.user || session.user.role !== 'admin') {
    notFound()
  }

  return <SuperShell user={session.user}>{children}</SuperShell>
}
