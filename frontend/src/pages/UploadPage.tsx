import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { listInvoices, uploadInvoice, type Invoice } from '@/lib/api'

export function UploadPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    try {
      setInvoices(await listInvoices())
    } catch {
      setError('Could not load invoices.')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      await uploadInvoice(file)
      await refresh()
    } catch {
      setError('Upload failed — check the file is a PDF or image.')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="mx-auto mt-12 flex max-w-2xl flex-col gap-6 px-4">
      <h1 className="text-xl font-semibold">Invoices</h1>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-10 text-center text-muted-foreground hover:bg-accent/30"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        {uploading ? 'Uploading…' : 'Drag & drop an invoice, or click to choose a file'}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2">File</th>
            <th className="py-2">Status</th>
            <th className="py-2">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b border-border">
              <td className="py-2">{invoice.file.split('/').pop()}</td>
              <td className="py-2">
                <Badge status={invoice.status} />
              </td>
              <td className="py-2">{new Date(invoice.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button type="button" onClick={refresh} className="self-start">
        Refresh
      </Button>
    </div>
  )
}
