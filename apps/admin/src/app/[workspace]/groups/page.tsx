'use client'

/**
 * Product Groups — Judge.me-style review pooling.
 *
 * One canonical entity that aggregates reviews across N product variations
 * so the storefront widget on every member SKU sees the same review list,
 * star count, and video wall. Membership is one-to-many (a product belongs
 * to at most ONE group), which keeps dedupe and "primary product" semantics
 * trivial.
 *
 * Public endpoints (reviews/summary/videos) consult Product#review_scope_product_ids
 * server-side, so changing membership here is the only knob a merchant has
 * to touch — no widget config, no shortcode change.
 */

import { useId, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  Folder,
  Plus,
  Search,
  Trash2,
  X,
  Loader2,
  Package,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { Toolbar, SearchInput, ActionButton } from '@/components/godmode/Toolbar'
import { Pagination } from '@/components/godmode/Pagination'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { formatNumber } from '@/lib/utils'
import type { ProductGroup, Product } from '@/types'

export default function ProductGroupsPage() {
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ProductGroup | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['product-groups', page, search],
    queryFn: () =>
      api.productGroups.list({ page, per_page: 25, q: search || undefined }, getToken()),
    enabled: isAuthenticated,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['product-groups'] })

  const createMut = useMutation({
    mutationFn: (vals: {
      name: string
      description?: string
      product_ids?: string[]
    }) => api.productGroups.create(vals, getToken()),
    onSuccess: () => {
      toast.success('Grupo criado — reviews já estão sendo compartilhadas')
      setShowCreate(false)
      void invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao criar grupo'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.productGroups.delete(id, getToken()),
    onSuccess: () => {
      toast.success('Grupo removido — produtos voltam a ter reviews isoladas')
      setSelected(null)
      void invalidate()
    },
  })

  const items = data?.data ?? []

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Boxes className="w-5 h-5" />}
        title="Grupos de produtos"
        subtitle="Compartilhe reviews entre variações do mesmo produto (sabor, cor, tamanho)"
        actions={
          <ActionButton variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />
            Novo grupo
          </ActionButton>
        }
      />

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
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {data?.meta.total_count ?? 0} grupos
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div
            className="flex items-center justify-center py-20"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum grupo de produtos ainda"
            subtitle="Crie grupos para que múltiplas variações do mesmo produto (ex: Colorizze tons 1–8) mostrem o mesmo conjunto de reviews."
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

