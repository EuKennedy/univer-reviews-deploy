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
        borderBottom: '1px solid #1e1e21',
        background: 'rgba(17,17,19,0.6)',
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
        className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
        style={{ color: '#5a5a64' }}
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
        className="pl-9 pr-3 py-1.5 text-sm rounded-lg outline-none transition-all duration-150 w-56"
        style={{
          background: '#0a0a0b',
          border: '1px solid #1e1e21',
          color: '#f0f0f2',
        }}
        onFocus={(e) => {
          e.target.style.border = '1px solid rgba(212,168,80,0.4)'
          e.target.style.boxShadow = '0 0 0 3px rgba(212,168,80,0.06)'
        }}
        onBlur={(e) => {
          e.target.style.border = '1px solid #1e1e21'
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
      className={cn('px-3 py-1.5 text-sm rounded-lg outline-none transition-all duration-150 cursor-pointer', className)}
      style={{
        background: '#0a0a0b',
        border: '1px solid #1e1e21',
        color: value ? '#f0f0f2' : '#5a5a64',
        appearance: 'none',
        paddingRight: '2rem',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235a5a64' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
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
      background: '#0a0a0b',
      border: '1px solid #1e1e21',
      color: '#8b8b96',
    },
    primary: {
      background: 'linear-gradient(135deg, #d4a850, #c49040)',
      border: 'none',
      color: '#0a0a0b',
    },
    danger: {
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.2)',
      color: '#ef4444',
    },
    ghost: {
      background: 'transparent',
      border: '1px solid transparent',
      color: '#8b8b96',
    },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
      style={styles[variant]}
    >
      {children}
    </button>
  )
}
