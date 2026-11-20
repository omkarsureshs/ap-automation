/** Invoice sheet with a torn bottom edge. "missing" marks an absent line item with a magnifier; "fault" shows a broken rule. */
export function StatusSheet({ variant }: { variant: 'missing' | 'fault' }) {
  return (
    <svg
      viewBox="0 0 220 180"
      className="h-auto w-44 shrink-0 sm:w-56"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* sheet with torn lower edge */}
      <path
        d="M48 14h108a6 6 0 0 1 6 6v118l-9 7-10-8-11 9-10-7-12 8-11-9-10 8-12-8-11 8-10-7-8 4V20a6 6 0 0 1 6-6Z"
        className="fill-card stroke-hairline"
      />
      {/* header */}
      <path d="M64 34h40" className="stroke-ledger" strokeWidth="3" />
      <path d="M130 34h16" className="stroke-hairline" />
      {/* ruled line items */}
      <path d="M64 58h82M64 78h82" className="stroke-hairline" />
      {variant === 'missing' ? (
        <>
          <path d="M64 98h30" className="stroke-hairline" />
          <path d="M104 98h10M122 98h10" className="stroke-exception" strokeDasharray="1 7" />
          <path d="M64 118h56" className="stroke-hairline" />
          <circle cx="150" cy="112" r="17" className="fill-background stroke-ledger" strokeWidth="3" />
          <path d="m162.5 124.5 18 18" className="stroke-ledger" strokeWidth="4" />
          <path d="M144 112h12" className="stroke-exception" />
        </>
      ) : (
        <>
          <path d="M64 98h36" className="stroke-hairline" />
          <path d="m106 92 8 12m0-12-8 12" className="stroke-exception" strokeWidth="2.5" />
          <path d="M122 98h24" className="stroke-hairline" strokeDasharray="2 6" />
          <path d="M64 118h56" className="stroke-hairline" />
        </>
      )}
    </svg>
  )
}
