import { BRAND } from '@/lib/legal'

export const metadata = {
  title: `Status — ${BRAND.product}`,
  description: `Status operacional dos componentes do ${BRAND.product}.`,
}

interface ComponentStatus {
  name: string
  ok: boolean
  detail?: string
}

async function probe(): Promise<{ overallOk: boolean; checks: ComponentStatus[]; ts: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.univerreviews.com'
  const checks: ComponentStatus[] = []
  let overallOk = true

  // API health probe — light path, 200/503.
  try {
    const res = await fetch(`${apiUrl}/health`, { cache: 'no-store', next: { revalidate: 30 } })
    const json = await res.json().catch(() => ({}))
    const ok = res.ok && (json.status === 'ok' || json.status === 'healthy')
    checks.push({
      name: 'API (Rails)',
      ok,
      detail: json.db ? `DB: ${json.db}` : undefined,
    })
    if (!ok) overallOk = false
  } catch {
    checks.push({ name: 'API (Rails)', ok: false, detail: 'unreachable' })
    overallOk = false
  }

  // Widget CDN — HEAD on widget.js.
  try {
    const res = await fetch(`${apiUrl}/widget.js`, {
      method: 'HEAD',
      cache: 'no-store',
      next: { revalidate: 60 },
    })
    checks.push({ name: 'Widget CDN', ok: res.ok, detail: res.ok ? 'serving' : `HTTP ${res.status}` })
    if (!res.ok) overallOk = false
  } catch {
    checks.push({ name: 'Widget CDN', ok: false, detail: 'unreachable' })
    overallOk = false
  }

  // Admin shell — we're literally running it, so if this page renders it's up.
  checks.push({ name: 'Admin (dash)', ok: true, detail: 'serving' })

  return { overallOk, checks, ts: new Date().toISOString() }
}

export default async function StatusPage() {
  const { overallOk, checks, ts } = await probe()

  return (
    <article className="prose prose-invert max-w-none">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Status do serviço</h1>
        <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
          Atualizado em {new Date(ts).toLocaleString('pt-BR')}
        </p>
      </header>

      <div
        className="rounded-xl p-5 mb-8 flex items-center gap-4"
        style={{
          background: overallOk ? 'var(--ur-success-bg)' : 'var(--ur-danger-bg)',
          border: `1px solid ${overallOk ? 'var(--ur-success)' : 'var(--ur-danger)'}`,
          color: overallOk ? 'var(--ur-success)' : 'var(--ur-danger)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
          style={{
            background: overallOk ? 'var(--ur-success)' : 'var(--ur-danger)',
            color: 'white',
          }}
          aria-hidden
        >
          {overallOk ? '✓' : '!'}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-0.5">
            {overallOk ? 'Todos os sistemas operacionais' : 'Algum componente está degradado'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--ur-text-soft)' }}>
            {overallOk
              ? 'Nenhum incidente em andamento.'
              : 'Estamos investigando. Acompanhe esta página para atualizações.'}
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {checks.map((c) => (
          <li
            key={c.name}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{
              background: 'var(--ur-surface)',
              border: '1px solid var(--ur-border)',
            }}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: c.ok ? 'var(--ur-success)' : 'var(--ur-danger)' }}
              aria-hidden
            />
            <span className="flex-1 font-medium" style={{ color: 'var(--ur-text)' }}>
              {c.name}
            </span>
            <span className="text-xs" style={{ color: c.ok ? 'var(--ur-success)' : 'var(--ur-danger)' }}>
              {c.ok ? 'Operacional' : 'Degradado'}
            </span>
            {c.detail && (
              <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                {c.detail}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs mt-8" style={{ color: 'var(--ur-text-muted)' }}>
        Esta página é regenerada server-side a cada 30s. Para incidentes
        graves, anúncios são enviados por e-mail aos administradores e
        publicados aqui com timeline + RCA pós-resolução.
      </p>
    </article>
  )
}

// Disable static gen — we want fresh probes on every visit (well, every 30s
// per fetch revalidate).
export const dynamic = 'force-dynamic'
