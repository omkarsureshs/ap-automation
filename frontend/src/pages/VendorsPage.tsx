import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createVendor, listVendors, type Vendor } from '@/lib/api'

export function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', gstin: '', email: '', bank_account_number: '', bank_ifsc: '' })

  async function refresh() {
    try {
      setVendors(await listVendors())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load vendors.')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await createVendor(form)
      setForm({ name: '', gstin: '', email: '', bank_account_number: '', bank_ifsc: '' })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vendor.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-6 px-4">
      <h1 className="text-xl font-semibold">Vendors</h1>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2 rounded-lg border border-border p-4">
        <Input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder="GSTIN"
          value={form.gstin}
          onChange={(e) => setForm({ ...form, gstin: e.target.value })}
          required
        />
        <Input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          placeholder="Bank account number"
          value={form.bank_account_number}
          onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
          required
        />
        <Input
          placeholder="Bank IFSC"
          value={form.bank_ifsc}
          onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })}
          required
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add vendor'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2">Name</th>
            <th className="py-2">GSTIN</th>
            <th className="py-2">Bank account</th>
            <th className="py-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr key={vendor.id} className="border-b border-border">
              <td className="py-2">{vendor.name}</td>
              <td className="py-2">{vendor.gstin}</td>
              <td className="py-2">{vendor.bank_account_number}</td>
              <td className="py-2">{vendor.is_active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
