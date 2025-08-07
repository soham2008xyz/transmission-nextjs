declare module "@tanstack/react-table" {
  interface TableMeta<TData extends unknown> {
    startTorrent: (id: number) => void;
    stopTorrent: (id: number) => void;
    removeTorrent: (id: number, deleteLocalData?: boolean) => void;
    viewTorrentDetails: (id: number) => void;
  }
}

export type Torrent = {
  id: number;
  name: string;
  totalSize: number;
  percentDone: number;
  rateDownload: number;
  rateUpload: number;
  status: number;
};

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
}

export interface TorrentDetailsDialogProps {
  torrent: Torrent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface AddTorrentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (
    magnetLink: string,
    torrentFile: File | null,
    destination: string
  ) => Promise<void>;
  error?: string;
}
