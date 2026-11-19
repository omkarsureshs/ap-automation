import { useEffect, useState } from 'react'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { SkeletonRow } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { ApiError, createVendor, listVendors, type Vendor } from '@/lib/api'

const EMPTY_FORM = { name: '', gstin: '', email: '', bank_account_number: '', bank_ifsc: '' }

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'forbidden') return "You don't have access to manage vendors. That's limited to AP Admins."
    return err.message
  }
  return 'Something went wrong. Try again.'
}

export function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const { show } = useToast()

  async function refresh() {
    try {
      setVendors(await listVendors())
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessageFor(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setFieldErrors({})
    try {
      await createVendor(form)
      show({ title: 'Vendor added', description: form.name, variant: 'success' })
      setForm(EMPTY_FORM)
      await refresh()
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'validation') {
        setFieldErrors(err.fieldErrors ?? {})
      }
      show({ title: "Couldn't add vendor", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Vendors</h1>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-md border border-hairline p-4 sm:flex-row sm:flex-wrap sm:items-start">
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            invalid={Boolean(fieldErrors.name)}
            required
          />
          {fieldErrors.name && <span className="text-xs text-exception">{fieldErrors.name}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Input
            placeholder="GSTIN"
            value={form.gstin}
            onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            invalid={Boolean(fieldErrors.gstin)}
            required
          />
          {fieldErrors.gstin && <span className="text-xs text-exception">{fieldErrors.gstin}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            invalid={Boolean(fieldErrors.email)}
            required
          />
          {fieldErrors.email && <span className="text-xs text-exception">{fieldErrors.email}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Bank account number"
            value={form.bank_account_number}
            onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
            invalid={Boolean(fieldErrors.bank_account_number)}
            required
          />
          {fieldErrors.bank_account_number && (
            <span className="text-xs text-exception">{fieldErrors.bank_account_number}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Bank IFSC"
            value={form.bank_ifsc}
            onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })}
            invalid={Boolean(fieldErrors.bank_ifsc)}
            required
          />
          {fieldErrors.bank_ifsc && <span className="text-xs text-exception">{fieldErrors.bank_ifsc}</span>}
        </div>
        <Button type="submit" loading={submitting}>
          Add vendor
        </Button>
      </form>

      {loadError ? (
        <Banner
          variant="error"
          title="Couldn't load vendors."
          action={
            <Button type="button" onClick={refresh}>
              Try again
            </Button>
          }
        >
          {loadError}
        </Banner>
      ) : vendors && vendors.length === 0 ? (
        <EmptyState title="No vendors yet">
          Add your first vendor to start matching invoices against purchase orders.
        </EmptyState>
      ) : (
        <Table>
          <TableHead>
            <TableHeaderRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>GSTIN</TableHeaderCell>
              <TableHeaderCell>Bank account</TableHeaderCell>
              <TableHeaderCell>Active</TableHeaderCell>
            </TableHeaderRow>
          </TableHead>
          <TableBody>
            {vendors === null ? (
              <>
                <SkeletonRow columns={4} />
                <SkeletonRow columns={4} />
              </>
            ) : (
              vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>{vendor.name}</TableCell>
                  <TableCell className="tabular">{vendor.gstin}</TableCell>
                  <TableCell className="tabular">{vendor.bank_account_number}</TableCell>
                  <TableCell>{vendor.is_active ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
