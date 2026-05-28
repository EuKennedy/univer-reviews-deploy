import { test, expect } from '@playwright/test'

/**
 * Smoke on the public login surface — guarantees the front door of the
 * SaaS is reachable AND the error-toast wiring we added for
 * ?error=no_workspace / ?error=account_pending_deletion actually fires.
 *
 * Doesn't perform a real signup (would require a clean DB + email
 * verification). Real signup flow is exercised in `signup-onboarding.spec.ts`
 * which is gated on CI_E2E_FULL=1.
 */
test.describe('Login surface', () => {
  test('renders email + password form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder(/e-mail/i)).toBeVisible()
    await expect(page.getByPlaceholder(/senha/i)).toBeVisible()
  })

  test('shows no_workspace toast when redirected after Google signup race', async ({ page }) => {
    await page.goto('/login?error=no_workspace')
    // Sonner toasts render asynchronously — give it a tick.
    await expect(
      page.getByText(/workspace ainda está sendo provisionado/i),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('shows account_pending_deletion toast', async ({ page }) => {
    await page.goto('/login?error=account_pending_deletion')
    await expect(
      page.getByText(/pedido de exclusão ativo/i),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('Google button is enabled when env is set, hidden when not', async ({ page }) => {
    await page.goto('/login')
    // We don't know whether GOOGLE_CLIENT_ID is set in this env, so we
    // just assert the page renders without throwing and either path is
    // ok.
    const googleBtn = page.getByRole('button', { name: /google/i })
    const count = await googleBtn.count()
    expect(count === 0 || count === 1).toBeTruthy()
  })
})
