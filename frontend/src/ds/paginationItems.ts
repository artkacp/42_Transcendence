export type Item = number | 'gap'
// Always show the first and last page, the current one and its neighbours.
// Anything else collapses into a gap: 1 … 4 [5] 6 … 12


export function pageItems(page: number, totalPages: number): Item[] {
  const keep = new Set([1, totalPages, page - 1, page, page + 1])
  const items: Item[] = []
  let prev = 0

  for (let p = 1; p <= totalPages; p++) {
    if (!keep.has(p)) continue
    if (p - prev === 2) items.push(prev + 1)
    else if (p - prev > 2) items.push('gap')
    items.push(p)
    prev = p
  }

  return items
}
