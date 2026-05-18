'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Star,
  HelpCircle,
  Copy,
  FlaskConical,
  Package,
  Megaphone,
  Plug,
  Gift,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/ThemeToggle'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string | number
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
  { label: 'Avaliações', href: 'reviews', icon: Star },
  { label: 'Perguntas e Respostas', href: 'qa', icon: HelpCircle },
  { label: 'Duplicatas', href: 'duplicates', icon: Copy },
  { label: 'Lab de IA', href: 'ai-lab', icon: FlaskConical },
  { label: 'Produtos', href: 'products', icon: Package },
  { label: 'Campanhas', href: 'campaigns', icon: Megaphone },
  { label: 'Integrações', href: 'integrations', icon: Plug },
  { label: 'Recompensas', href: 'rewards', icon: Gift },
]

const bottomNavItems: NavItem[] = [
  { label: 'Configurações', href: 'settings', icon: Settings },
  { label: 'Faturamento', href: 'billing', icon: CreditCard },
]

interface ShellProps {
  children: React.ReactNode
  workspace: string
}

function NavLink({
  item,
  workspace,
  collapsed,
  onClick,
}: {
  item: NavItem
  workspace: string
  collapsed: boolean
  onClick?: () => void
}) {
  const pathname = usePathname()
  const href = `/${workspace}/${item.href}`
  const isActive =
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative group',
        collapsed && 'justify-center px-2'
      )}
      style={{
        background: isActive ? 'var(--ur-accent-soft)' : 'transparent',
        color: isActive ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
        border: isActive
          ? '1px solid var(--ur-accent-soft-2)'
          : '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--ur-surface-soft)'
          e.currentTarget.style.color = 'var(--ur-text)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--ur-text-soft)'
        }
      }}
    >
      {isActive && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
          style={{ background: 'var(--ur-accent)' }}
        />
      )}

      <item.icon className="w-4 h-4 shrink-0" />

      {!collapsed && (
        <span className="flex-1 truncate">{item.label}</span>
      )}

      {!collapsed && item.badge !== undefined && (
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
          style={{
            background: 'var(--ur-accent-soft-2)',
            color: 'var(--ur-accent)',
          }}
        >
          {item.badge}
        </span>
      )}

      {collapsed && (
        <div
          className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{
            background: 'var(--ur-surface)',
            border: '1px solid var(--ur-border-strong)',
            color: 'var(--ur-text)',
            boxShadow: 'var(--ur-shadow-md)',
          }}
        >
          {item.label}
        </div>
      )}
    </Link>
  )
}

export function Shell({ children, workspace }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const sidebarWidth = collapsed ? 60 : 220

  const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-3 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--ur-border)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background:
              'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-dim))',
          }}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate leading-none"
              style={{ color: 'var(--ur-text)' }}
            >
              UniverReviews
            </p>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              {workspace}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            workspace={workspace}
            collapsed={collapsed}
            onClick={onItemClick}
          />
        ))}
      </nav>

      {/* Bottom nav */}
      <div
        className="px-2 py-2 space-y-0.5"
        style={{ borderTop: '1px solid var(--ur-border)' }}
      >
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            workspace={workspace}
            collapsed={collapsed}
            onClick={onItemClick}
          />
        ))}
      </div>

      {/* User */}
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
            {user?.name ? getInitials(user.name) : 'U'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-medium truncate leading-none"
                  style={{ color: 'var(--ur-text)' }}
                >
                  {user?.name ?? 'Admin'}
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: 'var(--ur-text-muted)' }}
                >
                  {user?.role ?? 'admin'}
                </p>
              </div>

              {/* Theme toggle next to avatar */}
              <ThemeToggle />

              <button
                onClick={logout}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--ur-text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--ur-danger)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--ur-text-muted)'
                }}
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--ur-bg)' }}
    >
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col shrink-0 relative"
        style={{
          background: 'var(--ur-bg-soft)',
          borderRight: '1px solid var(--ur-border)',
          overflow: 'hidden',
        }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute top-4 -right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10"
          style={{
            background: 'var(--ur-surface)',
            border: '1px solid var(--ur-border-strong)',
            color: 'var(--ur-text-muted)',
            boxShadow: 'var(--ur-shadow-sm)',
          }}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </motion.aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: 'var(--ur-overlay)' }}
            />
            <motion.aside
              initial={{ x: -220 }}
              animate={{ x: 0 }}
              exit={{ x: -220 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="fixed left-0 top-0 bottom-0 w-[220px] z-50 lg:hidden"
              style={{
                background: 'var(--ur-bg-soft)',
                borderRight: '1px solid var(--ur-border)',
              }}
            >
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 shrink-0"
          style={{
            borderBottom: '1px solid var(--ur-border)',
            background: 'var(--ur-bg-soft)',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--ur-text-soft)' }}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-dim))',
              }}
            >
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--ur-text)' }}
            >
              UniverReviews
            </span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
