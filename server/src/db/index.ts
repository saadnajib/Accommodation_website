import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.js'
import { env } from '../lib/env.js'

const here = path.dirname(fileURLToPath(import.meta.url))

export function openDatabase(url = env.DATABASE_URL) {
  if (url !== ':memory:') fs.mkdirSync(path.dirname(url), { recursive: true })
  const sqlite = new Database(url)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.resolve(here, '../../drizzle') })
  return db
}

export type DB = ReturnType<typeof openDatabase>
export let db: DB = undefined as unknown as DB
export function setDb(d: DB) { db = d }
export { schema }
