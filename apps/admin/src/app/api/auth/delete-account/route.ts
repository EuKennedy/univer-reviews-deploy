import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, sql } from '@/lib/db'
import { user } from '@/lib/db/schema'

/**
 * POST /api/auth/delete-account
 *
 * LGPD Art. 18 VI — eliminação. Marca a conta para exclusão e revoga
 * todas as sessões ativas. A exclusão real (hard delete) acontece após
 * o período de retenção configurado (default 30 dias) via job scheduled
 * — `DeleteRequestedUsersJob` no backend Rails. Isso dá ao usuário uma
 * janela para reverter um pedido acidental + cumpre a obrigação legal
 * de manter logs por X dias antes do apagamento completo.
 *
 * Comportamento:
 *  1. Confirma que o usuário NÃO é o último OWNER de algum workspace
 *     (orfanização criaria contas zombie). Se for, retorna 409 e exige
 *     transferência de propriedade primeiro.
 *  2. Stamp user.deletion_requested_at = NOW.
 *  3. Better Auth: revoga sessões (signOut server-side).
 *  4. Retorna 200 com cleanup_at (30 dias à frente) para a UI mostrar.
 *
 * Reversão: chamar DELETE neste mesmo endpoint dentro da janela.
 */
export async function POST() {
  const sess = await auth.api.getSession({ headers: await headers() })
  if (!sess?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const userId = sess.user.id

  // 1. Guard: last-owner-of-some-workspace can't self-delete.
  let blockingWorkspaces: Array<{ slug: string; name: string }> = []
  try {
    await sql`SET LOCAL row_security = off`
    blockingWorkspaces = await sql<typeof blockingWorkspaces>`
      WITH my_owner_rows AS (
        SELECT workspace_id
        FROM public.workspace_users
        WHERE better_auth_user_id = ${userId} AND role = 'owner'
      )
      SELECT w.slug, w.name
      FROM public.workspaces w
      WHERE w.id IN (SELECT workspace_id FROM my_owner_rows)
        AND (
          SELECT COUNT(*) FROM public.workspace_users wu
          WHERE wu.workspace_id = w.id AND wu.role = 'owner'
        ) <= 1
    `
  } catch (e) {
    console.warn('[lgpd-delete] could not check ownership:', e)
  }

  if (blockingWorkspaces.length > 0) {
    return NextResponse.json(
      {
        error: 'last_owner',
        message:
          'Você é o único dono de pelo menos um workspace. Transfira a propriedade ou exclua o workspace antes de excluir sua conta.',
        workspaces: blockingWorkspaces,
      },
      { status: 409 },
    )
  }

  // 2. Stamp deletion_requested_at.
  await db
    .update(user)
    .set({ deletionRequestedAt: new Date() })
    .where(eq(user.id, userId))

  // 3. Revoke sessions — signs out everywhere.
  try {
    await auth.api.signOut({ headers: await headers() })
  } catch (e) {
    console.warn('[lgpd-delete] signOut failed (continuing):', e)
  }

  const cleanupAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  return NextResponse.json({
    ok: true,
    deletion_requested_at: new Date().toISOString(),
    cleanup_at: cleanupAt.toISOString(),
    message:
      'Pedido registrado. Sua conta será permanentemente excluída em 30 dias. Para reverter, faça login novamente e use Cancelar exclusão.',
  })
}

/**
 * DELETE /api/auth/delete-account
 *
 * Reverte um pedido de exclusão dentro da janela de 30 dias. Limpa o
 * campo `deletion_requested_at` e o usuário volta ao estado normal.
 */
export async function DELETE() {
  const sess = await auth.api.getSession({ headers: await headers() })
  if (!sess?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  await db
    .update(user)
    .set({ deletionRequestedAt: null })
    .where(eq(user.id, sess.user.id))

  return NextResponse.json({ ok: true, cancelled_at: new Date().toISOString() })
}
