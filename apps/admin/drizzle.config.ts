import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/univerreviews_development',
  },
  schemaFilter: ['auth'],
  strict: true,
  verbose: true,
} satisfies Config
