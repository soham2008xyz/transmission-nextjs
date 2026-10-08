import { getRowStyle } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  flexRender,
  type ColumnDef,
  type Table as ReactTable
} from "@tanstack/react-table";
import type { Torrent } from "@/lib/types";

interface DataTableProps {
  table: ReactTable<Torrent>;
  columns: ColumnDef<Torrent>[];
}

export function DataTable({ table, columns }: DataTableProps) {
  return (
    <div>
      <div className='rounded-md border'>
        <Table className='table-fixed'>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  style={getRowStyle(row)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-between py-4'>
        <div className='flex items-center space-x-2'>
          <p className='text-sm font-medium'>Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}>
            <SelectTrigger className='h-8 w-[70px]'>
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side='top'>
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center justify-end space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          {/* Smart page number buttons with ellipsis */}
          {(() => {
            const pageCount = table.getPageCount();
            const current = table.getState().pagination.pageIndex;
            const pages: number[] = [];
            // Always show first page
            if (pageCount > 0) {
              pages.push(0);
            }
            // Show previous 2 pages before current
            for (let i = Math.max(1, current - 2); i < current; i++) {
              pages.push(i);
            }
            // Show current page
            if (current !== 0 && current !== pageCount - 1) {
              pages.push(current);
            }
            // Show next 2 pages after current
            for (
              let i = current + 1;
              i <= Math.min(pageCount - 2, current + 2);
              i++
            ) {
              pages.push(i);
            }
            // Always show last page if more than one page
            if (pageCount > 1) {
              pages.push(pageCount - 1);
            }
            // Remove duplicates and sort
            const uniquePages = Array.from(new Set(pages)).sort(
              (a, b) => a - b
            );
            // Render buttons with ellipsis
            return uniquePages
              .map((page, idx) => {
                // Add ellipsis if gap from previous page
                if (idx > 0 && page - uniquePages[idx - 1] > 1) {
                  return [
                    <span key={`ellipsis-${page}`} className='px-1'>
                      ...
                    </span>,
                    <Button
                      key={page}
                      variant={current === page ? "default" : "outline"}
                      size='sm'
                      onClick={() => table.setPageIndex(page)}
                      className={current === page ? "font-bold" : ""}>
                      {page + 1}
                    </Button>
                  ];
                }
                return (
                  <Button
                    key={page}
                    variant={current === page ? "default" : "outline"}
                    size='sm'
                    onClick={() => table.setPageIndex(page)}
                    className={current === page ? "font-bold" : ""}>
                    {page + 1}
                  </Button>
                );
              })
              .flat();
          })()}
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
