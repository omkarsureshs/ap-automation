import { useEffect, useRef, useState } from 'react'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonRow } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  ApiError,
  type CsvImportResult,
  type GoodsReceiptNote,
  type PurchaseOrder,
  importGrnsCsv,
  importPurchaseOrdersCsv,
  listGrns,
  listPurchaseOrders,
} from '@/lib/api'

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'forbidden') return "You don't have access to import these. That's limited to AP Admins."
    return err.message
  }
  return 'Something went wrong. Try again.'
}

function ImportBanner({ result, kind }: { result: CsvImportResult; kind: 'PO' | 'GRN' }) {
  if (result.errors.length === 0) {
    return (
      <Banner variant="warning" className="bg-approved-soft text-approved" title={`${result.created} ${kind} row(s) created.`} />
    )
  }
  return (
    <Banner variant="error" title={`${result.created} created, ${result.errors.length} failed.`}>
      <ul className="mt-1 list-disc pl-4">
        {result.errors.map((e, i) => (
          <li key={i}>
            Row {e.row}: {e.message}
          </li>
        ))}
      </ul>
    </Banner>
  )
}

export function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[] | null>(null)
  const [grns, setGrns] = useState<GoodsReceiptNote[] | null>(null)
  const [poResult, setPoResult] = useState<CsvImportResult | null>(null)
  const [grnResult, setGrnResult] = useState<CsvImportResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [importingPo, setImportingPo] = useState(false)
  const [importingGrn, setImportingGrn] = useState(false)
  const poFileRef = useRef<HTMLInputElement>(null)
  const grnFileRef = useRef<HTMLInputElement>(null)
  const { show } = useToast()

  async function refresh() {
    try {
      const [pos, grnList] = await Promise.all([listPurchaseOrders(), listGrns()])
      setPurchaseOrders(pos)
      setGrns(grnList)
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessageFor(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handlePoImport(file: File) {
    if (importingPo) return
    setImportingPo(true)
    try {
      const result = await importPurchaseOrdersCsv(file)
      setPoResult(result)
      show({ title: 'Purchase order import finished', description: `${result.created} created`, variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't import purchase orders", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setImportingPo(false)
    }
  }

  async function handleGrnImport(file: File) {
    if (importingGrn) return
    setImportingGrn(true)
    try {
      const result = await importGrnsCsv(file)
      setGrnResult(result)
      show({ title: 'GRN import finished', description: `${result.created} created`, variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't import GRNs", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setImportingGrn(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Purchase Orders &amp; GRNs</h1>

      {loadError && <Banner variant="error" title="Couldn't load purchase orders.">{loadError}</Banner>}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Purchase Orders</h2>
        <input
          ref={poFileRef}
          type="file"
          accept=".csv"
          className="hidden"
          disabled={importingPo}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handlePoImport(file)
          }}
        />
        <Button type="button" loading={importingPo} onClick={() => poFileRef.current?.click()} className="self-start">
          {importingPo ? 'Importing…' : 'Import PO CSV'}
        </Button>
        {poResult && <ImportBanner result={poResult} kind="PO" />}
        {purchaseOrders && purchaseOrders.length === 0 ? (
          <EmptyState title="No purchase orders yet">Import a CSV to get started.</EmptyState>
        ) : (
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>PO Number</TableHeaderCell>
                <TableHeaderCell>Vendor</TableHeaderCell>
                <TableHeaderCell numeric>Total Amount</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {purchaseOrders === null ? (
                <SkeletonRow columns={3} />
              ) : (
                purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>{po.po_number}</TableCell>
                    <TableCell>{po.vendor}</TableCell>
                    <TableCell numeric>₹{po.total_amount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Goods Receipt Notes</h2>
        <input
          ref={grnFileRef}
          type="file"
          accept=".csv"
          className="hidden"
          disabled={importingGrn}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleGrnImport(file)
          }}
        />
        <Button type="button" loading={importingGrn} onClick={() => grnFileRef.current?.click()} className="self-start">
          {importingGrn ? 'Importing…' : 'Import GRN CSV'}
        </Button>
        {grnResult && <ImportBanner result={grnResult} kind="GRN" />}
        {grns && grns.length === 0 ? (
          <EmptyState title="No GRNs yet">Import a CSV to get started.</EmptyState>
        ) : (
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>GRN Number</TableHeaderCell>
                <TableHeaderCell>Purchase Order</TableHeaderCell>
                <TableHeaderCell numeric>Received Amount</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {grns === null ? (
                <SkeletonRow columns={3} />
              ) : (
                grns.map((grn) => (
                  <TableRow key={grn.id}>
                    <TableCell>{grn.grn_number}</TableCell>
                    <TableCell>{grn.purchase_order}</TableCell>
                    <TableCell numeric>₹{grn.received_amount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
