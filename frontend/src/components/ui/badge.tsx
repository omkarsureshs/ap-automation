import * as React from 'react'
import { cn } from '@/lib/utils'

type StatusTone = 'neutral' | 'approved' | 'pending' | 'exception'

const STATUS_TONE: Record<string, StatusTone> = {
  // Invoice.status
  uploaded: 'neutral',
  extracted: 'neutral',
  needs_review: 'exception',
  validated: 'approved',
  pending_approval: 'pending',
  approved: 'approved',
  rejected: 'exception',
  paid: 'approved',
  // Payment.status
  processing: 'pending',
  completed: 'approved',
  failed: 'exception',
  // Invoice.match_status
  unmatched: 'neutral',
  matched: 'approved',
  mismatched: 'exception',
}

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'text-muted-foreground',
  approved: 'text-approved',
  pending: 'text-pending',
  exception: 'text-exception',
}

const DOT_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground',
  approved: 'bg-approved',
  pending: 'bg-pending',
  exception: 'bg-exception',
}

function toLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

export function Badge({
  status,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', TONE_CLASS[tone], className)} {...props}>
      <span className={cn('h-[7px] w-[7px] flex-none rounded-full', DOT_CLASS[tone])} />
      {toLabel(status)}
    </span>
  )
}
