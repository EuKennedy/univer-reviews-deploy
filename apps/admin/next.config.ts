import type { NextConfig } from 'next'

// Security headers applied to every response served by the admin app.
// dash.univerreviews.com renders the workspace dashboard — the auth
// cookie is httpOnly, but XSS could still trigger authenticated requests
// via fetch(), clickjacking could trap-frame the admin UI on a phishing
// site, and HSTS prevents the first-load downgrade.
//
// These were entirely absent before — the admin shipped with zero
// security headers, relying on browser defaults.
const securityHeaders = [
  // No framing — admin must never be iframed (clickjacking + login UI
  // wrapping). The Stripe checkout / billing portal opens in a new tab,
  // so frame-ancestors 'none' is safe.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // HSTS: 2 years, include subdomains. Only meaningful in prod; harmless
  // on localhost (browsers ignore it for http://localhost).
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // CSP. Tight default-src; explicit allowlist for the API + minio + Stripe.
  // 'unsafe-inline' on script-src is unfortunate but Next's theme-bootstrap
  // injects an inline script via dangerouslySetInnerHTML for FOUC-prevention.
  // We can drop 'unsafe-inline' after migrating that to an external script
  // with a nonce.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      // img-src is permissive: product images come from arbitrary merchant
      // domains (lizzon.com.br, *.myshopify.com, customer's own CDN). Locking
      // this down to a whitelist would break the admin's product table the
      // moment a new merchant connects. Keep https: open for images while
      // staying tight on scripts/connects/frames.
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.univerreviews.com https://*.univerreviews.com https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.univerreviews.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // Strip console.* in production builds (except errors / warnings) so a
  // stray console.log(user) doesn't leak PII to the browser console.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
