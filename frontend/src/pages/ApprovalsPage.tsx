import { useEffect, useState } from 'react'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import { ApiError, decideApprovalStep, listMyApprovals, type ApprovalStep } from '@/lib/api'

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'forbidden') return "You don't have access to decide this step."
    return err.message
  }
  return 'Something went wrong. Try again.'
}

export function ApprovalsPage() {
  const [steps, setSteps] = useState<ApprovalStep[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<number | null>(null)
  const [decidingAction, setDecidingAction] = useState<'approve' | 'reject' | null>(null)
  const { show } = useToast()

  async function refresh() {
    try {
      setSteps(await listMyApprovals())
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessageFor(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleDecide(step: ApprovalStep, approve: boolean) {
    if (decidingId !== null) return
    setDecidingId(step.id)
    setDecidingAction(approve ? 'approve' : 'reject')
    const previous = steps
    setSteps((steps ?? []).filter((s) => s.id !== step.id))
    try {
      await decideApprovalStep(step.id, approve)
      show({
        title: approve ? 'Approved' : 'Rejected',
        description: step.invoice_detail.extracted_invoice_no ?? `Invoice #${step.invoice}`,
        variant: 'success',
      })
    } catch (err) {
      if (err instanceof ApiError && (err.kind === 'conflict' || err.kind === 'not_found')) {
        // The step is no longer pending (someone else decided it) or no
        // longer exists — leave it removed either way; there is nothing
        // left for this user to do with it.
        show({
          title: "Couldn't record your decision",
          description: 'Someone else already decided this invoice, or it no longer needs your review.',
          variant: 'error',
        })
      } else {
        setSteps(previous)
        show({ title: "Couldn't record your decision", description: errorMessageFor(err), variant: 'error' })
      }
    } finally {
      setDecidingId(null)
      setDecidingAction(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">My Approvals</h1>

      {loadError && (
        <Banner
          variant="error"
          title="Couldn't load approvals."
          action={
            <Button type="button" onClick={refresh}>
              Try again
            </Button>
          }
        >
          {loadError}
        </Banner>
      )}

      {!loadError && steps && steps.length === 0 && (
        <EmptyState title="That's everything for now">
          Approved and rejected invoices move to the register. New ones land here as soon as they're matched.
        </EmptyState>
      )}

      {steps && steps.length > 0 && (
        <div className="flex flex-col gap-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-hairline p-4"
            >
              <div>
                <div className="font-medium">
                  {step.invoice_detail.extracted_invoice_no ?? `Invoice #${step.invoice}`}
                  {step.invoice_detail.extracted_vendor_name && ` — ${step.invoice_detail.extracted_vendor_name}`}
                </div>
                {step.invoice_detail.extracted_total_amount && (
                  <div className="tabular text-sm text-muted-foreground">
                    ₹{step.invoice_detail.extracted_total_amount}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  loading={decidingId === step.id && decidingAction === 'approve'}
                  disabled={decidingId !== null && decidingId !== step.id}
                  onClick={() => handleDecide(step, true)}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  loading={decidingId === step.id && decidingAction === 'reject'}
                  className="bg-exception-soft text-exception hover:opacity-80"
                  disabled={decidingId !== null}
                  onClick={() => handleDecide(step, false)}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
