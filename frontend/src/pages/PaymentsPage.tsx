import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
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
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { ApiError, listInvoices, listPayments, requestPayment, type Invoice, type Payment } from '@/lib/api'
import { formatDateTime, formatRupees } from '@/lib/format'
import { useSort } from '@/lib/sort'

function invoiceLabel(inv: Invoice | undefined, id: number): string {
  return inv?.extracted_invoice_no || (inv ? inv.file.split('/').pop() : null) || `Invoice #${id}`
}

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return 'Something went wrong. Try again.'
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
  // "Ready to pay" and "Payment history" are fetched and error-handled
  // independently: only ap_admin can see the invoice list, but both
  // ap_admin and approver can see payment history, and the latter
  // shouldn't be hidden just because the former 403s for that role.
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [invoicesError, setInvoicesError] = useState<string | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)
  const inFlight = useRef(false)
  const { show } = useToast()

  async function refreshInvoices() {
    try {
      setInvoices(await listInvoices())
      setInvoicesError(null)
    } catch (err) {
      setInvoicesError(errorMessageFor(err))
    }
  }

  async function refreshPayments() {
    try {
      setPayments(await listPayments())
      setPaymentsError(null)
    } catch (err) {
      setPaymentsError(errorMessageFor(err))
    }
  }

  useEffect(() => {
    refreshInvoices()
    refreshPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await Promise.all([refreshInvoices(), refreshPayments()])
    }
  }

  const ready = invoices?.filter((i) => i.status === 'approved') ?? []
  const byId = new Map((invoices ?? []).map((i) => [i.id, i]))
  const invoicesLoading = invoices === null && !invoicesError
  const readySort = useSort<Invoice, keyof Invoice>(ready, null)
  const paymentsSort = useSort<Payment, keyof Payment>(payments, 'completed_at')

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Payments</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Ready to pay</h2>
        {invoicesError ? (
          <Banner
            variant="error"
            title="Couldn't load invoices ready for payment."
            action={
              <Button type="button" onClick={refreshInvoices}>
                Try again
              </Button>
            }
          >
            {invoicesError}
          </Banner>
        ) : !invoicesLoading && ready.length === 0 ? (
          <EmptyState title="Nothing to pay right now">Approved invoices appear here, ready for payment.</EmptyState>
        ) : (
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <SortableHeaderCell
                  active={readySort.sortKey === 'extracted_vendor_name'}
                  direction={readySort.sortDirection}
                  onSort={() => readySort.toggleSort('extracted_vendor_name')}
                >
                  Vendor
                </SortableHeaderCell>
                <SortableHeaderCell
                  numeric
                  active={readySort.sortKey === 'extracted_total_amount'}
                  direction={readySort.sortDirection}
                  onSort={() => readySort.toggleSort('extracted_total_amount')}
                >
                  Amount
                </SortableHeaderCell>
                <TableHeaderCell className="text-right">
                  <span className="sr-only">Action</span>
                </TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {invoicesLoading && [0, 1, 2].map((i) => <SkeletonRow key={i} columns={4} />)}
              {readySort.sorted?.map((inv) => (
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
        {paymentsError ? (
          <Banner
            variant="error"
            title="Couldn't load payment history."
            action={
              <Button type="button" onClick={refreshPayments}>
                Try again
              </Button>
            }
          >
            {paymentsError}
          </Banner>
        ) : payments !== null && payments.length === 0 ? (
          <EmptyState title="No payments yet">Requested payments and their bank status show up here.</EmptyState>
        ) : (
          <Table className="min-w-[640px]">
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <SortableHeaderCell
                  numeric
                  active={paymentsSort.sortKey === 'amount'}
                  direction={paymentsSort.sortDirection}
                  onSort={() => paymentsSort.toggleSort('amount')}
                >
                  Amount
                </SortableHeaderCell>
                <SortableHeaderCell
                  active={paymentsSort.sortKey === 'status'}
                  direction={paymentsSort.sortDirection}
                  onSort={() => paymentsSort.toggleSort('status')}
                >
                  Status
                </SortableHeaderCell>
                <TableHeaderCell>Gateway reference</TableHeaderCell>
                <SortableHeaderCell
                  active={paymentsSort.sortKey === 'completed_at'}
                  direction={paymentsSort.sortDirection}
                  onSort={() => paymentsSort.toggleSort('completed_at')}
                >
                  Completed
                </SortableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {payments === null && [0, 1, 2].map((i) => <SkeletonRow key={i} columns={5} />)}
              {paymentsSort.sorted?.map((p) => (
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
