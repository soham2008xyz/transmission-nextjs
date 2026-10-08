"use client";

import { useEffect, useState } from "react";
import {
  RpcError,
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
import { AddTorrentDialog } from "@/components/add-torrent-dialog";
import { Toaster, toast } from "sonner";

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export default function Home() {
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [sorting, setSorting] = useLocalStorage("table_sorting", []);
  const [columnFilters, setColumnFilters] = useLocalStorage(
    "table_columnFilters",
    []
  );
  const [columnVisibility, setColumnVisibility] = useLocalStorage(
    "table_columnVisibility",
    {}
  );
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    title: string;
    description: string;
    destructive: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    title: "",
    description: "",
    destructive: false,
    onConfirm: () => {}
  });
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null);
  const [pageIndex, setPageIndex] = useLocalStorage("table_pageIndex", 0);
  const [pageSize, setPageSize] = useLocalStorage("table_pageSize", 10);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchTorrents = async () => {
    let torrents: Torrent[];
    try {
      torrents = await getTorrents();
    } catch (e) {
      // Keep the last rows and show one persistent banner, not a toast per poll.
      if (e instanceof RpcError && e.unreachable) setDisconnected(true);
      else console.error("Failed to fetch torrents:", e);
      return;
    }
    setDisconnected(false);
    setTorrents(torrents);
    setLoaded(true);
    // Drop selections for torrents that no longer exist
    const ids = new Set(torrents.map((t) => String(t.id)));
    setRowSelection((prev) => {
      const keys = Object.keys(prev);
      if (keys.every((k) => ids.has(k))) return prev;
      return Object.fromEntries(keys.filter((k) => ids.has(k)).map((k) => [k, prev[k]]));
    });
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Chain polls so one never starts before the last one returns.
    let running = false;
    const poll = async () => {
      if (running) return;
      running = true;
      try {
        await fetchTorrents();
      } finally {
        running = false;
      }
      if (!cancelled && !document.hidden) timer = setTimeout(poll, 5000);
    };

    const handleVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden && !cancelled) poll();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const handleStartTorrent = async (id: number) => {
    try {
      await startTorrent(id);
    } catch (e) {
      toast.error(errorMessage(e, "Failed to start torrent."));
    }
    await fetchTorrents();
  };

  const handleStopTorrent = async (id: number) => {
    try {
      await stopTorrent(id);
    } catch (e) {
      toast.error(errorMessage(e, "Failed to stop torrent."));
    }
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
      destructive: deleteLocalData,
      onConfirm: async () => {
        try {
          await removeTorrent(id, deleteLocalData);
        } catch (e) {
          toast.error(errorMessage(e, "Failed to remove torrent."));
        }
        setDialogOpen(false);
        await fetchTorrents();
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
  ): Promise<boolean> => {
    setAddError("");
    try {
      if (magnetLink) {
        await addTorrentByMagnet(magnetLink, destination);
      } else if (torrentFile) {
        await addTorrentByFile(torrentFile, destination);
      } else {
        setAddError("Please provide a magnet link or select a file.");
        return false;
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add torrent.");
      return false;
    }
    setAddDialogOpen(false);
    // The torrent is added; a failed refresh must not read as a failed add.
    await fetchTorrents().catch(() => {});
    return true;
  };

  const handleAddDialogOpenChange = (open: boolean) => {
    if (!open) setAddError("");
    setAddDialogOpen(open);
  };

  // Bulk action handlers
  const selectedIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map(Number);

  const handleStartSelected = async () => {
    try {
      await startTorrent(selectedIds);
    } catch (e) {
      toast.error(errorMessage(e, "Failed to start torrents."));
    }
    await fetchTorrents();
  };

  const handleStopSelected = async () => {
    try {
      await stopTorrent(selectedIds);
    } catch (e) {
      toast.error(errorMessage(e, "Failed to stop torrents."));
    }
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
      destructive: deleteLocalData,
      onConfirm: async () => {
        try {
          await removeTorrent(selectedIds, deleteLocalData);
        } catch (e) {
          toast.error(errorMessage(e, "Failed to remove torrents."));
        }
        setDialogOpen(false);
        await fetchTorrents();
      }
    });
    setDialogOpen(true);
  };

  const table = useReactTable({
    data: torrents,
    columns,
    getRowId: (row) => String(row.id),
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
    onColumnFiltersChange: (updater) => {
      setColumnFilters(
        typeof updater === "function" ? updater(columnFilters) : updater
      );
      setPageIndex(0);
    },
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

  // Keep the saved page inside range when rows are removed or filtered out.
  // Wait for the first fetch so an empty table does not reset the saved page.
  const pageCount = table.getPageCount();
  useEffect(() => {
    if (!loaded) return;
    const lastPage = Math.max(0, pageCount - 1);
    if (pageIndex > lastPage) setPageIndex(lastPage);
  }, [loaded, pageCount, pageIndex, setPageIndex]);

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
        {disconnected && (
          <div
            role='alert'
            className='mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive'
          >
            Disconnected: could not reach Transmission. Showing the last known
            data; retrying every 5 seconds.
          </div>
        )}
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
        onOpenChange={handleAddDialogOpenChange}
        onAdd={handleAddTorrent}
        error={addError}
      />
      <ConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={dialogConfig.onConfirm}
        title={dialogConfig.title}
        description={dialogConfig.description}
        destructive={dialogConfig.destructive}
      />
      <TorrentDetailsDialog
        torrent={selectedTorrent}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
      <Toaster />
    </>
  );
}
