import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  type CsvImportResult,
  type GoodsReceiptNote,
  type PurchaseOrder,
  importGrnsCsv,
  importPurchaseOrdersCsv,
  listGrns,
  listPurchaseOrders,
} from '@/lib/api'

function ImportSummary({ result }: { result: CsvImportResult }) {
  return (
    <div className="text-sm">
      <p>{result.created} row(s) created.</p>
      {result.errors.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-destructive">
          {result.errors.map((e, i) => (
            <li key={i}>
              Row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([])
  const [poResult, setPoResult] = useState<CsvImportResult | null>(null)
  const [grnResult, setGrnResult] = useState<CsvImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const poFileRef = useRef<HTMLInputElement>(null)
  const grnFileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    try {
      setPurchaseOrders(await listPurchaseOrders())
      setGrns(await listGrns())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load purchase orders.')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handlePoImport(file: File) {
    setError(null)
    try {
      setPoResult(await importPurchaseOrdersCsv(file))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PO import failed.')
    }
  }

  async function handleGrnImport(file: File) {
    setError(null)
    try {
      setGrnResult(await importGrnsCsv(file))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GRN import failed.')
    }
  }

  return (
    <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-8 px-4">
      <h1 className="text-xl font-semibold">Purchase Orders &amp; GRNs</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Purchase Orders</h2>
        <input
          ref={poFileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handlePoImport(file)
          }}
        />
        <Button type="button" onClick={() => poFileRef.current?.click()} className="self-start">
          Import PO CSV
        </Button>
        {poResult && <ImportSummary result={poResult} />}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2">PO Number</th>
              <th className="py-2">Vendor</th>
              <th className="py-2">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.map((po) => (
              <tr key={po.id} className="border-b border-border">
                <td className="py-2">{po.po_number}</td>
                <td className="py-2">{po.vendor}</td>
                <td className="py-2">{po.total_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Goods Receipt Notes</h2>
        <input
          ref={grnFileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleGrnImport(file)
          }}
        />
        <Button type="button" onClick={() => grnFileRef.current?.click()} className="self-start">
          Import GRN CSV
        </Button>
        {grnResult && <ImportSummary result={grnResult} />}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2">GRN Number</th>
              <th className="py-2">Purchase Order</th>
              <th className="py-2">Received Amount</th>
            </tr>
          </thead>
          <tbody>
            {grns.map((grn) => (
              <tr key={grn.id} className="border-b border-border">
                <td className="py-2">{grn.grn_number}</td>
                <td className="py-2">{grn.purchase_order}</td>
                <td className="py-2">{grn.received_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
