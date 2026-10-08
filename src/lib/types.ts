declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- type parameter must match the library declaration
  interface TableMeta<TData> {
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

export interface TorrentPeer {
  address: string;
  clientName: string;
  progress: number;
  rateToClient: number;
  rateToPeer: number;
  flagStr: string;
}

export interface TorrentFile {
  name: string;
  length: number;
}

export interface TorrentFileStat {
  bytesCompleted: number;
  wanted: boolean;
}

export interface TorrentDetails extends Torrent {
  addedDate?: number;
  activityDate?: number;
  doneDate?: number;
  eta?: number;
  uploadRatio?: number;
  uploadedEver?: number;
  downloadedEver?: number;
  errorString?: string;
  creator?: string;
  comment?: string;
  hashString?: string;
  downloadDir?: string;
  isPrivate?: boolean;
  pieceSize?: number;
  pieceCount?: number;
  pieces?: string;
  peers?: TorrentPeer[];
  trackerStats?: unknown[];
  files?: TorrentFile[];
  fileStats?: TorrentFileStat[];
}

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
