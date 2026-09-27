import type { StateStorage } from 'zustand/middleware'

/**
 * Minimal async key/value storage on IndexedDB (DB "staybridge", store "kv") for zustand's
 * createJSONStorage. localStorage caps out around 5MB, which uploaded photos quickly exceed.
 *
 * Migration: if IndexedDB has no value for a key, getItem falls back to the legacy localStorage
 * entry of the same name; the legacy entry is removed after the first successful setItem.
 * If IndexedDB is unavailable (e.g. some private modes), everything falls back to localStorage.
 */
const DB_NAME = 'staybridge'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'))
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
      req.onblocked = () => reject(new Error('IndexedDB open blocked'))
    })
    dbPromise.catch(() => { dbPromise = null })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result as T)
    tx.onerror = () => reject(tx.error ?? req.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  }))
}

function legacyGet(name: string): string | null {
  try { return localStorage.getItem(name) } catch { return null }
}
function legacyRemove(name: string) {
  try { localStorage.removeItem(name) } catch { /* storage unavailable */ }
}

export const idbStorage: StateStorage = {
  async getItem(name) {
    try {
      const value = await run<unknown>('readonly', (s) => s.get(name))
      if (typeof value === 'string') return value
    } catch { /* fall through to legacy storage */ }
    return legacyGet(name)
  },
  async setItem(name, value) {
    try {
      await run('readwrite', (s) => s.put(value, name))
      legacyRemove(name)
    } catch {
      // IndexedDB unavailable: best effort on localStorage (may hit its quota with many photos).
      try { localStorage.setItem(name, value) } catch { /* quota or unavailable */ }
    }
  },
  async removeItem(name) {
    try { await run('readwrite', (s) => s.delete(name)) } catch { /* ignore */ }
    legacyRemove(name)
  },
}
