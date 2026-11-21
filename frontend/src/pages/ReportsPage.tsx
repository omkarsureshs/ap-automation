import { useEffect, useRef, useState } from 'react'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonRow } from '@/components/ui/skeleton'
import {
  SortableHeaderCell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderRow,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { ApiError, downloadReportCsv, getReport, type ReportKind, type ReportRow } from '@/lib/api'
import { formatDateTime, formatRupees } from '@/lib/format'
import { compareValues, type SortDirection } from '@/lib/sort'

type ColType = 'text' | 'money' | 'number' | 'date'
interface Col {
  key: string
  label: string
  type: ColType
}

const TABS: { kind: ReportKind; label: string; empty: string; cols: Col[] }[] = [
  {
    kind: 'ap-aging',
    label: 'AP aging',
    empty: 'No unpaid invoices to age.',
    cols: [
      { key: 'invoice_no', label: 'Invoice no.', type: 'text' },
      { key: 'vendor_name', label: 'Vendor', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'age_days', label: 'Age (days)', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
  },
  {
    kind: 'invoice-status',
    label: 'Invoice status',
    empty: 'No invoices yet.',
    cols: [
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'count', label: 'Invoices', type: 'number' },
    ],
  },
  {
    kind: 'exceptions',
    label: 'Exceptions',
    empty: 'No exceptions raised. Every invoice so far passed validation.',
    cols: [
      { key: 'invoice_no', label: 'Invoice no.', type: 'text' },
      { key: 'reason', label: 'Reason', type: 'text' },
      { key: 'created_at', label: 'Raised', type: 'date' },
    ],
  },
  {
    kind: 'audit-log',
    label: 'Audit log',
    empty: 'No audit events recorded yet.',
    cols: [
      { key: 'timestamp', label: 'When', type: 'date' },
      { key: 'actor', label: 'Actor', type: 'text' },
      { key: 'event', label: 'Event', type: 'text' },
      { key: 'detail', label: 'Detail', type: 'text' },
    ],
  },
  {
    kind: 'gst-tax',
    label: 'GST / tax',
    empty: 'No invoices with GST details yet.',
    cols: [
      { key: 'invoice_no', label: 'Invoice no.', type: 'text' },
      { key: 'vendor_gstin', label: 'Vendor GSTIN', type: 'text' },
      { key: 'taxable_amount', label: 'Taxable amount', type: 'money' },
    ],
  },
]

function cell(value: string | number | null | undefined, type: ColType): string {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'money') return formatRupees(value)
  if (type === 'date') return formatDateTime(String(value))
  return String(value).replace(/_/g, ' ')
}

interface TabState {
  rows?: ReportRow[]
  error?: string
}

export function ReportsPage() {
  const [active, setActive] = useState(0)
  const [state, setState] = useState<Partial<Record<ReportKind, TabState>>>({})
  const [exporting, setExporting] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const requested = useRef(new Set<ReportKind>())
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const { show } = useToast()
  const tab = TABS[active]

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  async function load(kind: ReportKind) {
    requested.current.add(kind)
    setState((s) => ({ ...s, [kind]: {} }))
    try {
      const rows = await getReport(kind)
      setState((s) => ({ ...s, [kind]: { rows } }))
    } catch (err) {
      setState((s) => ({
        ...s,
        [kind]: { error: err instanceof ApiError ? err.message : 'Something went wrong. Try again.' },
      }))
    }
  }

  useEffect(() => {
    if (!requested.current.has(tab.kind)) load(tab.kind)
  }, [tab.kind])

  useEffect(() => {
    setSortKey(null)
    setSortDirection('asc')
  }, [tab.kind])

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null
    if (next === null) return
    e.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      await downloadReportCsv(tab.kind)
      show({ title: 'CSV exported', description: tab.label, variant: 'success' })
    } catch (err) {
      show({
        title: "Couldn't export CSV",
        description: err instanceof ApiError ? err.message : 'Something went wrong. Try again.',
        variant: 'error',
      })
    } finally {
      setExporting(false)
    }
  }

  const s = state[tab.kind]

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Reports</h1>

      <div role="tablist" aria-label="Reports" className="flex gap-5 overflow-x-auto border-b border-hairline">
        {TABS.map((t, i) => (
          <button
            key={t.kind}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            role="tab"
            id={`tab-${t.kind}`}
            type="button"
            aria-selected={i === active}
            aria-controls="report-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent pb-2 text-sm text-muted-foreground hover:text-foreground aria-selected:border-ledger aria-selected:text-foreground"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="report-panel" aria-labelledby={`tab-${tab.kind}`} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {s?.rows ? `${s.rows.length} ${s.rows.length === 1 ? 'row' : 'rows'}` : ''}
          </span>
          <Button type="button" loading={exporting} onClick={handleExport}>
            Export CSV
          </Button>
        </div>

        {s?.error && (
          <Banner
            variant="error"
            title={`Couldn't load the ${tab.label} report.`}
            action={
              <Button type="button" onClick={() => load(tab.kind)}>
                Try again
              </Button>
            }
          >
            {s.error}
          </Banner>
        )}

        {s?.rows && s.rows.length === 0 && <EmptyState title="Nothing to report">{tab.empty}</EmptyState>}

        {!s?.error && (!s?.rows || s.rows.length > 0) && (
          <Table>
            <TableHead>
              <TableHeaderRow>
                {tab.cols.map((c) => (
                  <SortableHeaderCell
                    key={c.key}
                    numeric={c.type === 'money' || c.type === 'number'}
                    active={sortKey === c.key}
                    direction={sortDirection}
                    onSort={() => toggleSort(c.key)}
                  >
                    {c.label}
                  </SortableHeaderCell>
                ))}
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {!s?.rows && [0, 1, 2, 3].map((i) => <SkeletonRow key={i} columns={tab.cols.length} />)}
              {s?.rows &&
                [...s.rows]
                  .sort((a, b) => {
                    if (!sortKey) return 0
                    const cmp = compareValues(a[sortKey], b[sortKey])
                    return sortDirection === 'asc' ? cmp : -cmp
                  })
                  .map((row, i) => (
                    <TableRow key={i}>
                      {tab.cols.map((c) => (
                        <TableCell key={c.key} numeric={c.type === 'money' || c.type === 'number'}>
                          {cell(row[c.key], c.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
