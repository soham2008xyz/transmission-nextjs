"use client";

import { useEffect, useState } from "react";
import {
  getTorrents,
  startTorrent,
  stopTorrent,
  removeTorrent,
  addTorrentByMagnet,
  addTorrentByFile
} from "@/lib/transmission";
import { columns } from "@/components/columns";
import { DataTable } from "@/components/data-table";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel
} from "@tanstack/react-table";
import { Navbar } from "@/components/navbar";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { TorrentDetailsDialog } from "@/components/torrent-details-dialog";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Torrent } from "@/lib/types";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AddTorrentDialog } from "@/components/add-torrent-dialog";

export default function Home() {
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [sorting, setSorting] = useLocalStorage("table_sorting", []);
  const [columnFilters, setColumnFilters] = useLocalStorage(
    "table_columnFilters",
    []
  );
  const [columnVisibility, setColumnVisibility] = useLocalStorage(
    "table_columnVisibility",
    {}
  );
  const [rowSelection, setRowSelection] = useLocalStorage(
    "table_rowSelection",
    {}
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState({
    title: "",
    description: "",
    onConfirm: () => {}
  });
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null);
  const [pageIndex, setPageIndex] = useLocalStorage("table_pageIndex", 0);
  const [pageSize, setPageSize] = useLocalStorage("table_pageSize", 10);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchTorrents = async () => {
    const torrents = await getTorrents();
    setTorrents(torrents);
  };

  useEffect(() => {
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleStartTorrent = async (id: number) => {
    await startTorrent(id);
    await fetchTorrents();
  };

  const handleStopTorrent = async (id: number) => {
    await stopTorrent(id);
    await fetchTorrents();
  };

  const handleRemoveTorrent = async (id: number, deleteLocalData = false) => {
    const torrent = torrents.find((t) => t.id === id);
    const torrentName = torrent ? torrent.name : "this torrent";
    const title = deleteLocalData
      ? `Permanently delete ${torrentName}?`
      : `Remove ${torrentName}?`;
    const description = deleteLocalData
      ? "This action cannot be undone. The torrent and its data will be permanently deleted."
      : "This will remove the torrent from the list, but the data will remain on disk.";

    setDialogConfig({
      title,
      description,
      onConfirm: async () => {
        await removeTorrent(id, deleteLocalData);
        await fetchTorrents();
        setDialogOpen(false);
      }
    });
    setDialogOpen(true);
  };

  const handleViewTorrentDetails = (id: number) => {
    const torrent = torrents.find((t) => t.id === id);
    if (torrent) {
      setSelectedTorrent(torrent);
      setDetailsDialogOpen(true);
    }
  };

  const handleAddTorrent = async (
    magnetLink: string,
    torrentFile: File | null,
    destination: string
  ) => {
    setAddError("");
    try {
      if (magnetLink) {
        await addTorrentByMagnet(magnetLink, destination);
      } else if (torrentFile) {
        await addTorrentByFile(torrentFile, destination);
      } else {
        setAddError("Please provide a magnet link or select a file.");
        return;
      }
      setAddDialogOpen(false);
      await fetchTorrents();
    } catch (e) {
      setAddError("Failed to add torrent.");
    }
  };

  // Bulk action handlers
  const selectedIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map(Number);

  const handleStartSelected = async () => {
    await Promise.all(selectedIds.map((id) => startTorrent(id)));
    await fetchTorrents();
  };

  const handleStopSelected = async () => {
    await Promise.all(selectedIds.map((id) => stopTorrent(id)));
    await fetchTorrents();
  };

  const handleRemoveSelected = async (deleteLocalData = false) => {
    setDialogConfig({
      title: deleteLocalData
        ? `Permanently delete ${selectedIds.length} selected torrents?`
        : `Remove ${selectedIds.length} selected torrents?`,
      description: deleteLocalData
        ? "This action cannot be undone. The torrents and their data will be permanently deleted."
        : "This will remove the selected torrents from the list, but the data will remain on disk.",
      onConfirm: async () => {
        await Promise.all(
          selectedIds.map((id) => removeTorrent(id, deleteLocalData))
        );
        await fetchTorrents();
        setDialogOpen(false);
      }
    });
    setDialogOpen(true);
  };

  const table = useReactTable({
    data: torrents,
    columns,
    meta: {
      startTorrent: handleStartTorrent,
      stopTorrent: handleStopTorrent,
      removeTorrent: handleRemoveTorrent,
      viewTorrentDetails: handleViewTorrentDetails
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        const newState = updater({ pageIndex, pageSize });
        setPageIndex(newState.pageIndex);
        setPageSize(newState.pageSize);
      } else {
        setPageIndex(updater.pageIndex);
        setPageSize(updater.pageSize);
      }
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex,
        pageSize
      }
    },
    autoResetPageIndex: false
  });

  return (
    <>
      <Navbar
        table={table}
        onAddTorrentClick={() => setAddDialogOpen(true)}
        onStartSelected={handleStartSelected}
        onStopSelected={handleStopSelected}
        onRemoveSelected={handleRemoveSelected}
        selectedCount={selectedIds.length}
      />
      <main className='container mx-auto py-12'>
        <DataTable table={table} columns={columns} />
        {/* Status Bar */}
        <div className='mt-4 text-sm text-muted-foreground'>
          {(() => {
            const pageIndex = table.getState().pagination.pageIndex;
            const pageSize = table.getState().pagination.pageSize;
            const filteredRows = table.getFilteredRowModel().rows.length;
            const totalRows = table.getPreFilteredRowModel().rows.length;
            const start = filteredRows === 0 ? 0 : pageIndex * pageSize + 1;
            const end = Math.min((pageIndex + 1) * pageSize, filteredRows);
            const filtersActive = table.getState().columnFilters?.length > 0;
            return (
              <span>
                {`Showing ${start}-${end} of ${filteredRows} results`}
                {filtersActive && filteredRows !== totalRows
                  ? ` (filtered from total ${totalRows} items)`
                  : ""}
              </span>
            );
          })()}
        </div>
      </main>
      {/* Add Torrent Dialog */}
      <AddTorrentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddTorrent}
        error={addError}
      />
      <ConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={dialogConfig.onConfirm}
        title={dialogConfig.title}
        description={dialogConfig.description}
      />
      <TorrentDetailsDialog
        torrent={selectedTorrent}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </>
  );
}
