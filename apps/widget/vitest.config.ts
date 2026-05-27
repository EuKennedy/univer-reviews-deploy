import { defineConfig } from 'vitest/config'

// Widget runtime tests run under happy-dom so renderStars / renderSummary
// / star-icon CSS-mask path can be asserted against real DOM nodes. We
// stay away from jsdom because happy-dom is ~3× faster and the widget
// doesn't use the few APIs jsdom implements differently.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        // Starter floor — we'll raise these as widget tests grow. Without
        // a threshold, "vitest passes with 0 tests" silently regresses
        // coverage. 30% line floor is the minimum honest baseline given
        // the current single smoke spec; bump as more specs land.
        lines: 30,
        statements: 30,
        functions: 25,
        branches: 25,
      },
    },
  },
})
