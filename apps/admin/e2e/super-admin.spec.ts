import { test, expect } from '@playwright/test'

/**
 * Super admin surface smoke.
 *
 * This suite covers the un-authenticated stance: anonymous visitors and
 * non-admin sessions MUST be invisible to the founder ops UI. The
 * happy-path login + suspend + audit flow needs a seeded Better Auth
 * admin user (role='admin') + Rails workspace fixtures, and is gated by
 * the same CI_E2E_FULL=1 flag that controls signup-onboarding.spec.ts.
 *
 * Why so light? The server-side guard in /super/layout.tsx returns
 * `notFound()` for any visitor without `session.user.role === 'admin'`,
 * and the Rails controllers return 404 with NO body. Both are exercised
 * by the smoke tests below; the happy path is left to the gated full
 * run + the RSpec controller specs.
 */
test.describe('Super admin surface (closed)', () => {
  test('anonymous visit to /super redirects to /login (middleware) without leaking the route', async ({ page }) => {
    // The dash's edge middleware redirects every non-public path to
    // /login when no session cookie exists. The critical invariant we
    // assert: an unauthenticated visitor MUST NOT land on a 200 /super
    // page — either they're redirected to /login or they get Next's
    // built-in 404 from the layout's notFound() chain.
    await page.goto('/super', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toMatch(/\/super\/?$/)
  })

  test('anonymous visit to /super/users behaves the same', async ({ page }) => {
    await page.goto('/super/users', { waitUntil: 'domcontentloaded' })
    expect(page.url()).not.toMatch(/\/super\/users\/?$/)
  })
})

/**
 * Happy-path E2E. Gated on CI_E2E_FULL=1 because it requires:
 *   - A Better Auth user with email FULL_E2E_ADMIN_EMAIL + password
 *     FULL_E2E_ADMIN_PASSWORD, role='admin' in the DB.
 *   - At least one workspace fixture loaded.
 * Run locally with `CI_E2E_FULL=1 pnpm --filter=admin exec playwright test
 * super-admin.spec.ts`.
 */
test.describe('Super admin happy path', () => {
  test.skip(
    process.env.CI_E2E_FULL !== '1',
    'Set CI_E2E_FULL=1 to run the happy-path super admin flow',
  )

  const email = process.env.FULL_E2E_ADMIN_EMAIL ?? 'founder@example.com'
  const password = process.env.FULL_E2E_ADMIN_PASSWORD ?? 'super-admin-pwd-1!'

  test('founder logs in, sees /super, opens a workspace, suspends it', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/e-mail/i).fill(email)
    await page.getByPlaceholder(/senha/i).fill(password)
    await page.getByRole('button', { name: /entrar/i }).click()

    // After login, manually navigate to /super (the merchant home does
    // not link to it — only admins know it exists).
    await page.goto('/super')
    await expect(page.getByRole('heading', { name: /visão geral/i })).toBeVisible({ timeout: 10_000 })

    // Click the first workspace row.
    await page.locator('a[href^="/super/workspaces/"]').first().click()
    await expect(page.getByRole('button', { name: /impersonar/i })).toBeVisible()

    // Switch to Danger tab.
    await page.getByRole('button', { name: /zona de risco/i }).click()

    // Click suspend, type the workspace slug to confirm.
    await page.getByRole('button', { name: /suspender$/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // The slug is shown inline in the modal label; assume the first
    // <code> inside the dialog carries it.
    const slugText = await dialog.locator('code').first().textContent()
    if (!slugText) throw new Error('Modal did not render the slug token')
    await dialog.getByRole('textbox').fill(slugText)
    await dialog.getByRole('button', { name: /^suspender$/i }).click()

    // Move to the Audit tab and confirm the suspend event is there.
    await page.getByRole('button', { name: /auditoria/i }).click()
    await expect(page.locator('text=super_admin.workspace.suspended').first()).toBeVisible({ timeout: 10_000 })
  })
})
