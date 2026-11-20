import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonRow } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { ApiError, listInvoices, listPayments, requestPayment, type Invoice, type Payment } from '@/lib/api'
import { formatDateTime, formatRupees } from '@/lib/format'

function invoiceLabel(inv: Invoice | undefined, id: number): string {
  return inv?.extracted_invoice_no || (inv ? inv.file.split('/').pop() : null) || `Invoice #${id}`
}

function paymentError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'conflict') return 'A payment was already requested for this invoice.'
    if (err.kind === 'forbidden') return 'Only AP Admins can request payments.'
    return err.message
  }
  return 'Something went wrong. Try again.'
}

export function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)
  const inFlight = useRef(false)
  const { show } = useToast()

  async function refresh() {
    try {
      const [inv, pay] = await Promise.all([listInvoices(), listPayments()])
      setInvoices(inv)
      setPayments(pay)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    }
  }

  useEffect(() => {
    Promise.all([listInvoices(), listPayments()])
      .then(([inv, pay]) => {
        setInvoices(inv)
        setPayments(pay)
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.'))
  }, [])

  async function handlePay(inv: Invoice) {
    if (inFlight.current) return
    inFlight.current = true
    setPayingId(inv.id)
    try {
      const p = await requestPayment(inv.id)
      show(
        p.status === 'failed'
          ? { title: 'Payment failed', description: p.failure_reason || 'The bank rejected it. Try again.', variant: 'error' }
          : {
              title: p.status === 'completed' ? 'Payment completed' : 'Payment requested',
              description: invoiceLabel(inv, inv.id),
              variant: 'success',
            },
      )
    } catch (err) {
      show({ title: "Couldn't request payment", description: paymentError(err), variant: 'error' })
    } finally {
      inFlight.current = false
      setPayingId(null)
      await refresh()
    }
  }

  const ready = invoices?.filter((i) => i.status === 'approved') ?? []
  const byId = new Map((invoices ?? []).map((i) => [i.id, i]))
  const loading = invoices === null || payments === null

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Payments</h1>

      {loadError && (
        <Banner
          variant="error"
          title="Couldn't load payments."
          action={
            <Button type="button" onClick={refresh}>
              Try again
            </Button>
          }
        >
          {loadError}
        </Banner>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Ready to pay</h2>
        {!loadError && !loading && ready.length === 0 ? (
          <EmptyState title="Nothing to pay right now">Approved invoices appear here, ready for payment.</EmptyState>
        ) : (
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <TableHeaderCell>Vendor</TableHeaderCell>
                <TableHeaderCell numeric>Amount</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  <span className="sr-only">Action</span>
                </TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {loading && !loadError && [0, 1, 2].map((i) => <SkeletonRow key={i} columns={4} />)}
              {ready.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{invoiceLabel(inv, inv.id)}</TableCell>
                  <TableCell>{inv.extracted_vendor_name || '—'}</TableCell>
                  <TableCell numeric>{formatRupees(inv.extracted_total_amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      loading={payingId === inv.id}
                      disabled={payingId !== null}
                      onClick={() => handlePay(inv)}
                    >
                      Request payment
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Payment history</h2>
        {!loadError && !loading && payments.length === 0 ? (
          <EmptyState title="No payments yet">Requested payments and their bank status show up here.</EmptyState>
        ) : (
          <Table className="min-w-[640px]">
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <TableHeaderCell numeric>Amount</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Gateway reference</TableHeaderCell>
                <TableHeaderCell>Completed</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {loading && !loadError && [0, 1, 2].map((i) => <SkeletonRow key={i} columns={5} />)}
              {payments?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{invoiceLabel(byId.get(p.invoice), p.invoice)}</TableCell>
                  <TableCell numeric>{formatRupees(p.amount)}</TableCell>
                  <TableCell>
                    <Badge status={p.status} />
                    {p.status === 'failed' && p.failure_reason && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{p.failure_reason}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.gateway_reference || '—'}</TableCell>
                  <TableCell>{formatDateTime(p.completed_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
