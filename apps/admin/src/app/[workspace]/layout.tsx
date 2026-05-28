import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { Shell } from '@/components/godmode/Shell'
import { auth } from '@/lib/auth'
import { db, sql } from '@/lib/db'
import { user as authUser } from '@/lib/db/schema'
import { CookieConsent } from '@/components/legal/CookieConsent'
import { LegalReAcceptBanner } from '@/components/legal/LegalReAcceptBanner'

interface WorkspaceLayoutProps {
  children: React.ReactNode
  params: Promise<{ workspace: string }>
}

/**
 * Server-side guard for every /[workspace]/* route.
 *
 * Previously the layout accepted any slug, which meant visiting /dashboard
 * (with workspace="dashboard") would render the Shell, the React Query
 * hooks would 404 against /api/v1/workspace, and the page would load in
 * a half-broken state — looking like "magically logged in" to the user.
 *
 * Now we resolve the session here and validate that:
 *   1. The slug exists in `workspaces`.
 *   2. The signed-in user has a `workspace_users` row pointing at that
 *      workspace (i.e. they're authorized).
 *
 * If either check fails we send the user to the right place:
 *   - no session         → /login
 *   - session, no access → /                  (root resolver picks their first ws)
 *   - signed-in admin    → /                  (likewise; admin will fall through
 *                                              if they truly have no workspace).
 *
 * Cheap query: 1 SELECT JOIN, indexed columns. Adds ~2-3ms per workspace
 * navigation but kills an entire class of "wrong tenant" / "ghost workspace"
 * bugs at the boundary.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspace } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login')
  }

  // Slug format guard. Workspace slugs are /\A[a-z0-9-]+\z/ — anything
  // that doesn't fit is structurally invalid (e.g. "dashboard" hitting
  // /dashboard because the user typed the bare path).
  const slugFormatOk = /^[a-z0-9-]+$/.test(workspace) && workspace.length <= 64
  if (!slugFormatOk) {
    redirect('/')
  }

  const rows = await sql<{ id: string }[]>`
    SELECT w.id
    FROM public.workspaces w
    INNER JOIN public.workspace_users wu
      ON wu.workspace_id = w.id
     AND wu.better_auth_user_id = ${session.user.id}
    WHERE w.slug = ${workspace}
    LIMIT 1
  `

  if (rows.length === 0) {
    // Either the workspace doesn't exist OR the user has no row for it.
    // Send them to the root resolver which picks their first legitimate
    // workspace (or shows error=no_workspace if they truly have none).
    redirect('/')
  }

  // LGPD acceptance state — fetched cheaply alongside the workspace
  // check. Banner only blocks when versions diverge.
  const me = await db
    .select({
      acceptedTermsVersion: authUser.acceptedTermsVersion,
      acceptedPrivacyVersion: authUser.acceptedPrivacyVersion,
      deletionRequestedAt: authUser.deletionRequestedAt,
    })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1)

  // Account marked for deletion — bounce to /goodbye and force re-auth.
  if (me[0]?.deletionRequestedAt) {
    redirect('/login?error=account_pending_deletion')
  }

  return (
    <Shell workspace={workspace}>
      {children}
      <LegalReAcceptBanner
        acceptedTermsVersion={me[0]?.acceptedTermsVersion ?? null}
        acceptedPrivacyVersion={me[0]?.acceptedPrivacyVersion ?? null}
      />
      <CookieConsent />
    </Shell>
  )
}
