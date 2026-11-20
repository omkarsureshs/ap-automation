import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ApiError, getDashboardSummary, type DashboardSummary } from '@/lib/api'
import { formatRupees } from '@/lib/format'

const AXIS = { fill: 'var(--ink-soft)', fontSize: 12 }

function formatTurnaround(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—'
  return hours >= 48 ? `${(hours / 24).toFixed(1)} d` : `${hours.toFixed(1)} h`
}

function formatPercent(p: number | null): string {
  return p === null || !Number.isFinite(p) ? '—' : `${p.toFixed(1)}%`
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border border-hairline bg-card p-4">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-hairline bg-card p-4 ${className ?? ''}`}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

interface TipProps {
  active?: boolean
  payload?: { payload: { name: string; count: number; amount: string } }[]
}

function ChartTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-hairline bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      <div className="font-semibold">{d.name}</div>
      <div className="tabular">{d.count} invoices</div>
      <div className="tabular text-muted-foreground">{formatRupees(d.amount)}</div>
    </div>
  )
}

function DataTable({ caption, rows }: { caption: string; rows: [string, string][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer h-24 rounded-md" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton-shimmer h-64 rounded-md" />
        <div className="skeleton-shimmer h-64 rounded-md" />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setData(await getDashboardSummary())
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    }
  }

  useEffect(() => {
    getDashboardSummary()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.'))
  }, [])

  let body: React.ReactNode
  if (error) {
    body = (
      <Banner
        variant="error"
        title="Couldn't load the overview."
        action={
          <Button type="button" onClick={load}>
            Try again
          </Button>
        }
      >
        {error}
      </Banner>
    )
  } else if (!data) {
    body = <DashboardSkeleton />
  } else {
    const aging = data.invoice_aging.map((b) => ({ name: b.bucket, count: b.count, amount: b.total_amount }))
    const vendors = data.vendor_analytics
      .slice(0, 6)
      .map((v) => ({ name: v.vendor_name, count: v.invoice_count, amount: v.total_amount }))
    const pay = data.payment_tracking
    const payTotal = pay.processing + pay.completed + pay.failed
    const empty =
      aging.every((b) => b.count === 0) && vendors.length === 0 && payTotal === 0 && data.pending_approvals === 0
    const segments = [
      { key: 'completed', label: 'Completed', n: pay.completed, color: 'var(--approved)' },
      { key: 'processing', label: 'Processing', n: pay.processing, color: 'var(--pending)' },
      { key: 'failed', label: 'Failed', n: pay.failed, color: 'var(--exception)' },
    ]

    body = (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Pending approvals" value={String(data.pending_approvals)} />
          <Tile label="Avg. turnaround" value={formatTurnaround(data.avg_turnaround_hours)} note="Upload to final decision" />
          <Tile
            label="OCR accuracy"
            value={formatPercent(data.ocr_accuracy_percent)}
            note="Invoices that passed validation with no exceptions"
          />
          <Tile label="Total paid" value={formatRupees(pay.total_paid_amount)} />
        </div>

        {empty ? (
          <EmptyState title="No activity yet">Upload an invoice to see this fill in.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Invoice aging">
              <div role="img" aria-label="Bar chart of invoice counts by age bucket" className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aging} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid vertical={false} stroke="var(--hairline)" />
                    <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--hairline)' }} />
                    <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'var(--ledger-soft)' }} content={<ChartTip />} />
                    <Bar dataKey="count" fill="var(--ledger)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                caption="Invoice aging"
                rows={aging.map((b) => [b.name, `${b.count} invoices, ${formatRupees(b.amount)}`])}
              />
            </Panel>

            <Panel title="Top vendors by invoice count">
              {vendors.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No vendor invoices yet.</p>
              ) : (
                <div
                  role="img"
                  aria-label="Horizontal bar chart of invoice counts per vendor"
                  style={{ height: Math.max(160, vendors.length * 40 + 24) }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendors} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid horizontal={false} stroke="var(--hairline)" />
                      <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={AXIS} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'var(--ledger-soft)' }} content={<ChartTip />} />
                      <Bar dataKey="count" fill="var(--ledger)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <DataTable
                caption="Vendor analytics"
                rows={vendors.map((v) => [v.name, `${v.count} invoices, ${formatRupees(v.amount)}`])}
              />
            </Panel>

            <Panel title="Payment tracking" className="md:col-span-2">
              {payTotal === 0 ? (
                <p className="text-sm text-muted-foreground">No payments requested yet.</p>
              ) : (
                <>
                  <div
                    role="img"
                    aria-label={segments.map((s) => `${s.n} ${s.label.toLowerCase()}`).join(', ')}
                    className="flex h-3 overflow-hidden rounded-full bg-secondary"
                  >
                    {segments.map((s) => (
                      <div key={s.key} style={{ width: `${(s.n / payTotal) * 100}%`, background: s.color }} />
                    ))}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    {segments.map((s) => (
                      <li key={s.key} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="tabular font-medium">{s.n}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where every invoice stands, from upload to payment, at a glance.
        </p>
      </div>
      {body}
    </div>
  )
}
