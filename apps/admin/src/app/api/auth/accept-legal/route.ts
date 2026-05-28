import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { LEGAL_VERSIONS } from '@/lib/legal'

/**
 * POST /api/auth/accept-legal
 *
 * Registers the signed-in user's acceptance of the latest Terms +
 * Privacy versions. Idempotent — re-aceite of the same version just
 * updates accepted_at. Server-side validation prevents the client from
 * smuggling an arbitrary "version" string (must exactly match the
 * canonical LEGAL_VERSIONS values).
 *
 * Audit-friendly: bumps user.accepted_at to NOW so the audit timeline
 * shows when consent was given.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { terms_version?: string; privacy_version?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (
    body.terms_version !== LEGAL_VERSIONS.terms ||
    body.privacy_version !== LEGAL_VERSIONS.privacy
  ) {
    return NextResponse.json(
      {
        error: 'version_mismatch',
        message: 'Aceite precisa referenciar a versão atual exposta pelo servidor.',
        expected: LEGAL_VERSIONS,
      },
      { status: 409 },
    )
  }

  await db
    .update(user)
    .set({
      acceptedTermsVersion: LEGAL_VERSIONS.terms,
      acceptedPrivacyVersion: LEGAL_VERSIONS.privacy,
      acceptedAt: new Date(),
    })
    .where(eq(user.id, session.user.id))

  return NextResponse.json({
    ok: true,
    accepted_at: new Date().toISOString(),
    terms_version: LEGAL_VERSIONS.terms,
    privacy_version: LEGAL_VERSIONS.privacy,
  })
}
