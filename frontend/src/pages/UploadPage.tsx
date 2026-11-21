import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { SkeletonRow } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { ApiError, correctInvoice, listInvoices, uploadInvoice, type Invoice } from '@/lib/api'

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

export function UploadPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { show } = useToast()

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

  async function handleFile(file: File) {
    if (uploading) return
    setUploading(true)
    try {
      await uploadInvoice(file)
      show({ title: 'Invoice uploaded', description: file.name, variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't upload invoice", description: uploadErrorMessageFor(err), variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
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
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
            {uploading ? 'Uploading…' : 'Drag & drop an invoice, or click to choose a file'}
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
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Match</TableHeaderCell>
                  <TableHeaderCell>Uploaded</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {invoices === null ? (
                  <>
                    <SkeletonRow columns={4} />
                    <SkeletonRow columns={4} />
                    <SkeletonRow columns={4} />
                  </>
                ) : (
                  invoices.map((invoice) => (
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
                        {invoice.status === 'needs_review' && (
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
