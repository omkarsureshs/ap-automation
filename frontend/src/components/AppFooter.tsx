const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-hairline px-4 py-5 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <span>
          <span className="font-semibold text-foreground">AP Automation</span>
          <span aria-hidden="true"> · </span>
          Built with Django, React and PostgreSQL
        </span>
        <a
          href={`${API_BASE}/api/docs/`}
          target="_blank"
          rel="noreferrer"
          className="rounded-sm text-ledger underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          API documentation
        </a>
      </div>
    </footer>
  )
}
