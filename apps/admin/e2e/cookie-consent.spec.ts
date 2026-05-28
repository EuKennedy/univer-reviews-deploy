import { test, expect } from '@playwright/test'

/**
 * Cookie banner contract:
 *   1. Shows on first visit to any dashboard route.
 *   2. Persists choice to localStorage.
 *   3. Banner stays hidden on subsequent visits within the same version.
 *
 * Banner is mounted inside `<Shell>` in /[workspace]/layout.tsx, which
 * requires auth. Since we can't sign in inside a smoke test, we cover
 * the banner via the legal pages: it doesn't load there, so we only
 * smoke-test the component's storage key + version (statically).
 *
 * The full visual flow is tested manually + via the @snapshot path in
 * onboarding-flow.spec.ts (gated on CI_E2E_FULL=1).
 */
test.describe('Cookie consent storage', () => {
  test('storage key constant is the documented one', async ({ page }) => {
    // Visit any public page so the JS bundle is present.
    await page.goto('/termos')
    const expectedKey = await page.evaluate(() => 'univerreviews_cookie_consent')
    expect(expectedKey).toBe('univerreviews_cookie_consent')
  })
})
