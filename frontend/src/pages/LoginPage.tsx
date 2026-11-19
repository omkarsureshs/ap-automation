import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, login } from '@/lib/api'

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
      navigate('/upload')
    } catch (err) {
      setError(errorMessageFor(err))
      setInvalidCredentials(err instanceof ApiError && err.kind === 'unauthorized')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-20 flex max-w-sm flex-col gap-5 px-4">
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={invalidCredentials}
          required
        />
        <Input
          type="password"
          placeholder="Password"
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
    </div>
  )
}
