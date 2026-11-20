import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, login } from '@/lib/api'

const DEMO_PASSWORD = 'Demo@12345'
const DEMO_EMAILS = ['requester@demo.com', 'approver@demo.com', 'admin@demo.com', 'vendor@demo.com']
const STEPS = ['Capture', 'Validate', 'Match', 'Approve', 'Pay']

function PipelineFlow() {
  return (
    <svg
      viewBox="0 0 500 64"
      className="h-auto w-full max-w-md text-ledger"
      role="img"
      aria-label="Pipeline: Capture, Validate, Match, Approve, Pay"
      fill="none"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      {STEPS.map((label, i) => {
        const cx = 25 + i * 112.5
        return (
          <g key={label}>
            {i > 0 && <path d={`M${cx - 112.5 + 12} 20H${cx - 12}`} stroke="currentColor" opacity="0.45" />}
            <circle cx={cx} cy="20" r="11" stroke="currentColor" className="fill-card" />
            {i === STEPS.length - 1 ? (
              <path d={`m${cx - 4} 20 3 3 5-6`} stroke="currentColor" strokeLinejoin="round" />
            ) : (
              <text x={cx} y="24" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" stroke="none">
                {i + 1}
              </text>
            )}
            <text x={cx} y="54" textAnchor="middle" fontSize="12" fontWeight="500" className="fill-foreground" stroke="none">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
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
      navigate('/dashboard')
    } catch (err) {
      setError(errorMessageFor(err))
      setInvalidCredentials(err instanceof ApiError && err.kind === 'unauthorized')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="flex flex-col justify-center gap-8 border-b border-hairline bg-secondary px-6 py-10 sm:px-12 lg:border-b-0 lg:border-r lg:px-16">
        <Logo size={36} withWordmark />
        <p className="max-w-md text-2xl font-semibold leading-snug tracking-tight">
          Capture invoices, match them to purchase orders, route approvals, and pay — with every
          exception explained.
        </p>
        <div className="hidden sm:block">
          <PipelineFlow />
        </div>
      </aside>
      <main className="flex items-center justify-center px-6 py-10 sm:px-12">
        <div className="flex w-full max-w-sm flex-col gap-5">
          <h1 className="text-xl font-semibold">Sign in</h1>
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
          <details className="rounded-md border border-hairline bg-card text-sm">
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
        </div>
      </main>
    </div>
  )
}
