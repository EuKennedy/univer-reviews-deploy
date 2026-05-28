import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, sql } from '@/lib/db'
import { user, session, account } from '@/lib/db/schema'

/**
 * GET /api/auth/export
 *
 * LGPD Art. 18 V — portabilidade. Devolve um JSON com TODOS os dados
 * pessoais que mantemos do usuário autenticado. Dois dump principais:
 *
 *   • auth.user / auth.session / auth.account (Better Auth)
 *   • public.workspace_users + public.workspaces (Rails-owned)
 *
 * Reviews / Q&A / loyalty grants são dados do workspace (controlador
 * do dado, do ponto de vista LGPD, é a loja). Aqui exportamos só os
 * metadados de membership; o operador da loja exporta os reviews
 * via /api/v1/reviews/export.csv.
 *
 * Streamed como attachment download.
 */
export async function GET() {
  const sess = await auth.api.getSession({ headers: await headers() })
  if (!sess?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = sess.user.id

  // Better Auth tables — only rows owned by this user.
  const [userRow, sessions, accounts] = await Promise.all([
    db.select().from(user).where(eq(user.id, userId)).limit(1),
    db.select().from(session).where(eq(session.userId, userId)),
    db.select().from(account).where(eq(account.userId, userId)),
  ])

  // Rails-owned membership + workspace metadata. Bypass RLS via direct
  // SQL — this is the auth bootstrap, no current workspace context yet.
  let memberships: Array<{
    workspace_id: string
    workspace_slug: string
    workspace_name: string
    role: string
    created_at: string
  }> = []
  try {
    await sql`SET LOCAL row_security = off`
    memberships = await sql<typeof memberships>`
      SELECT
        w.id              AS workspace_id,
        w.slug            AS workspace_slug,
        w.name            AS workspace_name,
        wu.role,
        wu.created_at::text
      FROM public.workspace_users wu
      JOIN public.workspaces w ON w.id = wu.workspace_id
      WHERE wu.better_auth_user_id = ${userId}
      ORDER BY wu.created_at ASC
    `
  } catch (e) {
    // BYPASSRLS may not be granted — fall back to empty list; we'd
    // rather honour the export with partial data than 500. Log for
    // ops to investigate.
    console.warn('[lgpd-export] could not bypass RLS:', e)
  }

  // Strip secret fields from account rows before exporting. The
  // bcrypt hash is the user's credential — its inclusion in a JSON
  // dump that the user downloads is itself a leakage vector.
  const safeAccounts = accounts.map((a) => ({
    ...a,
    password: a.password ? '[REDACTED]' : null,
    accessToken: a.accessToken ? '[REDACTED]' : null,
    refreshToken: a.refreshToken ? '[REDACTED]' : null,
    idToken: a.idToken ? '[REDACTED]' : null,
  }))

  const payload = {
    exported_at: new Date().toISOString(),
    legal_basis: 'LGPD Art. 18 V — portabilidade',
    user: userRow[0] ?? null,
    sessions: sessions.map((s) => ({
      ...s,
      // token field is the session secret — never include in export.
      token: '[REDACTED]',
    })),
    accounts: safeAccounts,
    workspace_memberships: memberships,
  }

  const filename = `univerreviews-export-${userId.slice(0, 8)}-${Date.now()}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
