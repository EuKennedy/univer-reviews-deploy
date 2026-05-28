'use client'

/**
 * PaywallModal — the "upgrade gate" surface shown when an API call
 * returns 402.
 *
 * Two variants under one shell:
 *   1. `feature` — the workspace's plan doesn't include the feature.
 *      Headline: "Disponível no plano X". Body: editorial copy from
 *      feature-copy.ts. Plan comparison mini-card. CTA → upgrade URL.
 *   2. `ai_cap` — the workspace burned through its monthly AI USD cap.
 *      Headline: "Limite mensal de IA atingido". Progress bar showing
 *      usage. CTA → upgrade URL (raise cap) + secondary "esperar reset".
 *
 * Shell mirrors the Modal used by ai-summaries/[productId]/page.tsx:
 * scale-in motion, backdrop blur, focus trap, ESC + outside-click close.
 */

import { useEffect, useId, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Lock,
  Zap,
  Sparkles,
  Check,
  ExternalLink,
  X,
  ArrowRight,
} from 'lucide-react'
import { useFocusTrap } from '@/lib/useFocusTrap'
import {
  PLAN_LABELS,
  resolveFeatureCopy,
  type PlanKey,
} from './feature-copy'

export type PaywallBlock =
  | {
      kind: 'feature'
      feature: string
      currentPlan: PlanKey | string
      requiredPlan: PlanKey | string
      message?: string
      upgradeUrl?: string
    }
  | {
      kind: 'ai_cap'
      currentPlan: PlanKey | string
      spentUsd: number
      capUsd: number | null
      period?: 'month'
      message?: string
      upgradeUrl?: string
    }

interface PaywallModalProps {
  block: PaywallBlock | null
  /**
   * Fallback workspace slug for the in-app /[workspace]/billing route
   * when NEXT_PUBLIC_UPGRADE_URL is missing.
   */
  workspaceSlug?: string | null
  onClose: () => void
}

/**
 * Determines the URL the "Fazer upgrade" CTA should send the user to.
 *
 * Precedence:
 *   1. NEXT_PUBLIC_UPGRADE_URL (external payment platform) — if set,
 *      open in a new tab so the merchant doesn't lose their dashboard
 *      context mid-task.
 *   2. The backend-supplied `upgrade_url` (today: "/billing") rewritten
 *      under the current workspace slug.
 *   3. Last-resort `/`.
 */
function resolveUpgradeTarget(
  block: PaywallBlock,
  workspaceSlug: string | null | undefined,
): { href: string; external: boolean } {
  const external = process.env.NEXT_PUBLIC_UPGRADE_URL
  if (external) return { href: external, external: true }

  const fromPayload = block.upgradeUrl?.startsWith('/') ? block.upgradeUrl : null
  if (workspaceSlug && fromPayload) {
    return { href: `/${workspaceSlug}${fromPayload}`, external: false }
  }
  if (workspaceSlug) {
    return { href: `/${workspaceSlug}/billing`, external: false }
  }
  return { href: fromPayload || '/', external: false }
}

export function PaywallModal({ block, workspaceSlug, onClose }: PaywallModalProps) {
  return (
    <AnimatePresence>
      {block !== null && (
        <ModalShell block={block} workspaceSlug={workspaceSlug} onClose={onClose} />
      )}
    </AnimatePresence>
  )
}

