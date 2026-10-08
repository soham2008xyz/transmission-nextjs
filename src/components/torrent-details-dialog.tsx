import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TorrentDetailsDialogProps } from "@/lib/types";
import { formatBytes, getStatusText } from "@/lib/utils";
import { getTorrentDetails, setFileWantedState } from "@/lib/transmission";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

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
}: {
  pieces: string;
  pieceCount: number;
}) {
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
        if (((bytes.charCodeAt(i >> 3) || 0) & (0x80 >> (i & 7))) !== 0) done++;
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

export function TorrentDetailsDialog({
  torrent,
  open,
  onOpenChange
}: TorrentDetailsDialogProps) {
  const [details, setDetails] = useState<any>(null);

  const torrentId = torrent?.id;

  useEffect(() => {
    let cancelled = false;
    // Drop cached details on every open or torrent change so the fresher prop shows first.
    setDetails(null);
    let interval: NodeJS.Timeout | null = null;
    if (open && torrent) {
      const fetchDetails = async () => {
        const torrentDetails = await getTorrentDetails(torrent.id);
        if (!cancelled) setDetails(torrentDetails);
      };
      fetchDetails();
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
  const live = details?.id === torrent.id ? details : torrent;

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
              <table className='w-full text-sm border border-muted rounded-md'>
                <tbody>
                  <tr>
                    <td className='font-semibold p-2'>ID</td>
                    <td className='p-2'>{torrent.id}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Name</td>
                    <td className='p-2'>{torrent.name}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Size</td>
                    <td className='p-2'>{formatBytes(live.totalSize)}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Progress</td>
                    <td className='p-2'>
                      {(live.percentDone * 100).toFixed(2)}%
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Status</td>
                    <td className='p-2'>{getStatusText(live.status)}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Download Speed</td>
                    <td className='p-2'>
                      {formatBytes(live.rateDownload)}/s
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Upload Speed</td>
                    <td className='p-2'>{formatBytes(live.rateUpload)}/s</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Date Added</td>
                    <td className='p-2'>
                      {details?.addedDate
                        ? new Date(details.addedDate * 1000).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Last Activity</td>
                    <td className='p-2'>
                      {details?.activityDate
                        ? new Date(details.activityDate * 1000).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Done Date</td>
                    <td className='p-2'>
                      {details?.doneDate
                        ? new Date(details.doneDate * 1000).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>ETA</td>
                    <td className='p-2'>
                      {formatEta(details?.eta)}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Upload Ratio</td>
                    <td className='p-2'>{formatRatio(details?.uploadRatio)}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Uploaded Ever</td>
                    <td className='p-2'>
                      {details?.uploadedEver !== undefined
                        ? formatBytes(details.uploadedEver)
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Downloaded Ever</td>
                    <td className='p-2'>
                      {details?.downloadedEver !== undefined
                        ? formatBytes(details.downloadedEver)
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Error</td>
                    <td className='p-2'>{details?.errorString || "-"}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Creator</td>
                    <td className='p-2'>{details?.creator || "-"}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Comment</td>
                    <td className='p-2'>{details?.comment || "-"}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Hash</td>
                    <td className='p-2'>{details?.hashString || "-"}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Download Directory</td>
                    <td className='p-2'>{details?.downloadDir || "-"}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Private</td>
                    <td className='p-2'>
                      {details?.isPrivate !== undefined
                        ? details.isPrivate
                          ? "Yes"
                          : "No"
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Piece Count</td>
                    <td className='p-2'>{details?.pieceCount}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Piece Size</td>
                    <td className='p-2'>
                      {details?.pieceSize
                        ? formatBytes(details.pieceSize)
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Tracker Stats</td>
                    <td className='p-2'>
                      {details?.trackerStats
                        ? details.trackerStats.length
                        : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value='peers' className='flex-1 min-h-0'>
            <div className='h-full overflow-y-auto'>
              {details && details.peers && details.peers.length > 0 ? (
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
                    {details.peers.map((peer: any, index: number) => (
                      <tr key={index}>
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
              ) : (
                <p>No peers found.</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value='pieces'>
            {details?.pieces && details.pieceCount ? (
              <div className='w-full max-h-[50vh] overflow-y-auto bg-muted rounded-md p-2'>
                <PieceMap
                  pieces={details.pieces}
                  pieceCount={details.pieceCount}
                />
              </div>
            ) : details ? (
              <p>No piece data.</p>
            ) : (
              <p>Loading pieces...</p>
            )}
          </TabsContent>
          <TabsContent value='files' className='flex-1 min-h-0'>
            <div className='h-full overflow-y-auto'>
              {details &&
              details.files &&
              details.fileStats &&
              details.fileStats.length > 0 ? (
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
                    {details.fileStats.map((fileStat: any, index: number) => {
                      const file = details.files[index];
                      const wanted = fileStat.wanted;
                      return (
                        <tr key={index}>
                          <td className='p-2'>
                            <Checkbox
                              checked={wanted}
                              onCheckedChange={async (checked) => {
                                await setFileWantedState(
                                  torrent.id,
                                  [index],
                                  !!checked
                                );
                                // Refetch details to sync UI
                                const updatedDetails = await getTorrentDetails(
                                  torrent.id
                                );
                                setDetails(updatedDetails);
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
                            {file?.length > 0 &&
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
              ) : (
                <p>No files found.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
