'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormValues = z.infer<typeof schema>
type Step = 'idle' | 'loading' | 'sent'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('idle')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const email = watch('email')

  const onSubmit = async (values: FormValues) => {
    setStep('loading')
    try {
      await api.auth.magicLink(values.email)
      setStep('sent')
    } catch {
      toast.error('Failed to send magic link. Please try again.')
      setStep('idle')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0a0a0b' }}
    >
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(212,168,80,0.06) 0%, transparent 60%), linear-gradient(rgba(30,30,33,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,30,33,0.4) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 64px 64px, 64px 64px',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
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

        {/* Card */}
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
          {/* Gold top accent */}
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(212,168,80,0.6), transparent)',
            }}
          />

          <AnimatePresence mode="wait">
            {step !== 'sent' ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-7">
                  <h1
                    className="text-2xl font-bold tracking-tight mb-1.5"
                    style={{ color: '#f0f0f2' }}
                  >
                    Welcome back
                  </h1>
                  <p className="text-sm" style={{ color: '#8b8b96' }}>
                    Sign in to your admin dashboard
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: '#8b8b96' }}
                    >
                      Work email
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: '#5a5a64' }}
                      />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        placeholder="you@company.com"
                        {...register('email')}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm transition-all duration-150 outline-none"
                        style={{
                          background: '#0a0a0b',
                          border: errors.email
                            ? '1px solid rgba(239,68,68,0.6)'
                            : '1px solid #1e1e21',
                          color: '#f0f0f2',
                        }}
                        onFocus={(e) => {
                          e.target.style.border = '1px solid rgba(212,168,80,0.5)'
                          e.target.style.boxShadow =
                            '0 0 0 3px rgba(212,168,80,0.08)'
                        }}
                        onBlur={(e) => {
                          e.target.style.border = errors.email
                            ? '1px solid rgba(239,68,68,0.6)'
                            : '1px solid #1e1e21'
                          e.target.style.boxShadow = 'none'
                        }}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1.5 text-xs" style={{ color: '#ef4444' }}>
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={step === 'loading'}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-150"
                    style={{
                      background:
                        step === 'loading'
                          ? '#a07830'
                          : 'linear-gradient(135deg, #d4a850, #c49040)',
                      color: '#0a0a0b',
                      boxShadow: step === 'loading'
                        ? 'none'
                        : '0 1px 2px rgba(0,0,0,0.4)',
                    }}
                  >
                    {step === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending link…
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-6 text-xs text-center" style={{ color: '#5a5a64' }}>
                  No password needed — we&apos;ll email you a secure magic link
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'rgba(34, 197, 94, 0.12)' }}
                >
                  <CheckCircle2 className="w-7 h-7" style={{ color: '#22c55e' }} />
                </div>
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ color: '#f0f0f2' }}
                >
                  Check your inbox
                </h2>
                <p className="text-sm mb-5" style={{ color: '#8b8b96' }}>
                  We sent a magic link to
                </p>
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mb-6"
                  style={{
                    background: 'rgba(212,168,80,0.1)',
                    border: '1px solid rgba(212,168,80,0.2)',
                    color: '#d4a850',
                  }}
                >
                  <Mail className="w-4 h-4" />
                  {email}
                </div>
                <p className="text-xs" style={{ color: '#5a5a64' }}>
                  The link expires in 15 minutes. Check your spam folder if you
                  don&apos;t see it.
                </p>
                <button
                  onClick={() => setStep('idle')}
                  className="mt-5 text-xs transition-colors"
                  style={{ color: '#8b8b96' }}
                >
                  Use a different email
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-center mt-6 text-xs" style={{ color: '#5a5a64' }}>
          dash.univerreviews.com — Staff only
        </p>
      </div>
    </div>
  )
}
