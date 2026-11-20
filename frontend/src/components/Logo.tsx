import { cn } from '@/lib/utils'

/** Ledger page with a bound spine, two ruled lines and a check mark. Uses currentColor (defaults to --ledger). */
export function Logo({
  size = 28,
  withWordmark = false,
  className,
}: {
  size?: number
  withWordmark?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-ledger', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        role={withWordmark ? undefined : 'img'}
        aria-label={withWordmark ? undefined : 'AP Automation'}
        aria-hidden={withWordmark ? true : undefined}
      >
        <rect x="4" y="3" width="24" height="26" rx="3" />
        <path d="M10.5 3v26" />
        <path d="M15.5 10.5h8" />
        <path d="M15.5 16h5" />
        <path d="m15.5 22.5 2.6 2.6 5.4-5.6" />
      </svg>
      {withWordmark && (
        <span className="text-base font-bold tracking-tight text-foreground">AP Automation</span>
      )}
    </span>
  )
}
