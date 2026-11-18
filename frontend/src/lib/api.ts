const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export interface InvoiceException {
  id: number
  reason: string
  created_at: string
}

export interface Invoice {
  id: number
  file: string
  source: string
  status: string
  created_at: string
  exceptions: InvoiceException[]
}

function getAccessToken(): string | null {
  return localStorage.getItem('access')
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh')
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false
  const resp = await fetch(`${API_BASE}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!resp.ok) return false
  const data = await resp.json()
  localStorage.setItem('access', data.access)
  return true
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const headers = new Headers(options.headers)
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${API_BASE}${path}`, { ...options, headers })
  }

  let resp = await doFetch()
  if (resp.status === 401 && (await tryRefreshToken())) {
    resp = await doFetch()
  }
  return resp
}

async function errorMessage(resp: Response, fallback: string): Promise<string> {
  try {
    const data = await resp.json()
    if (typeof data?.detail === 'string') return data.detail
    const firstFieldError = Object.values(data)[0]
    if (Array.isArray(firstFieldError) && typeof firstFieldError[0] === 'string') return firstFieldError[0]
  } catch {
    // fall through to the generic message below
  }
  return fallback
}

export async function login(email: string, password: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!resp.ok) throw new Error(await errorMessage(resp, 'Login failed'))
  const data = await resp.json()
  localStorage.setItem('access', data.access)
  localStorage.setItem('refresh', data.refresh)
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null
}

export function logout(): void {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
}

export async function listInvoices(): Promise<Invoice[]> {
  const resp = await authedFetch('/api/invoices/')
  if (resp.status === 401) {
    logout()
    throw new Error('Session expired — please log in again.')
  }
  if (!resp.ok) throw new Error(await errorMessage(resp, 'Failed to list invoices'))
  return resp.json()
}

export async function uploadInvoice(file: File): Promise<Invoice> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await authedFetch('/api/invoices/', { method: 'POST', body: formData })
  if (resp.status === 401) {
    logout()
    throw new Error('Session expired — please log in again.')
  }
  if (!resp.ok) throw new Error(await errorMessage(resp, 'Upload failed'))
  return resp.json()
}
