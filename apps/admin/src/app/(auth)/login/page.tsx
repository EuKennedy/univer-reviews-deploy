'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, Sparkles, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { setCookie } from 'cookies-next'

const schema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.message || 'E-mail ou senha incorretos.')
        setLoading(false)
        return
      }

      const data = await res.json()
      setCookie('univer_token', data.token, {
        maxAge: 60 * 60 * 24,
        path: '/',
        sameSite: 'lax',
        secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
      })
      setCookie('univer_workspace', data.user.workspace_slug, {
        maxAge: 60 * 60 * 24,
        path: '/',
        sameSite: 'lax',
      })

      router.push(`/${data.user.workspace_slug}/dashboard`)
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  {...register('email')}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm transition-all duration-150 outline-none"
                  style={{
                    background: '#0a0a0b',
                    border: errors.email ? '1px solid rgba(239,68,68,0.6)' : '1px solid #1e1e21',
                    color: '#f0f0f2',
                  }}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs" style={{ color: '#ef4444' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

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
                  {...register('password')}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm transition-all duration-150 outline-none"
                  style={{
                    background: '#0a0a0b',
                    border: errors.password ? '1px solid rgba(239,68,68,0.6)' : '1px solid #1e1e21',
                    color: '#f0f0f2',
                  }}
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs" style={{ color: '#ef4444' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

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
                  Entrando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

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
