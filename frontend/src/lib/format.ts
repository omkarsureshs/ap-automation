const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

/** Format a number or numeric string as ₹ with Indian grouping; "—" when missing/invalid. */
export function formatRupees(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? `₹${inr.format(n)}` : '—'
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
