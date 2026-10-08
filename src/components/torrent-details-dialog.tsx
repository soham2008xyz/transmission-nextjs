import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Torrent,
  TorrentDetails,
  TorrentDetailsDialogProps,
  TorrentFileStat,
  TorrentPeer
} from "@/lib/types";
import { formatBytes, getStatusText } from "@/lib/utils";
import { getTorrentDetails, setFileWantedState } from "@/lib/transmission";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

function formatEta(eta: number | undefined) {
  if (eta === undefined) return "-";
  if (eta === -1) return "N/A";
  if (eta === -2) return "Unknown";
  if (eta === 0) return "Done";
  return `${Math.floor(eta / 3600)}h ${Math.floor((eta % 3600) / 60)}m`;
}

function formatRatio(ratio: number | undefined) {
  if (ratio === undefined) return "-";
  if (ratio === -1) return "None";
  if (ratio === -2) return "∞";
  return ratio.toFixed(2);
}

const MAX_PIECE_CELLS = 10000;

function PieceMap({
  pieces,
  pieceCount
}: Readonly<{
  pieces: string;
  pieceCount: number;
}>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cell = 6;
  const cols = 100;
  // Group pieces into at most MAX_PIECE_CELLS cells to keep the bitmap small.
  const perCell = Math.ceil(pieceCount / MAX_PIECE_CELLS);
  const cellCount = Math.ceil(pieceCount / perCell);
  const rows = Math.ceil(cellCount / cols);

  let bytes: string | null = null;
  try {
    bytes = atob(pieces);
  } catch {
    bytes = null;
  }

  let have = 0;
  const cellFill: number[] = [];
  if (bytes) {
    for (let c = 0; c < cellCount; c++) {
      const start = c * perCell;
      const end = Math.min(start + perCell, pieceCount);
      let done = 0;
      for (let i = start; i < end; i++) {
        if (((bytes.codePointAt(i >> 3) ?? 0) & (0x80 >> (i & 7))) !== 0) done++;
      }
      have += done;
      cellFill.push(done / (end - start));
    }
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cols * cell, rows * cell);
    cellFill.forEach((fill, c) => {
      ctx.fillStyle = fill > 0 ? "#22c55e" : "#6b728055";
      ctx.globalAlpha = fill > 0 ? 0.35 + 0.65 * fill : 1;
      ctx.fillRect((c % cols) * cell, Math.floor(c / cols) * cell, cell - 1, cell - 1);
    });
    ctx.globalAlpha = 1;
  });

  if (!bytes) return <p>Piece data unavailable.</p>;

  return (
    <div>
      <p className='text-sm mb-2'>
        {have} of {pieceCount} pieces complete
        {perCell > 1 && ` (each square covers ${perCell} pieces)`}
      </p>
      <canvas
        ref={canvasRef}
        width={cols * cell}
        height={rows * cell}
        style={{ maxWidth: "100%" }}
      />
    </div>
  );
}

function formatYesNo(value: boolean | undefined) {
  if (value === undefined) return "-";
  return value ? "Yes" : "No";
}

