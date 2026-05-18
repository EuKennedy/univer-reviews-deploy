'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  HelpCircle,
  MessageCircle,
  Folder,
  Plus,
  Search,
  Send,
  Trash2,
  Check,
  X,
  Loader2,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { Toolbar, SearchInput, FilterSelect, ActionButton } from '@/components/godmode/Toolbar'
import { Pagination } from '@/components/godmode/Pagination'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Question, QuestionGroup, QuestionStatus, Product } from '@/types'

type Tab = 'questions' | 'groups'

// ────────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────────

export default function QaPage() {
  const [tab, setTab] = useState<Tab>('questions')

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<HelpCircle className="w-5 h-5" />}
        title="Perguntas e Respostas"
        subtitle="Modere perguntas dos clientes e organize-as em grupos reutilizáveis"
      />

      <div
        className="flex items-center gap-1 px-6 pt-3 shrink-0"
        style={{ borderBottom: '1px solid var(--ur-border)', background: 'var(--ur-bg-soft)' }}
      >
        <TabButton
          active={tab === 'questions'}
          icon={<MessageCircle className="w-3.5 h-3.5" />}
          label="Perguntas"
          onClick={() => setTab('questions')}
        />
        <TabButton
          active={tab === 'groups'}
          icon={<Folder className="w-3.5 h-3.5" />}
          label="Grupos"
          onClick={() => setTab('groups')}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'questions' ? <QuestionsTab /> : <GroupsTab />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-150 relative"
      style={{
        color: active ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
        borderBottom: active ? '2px solid var(--ur-accent)' : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Questions tab
// ────────────────────────────────────────────────────────────────────────────────

function QuestionsTab() {
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<QuestionStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['questions', page, status],
    queryFn: () =>
      api.questions.list(
        { page, per_page: 25, status: status || undefined },
        getToken(),
      ),
    enabled: isAuthenticated,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['questions'] })

  const answerMut = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      api.questions.answer(id, answer, getToken()),
    onSuccess: () => {
      toast.success('Resposta publicada')
      void invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao responder'),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: QuestionStatus }) =>
      api.questions.updateStatus(id, s, getToken()),
    onSuccess: () => {
      toast.success('Status atualizado')
      void invalidate()
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.questions.delete(id, getToken()),
    onSuccess: () => {
      toast.success('Pergunta removida')
      void invalidate()
    },
  })

  const items = data?.data ?? []

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        left={
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v as QuestionStatus | '')
              setPage(1)
            }}
            options={[
              { label: 'Pendentes', value: 'pending' },
              { label: 'Publicadas', value: 'published' },
              { label: 'Rejeitadas', value: 'rejected' },
            ]}
            placeholder="Todos os status"
          />
        }
        right={
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {data?.meta.total_count ?? 0} perguntas
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--ur-text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma pergunta ainda"
            subtitle="Quando clientes enviarem perguntas pelo widget, elas aparecem aqui."
          />
        ) : (
          <div className="px-4 py-3 space-y-2">
            {items.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                onAnswer={(answer) => answerMut.mutate({ id: q.id, answer })}
                onPublish={() => statusMut.mutate({ id: q.id, status: 'published' })}
                onReject={() => statusMut.mutate({ id: q.id, status: 'rejected' })}
                onDelete={() => deleteMut.mutate(q.id)}
                isBusy={answerMut.isPending || statusMut.isPending || deleteMut.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {data && data.meta.total_pages > 1 && (
        <Pagination
          currentPage={data.meta.current_page}
          totalPages={data.meta.total_pages}
          totalCount={data.meta.total_count}
          perPage={data.meta.per_page}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function QuestionCard({
  question,
  onAnswer,
  onPublish,
  onReject,
  onDelete,
  isBusy,
}: {
  question: Question
  onAnswer: (a: string) => void
  onPublish: () => void
  onReject: () => void
  onDelete: () => void
  isBusy: boolean
}) {
  const [answer, setAnswer] = useState(question.answer ?? '')
  const [showAnswerForm, setShowAnswerForm] = useState(false)

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={question.status} />
            {question.author_name && (
              <span className="text-xs" style={{ color: 'var(--ur-text-soft)' }}>
                {question.author_name}
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--ur-text-faint)' }}>·</span>
            <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
              {new Date(question.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--ur-text)' }}>
            {question.body}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {question.status !== 'published' && (
            <IconButton onClick={onPublish} disabled={isBusy} title="Publicar" tone="success">
              <Check className="w-3.5 h-3.5" />
            </IconButton>
          )}
          {question.status !== 'rejected' && (
            <IconButton onClick={onReject} disabled={isBusy} title="Rejeitar">
              <X className="w-3.5 h-3.5" />
            </IconButton>
          )}
          <IconButton onClick={onDelete} disabled={isBusy} title="Excluir" tone="danger">
            <Trash2 className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      {question.answer && !showAnswerForm && (
        <div
          className="mt-3 p-3 rounded-md text-sm"
          style={{
            background: 'var(--ur-accent-glow)',
            border: '1px solid var(--ur-accent-soft-2)',
            color: 'var(--ur-text)',
          }}
        >
          <div
            className="text-xs uppercase tracking-wider font-medium mb-1"
            style={{ color: 'var(--ur-accent)' }}
          >
            Resposta da loja
          </div>
          {question.answer}
          <button
            onClick={() => setShowAnswerForm(true)}
            className="mt-2 text-xs underline"
            style={{ color: 'var(--ur-text-soft)' }}
          >
            Editar
          </button>
        </div>
      )}

      {(!question.answer || showAnswerForm) && (
        <div className="mt-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Escreva uma resposta…"
            rows={2}
            className="w-full text-sm rounded-lg outline-none p-2.5 resize-y"
            style={{
              background: 'var(--ur-bg)',
              border: '1px solid var(--ur-border)',
              color: 'var(--ur-text)',
              minHeight: 60,
            }}
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            {showAnswerForm && (
              <button
                onClick={() => setShowAnswerForm(false)}
                className="text-xs px-2 py-1"
                style={{ color: 'var(--ur-text-soft)' }}
              >
                Cancelar
              </button>
            )}
            <button
              onClick={() => {
                if (answer.trim().length < 2) return
                onAnswer(answer.trim())
                setShowAnswerForm(false)
              }}
              disabled={isBusy || answer.trim().length < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
                color: 'var(--ur-text-on-accent)',
              }}
            >
              <Send className="w-3 h-3" />
              Publicar resposta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: QuestionStatus }) {
  const map: Record<QuestionStatus, { label: string; bg: string; color: string; border: string }> = {
    pending: {
      label: 'Pendente',
      bg: 'var(--ur-warn-bg)',
      color: '#eab308',
      border: 'var(--ur-warn-bg)',
    },
    published: {
      label: 'Publicada',
      bg: 'var(--ur-success-bg)',
      color: 'var(--ur-success)',
      border: 'var(--ur-success-bg)',
    },
    rejected: {
      label: 'Rejeitada',
      bg: 'var(--ur-danger-bg)',
      color: 'var(--ur-danger)',
      border: 'var(--ur-danger-bg)',
    },
  }
  const s = map[status]
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  )
}

function IconButton({
  children,
  onClick,
  disabled,
  title,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title: string
  tone?: 'default' | 'success' | 'danger'
}) {
  const colors: Record<string, { color: string; hover: string }> = {
    default: { color: 'var(--ur-text-soft)', hover: 'var(--ur-text)' },
    success: { color: 'var(--ur-success)', hover: 'var(--ur-success)' },
    danger: { color: 'var(--ur-danger)', hover: 'var(--ur-danger)' },
  }
  const c = colors[tone]
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-md transition-colors disabled:opacity-40"
      style={{ color: c.color, background: 'transparent' }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--ur-surface-soft)'
      }}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
        style={{
          background: 'var(--ur-accent-glow)',
          border: '1px solid var(--ur-accent-soft-2)',
        }}
      >
        <HelpCircle className="w-5 h-5" style={{ color: 'var(--ur-accent)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
        {title}
      </p>
      <p className="text-xs mt-1 max-w-sm" style={{ color: 'var(--ur-text-muted)' }}>
        {subtitle}
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Groups tab
// ────────────────────────────────────────────────────────────────────────────────

function GroupsTab() {
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<QuestionGroup | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['question-groups', page, search],
    queryFn: () =>
      api.questionGroups.list({ page, per_page: 25, q: search || undefined }, getToken()),
    enabled: isAuthenticated,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['question-groups'] })

  const createMut = useMutation({
    mutationFn: (data: { name: string; description?: string; product_ids?: string[] }) =>
      api.questionGroups.create(data, getToken()),
    onSuccess: () => {
      toast.success('Grupo criado')
      setShowCreate(false)
      void invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao criar grupo'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.questionGroups.delete(id, getToken()),
    onSuccess: () => {
      toast.success('Grupo removido')
      setSelected(null)
      void invalidate()
    },
  })

  const items = data?.data ?? []

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        left={
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Buscar grupos…"
          />
        }
        right={
          <ActionButton variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />
            Novo grupo
          </ActionButton>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--ur-text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum grupo ainda"
            subtitle="Crie grupos para reutilizar uma mesma lista de perguntas em vários produtos."
          />
        ) : (
          <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((g) => (
              <GroupCard key={g.id} group={g} onOpen={() => setSelected(g)} />
            ))}
          </div>
        )}
      </div>

      {data && data.meta.total_pages > 1 && (
        <Pagination
          currentPage={data.meta.current_page}
          totalPages={data.meta.total_pages}
          totalCount={data.meta.total_count}
          perPage={data.meta.per_page}
          onPageChange={setPage}
        />
      )}

      {showCreate && (
        <GroupFormModal
          onClose={() => setShowCreate(false)}
          onSubmit={(values) => createMut.mutate(values)}
          isSubmitting={createMut.isPending}
        />
      )}

      {selected && (
        <GroupDetailModal
          groupId={selected.id}
          onClose={() => setSelected(null)}
          onDelete={() => deleteMut.mutate(selected.id)}
          isDeleting={deleteMut.isPending}
        />
      )}
    </div>
  )
}

function GroupCard({ group, onOpen }: { group: QuestionGroup; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-lg p-4 transition-all"
      style={{
        background: 'var(--ur-bg-soft)',
        border: '1px solid var(--ur-border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--ur-border)'
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'var(--ur-accent-soft)',
            border: '1px solid var(--ur-accent-soft-2)',
          }}
        >
          <Folder className="w-4 h-4" style={{ color: 'var(--ur-accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--ur-text)' }}>
            {group.name}
          </p>
          {group.description && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ur-text-soft)' }}>
              {group.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <Stat icon={<Package className="w-3 h-3" />} label={`${group.products_count} produtos`} />
            <Stat icon={<MessageCircle className="w-3 h-3" />} label={`${group.questions_count} perguntas`} />
          </div>
        </div>
      </div>
    </button>
  )
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
      {icon}
      {label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Create / Edit modal
// ────────────────────────────────────────────────────────────────────────────────

function GroupFormModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void
  onSubmit: (values: { name: string; description?: string; product_ids?: string[] }) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [productIds, setProductIds] = useState<string[]>([])

  return (
    <Modal title="Novo grupo" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: FAQ Cosméticos"
            className="w-full text-sm rounded-lg p-2.5 outline-none"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
          />
        </Field>
        <Field label="Descrição (opcional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Para que serve este grupo?"
            className="w-full text-sm rounded-lg p-2.5 outline-none resize-y"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
          />
        </Field>
        <Field label="Produtos (opcional)">
          <ProductMultiSelect value={productIds} onChange={setProductIds} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <ActionButton onClick={onClose}>Cancelar</ActionButton>
        <ActionButton
          variant="primary"
          disabled={!name.trim() || isSubmitting}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              description: description.trim() || undefined,
              product_ids: productIds.length ? productIds : undefined,
            })
          }
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Criar grupo
        </ActionButton>
      </div>
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Detail modal (rename, attach/detach products, delete)
// ────────────────────────────────────────────────────────────────────────────────

function GroupDetailModal({
  groupId,
  onClose,
  onDelete,
  isDeleting,
}: {
  groupId: string
  onClose: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const { data: group, isLoading } = useQuery({
    queryKey: ['question-group', groupId],
    queryFn: () => api.questionGroups.get(groupId, getToken()),
    enabled: isAuthenticated,
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [attachIds, setAttachIds] = useState<string[]>([])

  useMemo(() => {
    if (group) {
      setName(group.name)
      setDescription(group.description ?? '')
    }
  }, [group])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['question-group', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['question-groups'] })
  }

  const updateMut = useMutation({
    mutationFn: () =>
      api.questionGroups.update(groupId, { name, description: description || undefined }, getToken()),
    onSuccess: () => {
      toast.success('Grupo atualizado')
      invalidate()
    },
  })

  const attachMut = useMutation({
    mutationFn: () => api.questionGroups.attachProducts(groupId, attachIds, getToken()),
    onSuccess: (r) => {
      toast.success(`${r.attached} produto(s) vinculado(s)`)
      setAttachIds([])
      invalidate()
    },
  })

  const detachMut = useMutation({
    mutationFn: (id: string) =>
      api.questionGroups.detachProducts(groupId, [id], getToken()),
    onSuccess: () => {
      toast.success('Produto desvinculado')
      invalidate()
    },
  })

  return (
    <Modal title={group?.name ?? 'Grupo'} onClose={onClose} wide>
      {isLoading || !group ? (
        <div className="py-12 flex justify-center" style={{ color: 'var(--ur-text-muted)' }}>
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm rounded-lg p-2.5 outline-none"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-sm rounded-lg p-2.5 outline-none resize-y"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
          </Field>
          <div className="flex items-center justify-end">
            <ActionButton
              variant="primary"
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || !name.trim()}
            >
              {updateMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar alterações
            </ActionButton>
          </div>

          <div
            className="pt-4 mt-2"
            style={{ borderTop: '1px solid var(--ur-border)' }}
          >
            <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--ur-text-soft)' }}>
              Produtos vinculados ({group.products?.length ?? 0})
            </p>
            {group.products && group.products.length > 0 ? (
              <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
                {group.products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded-md"
                    style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
                  >
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt=""
                        className="w-6 h-6 rounded object-cover"
                        style={{ border: '1px solid var(--ur-border-strong)' }}
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: 'var(--ur-surface-soft)' }}
                      >
                        <Package className="w-3 h-3" style={{ color: 'var(--ur-text-muted)' }} />
                      </div>
                    )}
                    <span className="flex-1 text-sm truncate" style={{ color: 'var(--ur-text)' }}>
                      {p.title}
                    </span>
                    <IconButton
                      onClick={() => detachMut.mutate(p.id)}
                      title="Remover"
                      tone="danger"
                    >
                      <X className="w-3 h-3" />
                    </IconButton>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs mb-3" style={{ color: 'var(--ur-text-muted)' }}>
                Nenhum produto vinculado.
              </p>
            )}

            <Field label="Adicionar produtos">
              <ProductMultiSelect value={attachIds} onChange={setAttachIds} excludeIds={group.products?.map((p) => p.id) ?? []} />
            </Field>
            <div className="flex items-center justify-end mt-2">
              <ActionButton
                variant="primary"
                onClick={() => attachMut.mutate()}
                disabled={attachIds.length === 0 || attachMut.isPending}
              >
                {attachMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Vincular {attachIds.length || ''}
              </ActionButton>
            </div>
          </div>

          <div
            className="pt-4 mt-2 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--ur-border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
              Excluir o grupo não remove as perguntas — apenas desvincula-as.
            </p>
            <ActionButton variant="danger" onClick={onDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Trash2 className="w-3.5 h-3.5" />
              Excluir grupo
            </ActionButton>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5"
        style={{ color: 'var(--ur-text-soft)' }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--ur-overlay)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-xl p-5 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--ur-bg-soft)',
          border: '1px solid var(--ur-border)',
          maxWidth: wide ? 640 : 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--ur-text)' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md"
            style={{ color: 'var(--ur-text-soft)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Product multi-select
// ────────────────────────────────────────────────────────────────────────────────

function ProductMultiSelect({
  value,
  onChange,
  excludeIds = [],
}: {
  value: string[]
  onChange: (v: string[]) => void
  excludeIds?: string[]
}) {
  const { getToken, isAuthenticated } = useAuth()
  const [query, setQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['products-select', query],
    queryFn: () =>
      api.products.list({ page: 1, per_page: 25, q: query || undefined }, getToken()),
    enabled: isAuthenticated,
  })

  const products = (data?.data ?? []) as Product[]
  const visible = products.filter((p) => !excludeIds.includes(p.id))
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
    >
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: 'var(--ur-text-muted)' }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produtos…"
          className="w-full pl-8 pr-3 py-2 text-sm outline-none"
          style={{ background: 'transparent', color: 'var(--ur-text)', borderBottom: '1px solid var(--ur-border)' }}
        />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            Carregando…
          </div>
        ) : visible.length === 0 ? (
          <div className="p-3 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            Nenhum produto encontrado.
          </div>
        ) : (
          visible.map((p) => {
            const checked = value.includes(p.id)
            return (
              <label
                key={p.id}
                className="flex items-center gap-2 p-2 cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid var(--ur-border)',
                  background: checked ? 'var(--ur-accent-glow)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                  className="accent-[var(--ur-accent)]"
                />
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    className="w-6 h-6 rounded object-cover"
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ background: 'var(--ur-surface-soft)' }}
                  >
                    <Package className="w-3 h-3" style={{ color: 'var(--ur-text-muted)' }} />
                  </div>
                )}
                <span className="text-sm truncate" style={{ color: 'var(--ur-text)' }}>
                  {p.name}
                </span>
              </label>
            )
          })
        )}
      </div>
      {value.length > 0 && (
        <div
          className="px-2 py-1.5 text-xs"
          style={{ borderTop: '1px solid var(--ur-border)', background: 'var(--ur-bg-soft)', color: 'var(--ur-accent)' }}
        >
          {value.length} selecionado(s)
        </div>
      )}
    </div>
  )
}
