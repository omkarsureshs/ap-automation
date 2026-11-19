export function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr className="border-b border-hairline">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 pr-3">
          <div className="skeleton-shimmer h-3 rounded" style={{ width: `${55 + ((i * 13) % 35)}%` }} />
        </td>
      ))}
    </tr>
  )
}
