import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { clampPageIndex, getPageCount, getPageNumbers } from '../../utils/pagination'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'

export type DataTablePaginationProps = {
  readonly totalItems: number
  readonly pageIndex: number
  readonly pageSize: number
  readonly onPageIndexChange: (pageIndex: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
  readonly pageSizeOptions?: ReadonlyArray<number>
  readonly className?: string
}

const defaultPageSizeOptions = [10, 20, 30, 40, 50] as const

export const DataTablePagination = ({
  totalItems,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  pageSizeOptions = defaultPageSizeOptions,
  className
}: DataTablePaginationProps): React.JSX.Element => {
  const pageCount = getPageCount(totalItems, pageSize)
  const safePageIndex = clampPageIndex(pageIndex, totalItems, pageSize)
  const currentPage = safePageIndex + 1
  const pageNumbers = getPageNumbers(currentPage, pageCount)

  return (
    <div className={cn('flex items-center justify-between gap-3 px-2', className)}>
      <div className="flex items-center gap-2">
        <div className="hidden text-sm font-medium sm:block">Rows per page</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-[84px] justify-between">
              {pageSize}
              <ChevronDown className="h-4 w-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {pageSizeOptions.map((size) => (
              <DropdownMenuItem key={size} onSelect={() => onPageSizeChange(size)}>
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden text-sm font-medium sm:block">
          Page {currentPage} of {pageCount}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageIndexChange(0)}
            disabled={currentPage === 1}
          >
            <span className="sr-only">First page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageIndexChange(Math.max(0, safePageIndex - 1))}
            disabled={currentPage === 1}
          >
            <span className="sr-only">Previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pageNumbers.map((pageNumber, index) =>
            pageNumber === '...' ? (
              <div key={`${pageNumber}-${index}`} className="px-1 text-sm text-muted-foreground">
                …
              </div>
            ) : (
              <Button
                key={`${pageNumber}-${index}`}
                variant={pageNumber === currentPage ? 'default' : 'outline'}
                className="h-8 min-w-8 px-2"
                onClick={() => onPageIndexChange(pageNumber - 1)}
              >
                <span className="sr-only">Go to page {pageNumber}</span>
                {pageNumber}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageIndexChange(Math.min(pageCount - 1, safePageIndex + 1))}
            disabled={currentPage === pageCount}
          >
            <span className="sr-only">Next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageIndexChange(pageCount - 1)}
            disabled={currentPage === pageCount}
          >
            <span className="sr-only">Last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
