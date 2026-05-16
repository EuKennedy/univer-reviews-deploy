/**
 * Better Auth route handler — catches all /api/auth/* requests.
 */
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

export const { GET, POST } = toNextJsHandler(auth.handler)
