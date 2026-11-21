import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, getCurrentUser, login } from '@/lib/api'
import { landingPageFor } from '@/lib/nav'

const DEMO_PASSWORD = 'Demo@12345'
const DEMO_EMAILS = ['requester@demo.com', 'approver@demo.com', 'admin@demo.com', 'vendor@demo.com']

const PREVIEW_ROWS = [
  { no: 'INV-2049', vendor: 'Acme', amount: '18,400', status: 'validated' },
  { no: 'INV-2050', vendor: 'Globex', amount: '52,900', status: 'needs_review' },
  { no: 'INV-2051', vendor: 'Initech', amount: '9,750', status: 'approved' },
  { no: 'INV-2052', vendor: 'Acme', amount: '31,200', status: 'paid' },
]

const STAT_TILES = [
  { label: 'Pending approvals', value: '3' },
  { label: 'Straight-through rate', value: '61%' },
  { label: 'Paid this month', value: '₹1.94L' },
]

const TRUST_POINTS = [
  'Role-based access for requesters, approvers, AP admins and vendors',
  'Every approval, rejection and payment is logged — never edited',
  "Vendor bank details are encrypted at rest and masked for anyone but AP admins",
]

function RegisterPreview() {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-hairline bg-card">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-hairline text-muted-foreground">
            <th className="whitespace-nowrap px-2.5 py-2 font-medium">Invoice</th>
            <th className="whitespace-nowrap px-2.5 py-2 font-medium">Vendor</th>
            <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium">Amount</th>
            <th className="whitespace-nowrap px-2.5 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {PREVIEW_ROWS.map((row) => (
            <tr key={row.no} className="border-b border-hairline last:border-0">
              <td className="whitespace-nowrap px-2.5 py-2.5 text-foreground">{row.no}</td>
              <td className="whitespace-nowrap px-2.5 py-2.5 text-muted-foreground">{row.vendor}</td>
              <td className="tabular whitespace-nowrap px-2.5 py-2.5 text-right text-foreground">₹{row.amount}</td>
              <td className="whitespace-nowrap px-2.5 py-2.5">
                <Badge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatTiles() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {STAT_TILES.map((tile) => (
        <div key={tile.label} className="rounded-md border border-hairline bg-card p-3">
          <div className="text-[11px] font-semibold leading-tight text-muted-foreground">{tile.label}</div>
          <div className="tabular mt-1 text-lg font-semibold">{tile.value}</div>
        </div>
      ))}
    </div>
  )
}

function ApprovalPreview() {
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-hairline bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">DEMO-INV-007 — Acme</div>
        <div className="tabular text-xs text-muted-foreground">₹91,000 · waiting on Approver</div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Approve</span>
        <span className="rounded-md bg-exception-soft px-2.5 py-1 text-xs font-medium text-exception">Reject</span>
      </div>
    </div>
  )
}

function TrustList() {
  return (
    <ul className="flex flex-col gap-2.5 border-t border-hairline pt-5 text-xs text-muted-foreground">
      {TRUST_POINTS.map((point) => (
        <li key={point} className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-[5px] h-[6px] w-[6px] flex-none rounded-full bg-approved" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  )
}

function BrandPanel() {
  return (
    <div className="relative flex flex-col gap-6 overflow-hidden border-b border-hairline bg-secondary px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, var(--hairline) 0, var(--hairline) 1px, transparent 1px, transparent 32px)',
          opacity: 0.4,
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 -right-14 hidden opacity-[0.07] sm:block">
        <Logo size={260} />
      </div>

      <div className="relative flex flex-col gap-6">
        <Logo size={32} withWordmark />
        <p className="text-xl font-semibold leading-snug tracking-tight">
          Capture invoices, match them to purchase orders, route approvals, and pay — with every
          exception explained.
        </p>
        <div className="flex flex-col gap-3" aria-hidden="true">
          <StatTiles />
          <RegisterPreview />
          <ApprovalPreview />
        </div>
        <p className="text-sm text-muted-foreground">Live previews from your own invoice register.</p>
      </div>
    </div>
  )
}

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'unauthorized') {
      return "That email and password don't match. Check for typos, or reset your password."
    }
    if (err.kind === 'network') {
      return err.message
    }
    return 'Something went wrong signing you in. Try again.'
  }
  return 'Something went wrong signing you in. Try again.'
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [invalidCredentials, setInvalidCredentials] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const expired = searchParams.get('reason') === 'expired'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setInvalidCredentials(false)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(landingPageFor(getCurrentUser()?.role))
    } catch (err) {
      setError(errorMessageFor(err))
      setInvalidCredentials(err instanceof ApiError && err.kind === 'unauthorized')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/60 p-4 sm:p-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-md border border-hairline bg-card lg:grid-cols-2">
        <BrandPanel />
        <main className="flex flex-col justify-center gap-6 px-6 py-10 sm:px-10">
          <div>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use your work email to open the register.</p>
          </div>
          {expired && !error && (
            <p className="text-sm text-pending" role="status">
              Your session has expired. Sign in again.
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <Input
              type="email"
              placeholder="Email"
              aria-label="Email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={invalidCredentials}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={invalidCredentials}
              required
            />
            {error && (
              <p className="text-sm text-exception" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={submitting} className="justify-center">
              Sign in
            </Button>
          </form>
          <details className="rounded-md border border-hairline bg-background text-sm">
            <summary className="cursor-pointer rounded-md px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-ring">
              Demo accounts
            </summary>
            <div className="border-t border-hairline px-3 py-2.5">
              <p className="mb-2 text-xs text-muted-foreground">
                Demo data for reviewers. Click an email to fill the form. Password for all:{' '}
                <code className="font-mono text-foreground">{DEMO_PASSWORD}</code>
              </p>
              <ul className="flex flex-col gap-0.5">
                {DEMO_EMAILS.map((demo) => (
                  <li key={demo}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(demo)
                        setPassword(DEMO_PASSWORD)
                      }}
                      className="w-full rounded-sm px-1.5 py-1 text-left font-mono text-xs text-ledger hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {demo}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </details>
          <p className="text-xs text-muted-foreground">
            New here? Ask your AP Admin to create an account for you.
          </p>
          <TrustList />
        </main>
      </div>
    </div>
  )
}
