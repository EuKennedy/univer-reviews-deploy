import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://univerreviews:dev@localhost:5432/univerreviews_development'

// Single connection in dev with HMR; pool in production
const globalForPg = globalThis as unknown as { pg?: ReturnType<typeof postgres> }

const client =
  globalForPg.pg ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 1,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false, // Required for transaction pooler compatibility
  })

if (process.env.NODE_ENV !== 'production') globalForPg.pg = client

export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' })

// Raw postgres client for parameterized SQL against tables Drizzle does not own
// (e.g. Rails-managed public.workspace_users).
export const sql = client
export { schema }
