import { describe, it, expect, beforeAll } from 'vitest'

// Pull the widget bundle source in. Side effect: registers three custom
// elements (univer-reviews, univer-reviews-summary, univer-ai-carousel)
// against the happy-dom CustomElementRegistry.
beforeAll(async () => {
  await import('../src/widget')
})

describe('widget custom-element registration', () => {
  it('registers <univer-reviews>', () => {
    expect(customElements.get('univer-reviews')).toBeTypeOf('function')
  })

  it('registers <univer-reviews-summary>', () => {
    expect(customElements.get('univer-reviews-summary')).toBeTypeOf('function')
  })

  it('registers <univer-ai-carousel>', () => {
    expect(customElements.get('univer-ai-carousel')).toBeTypeOf('function')
  })
})

describe('<univer-reviews> shadow DOM', () => {
  it('creates an open shadow root on connect', () => {
    const el = document.createElement('univer-reviews')
    el.setAttribute('product-id', 'test-product')
    el.setAttribute('workspace-id', '00000000-0000-0000-0000-000000000000')
    el.setAttribute('api-url', 'http://localhost:9999')
    document.body.appendChild(el)

    expect(el.shadowRoot).not.toBeNull()
    expect(el.shadowRoot!.mode).toBe('open')
  })

  it('renders a star color CSS variable from the attribute', () => {
    const el = document.createElement('univer-reviews')
    el.setAttribute('product-id', 'p1')
    el.setAttribute('workspace-id', '00000000-0000-0000-0000-000000000000')
    el.setAttribute('star-color', '#ff00aa')
    el.setAttribute('api-url', 'http://localhost:9999')
    document.body.appendChild(el)

    const style = el.shadowRoot?.querySelector('style')?.textContent ?? ''
    expect(style).toContain('--ur-star')
    // Color may be normalised — accept either #ff00aa or rgb form.
    expect(style.toLowerCase()).toMatch(/#ff00aa|rgb\(255,\s*0,\s*170\)/)
  })
})

describe('<univer-reviews-summary> shadow DOM', () => {
  it('mounts without throwing when required attrs are present', () => {
    const el = document.createElement('univer-reviews-summary')
    el.setAttribute('product-id', 'p1')
    el.setAttribute('workspace-id', '00000000-0000-0000-0000-000000000000')
    el.setAttribute('api-url', 'http://localhost:9999')
    expect(() => document.body.appendChild(el)).not.toThrow()
    expect(el.shadowRoot).not.toBeNull()
  })
})

describe('<univer-ai-carousel> shadow DOM', () => {
  it('mounts without throwing', () => {
    const el = document.createElement('univer-ai-carousel')
    el.setAttribute('product-id', 'p1')
    el.setAttribute('workspace-id', '00000000-0000-0000-0000-000000000000')
    el.setAttribute('api-url', 'http://localhost:9999')
    expect(() => document.body.appendChild(el)).not.toThrow()
    expect(el.shadowRoot).not.toBeNull()
  })
})
