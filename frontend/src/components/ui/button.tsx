import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Button({
  className,
  loading,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> & { loading?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </button>
  )
}
