import { cn } from '@/lib/utils'

interface Breadcrumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
  breadcrumbs?: Breadcrumb[]
  className?: string
}

export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        background:
          'linear-gradient(180deg, rgba(212,168,80,0.06) 0%, rgba(212,168,80,0.02) 50%, transparent 100%)',
        borderBottom: '1px solid #1e1e21',
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-0 left-0 w-96 h-full pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at -10% 50%, rgba(212,168,80,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative px-6 py-5">
        {/* Breadcrumb */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 mb-3">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-xs" style={{ color: '#2e2e32' }}>
                    /
                  </span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-xs transition-colors hover:text-[#f0f0f2]"
                    style={{ color: '#5a5a64' }}
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-xs" style={{ color: '#8b8b96' }}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Icon container */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(212,168,80,0.2), rgba(212,168,80,0.06))',
                border: '1px solid rgba(212,168,80,0.2)',
                boxShadow: '0 0 20px rgba(212,168,80,0.08)',
              }}
            >
              <span style={{ color: '#d4a850' }}>{icon}</span>
            </div>

            <div>
              <h1
                className="text-xl font-bold tracking-tight leading-none"
                style={{ color: '#f0f0f2' }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm" style={{ color: '#8b8b96' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      </div>
    </div>
  )
}
