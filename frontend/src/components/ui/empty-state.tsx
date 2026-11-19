import * as React from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  children,
  className,
}: {
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-hairline px-5 py-9 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      <div className="mb-1 font-semibold text-foreground">{title}</div>
      {children}
    </div>
  )
}
