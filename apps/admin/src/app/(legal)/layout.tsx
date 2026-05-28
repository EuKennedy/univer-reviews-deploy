import Link from 'next/link'
import { BRAND } from '@/lib/legal'

/**
 * Shell para páginas legais públicas (/termos, /privacidade).
 * Layout simples — sem dependência de Better Auth, acessível
 * sem login para que clientes/visitantes possam consultar antes
 * de criar conta. Dark theme matching the marketing site.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--ur-bg)', color: 'var(--ur-text)', minHeight: '100vh' }}>
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--ur-border)' }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold tracking-tight"
          style={{ color: 'var(--ur-text)' }}
        >
          <span
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
              color: 'var(--ur-text-on-accent)',
            }}
          >
            U
          </span>
          {BRAND.product}
        </Link>
        <nav className="flex items-center gap-5 text-sm" style={{ color: 'var(--ur-text-muted)' }}>
          <Link href="/termos" className="hover:text-white transition-colors">Termos</Link>
          <Link href="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-md text-xs font-medium"
            style={{
              background: 'var(--ur-accent-soft)',
              color: 'var(--ur-accent)',
              border: '1px solid var(--ur-accent-soft-3)',
            }}
          >
            Entrar
          </Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12 leading-relaxed">{children}</main>
      <footer
        className="px-6 py-6 text-xs text-center"
        style={{ borderTop: '1px solid var(--ur-border)', color: 'var(--ur-text-muted)' }}
      >
        © {new Date().getFullYear()} {BRAND.company} — {BRAND.product}. Todos os direitos reservados.
      </footer>
    </div>
  )
}
