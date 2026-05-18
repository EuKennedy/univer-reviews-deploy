import { cn } from '@/lib/utils'

interface ToolbarProps {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export function Toolbar({ left, right, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3',
        className
      )}
      style={{
        borderBottom: '1px solid var(--ur-border)',
        background: 'var(--ur-surface-overlay)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">{left}</div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  )
}

interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
        style={{ color: 'var(--ur-text-soft)' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-3 py-2 text-sm font-medium rounded-lg outline-none transition-all duration-150 w-64"
        style={{
          background: 'var(--ur-bg)',
          border: '1px solid var(--ur-border)',
          color: 'var(--ur-text)',
        }}
        onFocus={(e) => {
          e.target.style.border = '1px solid var(--ur-accent-ring)'
          e.target.style.boxShadow = '0 0 0 3px var(--ur-accent-glow)'
        }}
        onBlur={(e) => {
          e.target.style.border = '1px solid var(--ur-border)'
          e.target.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}

interface FilterSelectProps {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  placeholder?: string
  className?: string
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = 'Filtrar…',
  className,
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'px-3 py-2 text-sm font-medium rounded-lg outline-none transition-all duration-150 cursor-pointer',
        className
      )}
      style={{
        background: 'var(--ur-bg)',
        border: '1px solid var(--ur-border)',
        color: value ? 'var(--ur-text)' : 'var(--ur-text-soft)',
        appearance: 'none',
        paddingRight: '2rem',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

interface ActionButtonProps {
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export function ActionButton({
  onClick,
  variant = 'default',
  disabled,
  children,
  className,
}: ActionButtonProps) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: 'var(--ur-bg)',
      border: '1px solid var(--ur-border)',
      color: 'var(--ur-text-secondary)',
    },
    primary: {
      background:
        'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
      border: 'none',
      color: 'var(--ur-text-on-accent)',
    },
    danger: {
      background: 'var(--ur-danger-bg)',
      border: '1px solid var(--ur-danger)',
      color: 'var(--ur-danger)',
    },
    ghost: {
      background: 'transparent',
      border: '1px solid transparent',
      color: 'var(--ur-text-secondary)',
    },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
      style={styles[variant]}
    >
      {children}
    </button>
  )
}
