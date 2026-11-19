import { CheckCircle2, X, XCircle } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

interface ToastOptions {
  title: string
  description?: string
  variant?: 'success' | 'error'
}

interface ToastItem extends ToastOptions {
  id: number
}

interface ToastContextValue {
  show: (options: ToastOptions) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 5000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])
  const nextId = React.useRef(0)

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = React.useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, ...options }])
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-5 right-4 z-50 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'flex items-start gap-2.5 rounded-md border border-hairline bg-card p-3 text-sm shadow-lg',
              'border-l-[3px]',
              toast.variant === 'error' ? 'border-l-exception' : 'border-l-approved',
            )}
          >
            {toast.variant === 'error' ? (
              <XCircle className="mt-0.5 h-4 w-4 flex-none text-exception" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-approved" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium">{toast.title}</div>
              {toast.description && <div className="mt-0.5 text-muted-foreground">{toast.description}</div>}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="flex-none text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
