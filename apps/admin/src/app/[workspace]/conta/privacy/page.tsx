'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, Trash2, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'

/**
 * Painel LGPD do usuário.
 *
 * Concentra os direitos do titular previstos no Art. 18 LGPD:
 *  • V — Portabilidade: botão "Exportar meus dados" baixa JSON
 *  • VI — Eliminação: botão "Excluir minha conta" abre confirmação
 *  • Histórico de aceite (terms/privacy version + accepted_at)
 *
 * Texto explicativo descreve o procedimento + janela de 30 dias antes
 * do hard-delete + como reverter.
 */
export default function PrivacyAccountPage() {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typed, setTyped] = useState('')

  const downloadMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/export', { credentials: 'include' })
      if (!res.ok) throw new Error('Falha no export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `univerreviews-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success('Export baixado. Verifique sua pasta de downloads.'),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao exportar'),
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        credentials: 'include',
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || 'Falha ao solicitar exclusão')
      return body as { cleanup_at: string; message: string }
    },
    onSuccess: (r) => {
      toast.success(r.message, { duration: 8000 })
      setConfirmDelete(false)
      // Hard redirect — sessions revoked.
      setTimeout(() => (window.location.href = '/login'), 1500)
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao solicitar exclusão'),
  })

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<ShieldCheck className="w-5 h-5" />}
        title="Privacidade e seus dados"
        subtitle="Direitos garantidos pela LGPD (Lei 13.709/2018)"
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Export */}
          <Card>
            <div className="flex items-start gap-3">
              <Icon><Download className="w-5 h-5" /></Icon>
              <div className="flex-1">
                <h3 className="text-base font-semibold mb-1">Exportar meus dados</h3>
                <p className="text-sm" style={{ color: 'var(--ur-text-soft)' }}>
                  Art. 18 V — portabilidade. Baixa um arquivo JSON com todos os dados
                  que mantemos sobre você: perfil, sessões, contas conectadas e
                  participações em workspaces. Tokens e senhas vêm redacted.
                </p>
                <button
                  type="button"
                  onClick={() => downloadMut.mutate()}
                  disabled={downloadMut.isPending}
                  className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{
                    background: 'var(--ur-accent-soft)',
                    color: 'var(--ur-accent)',
                    border: '1px solid var(--ur-accent-soft-3)',
                  }}
                >
                  {downloadMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Baixar JSON
                </button>
              </div>
            </div>
          </Card>

          {/* Delete */}
          <Card variant="danger">
            <div className="flex items-start gap-3">
              <Icon variant="danger"><Trash2 className="w-5 h-5" /></Icon>
              <div className="flex-1">
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
                  Excluir minha conta
                </h3>
                <p className="text-sm" style={{ color: 'var(--ur-text-soft)' }}>
                  Art. 18 VI — eliminação. Sua conta entra em janela de exclusão de{' '}
                  <strong>30 dias</strong>. Durante esse período, sessões ficam revogadas
                  e o acesso é bloqueado. Após 30 dias todos os dados pessoais são
                  permanentemente apagados (workspace_user, sessões, contas OAuth).
                </p>
                <p className="text-sm mt-2" style={{ color: 'var(--ur-text-soft)' }}>
                  Se você é o único dono de algum workspace, transfira a propriedade
                  primeiro — o sistema bloqueia a exclusão caso isso geraria workspace
                  órfão.
                </p>

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    style={{
                      background: 'var(--ur-danger-bg)',
                      color: 'var(--ur-danger)',
                      border: '1px solid var(--ur-danger-bg)',
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Solicitar exclusão
                  </button>
                ) : (
                  <div
                    className="mt-4 p-4 rounded-md"
                    style={{ background: 'var(--ur-danger-bg)', border: '1px solid var(--ur-danger)' }}
                  >
                    <div className="flex items-start gap-2 mb-3" style={{ color: 'var(--ur-danger)' }}>
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-sm font-semibold">
                        Confirme digitando <code>excluir</code> abaixo. Esta ação é reversível
                        durante 30 dias, depois é permanente.
                      </p>
                    </div>
                    <input
                      type="text"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="excluir"
                      className="w-full px-3 py-2 rounded-md text-sm font-mono outline-none"
                      style={{
                        background: 'var(--ur-bg)',
                        border: '1px solid var(--ur-danger)',
                        color: 'var(--ur-text)',
                      }}
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDelete(false)
                          setTyped('')
                        }}
                        className="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        style={{
                          background: 'transparent',
                          color: 'var(--ur-text-soft)',
                          border: '1px solid var(--ur-border)',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={typed.toLowerCase() !== 'excluir' || deleteMut.isPending}
                        onClick={() => deleteMut.mutate()}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-all disabled:opacity-40"
                        style={{
                          background: 'var(--ur-danger)',
                          color: 'white',
                        }}
                      >
                        {deleteMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Confirmar exclusão
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Help */}
          <Card>
            <h3 className="text-base font-semibold mb-2">Outras solicitações</h3>
            <p className="text-sm" style={{ color: 'var(--ur-text-soft)' }}>
              Para retificação, anonimização, oposição ou qualquer outro direito previsto
              no Art. 18 LGPD não coberto acima, escreva para{' '}
              <a href="mailto:privacidade@univerreviews.com" className="underline" style={{ color: 'var(--ur-accent)' }}>
                privacidade@univerreviews.com
              </a>
              . Resposta em até 15 dias úteis.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Card({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'danger'
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--ur-surface)',
        border: variant === 'danger'
          ? '1px solid var(--ur-danger-bg)'
          : '1px solid var(--ur-border)',
      }}
    >
      {children}
    </div>
  )
}

function Icon({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'danger'
}) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{
        background: variant === 'danger' ? 'var(--ur-danger-bg)' : 'var(--ur-accent-glow)',
        color: variant === 'danger' ? 'var(--ur-danger)' : 'var(--ur-accent)',
      }}
    >
      {children}
    </div>
  )
}
