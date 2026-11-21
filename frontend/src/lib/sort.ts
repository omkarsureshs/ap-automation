import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  const an = typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a)) ? Number(a) : a
  const bn = typeof b === 'string' && b.trim() !== '' && !Number.isNaN(Number(b)) ? Number(b) : b
  if (typeof an === 'number' && typeof bn === 'number') return an - bn
  return String(a).localeCompare(String(b))
}

export function useSort<T, K extends keyof T>(rows: T[] | null, defaultKey: K | null = null) {
  const [key, setKey] = useState<K | null>(defaultKey)
  const [direction, setDirection] = useState<SortDirection>('asc')

  function toggleSort(k: K) {
    if (key === k) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setKey(k)
      setDirection('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!rows || key === null) return rows
    return [...rows].sort((a, b) => {
      const cmp = compareValues(a[key], b[key])
      return direction === 'asc' ? cmp : -cmp
    })
  }, [rows, key, direction])

  return { sorted, sortKey: key, sortDirection: direction, toggleSort }
}
