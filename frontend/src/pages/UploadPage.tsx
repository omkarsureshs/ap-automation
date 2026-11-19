import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonRow } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { ApiError, listInvoices, uploadInvoice, type Invoice } from '@/lib/api'

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

export function UploadPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
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
