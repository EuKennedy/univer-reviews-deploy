'use client'

/**
 * PaywallProvider — mounted at the root layout. Listens to the global
 * `paywall` window event (dispatched by api.ts on every 402 response)
 * and pops the upgrade modal.
 *
 * Why a global window event instead of a React context callback:
 *
 *   - React Query mutations and queries live across dozens of pages,
 *     hooks, and ad-hoc fetch calls. Threading a context-provided
 *     `triggerPaywall()` through every callsite is messy and easy to
 *     forget on new code paths.
 *
 *   - The API client (`apps/admin/src/lib/api.ts`) is intentionally
 *     React-agnostic — it gets imported from server components,
 *     route handlers and tests. Dispatching a DOM event is the
 *     cleanest way to escape the React tree without coupling the
 *     client to a provider singleton.
 *
 *   - All paywall events look identical regardless of which mutation
 *     fired the 402. One listener, one modal, deterministic UX.
 *
 * Backend payloads (see plan_features.rb + ai_cost_cap.rb):
 *   `feature_locked`        → { error, message, feature, current_plan, required_plan, upgrade_url }
 *   `ai_cost_cap_reached`   → { error, message, spent_usd, cap_usd, current_plan, upgrade_url }
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PaywallModal, type PaywallBlock } from './PaywallModal'

interface FeatureLockedPayload {
  error: 'feature_locked'
  message?: string
  feature?: string
  current_plan?: string
  required_plan?: string
  upgrade_url?: string
}

interface AiCostCapPayload {
  error: 'ai_cost_cap_reached'
  message?: string
  spent_usd?: number
  cap_usd?: number | null
  current_plan?: string
  upgrade_url?: string
}

type PaywallPayload = FeatureLockedPayload | AiCostCapPayload

function isFeaturePayload(p: PaywallPayload): p is FeatureLockedPayload {
  return p.error === 'feature_locked'
}

function isAiCapPayload(p: PaywallPayload): p is AiCostCapPayload {
  return p.error === 'ai_cost_cap_reached'
}

function payloadToBlock(payload: PaywallPayload): PaywallBlock | null {
  if (isFeaturePayload(payload)) {
    return {
      kind: 'feature',
      feature: payload.feature ?? 'unknown',
      currentPlan: payload.current_plan ?? 'free',
      requiredPlan: payload.required_plan ?? 'pro',
      message: payload.message,
      upgradeUrl: payload.upgrade_url,
    }
  }
  if (isAiCapPayload(payload)) {
    return {
      kind: 'ai_cap',
      currentPlan: payload.current_plan ?? 'free',
      spentUsd: Number(payload.spent_usd ?? 0),
      capUsd: payload.cap_usd === null ? null : Number(payload.cap_usd ?? 0),
      period: 'month',
      message: payload.message,
      upgradeUrl: payload.upgrade_url,
    }
  }
  return null
}

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [block, setBlock] = useState<PaywallBlock | null>(null)

  // Pull the workspace slug off the URL so the in-app /billing fallback
  // can be routed correctly when NEXT_PUBLIC_UPGRADE_URL is unset.
  // useParams returns the dynamic segment for whatever route the user
  // is on — undefined for /login, /onboarding, etc.
  const params = useParams<{ workspace?: string }>()
  const workspaceSlug = params?.workspace ?? null

  const handle = useCallback((evt: Event) => {
    const detail = (evt as CustomEvent<PaywallPayload>).detail
    if (!detail || typeof detail !== 'object') return
    const next = payloadToBlock(detail)
    if (next) setBlock(next)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('paywall', handle as EventListener)
    return () => window.removeEventListener('paywall', handle as EventListener)
  }, [handle])

  return (
    <>
      {children}
      <PaywallModal
        block={block}
        workspaceSlug={workspaceSlug}
        onClose={() => setBlock(null)}
      />
    </>
  )
}