function ModalShell({
  block,
  workspaceSlug,
  onClose,
}: {
  block: PaywallBlock
  workspaceSlug: string | null | undefined
  onClose: () => void
}) {
  const titleId = useId()
  const descId = useId()
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)

  // Body-scroll lock — feels broken when the page behind the modal can
  // still scroll while focus is trapped inside.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(8, 10, 14, 0.62)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
      data-testid="paywall-overlay"
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.97, y: 4, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.0, 0.2, 1] }}
        className="w-full max-w-[440px] sm:max-w-[520px] rounded-2xl overflow-hidden relative"
        style={{
          background: 'var(--ur-surface)',
          border: '1px solid var(--ur-border)',
          boxShadow: 'var(--ur-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="paywall-modal"
      >
        <CloseButton onClose={onClose} />
        {block.kind === 'feature' ? (
          <FeatureBody
            block={block}
            workspaceSlug={workspaceSlug}
            titleId={titleId}
            descId={descId}
            onClose={onClose}
          />
        ) : (
          <AiCapBody
            block={block}
            workspaceSlug={workspaceSlug}
            titleId={titleId}
            descId={descId}
            onClose={onClose}
          />
        )}
      </motion.div>
    </motion.div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Fechar"
      className="absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors z-10"
      style={{ color: 'var(--ur-text-soft)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--ur-surface-soft)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <X className="w-4 h-4" />
    </button>
  )
}

// ─── Feature-locked variant ──────────────────────────────────────────────────

function FeatureBody({
  block,
  workspaceSlug,
  titleId,
  descId,
  onClose,
}: {
  block: Extract<PaywallBlock, { kind: 'feature' }>
  workspaceSlug: string | null | undefined
  titleId: string
  descId: string
  onClose: () => void
}) {
  const copy = useMemo(
    () =>
      resolveFeatureCopy(
        block.feature,
        normalisePlan(block.requiredPlan) ?? 'pro',
      ),
    [block.feature, block.requiredPlan],
  )

  const requiredPlan: PlanKey =
    normalisePlan(block.requiredPlan) ?? copy.planNeeded
  const currentPlan: PlanKey | null = normalisePlan(block.currentPlan)
  const target = resolveUpgradeTarget(block, workspaceSlug)

  return (
    <div className="px-6 pt-7 pb-6 sm:px-8 sm:pt-9 sm:pb-7">
      {/* Glow icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.28, ease: [0.2, 0.0, 0.2, 1] }}
        className="relative w-14 h-14 mb-5"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl"
          style={{ background: 'var(--ur-accent-ring)', filter: 'blur(18px)', opacity: 0.55 }}
        />
        <div
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
            boxShadow: '0 8px 22px var(--ur-accent-ring)',
          }}
        >
          <Lock className="w-6 h-6" style={{ color: 'var(--ur-text-on-accent)' }} />
        </div>
      </motion.div>

      <motion.h2
        id={titleId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.28 }}
        className="text-[22px] sm:text-[24px] leading-tight font-semibold tracking-tight"
        style={{ color: 'var(--ur-text)' }}
      >
        Disponível no plano {PLAN_LABELS[requiredPlan]}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.28 }}
        className="text-sm mt-1.5 font-medium"
        style={{ color: 'var(--ur-accent)' }}
      >
        {copy.label}
      </motion.p>

      <motion.p
        id={descId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.28 }}
        className="text-sm mt-3 leading-relaxed"
        style={{ color: 'var(--ur-text-soft)' }}
      >
        {block.message || copy.description}
      </motion.p>

      {/* Plan comparison + unlocks */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.28 }}
        className="mt-5 rounded-xl p-4"
        style={{
          background: 'var(--ur-bg-soft)',
          border: '1px solid var(--ur-border)',
        }}
      >
        <div className="flex items-center gap-2.5 mb-3.5">
          <PlanBadge plan={currentPlan ?? 'free'} muted />
          <ArrowRight
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: 'var(--ur-text-muted)' }}
            aria-hidden
          />
          <PlanBadge plan={requiredPlan} />
        </div>

        <ul className="space-y-1.5">
          {copy.unlocks.slice(0, 4).map((line, i) => (
            <motion.li
              key={line}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.26 + i * 0.04, duration: 0.22 }}
              className="flex items-start gap-2 text-xs leading-relaxed"
              style={{ color: 'var(--ur-text-secondary)' }}
            >
              <span
                className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--ur-accent-glow)',
                  color: 'var(--ur-accent)',
                }}
              >
                <Check className="w-2.5 h-2.5" strokeWidth={3} />
              </span>
              <span>{line}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      <PaywallActions
        primaryLabel="Fazer upgrade"
        secondaryLabel="Talvez depois"
        href={target.href}
        external={target.external}
        onClose={onClose}
      />
    </div>
  )
}

