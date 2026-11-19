import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

const VARIANT_ICON = {
  error: OctagonAlert,
  warning: AlertTriangle,
  success: CheckCircle2,
}

const VARIANT_CLASS = {
  error: 'bg-exception-soft text-exception',
  warning: 'bg-pending-soft text-pending',
  success: 'bg-approved-soft text-approved',
}

export function Banner({
  variant,
  title,
  action,
  className,
  children,
}: {
  variant: 'error' | 'warning' | 'success'
  title: string
  action?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  const Icon = VARIANT_ICON[variant]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md p-3.5 text-sm',
        VARIANT_CLASS[variant],
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
