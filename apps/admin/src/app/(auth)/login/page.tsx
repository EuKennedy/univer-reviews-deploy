'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, Sparkles, Lock, ArrowRight, Loader2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

const passwordSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
})

const magicLinkSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
})

type PasswordValues = z.infer<typeof passwordSchema>
type MagicLinkValues = z.infer<typeof magicLinkSchema>

type Mode = 'password' | 'magic-link'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams?.get('next') || '/'
  const [mode, setMode] = useState<Mode>('password')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })
  const magicForm = useForm<MagicLinkValues>({ resolver: zodResolver(magicLinkSchema) })

  const onPasswordSubmit = async (values: PasswordValues) => {
    setLoading(true)
    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      callbackURL: next,
    })
    setLoading(false)

    if (error || !data) {
      toast.error(error?.message || 'E-mail ou senha incorretos.')
      return
    }
    router.push(next)
  }

  const onMagicLinkSubmit = async (values: MagicLinkValues) => {
    setLoading(true)
    const { error } = await authClient.signIn.magicLink({
      email: values.email,
      callbackURL: next,
    })
    setLoading(false)

    if (error) {
      toast.error(error.message || 'Falha ao enviar link.')
      return
    }
    setMagicSent(true)
    toast.success('Link enviado. Cheque seu e-mail.')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0a0a0b' }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(212,168,80,0.06) 0%, transparent 60%), linear-gradient(rgba(30,30,33,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,30,33,0.4) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 64px 64px, 64px 64px',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 mb-10"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #d4a850, #a07830)' }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold" style={{ color: '#f0f0f2' }}>
            UniverReviews
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl p-8 relative overflow-hidden"
          style={{
            background: '#111113',
            border: '1px solid #1e1e21',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(212,168,80,0.6), transparent)',
            }}
          />

          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: '#f0f0f2' }}>
              Bem-vindo de volta
            </h1>
            <p className="text-sm" style={{ color: '#8b8b96' }}>
              Acesse seu painel admin
            </p>
          </div>

          {/* Mode toggle */}
          <div
            className="flex p-1 rounded-lg mb-5"
            style={{ background: '#0a0a0b', border: '1px solid #1e1e21' }}
          >
            {(['password', 'magic-link'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  setMagicSent(false)
                }}
                className="flex-1 py-1.5 text-xs font-medium rounded-md transition-all"
                style={{
                  background: mode === m ? '#1e1e21' : 'transparent',
                  color: mode === m ? '#f0f0f2' : '#5a5a64',
                }}
              >
                {m === 'password' ? 'Senha' : 'Link mágico'}
              </button>
            ))}
          </div>

          {mode === 'password' ? (
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FieldEmail
                register={passwordForm.register('email')}
                error={passwordForm.formState.errors.email?.message}
              />
              <FieldPassword
                register={passwordForm.register('password')}
                error={passwordForm.formState.errors.password?.message}
              />
              <SubmitButton loading={loading} label="Entrar" icon={<ArrowRight className="w-4 h-4" />} />
            </form>
          ) : magicSent ? (
            <div
              className="rounded-lg p-5 text-center"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <Wand2 className="w-6 h-6 mx-auto mb-2" style={{ color: '#22c55e' }} />
              <p className="text-sm" style={{ color: '#f0f0f2' }}>
                Link enviado!
              </p>
              <p className="text-xs mt-1" style={{ color: '#8b8b96' }}>
                Abra seu e-mail e clique no link mágico para entrar.
              </p>
            </div>
          ) : (
            <form onSubmit={magicForm.handleSubmit(onMagicLinkSubmit)} className="space-y-4">
              <FieldEmail
                register={magicForm.register('email')}
                error={magicForm.formState.errors.email?.message}
              />
              <SubmitButton loading={loading} label="Enviar link" icon={<Wand2 className="w-4 h-4" />} />
            </form>
          )}

          <p className="mt-6 text-xs text-center" style={{ color: '#5a5a64' }}>
            Acesso restrito a equipe autorizada
          </p>
        </motion.div>

        <p className="text-center mt-6 text-xs" style={{ color: '#5a5a64' }}>
          dash.univerreviews.com
        </p>
      </div>
    </div>
  )
}

// ─── Field components (extracted for readability) ───────────────────────────

function FieldEmail({
  register,
  error,
}: {
  register: ReturnType<ReturnType<typeof useForm>['register']>
  error?: string
}) {
  return (
    <div>
      <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: '#8b8b96' }}>
        E-mail
      </label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5a5a64' }} />
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="voce@empresa.com"
          {...register}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm transition-all duration-150 outline-none"
          style={{
            background: '#0a0a0b',
            border: error ? '1px solid rgba(239,68,68,0.6)' : '1px solid #1e1e21',
            color: '#f0f0f2',
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function FieldPassword({
  register,
  error,
}: {
  register: ReturnType<ReturnType<typeof useForm>['register']>
  error?: string
}) {
  return (
    <div>
      <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: '#8b8b96' }}>
        Senha
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5a5a64' }} />
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm transition-all duration-150 outline-none"
          style={{
            background: '#0a0a0b',
            border: error ? '1px solid rgba(239,68,68,0.6)' : '1px solid #1e1e21',
            color: '#f0f0f2',
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function SubmitButton({
  loading,
  label,
  icon,
}: {
  loading: boolean
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-150"
      style={{
        background: loading ? '#a07830' : 'linear-gradient(135deg, #d4a850, #c49040)',
        color: '#0a0a0b',
        boxShadow: loading ? 'none' : '0 1px 2px rgba(0,0,0,0.4)',
      }}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Aguarde…
        </>
      ) : (
        <>
          {label}
          {icon}
        </>
      )}
    </button>
  )
}
