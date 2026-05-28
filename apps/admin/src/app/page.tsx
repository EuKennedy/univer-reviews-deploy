import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'

/**
 * Root route. Resolves where the user should land:
 *   - No session         → /login
 *   - Session but no WS  → /login?error=no_workspace (auto-provision failed)
 *   - Session + WS       → /<workspace-slug>/dashboard
 *
 * Server-rendered so the redirect happens before the browser sees any UI,
 * avoiding the previous flash-then-redirect loop after Better Auth callback.
 */
export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/login')
  }

  const rows = await sql<
    Array<{ slug: string; domain_count: number; product_count: number }>
  >`
    SELECT
      w.slug,
      COALESCE((SELECT COUNT(*) FROM public.workspace_domains wd WHERE wd.workspace_id = w.id), 0) AS domain_count,
      COALESCE((SELECT COUNT(*) FROM public.products p WHERE p.workspace_id = w.id), 0)            AS product_count
    FROM public.workspaces w
    INNER JOIN public.workspace_users wu ON wu.workspace_id = w.id
    WHERE wu.better_auth_user_id = ${session.user.id}
    ORDER BY wu.created_at ASC
    LIMIT 1
  `

  if (rows.length === 0) {
    redirect('/login?error=no_workspace')
  }

  const me = rows[0]
  // First-time user (no domain or no products) lands on the onboarding
  // wizard. Once they have at least one of each, the root jumps straight
  // to the dashboard.
  if (Number(me.domain_count) === 0 || Number(me.product_count) === 0) {
    redirect('/onboarding')
  }

  redirect(`/${me.slug}/dashboard`)
}
