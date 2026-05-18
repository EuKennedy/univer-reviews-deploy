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
          'linear-gradient(180deg, var(--ur-accent-glow) 0%, transparent 100%)',
        borderBottom: '1px solid var(--ur-border)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-0 left-0 w-96 h-full pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at -10% 50%, var(--ur-accent-glow) 0%, transparent 60%)',
        }}
      />

      <div className="relative px-6 py-5">
        {/* Breadcrumb */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 mb-3">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span aria-hidden className="ur-meta" style={{ color: 'var(--ur-text-faint)' }}>
                    /
                  </span>
                )}
                {crumb.href ? (
                  <a href={crumb.href} className="ur-breadcrumb">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="ur-breadcrumb" aria-current="page" style={{ color: 'var(--ur-text)' }}>
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
                  'linear-gradient(135deg, var(--ur-accent-soft-3), var(--ur-accent-glow))',
                border: '1px solid var(--ur-accent-soft-3)',
                boxShadow: '0 0 20px var(--ur-accent-glow)',
              }}
            >
              <span style={{ color: 'var(--ur-accent)' }}>{icon}</span>
            </div>

            <div>
              <h1 className="ur-h1">{title}</h1>
              {subtitle && <p className="mt-1 ur-body-soft">{subtitle}</p>}
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
