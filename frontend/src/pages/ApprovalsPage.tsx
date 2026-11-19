import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { decideApprovalStep, listMyApprovals, type ApprovalStep } from '@/lib/api'

export function ApprovalsPage() {
  const [steps, setSteps] = useState<ApprovalStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<number | null>(null)

  async function refresh() {
    try {
      setSteps(await listMyApprovals())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load approvals.')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleDecide(step: ApprovalStep, approve: boolean) {
    setDecidingId(step.id)
    setError(null)
    const previous = steps
    setSteps(steps.filter((s) => s.id !== step.id))
    try {
      await decideApprovalStep(step.id, approve)
    } catch (err) {
      setSteps(previous)
      setError(err instanceof Error ? err.message : 'Failed to record decision.')
    } finally {
      setDecidingId(null)
    }
  }

  return (
    <div className="mx-auto mt-12 flex max-w-2xl flex-col gap-6 px-4">
      <h1 className="text-xl font-semibold">My Approvals</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {steps.length === 0 && <p className="text-sm text-muted-foreground">No pending approvals.</p>}

      <table className="w-full text-left text-sm">
        <tbody>
          {steps.map((step) => (
            <tr key={step.id} className="border-b border-border align-top">
              <td className="py-2">Invoice #{step.invoice}</td>
              <td className="py-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={decidingId === step.id}
                    onClick={() => handleDecide(step, true)}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    className="bg-destructive text-destructive-foreground"
                    disabled={decidingId === step.id}
                    onClick={() => handleDecide(step, false)}
                  >
                    Reject
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
