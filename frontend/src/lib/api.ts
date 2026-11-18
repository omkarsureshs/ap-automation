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

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}

export async function login(email: string, password: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!resp.ok) throw new Error('Login failed')
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
  if (!resp.ok) throw new Error('Failed to list invoices')
  return resp.json()
}

export async function uploadInvoice(file: File): Promise<Invoice> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await authedFetch('/api/invoices/', { method: 'POST', body: formData })
  if (!resp.ok) throw new Error('Upload failed')
  return resp.json()
}