// ─── AI cap variant ──────────────────────────────────────────────────────────

function AiCapBody({
  block,
  workspaceSlug,
  titleId,
  descId,
  onClose,
}: {
  block: Extract<PaywallBlock, { kind: 'ai_cap' }>
  workspaceSlug: string | null | undefined
  titleId: string
  descId: string
  onClose: () => void
}) {
  const target = resolveUpgradeTarget(block, workspaceSlug)
  const cap = block.capUsd ?? 0
  const used = block.spentUsd
  // Always render >= 100% — backend only fires when exceeded?, so showing
  // 78% would be a lie. Cap to 999% so a runaway month doesn't blow up
  // the bar width.
  const rawPct = cap > 0 ? (used / cap) * 100 : 100
  const pct = Math.min(999, Math.max(100, Math.round(rawPct)))
  const currentPlan: PlanKey | null = normalisePlan(block.currentPlan)
  const resetDay = monthResetDay()

  return (
    <div className="px-6 pt-7 pb-6 sm:px-8 sm:pt-9 sm:pb-7">
      {/* Glow icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.28, ease: [0.2, 0.0, 0.2, 1] }}
        className="relative w-14 h-14 mb-5"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl"
          style={{ background: 'var(--ur-accent-ring)', filter: 'blur(18px)', opacity: 0.55 }}
        />
        <div
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
            boxShadow: '0 8px 22px var(--ur-accent-ring)',
          }}
        >
          <Zap className="w-6 h-6" style={{ color: 'var(--ur-text-on-accent)' }} />
        </div>
      </motion.div>

      <motion.h2
        id={titleId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.28 }}
        className="text-[22px] sm:text-[24px] leading-tight font-semibold tracking-tight"
        style={{ color: 'var(--ur-text)' }}
      >
        Limite mensal de IA atingido
      </motion.h2>

      <motion.p
        id={descId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.28 }}
        className="text-sm mt-2 leading-relaxed"
        style={{ color: 'var(--ur-text-soft)' }}
      >
        Você usou <strong style={{ color: 'var(--ur-text)' }}>${used.toFixed(2)}</strong> de{' '}
        <strong style={{ color: 'var(--ur-text)' }}>
          {cap > 0 ? `$${cap.toFixed(2)}` : 'cap mensal'}
        </strong>{' '}
        este mês — o orçamento reabre no dia <strong style={{ color: 'var(--ur-text)' }}>{resetDay}</strong>.
      </motion.p>

      {/* Usage bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.28 }}
        className="mt-5"
        aria-label="Uso atual versus cap mensal"
      >
        <div className="flex items-baseline justify-between mb-2">
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            Uso atual
          </span>
          <span
            className="text-xs tabular-nums font-semibold"
            style={{ color: 'var(--ur-accent)' }}
            data-testid="paywall-usage-pct"
          >
            {pct}%
          </span>
        </div>

        <div
          className="h-2 rounded-full overflow-hidden relative"
          style={{ background: 'var(--ur-accent-soft)' }}
          role="progressbar"
          aria-valuenow={Math.min(100, pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--ur-accent), var(--ur-accent-strong))',
              boxShadow: '0 0 12px var(--ur-accent-ring)',
              width: '100%',
            }}
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.24 }}
          />
          {/* Shimmer — same pattern as BulkProgressBar so the surface
              feels consistent across motion elements. */}
          <motion.div
            className="absolute inset-y-0 w-16 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
            }}
            animate={{ x: ['-16px', '110%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-[11px] tabular-nums"
             style={{ color: 'var(--ur-text-muted)' }}>
          <span>${used.toFixed(2)} usados</span>
          <span>{cap > 0 ? `cap $${cap.toFixed(2)}` : 'cap ilimitado'}</span>
        </div>
      </motion.div>

      {/* Plan context */}
      {currentPlan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32, duration: 0.22 }}
          className="mt-4 flex items-center gap-2 text-xs"
          style={{ color: 'var(--ur-text-muted)' }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--ur-accent)' }} />
          <span>
            Seu plano <PlanBadgeInline plan={currentPlan} /> tem cap mensal de IA — planos superiores expandem o orçamento mensal.
          </span>
        </motion.div>
      )}

      <PaywallActions
        primaryLabel="Aumentar limite (upgrade)"
        secondaryLabel="Esperar reset"
        href={target.href}
        external={target.external}
        onClose={onClose}
      />
    </div>
  )
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function PaywallActions({
  primaryLabel,
  secondaryLabel,
  href,
  external,
  onClose,
}: {
  primaryLabel: string
  secondaryLabel: string
  href: string
  external: boolean
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.34, duration: 0.26 }}
      className="mt-6 flex items-center justify-end gap-2 flex-wrap"
    >
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors min-h-[44px] sm:min-h-0"
        style={{
          background: 'transparent',
          color: 'var(--ur-text-soft)',
          border: '1px solid var(--ur-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--ur-surface-soft)'
          e.currentTarget.style.color = 'var(--ur-text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--ur-text-soft)'
        }}
        data-testid="paywall-secondary"
      >
        {secondaryLabel}
      </button>

      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        onClick={() => {
          // Close the modal as the user navigates away so coming back to
          // the tab doesn't leave a stale gate sitting on top.
          onClose()
        }}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all min-h-[44px] sm:min-h-0"
        style={{
          background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
          color: 'var(--ur-text-on-accent)',
          boxShadow: '0 4px 14px var(--ur-accent-ring)',
          border: '1px solid transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 8px 22px var(--ur-accent-ring)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 14px var(--ur-accent-ring)'
        }}
        data-testid="paywall-primary"
      >
        {primaryLabel}
        {external && <ExternalLink className="w-3.5 h-3.5" aria-hidden />}
      </a>
    </motion.div>
  )
}

