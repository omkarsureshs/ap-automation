import * as React from 'react'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-muted text-muted-foreground',
  extracted: 'bg-accent text-accent-foreground',
  needs_review: 'bg-destructive/15 text-destructive',
  validated: 'bg-primary/15 text-primary',
}

export function Badge({ status, className, ...props }: React.ComponentProps<'span'> & { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      {status}
    </span>
  )
}
