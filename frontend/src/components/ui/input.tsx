import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({
  className,
  invalid,
  ...props
}: React.ComponentProps<'input'> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        invalid && 'border-exception focus-visible:ring-exception',
        className,
      )}
      {...props}
    />
  )
}
