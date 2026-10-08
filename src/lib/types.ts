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
  /** Non-zero when Transmission reports a tracker, local or other error. */
  error: number;
  errorString: string;
};

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
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
  ) => Promise<boolean>;
  error?: string;
}
