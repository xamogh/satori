export type PageNumber = number | "..."

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

export const getPageCount = (totalItems: number, pageSize: number): number => {
  if (pageSize <= 0) {
    return 1
  }

  return Math.max(1, Math.ceil(totalItems / pageSize))
}

export const clampPageIndex = (pageIndex: number, totalItems: number, pageSize: number): number =>
  clamp(pageIndex, 0, getPageCount(totalItems, pageSize) - 1)

export const slicePage = <A>(
  items: ReadonlyArray<A>,
  pageIndex: number,
  pageSize: number
): ReadonlyArray<A> => {
  if (pageSize <= 0) {
    return items
  }

  const start = pageIndex * pageSize
  return items.slice(start, start + pageSize)
}

export const getPageNumbers = (
  currentPage: number,
  totalPages: number
): ReadonlyArray<PageNumber> => {
  const total = Math.max(1, totalPages)
  const current = clamp(currentPage, 1, total)

  const maxVisiblePages = 5

  if (total <= maxVisiblePages) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const nearStart = current <= 3
  const nearEnd = current >= total - 2

  if (nearStart) {
    return [1, 2, 3, 4, "...", total]
  }

  if (nearEnd) {
    return [1, "...", total - 3, total - 2, total - 1, total]
  }

  return [1, "...", current - 1, current, current + 1, "...", total]
}

