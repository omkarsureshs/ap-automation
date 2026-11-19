import { AlertTriangle, OctagonAlert } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Banner({
  variant,
  title,
  action,
  className,
  children,
}: {
  variant: 'error' | 'warning'
  title: string
  action?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  const Icon = variant === 'error' ? OctagonAlert : AlertTriangle
  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md p-3.5 text-sm',
        variant === 'error' ? 'bg-exception-soft text-exception' : 'bg-pending-soft text-pending',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <div>
          <span className="font-semibold">{title}</span>
          {children && <span className="ml-1">{children}</span>}
        </div>
      </div>
      {action}
    </div>
  )
}
