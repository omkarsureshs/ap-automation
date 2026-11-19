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

export interface Vendor {
  id: number
  name: string
  gstin: string
  email: string
  bank_account_number: string
  bank_ifsc?: string
  is_active: boolean
  created_at: string
}

export interface PurchaseOrder {
  id: number
  po_number: string
  vendor: number
  total_amount: string
  created_at: string
}

export interface GoodsReceiptNote {
  id: number
  grn_number: string
  purchase_order: number
  received_amount: string
  created_at: string
}

export interface CsvImportResult {
  created: number
  errors: { row: number; message: string }[]
}

async function handleJsonResponse<T>(resp: Response, fallback: string): Promise<T> {
  if (resp.status === 401) {
    logout()
    throw new Error('Session expired — please log in again.')
  }
  if (!resp.ok) throw new Error(await errorMessage(resp, fallback))
  return resp.json()
}

export async function listVendors(): Promise<Vendor[]> {
  const resp = await authedFetch('/api/vendors/')
  return handleJsonResponse(resp, 'Failed to list vendors')
}

export async function createVendor(data: {
  name: string
  gstin: string
  email: string
  bank_account_number: string
  bank_ifsc: string
}): Promise<Vendor> {
  const resp = await authedFetch('/api/vendors/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleJsonResponse(resp, 'Failed to create vendor')
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const resp = await authedFetch('/api/procurement/purchase-orders/')
  return handleJsonResponse(resp, 'Failed to list purchase orders')
}

export async function importPurchaseOrdersCsv(file: File): Promise<CsvImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await authedFetch('/api/procurement/purchase-orders/import-csv/', { method: 'POST', body: formData })
  return handleJsonResponse(resp, 'CSV import failed')
}

export async function listGrns(): Promise<GoodsReceiptNote[]> {
  const resp = await authedFetch('/api/procurement/grns/')
  return handleJsonResponse(resp, 'Failed to list GRNs')
}

export async function importGrnsCsv(file: File): Promise<CsvImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await authedFetch('/api/procurement/grns/import-csv/', { method: 'POST', body: formData })
  return handleJsonResponse(resp, 'CSV import failed')
}

export interface ApprovalStep {
  id: number
  invoice: number
  rule: number
  sequence_order: number
  approver_role: string
  status: string
  assigned_at: string
  decided_at: string | null
  decided_by: number | null
}

export interface Notification {
  id: number
  message: string
  is_read: boolean
  created_at: string
}

export async function listMyApprovals(): Promise<ApprovalStep[]> {
  const resp = await authedFetch('/api/workflow/approvals/?mine=true')
  return handleJsonResponse(resp, 'Failed to list approvals')
}

export async function decideApprovalStep(id: number, approve: boolean): Promise<ApprovalStep> {
  const resp = await authedFetch(`/api/workflow/approvals/${id}/decide/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approve }),
  })
  return handleJsonResponse(resp, 'Failed to decide approval step')
}

export async function listNotifications(unreadOnly = false): Promise<Notification[]> {
  const resp = await authedFetch(`/api/workflow/notifications/${unreadOnly ? '?unread=true' : ''}`)
  return handleJsonResponse(resp, 'Failed to list notifications')
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const resp = await authedFetch(`/api/workflow/notifications/${id}/mark-read/`, { method: 'POST' })
  return handleJsonResponse(resp, 'Failed to mark notification read')
}
