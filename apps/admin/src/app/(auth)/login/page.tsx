'use client'

import { Suspense, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, Loader2, Wand2, Chrome } from 'lucide-react'
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

// Next.js 15 requires useSearchParams to be inside a Suspense boundary at the
// page level — otherwise prerender fails with `missing-suspense-with-csr-bailout`.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  )
}

function LoginFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--ur-bg)' }}
    >
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--ur-accent)' }} />
    </div>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams?.get('next') || '/'
  const [mode, setMode] = useState<Mode>('password')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })
  const magicForm = useForm<MagicLinkValues>({ resolver: zodResolver(magicLinkSchema) })

  // Surface OAuth errors that come back as ?error=... in the URL
  useEffect(() => {
    const err = searchParams?.get('error')
    if (err) {
      const map: Record<string, string> = {
        access_denied: 'Acesso não autorizado. Solicite um convite ao administrador.',
        signup_disabled: 'Cadastro desativado. Use uma conta autorizada.',
        invalid_provider: 'Provedor de login indisponível no momento.',
        no_workspace: 'Sua conta foi criada mas o workspace ainda está sendo provisionado. Tente novamente em alguns segundos — se persistir, fale com o suporte.',
        account_pending_deletion: 'Sua conta está com pedido de exclusão ativo. Faça login para reverter ou aguardar a exclusão permanente.',
      }
      toast.error(map[err] || decodeURIComponent(err))
    }
  }, [searchParams])

  // Reverse-guard (replaces the old (auth)-layout redirect that caused an
  // infinite loop): if a signed-in user lands on a *bare* /login (no error
  // context), bounce them to their destination. When there IS an error
  // (?error=no_workspace / account_pending_deletion) we stay so the message
  // can render — never ping-pong back to the root resolver.
  useEffect(() => {
    if (searchParams?.get('error')) return
    let active = true
    authClient.getSession().then((res) => {
      if (active && res?.data?.session) router.replace(next)
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const onGoogleSignIn = async () => {
    setGoogleLoading(true)
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: next,
    })
    if (error) {
      toast.error(error.message || 'Falha ao iniciar login com Google')
      setGoogleLoading(false)
    }
    // On success the browser is redirected — no need to setGoogleLoading(false)
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
      style={{ background: 'var(--ur-bg)' }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, var(--ur-accent-glow) 0%, transparent 60%), linear-gradient(rgba(30,30,33,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,30,33,0.4) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 64px 64px, 64px 64px',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-2 mb-10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="UniverReviews"
            className="h-20 w-auto object-contain"
            width={120}
            height={110}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl p-8 relative overflow-hidden"
          style={{
            background: 'var(--ur-surface)',
            border: '1px solid var(--ur-border)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px var(--ur-overlay)',
          }}
        >
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--ur-accent-ring), transparent)',
            }}
          />

          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--ur-text)' }}>
              Bem-vindo de volta
            </h1>
            <p className="text-sm" style={{ color: 'var(--ur-text-soft)' }}>
              Acesse seu painel admin
            </p>
          </div>

          {/* Google sign-in temporariamente desativado em prod —
             retomar após validar fluxo de OAuth callback + signup
             workspace-creation E2E. Set NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=true
             pra reativar. */}
          {process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === 'true' && (
            <>
              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-150 mb-4"
                style={{
                  background: '#ffffff',
                  color: 'var(--ur-surface-soft)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Chrome className="w-4 h-4" />
                )}
                Continuar com Google
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--ur-border)' }} />
                <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                  ou
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--ur-border)' }} />
              </div>
            </>
          )}

          {/* Mode toggle */}
          <div
            className="flex p-1 rounded-lg mb-5"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
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
                  background: mode === m ? 'var(--ur-border)' : 'transparent',
                  color: mode === m ? 'var(--ur-text)' : 'var(--ur-text-muted)',
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
              style={{ background: 'var(--ur-success-bg)', border: '1px solid var(--ur-success-bg)' }}
            >
              <Wand2 className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--ur-success)' }} />
              <p className="text-sm" style={{ color: 'var(--ur-text)' }}>
                Link enviado!
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ur-text-soft)' }}>
                Abra seu e-mail e clique no link mágico para entrar.
              </p>
            </div>
          ) : (
            <form onSubmit={magicForm.handleSubmit(onMagicLinkSubmit)} className="space-y-4">
              <FieldEmail
                register={magicForm.register('email')}
                error={magicForm.formState.errors.email?.message}
              />
              <p className="text-[11px] leading-snug" style={{ color: 'var(--ur-text-muted)' }}>
                Link mágico é enviado apenas para e-mails de contas já
                cadastradas. Se você ainda não tem conta, use o cadastro
                por senha ou peça um convite ao administrador.
              </p>
              <SubmitButton loading={loading} label="Enviar link" icon={<Wand2 className="w-4 h-4" />} />
            </form>
          )}
        </motion.div>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
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
      <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-soft)' }}>
        E-mail
      </label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="voce@empresa.com"
          {...register}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm transition-all duration-150 outline-none"
          style={{
            background: 'var(--ur-bg)',
            border: error ? '1px solid rgba(239,68,68,0.6)' : '1px solid var(--ur-border)',
            color: 'var(--ur-text)',
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--ur-danger)' }}>
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
      <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-soft)' }}>
        Senha
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm transition-all duration-150 outline-none"
          style={{
            background: 'var(--ur-bg)',
            border: error ? '1px solid rgba(239,68,68,0.6)' : '1px solid var(--ur-border)',
            color: 'var(--ur-text)',
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--ur-danger)' }}>
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
        background: loading ? 'var(--ur-accent-dim)' : 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
        color: 'var(--ur-text-on-accent)',
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
