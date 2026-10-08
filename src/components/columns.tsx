import { formatBytes, getStatusText } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal, Play, Pause, Trash2, Trash, ArrowUp, ArrowDown, Info, AlertCircle } from "lucide-react";
import { Column, ColumnDef } from "@tanstack/react-table";
import { Torrent } from "@/lib/types";

function SortIcon({ sorted }: Readonly<{ sorted: false | "asc" | "desc" }>) {
  if (sorted === "desc") return <ArrowDown className="ml-2 h-4 w-4" />;
  if (sorted === "asc") return <ArrowUp className="ml-2 h-4 w-4" />;
  return <ArrowUpDown className="ml-2 h-4 w-4" />;
}

function SortableHeader({ column, title }: Readonly<{ column: Column<Torrent>; title: string }>) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      className={sorted ? "font-extrabold" : "font-semibold"}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      <SortIcon sorted={sorted} />
    </Button>
  );
}

export const columns: ColumnDef<Torrent>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 50,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
    cell: ({ row }) => {
      return (
        <div className="truncate w-full">
          {row.getValue("name")}
        </div>
      )
    },
    size: 400,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const { error, errorString } = row.original;
      const status = getStatusText(row.getValue("status"));
      if (!error) return status;
      return (
        <div className="flex items-center gap-1 text-destructive" title={errorString}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{status}: {errorString || "Error"}</span>
        </div>
      );
    },
    filterFn: 'equals',
    size: 150,
  },
  {
    accessorKey: "totalSize",
    header: ({ column }) => <SortableHeader column={column} title="Size" />,
    cell: ({ row }) => formatBytes(row.getValue("totalSize")),
    size: 100,
  },
  {
    accessorKey: "percentDone",
    header: ({ column }) => <SortableHeader column={column} title="Progress" />,
    cell: ({ row }) => {
      const percentDone = Number.parseFloat(row.getValue("percentDone")) * 100;
      return `${percentDone.toFixed(2)}%`;
    },
    size: 100,
  },
  {
    accessorKey: "rateDownload",
    header: ({ column }) => <SortableHeader column={column} title="Down Speed" />,
    cell: ({ row }) => `${formatBytes(row.getValue("rateDownload"))}/s`,
    size: 120,
  },
  {
    accessorKey: "rateUpload",
    header: ({ column }) => <SortableHeader column={column} title="Up Speed" />,
    cell: ({ row }) => `${formatBytes(row.getValue("rateUpload"))}/s`,
    size: 120,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const torrent = row.original;
      const { startTorrent, stopTorrent, removeTorrent, viewTorrentDetails } = table.options.meta!;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => viewTorrentDetails(torrent.id)}>
              <Info className="mr-2 h-4 w-4" />
              <span>View Details</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => startTorrent(torrent.id)}>
              <Play className="mr-2 h-4 w-4" />
              <span>Start</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => stopTorrent(torrent.id)}>
              <Pause className="mr-2 h-4 w-4" />
              <span>Stop</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => removeTorrent(torrent.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Remove</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => removeTorrent(torrent.id, true)}>
              <Trash className="mr-2 h-4 w-4" />
              <span>Remove and Delete Data</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    size: 80,
  },
];
