import { useEffect, useRef, useState } from 'react'
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
import {
  ApiError,
  type CsvImportResult,
  type GoodsReceiptNote,
  type PurchaseOrder,
  deleteGrn,
  deletePurchaseOrder,
  getCurrentUser,
  importGrnsCsv,
  importPurchaseOrdersCsv,
  listGrns,
  listPurchaseOrders,
} from '@/lib/api'
import { useSort } from '@/lib/sort'

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'forbidden') return "You don't have access to manage these. That's limited to AP Admins."
    return err.message
  }
  return 'Something went wrong. Try again.'
}

function ImportBanner({ result, kind }: { result: CsvImportResult; kind: 'PO' | 'GRN' }) {
  if (result.errors.length === 0) {
    return <Banner variant="success" title={`${result.created} ${kind} row(s) created.`} />
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
  const [busyId, setBusyId] = useState<number | null>(null)
  const poFileRef = useRef<HTMLInputElement>(null)
  const grnFileRef = useRef<HTMLInputElement>(null)
  const { show } = useToast()
  const isAdmin = getCurrentUser()?.role === 'ap_admin'
  const poSort = useSort<PurchaseOrder, keyof PurchaseOrder>(purchaseOrders, 'po_number')
  const grnSort = useSort<GoodsReceiptNote, keyof GoodsReceiptNote>(grns, 'grn_number')

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
      if (result.created === 0 && result.errors.length > 0) {
        show({ title: "No purchase orders imported", description: `${result.errors.length} row(s) failed`, variant: 'error' })
      } else {
        show({ title: 'Purchase order import finished', description: `${result.created} created`, variant: 'success' })
      }
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
      if (result.created === 0 && result.errors.length > 0) {
        show({ title: 'No GRNs imported', description: `${result.errors.length} row(s) failed`, variant: 'error' })
      } else {
        show({ title: 'GRN import finished', description: `${result.created} created`, variant: 'success' })
      }
      await refresh()
    } catch (err) {
      show({ title: "Couldn't import GRNs", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setImportingGrn(false)
    }
  }

  async function handleDeletePo(po: PurchaseOrder) {
    if (!window.confirm(`Delete purchase order "${po.po_number}"? This can't be undone.`)) return
    setBusyId(po.id)
    try {
      await deletePurchaseOrder(po.id)
      show({ title: 'Purchase order deleted', description: po.po_number, variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't delete purchase order", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteGrn(grn: GoodsReceiptNote) {
    if (!window.confirm(`Delete GRN "${grn.grn_number}"? This can't be undone.`)) return
    setBusyId(grn.id)
    try {
      await deleteGrn(grn.id)
      show({ title: 'GRN deleted', description: grn.grn_number, variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't delete GRN", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Purchase Orders &amp; GRNs</h1>

      {loadError && (
        <Banner
          variant="error"
          title="Couldn't load purchase orders."
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
          <section className="flex flex-col gap-3">
            <h2 className="font-medium">Purchase Orders</h2>
            {isAdmin && (
              <>
                <input
                  ref={poFileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={importingPo}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePoImport(file)
                    e.target.value = ''
                  }}
                />
                <Button type="button" loading={importingPo} onClick={() => poFileRef.current?.click()} className="self-start">
                  Import PO CSV
                </Button>
              </>
            )}
            {poResult && <ImportBanner result={poResult} kind="PO" />}
            {purchaseOrders && purchaseOrders.length === 0 ? (
              <EmptyState title="No purchase orders yet">Import a CSV to get started.</EmptyState>
            ) : (
              <Table>
                <TableHead>
                  <TableHeaderRow>
                    <SortableHeaderCell
                      active={poSort.sortKey === 'po_number'}
                      direction={poSort.sortDirection}
                      onSort={() => poSort.toggleSort('po_number')}
                    >
                      PO Number
                    </SortableHeaderCell>
                    <SortableHeaderCell
                      active={poSort.sortKey === 'vendor'}
                      direction={poSort.sortDirection}
                      onSort={() => poSort.toggleSort('vendor')}
                    >
                      Vendor
                    </SortableHeaderCell>
                    <SortableHeaderCell
                      numeric
                      active={poSort.sortKey === 'total_amount'}
                      direction={poSort.sortDirection}
                      onSort={() => poSort.toggleSort('total_amount')}
                    >
                      Total Amount
                    </SortableHeaderCell>
                    {isAdmin && <TableHeaderCell>Actions</TableHeaderCell>}
                  </TableHeaderRow>
                </TableHead>
                <TableBody>
                  {purchaseOrders === null ? (
                    <SkeletonRow columns={isAdmin ? 4 : 3} />
                  ) : (
                    poSort.sorted?.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell>{po.po_number}</TableCell>
                        <TableCell>{po.vendor}</TableCell>
                        <TableCell numeric>₹{po.total_amount}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <button
                              type="button"
                              disabled={busyId === po.id}
                              onClick={() => handleDeletePo(po)}
                              className="text-xs font-medium text-exception underline underline-offset-2 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-medium">Goods Receipt Notes</h2>
            {isAdmin && (
              <>
                <input
                  ref={grnFileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={importingGrn}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleGrnImport(file)
                    e.target.value = ''
                  }}
                />
                <Button type="button" loading={importingGrn} onClick={() => grnFileRef.current?.click()} className="self-start">
                  Import GRN CSV
                </Button>
              </>
            )}
            {grnResult && <ImportBanner result={grnResult} kind="GRN" />}
            {grns && grns.length === 0 ? (
              <EmptyState title="No GRNs yet">Import a CSV to get started.</EmptyState>
            ) : (
              <Table>
                <TableHead>
                  <TableHeaderRow>
                    <SortableHeaderCell
                      active={grnSort.sortKey === 'grn_number'}
                      direction={grnSort.sortDirection}
                      onSort={() => grnSort.toggleSort('grn_number')}
                    >
                      GRN Number
                    </SortableHeaderCell>
                    <SortableHeaderCell
                      active={grnSort.sortKey === 'purchase_order'}
                      direction={grnSort.sortDirection}
                      onSort={() => grnSort.toggleSort('purchase_order')}
                    >
                      Purchase Order
                    </SortableHeaderCell>
                    <SortableHeaderCell
                      numeric
                      active={grnSort.sortKey === 'received_amount'}
                      direction={grnSort.sortDirection}
                      onSort={() => grnSort.toggleSort('received_amount')}
                    >
                      Received Amount
                    </SortableHeaderCell>
                    {isAdmin && <TableHeaderCell>Actions</TableHeaderCell>}
                  </TableHeaderRow>
                </TableHead>
                <TableBody>
                  {grns === null ? (
                    <SkeletonRow columns={isAdmin ? 4 : 3} />
                  ) : (
                    grnSort.sorted?.map((grn) => (
                      <TableRow key={grn.id}>
                        <TableCell>{grn.grn_number}</TableCell>
                        <TableCell>{grn.purchase_order}</TableCell>
                        <TableCell numeric>₹{grn.received_amount}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <button
                              type="button"
                              disabled={busyId === grn.id}
                              onClick={() => handleDeleteGrn(grn)}
                              className="text-xs font-medium text-exception underline underline-offset-2 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  )
}
