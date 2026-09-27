import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'

// Minimal .env loader (no dependency). Real deployments inject env vars directly.
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
}

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('./data/staybridge.db'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CORS_ORIGINS: z.string().default(''),
  UPLOAD_DIR: z.string().default('./uploads'),
  ADMIN_EMAIL: z.email().default('admin@staybridge.demo'),
  ADMIN_PASSWORD: z.string().min(10).default('ChangeMe!Admin2026'),
  SEED_DEMO: z.string().default('false'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AGENT_MODEL: z.string().default('claude-opus-5'),
  AGENT_INTERVAL_MINUTES: z.coerce.number().min(0).default(10),
  AGENT_MONTHLY_BUDGET_CENTS: z.coerce.number().min(0).default(5000),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  process.exit(1)
}
export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
}
if (env.isProd && env.SESSION_SECRET.startsWith('change-me')) {
  console.error('Refusing to start in production with the default SESSION_SECRET')
  process.exit(1)
}
