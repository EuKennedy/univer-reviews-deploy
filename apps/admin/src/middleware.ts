import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/invite']

/**
 * Edge middleware: gate authenticated routes.
 *
 * We check for Better Auth's session cookie presence. Full session validation
 * (signature + DB lookup) happens server-side in the API route or RSC layer.
 * Reasoning: avoid making DB calls from the edge runtime (cold-start cost).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Next.js internals + API + assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const hasSession =
    request.cookies.get('better-auth.session_token') ||
    request.cookies.get('__Secure-better-auth.session_token')

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
