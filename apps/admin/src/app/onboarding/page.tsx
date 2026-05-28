import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { OnboardingFlow } from './OnboardingFlow'

/**
 * /onboarding — first-time setup wizard.
 *
 * Server-side resolver: if the user already finished onboarding (workspace
 * has at least one workspace_domain AND at least one product), redirect
 * straight to the dashboard. Otherwise mount the client-side multi-step
 * flow.
 */
export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/login?next=/onboarding')
  }

  const rows = await sql<
    Array<{
      workspace_id: string
      slug: string
      name: string
      domain_count: number
      product_count: number
    }>
  >`
    SELECT
      w.id   AS workspace_id,
      w.slug,
      w.name,
      COALESCE((SELECT COUNT(*) FROM public.workspace_domains wd WHERE wd.workspace_id = w.id), 0) AS domain_count,
      COALESCE((SELECT COUNT(*) FROM public.products p WHERE p.workspace_id = w.id), 0)            AS product_count
    FROM public.workspaces w
    INNER JOIN public.workspace_users wu
      ON wu.workspace_id = w.id
     AND wu.better_auth_user_id = ${session.user.id}
    ORDER BY wu.created_at ASC
    LIMIT 1
  `

  if (rows.length === 0) {
    redirect('/login?error=no_workspace')
  }

  const me = rows[0]

  // If onboarding is materially done (domain + ≥1 product), skip the wizard.
  if (me.domain_count > 0 && me.product_count > 0) {
    redirect(`/${me.slug}/dashboard`)
  }

  return (
    <OnboardingFlow
      workspaceId={me.workspace_id}
      workspaceSlug={me.slug}
      workspaceName={me.name}
      userName={session.user.name || session.user.email.split('@')[0]}
      hasDomain={me.domain_count > 0}
      hasProducts={me.product_count > 0}
    />
  )
}
