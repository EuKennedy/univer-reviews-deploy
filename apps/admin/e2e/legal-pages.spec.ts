import { test, expect } from '@playwright/test'

/**
 * /termos and /privacidade must be publicly reachable without auth.
 * LGPD Art. 9º requires the privacy notice to be accessible at any time —
 * a login-gated privacy page would itself be a compliance failure.
 */
test.describe('LGPD legal pages', () => {
  test('/termos loads without auth and shows version + change history', async ({ page }) => {
    const res = await page.goto('/termos', { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBeLessThan(400)

    await expect(page.locator('h1', { hasText: 'Termos de Uso' })).toBeVisible()
    // Version line appears near the top with format YYYY-MM-DD.
    await expect(page.getByText(/Vers[aã]o 20\d{2}-\d{2}-\d{2}/)).toBeVisible()
    // Change-history section is the last block on the page.
    await expect(page.getByText(/Hist[oó]rico de altera[cç][oõ]es/i)).toBeVisible()
  })

  test('/privacidade loads without auth and lists sub-operators', async ({ page }) => {
    const res = await page.goto('/privacidade', { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBeLessThan(400)

    await expect(page.locator('h1', { hasText: 'Política de Privacidade' })).toBeVisible()
    // The sub-processors table must be present — exposing this list is a
    // direct LGPD Art. 39 requirement we don't want to silently break.
    for (const sp of ['Coolify', 'Anthropic', 'Resend', 'Stripe', 'Cloudflare']) {
      await expect(page.getByRole('cell', { name: sp })).toBeVisible()
    }
    // Art. 18 rights list must show V (portabilidade) + VI (eliminação).
    await expect(page.getByText('Portabilidade')).toBeVisible()
    await expect(page.getByText('Eliminação')).toBeVisible()
  })

  test('/termos and /privacidade cross-link in the layout nav', async ({ page }) => {
    await page.goto('/termos')
    await page.getByRole('link', { name: 'Privacidade' }).click()
    await expect(page).toHaveURL(/\/privacidade/)
    await page.getByRole('link', { name: 'Termos' }).click()
    await expect(page).toHaveURL(/\/termos/)
  })
})
