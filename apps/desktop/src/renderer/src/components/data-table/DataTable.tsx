import * as React from "react"
import { cn } from "../../lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Skeleton } from "../ui/skeleton"

export type DataTableColumn<Row> = {
  readonly id: string
  readonly header: React.ReactNode
  readonly cell: (row: Row) => React.ReactNode
  readonly headerClassName?: string
  readonly cellClassName?: string
}

export type DataTableProps<Row> = {
  readonly columns: ReadonlyArray<DataTableColumn<Row>>
  readonly rows: ReadonlyArray<Row>
  readonly getRowKey: (row: Row) => string
  readonly emptyState?: React.ReactNode
  readonly loading?: boolean
  readonly loadingRowCount?: number
  readonly className?: string
}

const defaultEmptyState = "No results."

export const DataTable = <Row,>({
  columns,
  rows,
  getRowKey,
  emptyState = defaultEmptyState,
  loading = false,
  loadingRowCount = 5,
  className,
}: DataTableProps<Row>): React.JSX.Element => {
  const showEmpty = rows.length === 0 && !loading
  const showLoading = rows.length === 0 && loading

  return (
    <div className={cn("overflow-hidden rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            {columns.map((column) => (
              <TableHead key={column.id} className={column.headerClassName}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.id} className={column.cellClassName}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {showLoading
            ? Array.from({ length: loadingRowCount }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.cellClassName}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
          {showEmpty ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
