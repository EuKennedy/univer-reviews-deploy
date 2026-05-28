'use client'

/**
 * Super admin shell — minimal sidebar tailored for the founder ops
 * surface. Distinct from the merchant Shell so it's visually obvious
 * which "mode" you're in: deeper background, accent-leaning header.
 *
 * Layout intentionally compact (no per-workspace navigation, no help
 * widget, no theme toggle) — this is an internal cockpit, not a customer
 * UI.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Globe2,
  Users2,
  LogOut,
  Shield,
  ArrowLeftCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

interface SuperShellProps {
  children: React.ReactNode
  user: {
    id: string
    email: string
    name: string
  }
}

const NAV = [
  { label: 'Visão geral', href: '/super', icon: Globe2 },
  { label: 'Usuários', href: '/super/users', icon: Users2 },
]

export function SuperShell({ children, user }: SuperShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push('/login'),
      },
    })
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--ur-bg)' }}
    >
      <a href="#main-content" className="ur-skip-link">
        Pular para conteúdo principal
      </a>

      <aside
        className="hidden lg:flex flex-col w-[220px] shrink-0 relative"
        style={{
          background: 'var(--ur-bg-soft)',
          borderRight: '1px solid var(--ur-border)',
        }}
      >
        {/* Brand block — distinctive accent banner so the operator
            instantly knows they are in super-admin mode. */}
        <div
          className="px-4 py-4 shrink-0 relative overflow-hidden"
          style={{ borderBottom: '1px solid var(--ur-border)' }}
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(135deg, var(--ur-accent-glow), transparent 70%)',
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
                boxShadow: '0 0 24px var(--ur-accent-glow)',
              }}
            >
              <Shield className="w-4 h-4" style={{ color: 'var(--ur-text-on-accent)' }} />
            </div>
            <div className="min-w-0">
              <p
                className="text-sm font-semibold leading-none tracking-tight"
                style={{ color: 'var(--ur-text)' }}
              >
                Super admin
              </p>
              <p
                className="text-[11px] mt-1 uppercase tracking-wider font-medium"
                style={{ color: 'var(--ur-accent)' }}
              >
                Ops cockpit
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/super' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative',
                )}
                style={{
                  background: active ? 'var(--ur-accent-soft)' : 'transparent',
                  color: active ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
                  border: active
                    ? '1px solid var(--ur-accent-soft-2)'
                    : '1px solid transparent',
                }}
              >
                {active && (
                  <motion.span
                    layoutId="super-nav-rail"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                    style={{ background: 'var(--ur-accent)' }}
                  />
                )}
                <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom block — exit back to merchant view + user identity */}
        <div
          className="px-2 py-2 space-y-1"
          style={{ borderTop: '1px solid var(--ur-border)' }}
        >
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ color: 'var(--ur-text-soft)' }}
          >
            <ArrowLeftCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Voltar ao painel</span>
          </Link>
        </div>

        <div
          className="px-3 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--ur-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: 'var(--ur-accent-soft-3)',
                color: 'var(--ur-accent)',
              }}
            >
              {user.name?.[0]?.toUpperCase() ?? user.email[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium truncate leading-none"
                style={{ color: 'var(--ur-text)' }}
              >
                {user.name || user.email}
              </p>
              <p
                className="text-[10px] mt-0.5 truncate uppercase tracking-wider font-semibold"
                style={{ color: 'var(--ur-accent)' }}
              >
                admin
              </p>
            </div>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-md transition-colors cursor-pointer"
              style={{ color: 'var(--ur-text-muted)' }}
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-y-auto focus:outline-none"
      >
        {children}
      </main>
    </div>
  )
}
