"use client";

import { useEffect, useState } from "react";
import {
  getTorrents,
  startTorrent,
  stopTorrent,
  removeTorrent
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
      <Navbar table={table} />
      <main className='container mx-auto py-12'>
        <DataTable table={table} columns={columns} />
      </main>
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
