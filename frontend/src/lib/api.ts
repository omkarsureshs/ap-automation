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
  match_status: string
  purchase_order: number | null
  created_at: string
  exceptions: InvoiceException[]
}

export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'network'
  | 'server'

export class ApiError extends Error {
  kind: ApiErrorKind
  fieldErrors?: Record<string, string>

  constructor(kind: ApiErrorKind, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.fieldErrors = fieldErrors
  }
}

function getAccessToken(): string | null {
  return localStorage.getItem('access')
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh')
}

async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options)
  } catch {
    throw new ApiError('network', "Can't reach AP Automation right now. Check your connection and try again.")
  }
}

async function classifyAndThrow(resp: Response): Promise<never> {
  let body: unknown = null
  try {
    body = await resp.json()
  } catch {
    // no JSON body to read
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const detail = record && typeof record.detail === 'string' ? record.detail : undefined

  if (resp.status === 401) {
    throw new ApiError('unauthorized', detail ?? 'Your session has expired. Log in again.')
  }
  if (resp.status === 403) {
    throw new ApiError('forbidden', detail ?? "You don't have access to do this.")
  }
  if (resp.status === 404) {
    throw new ApiError('not_found', detail ?? "That couldn't be found.")
  }
  if (resp.status === 409) {
    throw new ApiError('conflict', detail ?? 'Someone else already changed this. Refresh to see the current state.')
  }
  if (resp.status === 400) {
    const fieldErrors: Record<string, string> = {}
    let firstMessage: string | undefined
    if (record) {
      for (const [field, value] of Object.entries(record)) {
        if (field === 'detail') continue
        const message = Array.isArray(value) ? value[0] : typeof value === 'string' ? value : undefined
        if (typeof message === 'string') {
          fieldErrors[field] = message
          firstMessage ??= message
        }
      }
    }
    throw new ApiError('validation', firstMessage ?? detail ?? 'Check the highlighted fields.', fieldErrors)
  }
  if (resp.status >= 400 && resp.status < 500) {
    throw new ApiError('validation', detail ?? "That request couldn't be processed. Check what you sent and try again.")
  }
  throw new ApiError(
    'server',
    detail ?? "Something's wrong on our end. Try again shortly.",
  )
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false
  try {
    const resp = await fetch(`${API_BASE}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!resp.ok) return false
    const data = await resp.json()
    localStorage.setItem('access', data.access)
    return true
  } catch {
    return false
  }
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const headers = new Headers(options.headers)
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return safeFetch(`${API_BASE}${path}`, { ...options, headers })
  }

  let resp = await doFetch()
  if (resp.status === 401 && (await tryRefreshToken())) {
    resp = await doFetch()
  }
  return resp
}

function redirectToLoginExpired(): void {
  logout()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login?reason=expired')
  }
}

async function handleJsonResponse<T>(resp: Response): Promise<T> {
  if (resp.status === 401) {
    redirectToLoginExpired()
    throw new ApiError('unauthorized', 'Your session has expired. Log in again.')
  }
  if (!resp.ok) {
    await classifyAndThrow(resp)
  }
  return resp.json()
}

export async function login(email: string, password: string): Promise<void> {
  const resp = await safeFetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!resp.ok) await classifyAndThrow(resp)
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
  return handleJsonResponse(resp)
}

export async function uploadInvoice(file: File): Promise<Invoice> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await authedFetch('/api/invoices/', { method: 'POST', body: formData })
  return handleJsonResponse(resp)
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

export async function listVendors(): Promise<Vendor[]> {
  const resp = await authedFetch('/api/vendors/')
  return handleJsonResponse(resp)
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
  return handleJsonResponse(resp)
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const resp = await authedFetch('/api/procurement/purchase-orders/')
  return handleJsonResponse(resp)
}

export async function importPurchaseOrdersCsv(file: File): Promise<CsvImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await authedFetch('/api/procurement/purchase-orders/import-csv/', { method: 'POST', body: formData })
  return handleJsonResponse(resp)
}

export async function listGrns(): Promise<GoodsReceiptNote[]> {
  const resp = await authedFetch('/api/procurement/grns/')
  return handleJsonResponse(resp)
}

export async function importGrnsCsv(file: File): Promise<CsvImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await authedFetch('/api/procurement/grns/import-csv/', { method: 'POST', body: formData })
  return handleJsonResponse(resp)
}

export interface InvoiceSummary {
  id: number
  extracted_invoice_no: string | null
  extracted_vendor_name: string | null
  extracted_total_amount: string | null
  file: string
}

export interface ApprovalStep {
  id: number
  invoice: number
  invoice_detail: InvoiceSummary
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
  return handleJsonResponse(resp)
}

export async function decideApprovalStep(id: number, approve: boolean): Promise<ApprovalStep> {
  const resp = await authedFetch(`/api/workflow/approvals/${id}/decide/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approve }),
  })
  return handleJsonResponse(resp)
}

export async function listNotifications(unreadOnly = false): Promise<Notification[]> {
  const resp = await authedFetch(`/api/workflow/notifications/${unreadOnly ? '?unread=true' : ''}`)
  return handleJsonResponse(resp)
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const resp = await authedFetch(`/api/workflow/notifications/${id}/mark-read/`, { method: 'POST' })
  return handleJsonResponse(resp)
}
