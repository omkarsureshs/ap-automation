import { Link, useLocation } from 'react-router-dom'
import { StatusSheet } from '@/components/StatusSheet'

const linkFocus =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-8 px-4 py-12 sm:flex-row sm:gap-12">
      <StatusSheet variant="missing" />
      <div className="text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-widest text-ledger">Error 404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">That page isn't in the ledger</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing exists at this address. The link may be out of date, or the page was moved.
        </p>
        <p
          className="tabular mt-4 inline-block max-w-full break-all rounded-sm border border-hairline bg-card px-2.5 py-1 font-mono text-xs"
          aria-label={`Requested path ${pathname}`}
        >
          {pathname}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-start">
          <Link
            to="/dashboard"
            className={`group inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${linkFocus}`}
          >
            Back to dashboard
            <span
              aria-hidden="true"
              className="transition-transform motion-safe:group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
          <Link
            to="/upload"
            className={`rounded-sm text-sm font-medium text-ledger underline-offset-4 hover:underline ${linkFocus}`}
          >
            Go to invoices
          </Link>
        </div>
      </div>
    </main>
  )
}
