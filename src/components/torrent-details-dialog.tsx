import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Torrent } from "@/lib/types";
import { formatBytes, getStatusText } from "@/lib/utils";
import { getTorrentDetails } from "@/lib/transmission";
import { useEffect, useState } from "react";
import { TorrentDetailsDialogProps } from "@/lib/types";

export function TorrentDetailsDialog({
  torrent,
  open,
  onOpenChange
}: TorrentDetailsDialogProps) {
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (open && torrent) {
      const fetchDetails = async () => {
        const torrentDetails = await getTorrentDetails(torrent.id);
        setDetails(torrentDetails);
      };
      fetchDetails();
      interval = setInterval(fetchDetails, 5000); // refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [open, torrent]);

  if (!torrent) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl h-[70vh] flex flex-col'>
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
                    <td className='p-2'>{formatBytes(torrent.totalSize)}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Progress</td>
                    <td className='p-2'>
                      {(torrent.percentDone * 100).toFixed(2)}%
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Status</td>
                    <td className='p-2'>{getStatusText(torrent.status)}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Download Speed</td>
                    <td className='p-2'>
                      {formatBytes(torrent.rateDownload)}/s
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Upload Speed</td>
                    <td className='p-2'>{formatBytes(torrent.rateUpload)}/s</td>
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
                      {details?.eta !== undefined
                        ? details.eta > 0
                          ? `${Math.floor(details.eta / 3600)}h ${Math.floor(
                              (details.eta % 3600) / 60
                            )}m`
                          : "Done"
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Upload Ratio</td>
                    <td className='p-2'>{details?.uploadRatio?.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Uploaded Ever</td>
                    <td className='p-2'>
                      {details?.uploadedEver
                        ? formatBytes(details.uploadedEver)
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className='font-semibold p-2'>Downloaded Ever</td>
                    <td className='p-2'>
                      {details?.downloadedEver
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
            {details ? (
              <div className='w-full h-32 overflow-y-auto bg-muted rounded-md p-2'>
                <pre className='text-xs whitespace-pre-wrap break-all'>
                  {details.pieces}
                </pre>
              </div>
            ) : (
              <p>Loading pieces...</p>
            )}
          </TabsContent>
          <TabsContent value='files'>
            {details ? (
              <ul>
                {details.fileStats.map((file: any, index: number) => (
                  <li key={index}>
                    {file.name} ({formatBytes(file.length)})
                  </li>
                ))}
              </ul>
            ) : (
              <p>Loading files...</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
