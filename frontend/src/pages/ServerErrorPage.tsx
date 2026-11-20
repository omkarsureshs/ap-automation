import { StatusSheet } from '@/components/StatusSheet'

export function ServerErrorPage({ onRetry }: { onRetry?: () => void }) {
  return (
    <main
      role="alert"
      className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-8 px-4 py-12 sm:flex-row sm:gap-12"
    >
      <StatusSheet variant="fault" />
      <div className="text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-widest text-exception">Unexpected error</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">This page failed to load</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The app hit a problem it couldn't recover from. Invoices and approvals already saved are
          unaffected. Reload to try again; if it keeps happening, contact your administrator.
        </p>
        <button
          type="button"
          onClick={onRetry ?? (() => window.location.reload())}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Reload
        </button>
      </div>
    </main>
  )
}
