import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
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
import { ApiError, correctInvoice, deleteInvoice, getCurrentUser, listInvoices, uploadInvoice, type Invoice } from '@/lib/api'
import { useSort } from '@/lib/sort'

const DELETABLE_STATUSES = new Set(['uploaded', 'extracted', 'needs_review'])

function loadErrorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'forbidden') {
      return "You don't have access to view invoices. Ask an AP Admin to grant it."
    }
    return err.message
  }
  return 'Something went wrong. Try again.'
}

function uploadErrorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'forbidden') {
      return "You don't have access to upload invoices. That's limited to Requesters and AP Admins."
    }
    return err.message
  }
  return 'Something went wrong. Try again.'
}

function correctionErrorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'forbidden') {
      return "You don't have access to fix invoice fields. That's limited to AP Admins."
    }
    return err.message
  }
  return 'Something went wrong. Try again.'
}

const CORRECTION_FIELDS = [
  ['extracted_invoice_no', 'Invoice no.'],
  ['extracted_invoice_date', 'Invoice date (dd/mm/yyyy)'],
  ['extracted_gstin', 'GSTIN'],
  ['extracted_total_amount', 'Total amount'],
  ['extracted_vendor_name', 'Vendor name'],
] as const

function CorrectionForm({
  invoice,
  onDone,
  onCancel,
}: {
  invoice: Invoice
  onDone: (updated: Invoice) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState({
    extracted_invoice_no: invoice.extracted_invoice_no ?? '',
    extracted_invoice_date: invoice.extracted_invoice_date ?? '',
    extracted_gstin: invoice.extracted_gstin ?? '',
    extracted_total_amount: invoice.extracted_total_amount ?? '',
    extracted_vendor_name: invoice.extracted_vendor_name ?? '',
  })
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await correctInvoice(invoice.id, values)
      show({
        title: updated.status === 'needs_review' ? 'Saved — still needs review' : 'Invoice revalidated',
        description: `New status: ${updated.status}`,
        variant: 'success',
      })
      onDone(updated)
    } catch (err) {
      show({ title: "Couldn't save correction", description: correctionErrorMessageFor(err), variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-hairline bg-secondary/30 p-3">
      {CORRECTION_FIELDS.map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-xs">
          <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
          <Input
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex gap-2">
        <Button type="button" onClick={handleSave} loading={saving}>
          Save &amp; revalidate
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-transparent text-foreground ring-1 ring-inset ring-hairline hover:bg-secondary/60"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

function LineItemsPreview({ items }: { items: NonNullable<Invoice['line_items']> }) {
  return (
    <table className="mt-1 w-full max-w-sm border-collapse text-left text-xs">
      <thead>
        <tr className="border-b border-hairline text-muted-foreground">
          <th className="py-1 pr-2 font-medium">Description</th>
          <th className="py-1 pr-2 text-right font-medium">Qty</th>
          <th className="py-1 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-hairline last:border-0">
            <td className="py-1 pr-2">{item.description}</td>
            <td className="tabular py-1 pr-2 text-right">{item.quantity ?? '—'}</td>
            <td className="tabular py-1 text-right">{item.amount ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function UploadPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [expandedLineItemsId, setExpandedLineItemsId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { show } = useToast()
  const isAdmin = getCurrentUser()?.role === 'ap_admin'
  const { sorted, sortKey, sortDirection, toggleSort } = useSort<Invoice, keyof Invoice>(invoices, 'created_at')

  async function refresh() {
    try {
      setInvoices(await listInvoices())
      setLoadError(null)
    } catch (err) {
      setLoadError(loadErrorMessageFor(err))
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFiles(files: File[]) {
    if (uploading || files.length === 0) return
    setUploading(true)
    let succeeded = 0
    let failed = 0
    for (const file of files) {
      try {
        await uploadInvoice(file)
        succeeded++
      } catch (err) {
        failed++
        show({ title: `Couldn't upload ${file.name}`, description: uploadErrorMessageFor(err), variant: 'error' })
      }
    }
    if (succeeded > 0) {
      show({
        title: files.length === 1 ? 'Invoice uploaded' : `${succeeded} of ${files.length} invoices uploaded`,
        description: files.length === 1 ? files[0].name : failed > 0 ? `${failed} failed` : undefined,
        variant: 'success',
      })
    }
    await refresh()
    setUploading(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    handleFiles(Array.from(e.dataTransfer.files))
  }

  async function handleDelete(invoice: Invoice) {
    const name = invoice.file.split('/').pop()
    if (!window.confirm(`Delete invoice "${name}"? This can't be undone.`)) return
    setBusyId(invoice.id)
    try {
      await deleteInvoice(invoice.id)
      show({ title: 'Invoice deleted', description: name, variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't delete invoice", description: uploadErrorMessageFor(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const invoicesNeedingReview = invoices?.filter((inv) => inv.exceptions.length > 0) ?? []

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Invoices</h1>

      {loadError && (
        <Banner
          variant="error"
          title="Couldn't load invoices."
          action={
            <Button type="button" onClick={refresh}>
              Try again
            </Button>
          }
        >
          {loadError}
        </Banner>
      )}

      {!loadError && (
        <>
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-hairline p-10 text-center text-sm text-muted-foreground hover:bg-secondary/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                handleFiles(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            {uploading ? 'Uploading…' : 'Drag & drop one or more invoices, or click to choose files'}
          </div>

          {invoicesNeedingReview.length > 0 && (
            <Banner variant="warning" title={`${invoicesNeedingReview.length} invoice(s) need your review.`}>
              Mandatory fields are missing, or a vendor or purchase order couldn't be matched.
            </Banner>
          )}

          {invoices && invoices.length === 0 ? (
            <EmptyState title="No invoices yet">Upload one to get started.</EmptyState>
          ) : (
            <Table>
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell>File</TableHeaderCell>
                  <SortableHeaderCell active={sortKey === 'status'} direction={sortDirection} onSort={() => toggleSort('status')}>
                    Status
                  </SortableHeaderCell>
                  <SortableHeaderCell
                    active={sortKey === 'match_status'}
                    direction={sortDirection}
                    onSort={() => toggleSort('match_status')}
                  >
                    Match
                  </SortableHeaderCell>
                  <SortableHeaderCell
                    active={sortKey === 'created_at'}
                    direction={sortDirection}
                    onSort={() => toggleSort('created_at')}
                  >
                    Uploaded
                  </SortableHeaderCell>
                  {isAdmin && <TableHeaderCell>Actions</TableHeaderCell>}
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {invoices === null ? (
                  <>
                    <SkeletonRow columns={isAdmin ? 5 : 4} />
                    <SkeletonRow columns={isAdmin ? 5 : 4} />
                    <SkeletonRow columns={isAdmin ? 5 : 4} />
                  </>
                ) : (
                  sorted?.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.file.split('/').pop()}</TableCell>
                      <TableCell>
                        <Badge status={invoice.status} />
                        {invoice.exceptions.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-xs text-exception">
                            {invoice.exceptions.map((exception) => (
                              <li key={exception.id}>{exception.reason}</li>
                            ))}
                          </ul>
                        )}
                        {invoice.line_items && invoice.line_items.length > 0 && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedLineItemsId((id) => (id === invoice.id ? null : invoice.id))
                              }
                              className="text-xs font-medium text-primary underline underline-offset-2"
                            >
                              {expandedLineItemsId === invoice.id
                                ? 'Hide line items'
                                : `${invoice.line_items.length} line item${invoice.line_items.length === 1 ? '' : 's'}`}
                            </button>
                            {expandedLineItemsId === invoice.id && <LineItemsPreview items={invoice.line_items} />}
                          </div>
                        )}
                        {isAdmin && invoice.status === 'needs_review' && (
                          <div className="mt-1">
                            {editingId === invoice.id ? (
                              <CorrectionForm
                                invoice={invoice}
                                onCancel={() => setEditingId(null)}
                                onDone={(updated) => {
                                  setInvoices((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)) ?? prev)
                                  setEditingId(null)
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingId(invoice.id)}
                                className="text-xs font-medium text-primary underline underline-offset-2"
                              >
                                Fix &amp; revalidate
                              </button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge status={invoice.match_status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invoice.created_at).toLocaleString()}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {DELETABLE_STATUSES.has(invoice.status) ? (
                            <button
                              type="button"
                              disabled={busyId === invoice.id}
                              onClick={() => handleDelete(invoice)}
                              className="text-xs font-medium text-exception underline underline-offset-2 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          <Button type="button" onClick={refresh} className="self-start">
            Refresh
          </Button>
        </>
      )}
    </div>
  )
}