function PlanBadge({ plan, muted = false }: { plan: PlanKey; muted?: boolean }) {
  if (muted) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-tight"
        style={{
          background: 'var(--ur-surface-soft)',
          color: 'var(--ur-text-muted)',
          border: '1px solid var(--ur-border)',
        }}
      >
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--ur-text-faint)' }}
        />
        Atual: {PLAN_LABELS[plan]}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-tight"
      style={{
        background: 'var(--ur-accent-glow)',
        color: 'var(--ur-accent)',
        border: '1px solid var(--ur-accent-soft-3)',
      }}
    >
      <Sparkles className="w-3 h-3" />
      {PLAN_LABELS[plan]}
    </span>
  )
}

function PlanBadgeInline({ plan }: { plan: PlanKey }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider align-baseline"
      style={{
        background: 'var(--ur-surface-soft)',
        color: 'var(--ur-text-secondary)',
        border: '1px solid var(--ur-border)',
      }}
    >
      {PLAN_LABELS[plan]}
    </span>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalisePlan(value: string | null | undefined): PlanKey | null {
  if (!value) return null
  const lower = value.toLowerCase()
  if (lower === 'free' || lower === 'starter' || lower === 'pro' || lower === 'enterprise') {
    return lower
  }
  return null
}

/**
 * Day-of-month the AI budget resets — backend's AiCostCap.month_spent
 * scopes to `Time.current.beginning_of_month`, so the reset always
 * happens on day 1 of the next month. Render as a small chip ("1") in
 * the body — keeps the copy honest without leaking implementation.
 */
function monthResetDay(): number {
  return 1
}
