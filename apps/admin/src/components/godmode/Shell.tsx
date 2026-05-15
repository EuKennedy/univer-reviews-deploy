'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Star,
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

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string | number
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
  { label: 'Reviews', href: 'reviews', icon: Star },
  { label: 'Duplicates', href: 'duplicates', icon: Copy },
  { label: 'AI Lab', href: 'ai-lab', icon: FlaskConical },
  { label: 'Products', href: 'products', icon: Package },
  { label: 'Campaigns', href: 'campaigns', icon: Megaphone },
  { label: 'Integrations', href: 'integrations', icon: Plug },
  { label: 'Rewards', href: 'rewards', icon: Gift },
]

const bottomNavItems: NavItem[] = [
  { label: 'Settings', href: 'settings', icon: Settings },
  { label: 'Billing', href: 'billing', icon: CreditCard },
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
        background: isActive ? 'rgba(212,168,80,0.1)' : 'transparent',
        color: isActive ? '#d4a850' : '#8b8b96',
        border: isActive
          ? '1px solid rgba(212,168,80,0.15)'
          : '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.color = '#f0f0f2'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#8b8b96'
        }
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
          style={{ background: '#d4a850' }}
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
            background: 'rgba(212,168,80,0.15)',
            color: '#d4a850',
          }}
        >
          {item.badge}
        </span>
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{
            background: '#1e1e21',
            border: '1px solid #2a2a2d',
            color: '#f0f0f2',
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

  // Close mobile on resize
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
        style={{ borderBottom: '1px solid #1e1e21' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #d4a850, #a07830)' }}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate leading-none"
              style={{ color: '#f0f0f2' }}
            >
              UniverReviews
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: '#5a5a64' }}>
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
        style={{ borderTop: '1px solid #1e1e21' }}
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
        style={{ borderTop: '1px solid #1e1e21' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'rgba(212,168,80,0.2)', color: '#d4a850' }}
          >
            {user?.name ? getInitials(user.name) : 'U'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-medium truncate leading-none"
                  style={{ color: '#f0f0f2' }}
                >
                  {user?.name ?? 'Admin'}
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: '#5a5a64' }}
                >
                  {user?.role ?? 'admin'}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: '#5a5a64' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#5a5a64' }}
                title="Sign out"
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
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a0a0b' }}>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col shrink-0 relative"
        style={{
          background: '#0d0d0f',
          borderRight: '1px solid #1e1e21',
          overflow: 'hidden',
        }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute top-4 -right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10"
          style={{
            background: '#1a1a1d',
            border: '1px solid #2a2a2d',
            color: '#5a5a64',
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
              style={{ background: 'rgba(0,0,0,0.7)' }}
            />
            <motion.aside
              initial={{ x: -220 }}
              animate={{ x: 0 }}
              exit={{ x: -220 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="fixed left-0 top-0 bottom-0 w-[220px] z-50 lg:hidden"
              style={{
                background: '#0d0d0f',
                borderRight: '1px solid #1e1e21',
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
          style={{ borderBottom: '1px solid #1e1e21', background: '#0d0d0f' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg"
            style={{ color: '#8b8b96' }}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #d4a850, #a07830)' }}
            >
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
              UniverReviews
            </span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
