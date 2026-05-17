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

  const rows = await sql<{ slug: string }[]>`
    SELECT w.slug
    FROM public.workspaces w
    INNER JOIN public.workspace_users wu ON wu.workspace_id = w.id
    WHERE wu.better_auth_user_id = ${session.user.id}
    ORDER BY wu.created_at ASC
    LIMIT 1
  `

  if (rows.length === 0) {
    redirect('/login?error=no_workspace')
  }

  redirect(`/${rows[0].slug}/dashboard`)
}
