import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login } from '@/lib/api'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      navigate('/upload')
    } catch {
      setError('Invalid email or password.')
    }
  }

  return (
    <div className="mx-auto mt-24 flex max-w-sm flex-col gap-4 px-4">
      <h1 className="text-xl font-semibold">AP Automation — Sign in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit">Log in</Button>
      </form>
    </div>
  )
}
