/**
 * Minimal typed client for the StayBridge API (see server/API.md).
 * Same-origin in production; in development Vite proxies /api to the API server so the session
 * cookie stays first-party.
 */
import type { UploadedFile } from '@/types'

export const API_BASE = '/api'

export interface FieldIssue { path: string; message: string }

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.code = code
  }

  /** Validation issues keyed by field path ("verification.idNumber" → message). */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    if (Array.isArray(this.details)) {
      for (const d of this.details as Partial<FieldIssue>[]) {
        if (d && typeof d.path === 'string' && typeof d.message === 'string' && !out[d.path]) out[d.path] = d.message
      }
    }
    return out
  }
}

/** Human-readable message for anything thrown by an API call. */
export function errorMessage(e: unknown, fallback = 'Something went wrong') {
  if (e instanceof ApiError) return e.message || fallback
  if (e instanceof Error && e.message) return e.message
  return fallback
}

export const isApiError = (e: unknown, status?: number): e is ApiError =>
  e instanceof ApiError && (status === undefined || e.status === status)

type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  signal?: AbortSignal
}

let unauthorizedHandler: ((path: string) => void) | null = null
/** Called whenever an authenticated request comes back 401 (session expired / revoked). */
export function onUnauthorized(fn: (path: string) => void) {
  unauthorizedHandler = fn
}

/** 401 from these endpoints means "wrong credentials", not "session expired". */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup', '/auth/change-password', '/auth/me']

export function buildQuery(query?: Query) {
  if (!query) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue
    p.set(k, v === true ? '1' : String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

const NETWORK_MESSAGE = 'Can’t reach StayBridge right now. Check your connection and try again.'

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: string; code?: string; details?: unknown } | null = null
  try { body = await res.json() } catch { /* not JSON */ }
  // A gateway error without an API body means the API itself is down (e.g. the dev proxy can't connect).
  if (!body && [502, 503, 504].includes(res.status)) return new ApiError(res.status, NETWORK_MESSAGE)
  const fallback = res.status === 429 ? 'Too many requests. Please wait a moment and try again.'
    : res.status >= 500 ? 'The server had a problem. Please try again.'
      : res.status === 404 ? 'Not found'
        : res.status === 403 ? 'You don’t have access to this'
          : res.status === 401 ? 'Please sign in to continue' : `Request failed (${res.status})`
  return new ApiError(res.status, body?.error || fallback, body?.details, body?.code)
}

function handleUnauthorized(status: number, path: string) {
  if (status === 401 && !AUTH_ENDPOINTS.some((p) => path.startsWith(p))) unauthorizedHandler?.(path)
}

/** JSON request. Resolves with the parsed body (or undefined for 204). Throws ApiError otherwise. */
export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET')
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'fetch' }
  let body: BodyInit | undefined
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(opts.query)}`, { method, headers, body, credentials: 'include', signal: opts.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, NETWORK_MESSAGE)
  }
  if (!res.ok) {
    handleUnauthorized(res.status, path)
    throw await parseError(res)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) {
    // e.g. an SPA fallback page when the API isn't mounted.
    throw new ApiError(502, 'Unexpected response from the server. Is the API running?')
  }
  return (await res.json()) as T
}

export const get = <T>(path: string, query?: Query, signal?: AbortSignal) => api<T>(path, { query, signal })
export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body })
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body })
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body })
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' })

export type FileKind = UploadedFile['kind']

/**
 * Multipart upload to POST /api/files?kind=… (field "files"). Uses XHR so callers get upload
 * progress (0–1). Resolves with the stored file records in the same order.
 */
export function uploadFiles(kind: FileKind, files: File[], opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<UploadedFile[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const f of files) form.append('files', f, f.name)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/files${buildQuery({ kind })}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Requested-With', 'fetch')
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.responseType = 'text'
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total) }
    xhr.onerror = () => reject(new ApiError(0, NETWORK_MESSAGE))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    xhr.onload = () => {
      let body: { files?: UploadedFile[]; error?: string; details?: unknown; code?: string } | null = null
      try { body = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.files) {
        opts.onProgress?.(1)
        resolve(body.files)
        return
      }
      handleUnauthorized(xhr.status, '/files')
      const fallback = xhr.status === 413 ? 'File is too large (max 8 MB).' : xhr.status >= 200 && xhr.status < 300 ? 'Unexpected response from the server.' : `Upload failed (${xhr.status})`
      reject(new ApiError(xhr.status || 502, body?.error || fallback, body?.details, body?.code))
    }
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(form)
  })
}

/** URL that streams an uploaded file (private kinds require the uploader's or an admin's session). */
export const fileUrl = (id: string) => `${API_BASE}/files/${encodeURIComponent(id)}`

/** Mock card fields accepted by the payment endpoints. */
export interface CardInput { number: string; exp: string; cvc: string }
