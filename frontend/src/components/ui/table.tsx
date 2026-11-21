import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import type { SortDirection } from '@/lib/sort'

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-[520px] border-collapse text-left text-sm', className)} {...props} />
    </div>
  )
}

export function TableHead({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn(className)} {...props} />
}

export function TableHeaderRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn(className)} {...props} />
}

export function TableHeaderCell({
  numeric,
  className,
  ...props
}: React.ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'border-b border-hairline pb-2 pr-3 text-xs font-semibold text-muted-foreground',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function SortableHeaderCell({
  numeric,
  className,
  children,
  active,
  direction,
  onSort,
}: {
  numeric?: boolean
  className?: string
  children: React.ReactNode
  active: boolean
  direction: SortDirection
  onSort: () => void
}) {
  const Icon = active ? (direction === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      className={cn('border-b border-hairline pb-2 pr-3 text-xs font-semibold text-muted-foreground', numeric && 'text-right', className)}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          numeric && 'flex-row-reverse',
          active && 'text-foreground',
        )}
      >
        {children}
        <Icon className="h-3 w-3" aria-hidden="true" />
      </button>
    </th>
  )
}

export function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn(className)} {...props} />
}

export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('border-b border-hairline last:border-0', className)} {...props} />
}

export function TableCell({
  numeric,
  className,
  ...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'py-3 pr-3 align-top',
        numeric && 'tabular text-right',
        className,
      )}
      {...props}
    />
  )
}