// ─── Card ─────────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onOpen,
}: {
  group: ProductGroup
  onOpen: () => void
}) {
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
          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--ur-text)' }}
          >
            {group.name}
          </p>
          <p
            className="text-[11px] font-mono truncate mt-0.5"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            {group.slug}
          </p>
          {group.description && (
            <p
              className="text-xs mt-1.5 line-clamp-2"
              style={{ color: 'var(--ur-text-soft)' }}
            >
              {group.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Stat
              icon={<Package className="w-3 h-3" />}
              label={`${group.products_count} produtos`}
            />
            <Stat
              icon={<Star className="w-3 h-3" />}
              label={`${formatNumber(group.reviews_count)} reviews`}
            />
            {group.avg_rating != null && (
              <Stat
                icon={<Star className="w-3 h-3 fill-current" />}
                label={`${Number(group.avg_rating).toFixed(2)}`}
              />
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="flex items-center gap-1 text-xs tabular-nums"
      style={{ color: 'var(--ur-text-muted)' }}
    >
      {icon}
      {label}
    </span>
  )
}

// ─── Create form ──────────────────────────────────────────────────────────────

function GroupFormModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void
  onSubmit: (values: {
    name: string
    description?: string
    product_ids?: string[]
  }) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [productIds, setProductIds] = useState<string[]>([])

  return (
    <Modal title="Novo grupo de produtos" onClose={onClose} wide>
      <p
        className="text-xs mb-4"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        Selecione todas as variações que devem compartilhar o mesmo pool de
        reviews. Reviews escritas em qualquer produto do grupo aparecem em
        todos os outros.
      </p>
      <div className="space-y-3">
        <Field label="Nome do grupo">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Colorizze (todas as variações)"
            className="w-full text-sm rounded-lg p-2.5 outline-none"
            style={{
              background: 'var(--ur-bg)',
              border: '1px solid var(--ur-border)',
              color: 'var(--ur-text)',
            }}
          />
        </Field>
        <Field label="Descrição (opcional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Ex: 8 tons do mesmo produto base"
            className="w-full text-sm rounded-lg p-2.5 outline-none resize-y"
            style={{
              background: 'var(--ur-bg)',
              border: '1px solid var(--ur-border)',
              color: 'var(--ur-text)',
            }}
          />
        </Field>
        <Field label="Produtos do grupo">
          <ProductMultiSelect value={productIds} onChange={setProductIds} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <ActionButton onClick={onClose}>Cancelar</ActionButton>
        <ActionButton
          variant="primary"
          disabled={
            !name.trim() || productIds.length < 2 || isSubmitting
          }
          onClick={() =>
            onSubmit({
              name: name.trim(),
              description: description.trim() || undefined,
              product_ids: productIds,
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

// ─── Edit / detail ────────────────────────────────────────────────────────────

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
    queryKey: ['product-group', groupId],
    queryFn: () => api.productGroups.get(groupId, getToken()),
    enabled: isAuthenticated,
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [attachIds, setAttachIds] = useState<string[]>([])

  useMemo(() => {
    if (group) {
      setName(group.name)
      setDescription(group.description ?? '')
      setPrimaryId(group.primary_product_id ?? null)
    }
  }, [group])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['product-group', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['product-groups'] })
  }

  const updateMut = useMutation({
    mutationFn: () =>
      api.productGroups.update(
        groupId,
        {
          name,
          description: description || undefined,
          primary_product_id: primaryId,
        },
        getToken(),
      ),
    onSuccess: () => {
      toast.success('Grupo atualizado')
      invalidate()
    },
  })

  const attachMut = useMutation({
    mutationFn: () =>
      api.productGroups.attachProducts(groupId, attachIds, getToken()),
    onSuccess: (r) => {
      toast.success(`${r.attached} produto(s) vinculado(s)`)
      setAttachIds([])
      invalidate()
    },
  })

  const detachMut = useMutation({
    mutationFn: (id: string) =>
      api.productGroups.detachProducts(groupId, [id], getToken()),
    onSuccess: () => {
      toast.success('Produto desvinculado')
      invalidate()
    },
  })

  return (
    <Modal title={group?.name ?? 'Grupo'} onClose={onClose} wide>
      {isLoading || !group ? (
        <div
          className="py-12 flex justify-center"
          style={{ color: 'var(--ur-text-muted)' }}
        >
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Produtos" value={String(group.products_count)} />
            <Metric label="Reviews" value={formatNumber(group.reviews_count)} />
            <Metric
              label="Nota média"
              value={
                group.avg_rating != null
                  ? Number(group.avg_rating).toFixed(2)
                  : '—'
              }
            />
          </div>

          <Field label="Nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm rounded-lg p-2.5 outline-none"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text)',
              }}
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-sm rounded-lg p-2.5 outline-none resize-y"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text)',
              }}
            />
          </Field>
          {group.products && group.products.length > 0 && (
            <Field label="Produto canônico (opcional)">
              <select
                value={primaryId ?? ''}
                onChange={(e) => setPrimaryId(e.target.value || null)}
                className="w-full text-sm rounded-lg p-2.5 outline-none"
                style={{
                  background: 'var(--ur-bg)',
                  border: '1px solid var(--ur-border)',
                  color: 'var(--ur-text)',
                }}
              >
                <option value="">— Primeiro membro</option>
                {group.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
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
            <p
              className="text-xs uppercase tracking-wider font-semibold mb-2"
              style={{ color: 'var(--ur-text-soft)' }}
            >
              Produtos no grupo ({group.products?.length ?? 0})
            </p>
            {group.products && group.products.length > 0 ? (
              <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
                {group.products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded-md"
                    style={{
                      background: 'var(--ur-bg)',
                      border: '1px solid var(--ur-border)',
                    }}
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
                        <Package
                          className="w-3 h-3"
                          style={{ color: 'var(--ur-text-muted)' }}
                        />
                      </div>
                    )}
                    <span
                      className="flex-1 text-sm truncate"
                      style={{ color: 'var(--ur-text)' }}
                    >
                      {p.title}
                    </span>
                    {p.id === primaryId && (
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: 'var(--ur-accent-soft)',
                          color: 'var(--ur-accent)',
                        }}
                      >
                        Canônico
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => detachMut.mutate(p.id)}
                      aria-label={`Remover ${p.title}`}
                      title="Remover do grupo"
                      className="p-1 rounded"
                      style={{ color: 'var(--ur-danger)' }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p
                className="text-xs mb-3"
                style={{ color: 'var(--ur-text-muted)' }}
              >
                Nenhum produto neste grupo.
              </p>
            )}

            <Field label="Adicionar produtos">
              <ProductMultiSelect
                value={attachIds}
                onChange={setAttachIds}
                excludeIds={group.products?.map((p) => p.id) ?? []}
              />
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
            <p
              className="text-xs"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              Excluir o grupo não apaga reviews — apenas devolve cada produto à
              sua lista isolada.
            </p>
            <ActionButton
              variant="danger"
              onClick={onDelete}
              disabled={isDeleting}
            >
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

// ─── Shared bits ──────────────────────────────────────────────────────────────

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: 'var(--ur-bg)',
        border: '1px solid var(--ur-border)',
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        {label}
      </p>
      <p
        className="text-lg font-semibold tabular-nums mt-0.5"
        style={{ color: 'var(--ur-text)' }}
      >
        {value}
      </p>
    </div>
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
        <Boxes className="w-5 h-5" style={{ color: 'var(--ur-accent)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
        {title}
      </p>
      <p
        className="text-xs mt-1 max-w-md"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        {subtitle}
      </p>
    </div>
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
  const titleId = useId()
  const dialogRef = useFocusTrap<HTMLDivElement>(true, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--ur-overlay)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full rounded-xl p-5 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--ur-bg-soft)',
          border: '1px solid var(--ur-border)',
          maxWidth: wide ? 640 : 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            id={titleId}
            className="text-base font-semibold"
            style={{ color: 'var(--ur-text)' }}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar diálogo"
            className="p-1.5 rounded-md"
            style={{ color: 'var(--ur-text-soft)' }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Product multi-select ─────────────────────────────────────────────────────

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
      api.products.list(
        { page: 1, per_page: 50, q: query || undefined },
        getToken(),
      ),
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
          style={{
            background: 'transparent',
            color: 'var(--ur-text)',
            borderBottom: '1px solid var(--ur-border)',
          }}
        />
      </div>
      <div className="max-h-64 overflow-y-auto">
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
                  background: checked
                    ? 'var(--ur-accent-glow)'
                    : 'transparent',
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
                    <Package
                      className="w-3 h-3"
                      style={{ color: 'var(--ur-text-muted)' }}
                    />
                  </div>
                )}
                <span
                  className="flex-1 text-sm truncate"
                  style={{ color: 'var(--ur-text)' }}
                >
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
          style={{
            borderTop: '1px solid var(--ur-border)',
            background: 'var(--ur-bg-soft)',
            color: 'var(--ur-accent)',
          }}
        >
          {value.length} selecionado(s)
        </div>
      )}
    </div>
  )
}
