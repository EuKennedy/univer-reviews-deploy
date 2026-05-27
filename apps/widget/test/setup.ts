import { vi, beforeAll, afterEach } from 'vitest'

// happy-dom ships fetch by default but it'll hit the network for every
// public/widget-config and public/reviews call the widget makes on
// connect. Stub it globally so mount tests don't depend on a server.
// Returns 404 with an empty JSON body — the widget's catch path falls
// through to its built-in defaults, which is what we want to assert.
beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url

    // Tag the spy so individual tests can override per URL if needed.
    return new Response(JSON.stringify({ data: null, _stubbed: true, url }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }))
})

afterEach(() => {
  // Remove any custom elements appended during the previous test so the
  // next test starts clean. happy-dom keeps the registry across tests
  // (custom elements can't be unregistered) but DOM nodes can be wiped.
  document.body.innerHTML = ''
})