function InfoTab({
  torrent,
  live,
  details
}: Readonly<{
  torrent: Torrent;
  live: Torrent;
  details: TorrentDetails | null;
}>) {
  return (
    <table className='w-full text-sm border border-muted rounded-md'>
      <tbody>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>ID</th>
          <td className='p-2'>{torrent.id}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Name</th>
          <td className='p-2'>{torrent.name}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Size</th>
          <td className='p-2'>{formatBytes(live.totalSize)}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Progress</th>
          <td className='p-2'>
            {(live.percentDone * 100).toFixed(2)}%
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Status</th>
          <td className='p-2'>{getStatusText(live.status)}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Download Speed</th>
          <td className='p-2'>
            {formatBytes(live.rateDownload)}/s
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Upload Speed</th>
          <td className='p-2'>{formatBytes(live.rateUpload)}/s</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Date Added</th>
          <td className='p-2'>
            {details?.addedDate
              ? new Date(details.addedDate * 1000).toLocaleString()
              : "-"}
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Last Activity</th>
          <td className='p-2'>
            {details?.activityDate
              ? new Date(details.activityDate * 1000).toLocaleString()
              : "-"}
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Done Date</th>
          <td className='p-2'>
            {details?.doneDate
              ? new Date(details.doneDate * 1000).toLocaleString()
              : "-"}
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>ETA</th>
          <td className='p-2'>
            {formatEta(details?.eta)}
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Upload Ratio</th>
          <td className='p-2'>{formatRatio(details?.uploadRatio)}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Uploaded Ever</th>
          <td className='p-2'>
            {details?.uploadedEver !== undefined
              ? formatBytes(details.uploadedEver)
              : "-"}
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Downloaded Ever</th>
          <td className='p-2'>
            {details?.downloadedEver !== undefined
              ? formatBytes(details.downloadedEver)
              : "-"}
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Error</th>
          <td className='p-2'>{details?.errorString || "-"}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Creator</th>
          <td className='p-2'>{details?.creator || "-"}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Comment</th>
          <td className='p-2'>{details?.comment || "-"}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Hash</th>
          <td className='p-2'>{details?.hashString || "-"}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Download Directory</th>
          <td className='p-2'>{details?.downloadDir || "-"}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Private</th>
          <td className='p-2'>
            {formatYesNo(details?.isPrivate)}
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Piece Count</th>
          <td className='p-2'>{details?.pieceCount}</td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Piece Size</th>
          <td className='p-2'>
            {details?.pieceSize
              ? formatBytes(details.pieceSize)
              : "-"}
          </td>
        </tr>
        <tr>
          <th scope='row' className='font-semibold p-2 text-left'>Tracker Stats</th>
          <td className='p-2'>
            {details?.trackerStats
              ? details.trackerStats.length
              : "-"}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function PeersTab({ peers }: Readonly<{ peers: TorrentPeer[] | undefined }>) {
  if (!peers?.length) return <p>No peers found.</p>;
  return (
    <table className='min-w-full w-full text-sm border border-muted rounded-md'>
      <thead>
        <tr>
          <th className='font-semibold p-2 text-left'>Address</th>
          <th className='font-semibold p-2 text-left'>Client</th>
          <th className='font-semibold p-2 text-left'>Progress</th>
          <th className='font-semibold p-2 text-left'>
            Download Speed
          </th>
          <th className='font-semibold p-2 text-left'>
            Upload Speed
          </th>
          <th className='font-semibold p-2 text-left'>Flags</th>
        </tr>
      </thead>
      <tbody>
        {peers.map((peer: TorrentPeer) => (
          <tr key={`${peer.address}:${peer.port}`}>
            <td className='p-2'>{peer.address}</td>
            <td className='p-2'>{peer.clientName}</td>
            <td className='p-2'>
              {peer.progress !== undefined
                ? (peer.progress * 100).toFixed(2) + "%"
                : "-"}
            </td>
            <td className='p-2'>
              {peer.rateToClient !== undefined
                ? formatBytes(peer.rateToClient) + "/s"
                : "-"}
            </td>
            <td className='p-2'>
              {peer.rateToPeer !== undefined
                ? formatBytes(peer.rateToPeer) + "/s"
                : "-"}
            </td>
            <td className='p-2'>{peer.flagStr || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PiecesTab({ details }: Readonly<{ details: TorrentDetails | null }>) {
  if (!details) return <p>Loading pieces...</p>;
  if (!details.pieces || !details.pieceCount) return <p>No piece data.</p>;
  return (
    <div className='w-full max-h-[50vh] overflow-y-auto bg-muted rounded-md p-2'>
      <PieceMap pieces={details.pieces} pieceCount={details.pieceCount} />
    </div>
  );
}

function FilesTab({
  torrentId,
  details,
  onChange
}: Readonly<{
  torrentId: number;
  details: TorrentDetails | null;
  onChange: (details: TorrentDetails) => void;
}>) {
  if (!details?.files || !details.fileStats?.length) return <p>No files found.</p>;
  const { files } = details;
  // File order is how Transmission identifies files, so keep the index with each row.
  const rows = details.fileStats.map((fileStat: TorrentFileStat, index: number) => ({
    index,
    fileStat,
    file: files[index]
  }));
  return (
    <table className='min-w-full w-full text-sm border border-muted rounded-md'>
      <thead>
        <tr>
          <th className='font-semibold p-2 text-left'>Download</th>
          <th className='font-semibold p-2 text-left'>File Name</th>
          <th className='font-semibold p-2 text-left'>Size</th>
          <th className='font-semibold p-2 text-left'>
            Downloaded
          </th>
          <th className='font-semibold p-2 text-left'>Progress</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ index, file, fileStat }) => {
          const wanted = fileStat.wanted;
          return (
            <tr key={file?.name ?? index}>
              <td className='p-2'>
                <Checkbox
                  checked={wanted}
                  onCheckedChange={async (checked) => {
                    try {
                      await setFileWantedState(
                        torrentId,
                        [index],
                        !!checked
                      );
                    } catch (e) {
                      toast.error(
                        e instanceof Error && e.message
                          ? e.message
                          : "Failed to update file."
                      );
                    }
                    // Refetch details to sync UI, also after a failure so the checkbox shows the real state
                    try {
                      onChange(await getTorrentDetails(torrentId));
                    } catch {
                      // The next poll will retry.
                    }
                  }}
                  aria-label={`Toggle download for ${
                    file?.name || "file"
                  }`}
                />
              </td>
              <td className='p-2'>{file?.name || "-"}</td>
              <td className='p-2'>
                {file?.length !== undefined
                  ? formatBytes(file.length)
                  : "-"}
              </td>
              <td className='p-2'>
                {fileStat.bytesCompleted !== undefined
                  ? formatBytes(fileStat.bytesCompleted)
                  : "-"}
              </td>
              <td className='p-2'>
                {file && file.length > 0 &&
                fileStat.bytesCompleted !== undefined
                  ? (
                      (fileStat.bytesCompleted / file.length) *
                      100
                    ).toFixed(2) + "%"
                  : "-"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function TorrentDetailsDialog({
  torrent,
  open,
  onOpenChange
}: Readonly<TorrentDetailsDialogProps>) {
  const [rawDetails, setRawDetails] = useState<TorrentDetails | null>(null);

  const torrentId = torrent?.id;

  useEffect(() => {
    let cancelled = false;
    // Drop cached details on every open or torrent change so the fresher prop shows first.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset must run before the new fetch starts
    setRawDetails(null);
    let interval: NodeJS.Timeout | null = null;
    if (open && torrentId !== undefined) {
      const fetchDetails = async () => {
        const torrentDetails = await getTorrentDetails(torrentId);
        if (!cancelled) setRawDetails(torrentDetails);
      };
      void fetchDetails();
      interval = setInterval(fetchDetails, 5000); // refresh every 5 seconds
    }
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [open, torrentId]);

  if (!torrent) {
    return null;
  }

  // Prefer fresh polled values; fall back to the prop snapshot until the first fetch returns.
  const details = rawDetails?.id === torrent.id ? rawDetails : null;
  const live = details ?? torrent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-5xl h-[70vh] flex flex-col'>
        <DialogHeader>
          <DialogTitle>{torrent.name}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue='info' className='flex-1 flex flex-col min-h-0'>
          <TabsList>
            <TabsTrigger value='info'>Info</TabsTrigger>
            <TabsTrigger value='peers'>Peers</TabsTrigger>
            <TabsTrigger value='pieces'>Pieces</TabsTrigger>
            <TabsTrigger value='files'>Files</TabsTrigger>
          </TabsList>
          <TabsContent value='info' className='flex-1 min-h-0'>
            <div className='h-full overflow-y-auto'>
              <InfoTab torrent={torrent} live={live} details={details} />
            </div>
          </TabsContent>
          <TabsContent value='peers' className='flex-1 min-h-0'>
            <div className='h-full overflow-y-auto'>
              <PeersTab peers={details?.peers} />
            </div>
          </TabsContent>
          <TabsContent value='pieces'>
            <PiecesTab details={details} />
          </TabsContent>
          <TabsContent value='files' className='flex-1 min-h-0'>
            <div className='h-full overflow-y-auto'>
              <FilesTab torrentId={torrent.id} details={details} onChange={setRawDetails} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
