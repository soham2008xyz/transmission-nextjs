import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Torrent } from "@/lib/types";
import { formatBytes, getStatusText } from "@/lib/utils";
import { getTorrentDetails } from "@/lib/transmission";
import { useEffect, useState } from "react";
import { TorrentDetailsDialogProps } from "@/lib/types";

export function TorrentDetailsDialog({ torrent, open, onOpenChange }: TorrentDetailsDialogProps) {
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (open && torrent) {
      const fetchDetails = async () => {
        const torrentDetails = await getTorrentDetails(torrent.id);
        setDetails(torrentDetails);
      };
      fetchDetails();
    }
  }, [open, torrent]);

  if (!torrent) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{torrent.name}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="peers">Peers</TabsTrigger>
            <TabsTrigger value="pieces">Pieces</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>
          <TabsContent value="info">
            <div>
              <p><strong>ID:</strong> {torrent.id}</p>
              <p><strong>Size:</strong> {formatBytes(torrent.totalSize)}</p>
              <p><strong>Progress:</strong> {(torrent.percentDone * 100).toFixed(2)}%</p>
              <p><strong>Status:</strong> {getStatusText(torrent.status)}</p>
              <p><strong>Download Speed:</strong> {formatBytes(torrent.rateDownload)}/s</p>
              <p><strong>Upload Speed:</strong> {formatBytes(torrent.rateUpload)}/s</p>
            </div>
          </TabsContent>
          <TabsContent value="peers">
            {details ? (
              <ul>
                {details.peers.map((peer: any, index: number) => (
                  <li key={index}>{peer.address} - {peer.clientName}</li>
                ))}
              </ul>
            ) : <p>Loading peers...</p>}
          </TabsContent>
          <TabsContent value="pieces">
            {details ? (
              <div className="w-full h-32 overflow-y-auto bg-muted rounded-md p-2">
                <pre className="text-xs whitespace-pre-wrap break-all">{details.pieces}</pre>
              </div>
            ) : <p>Loading pieces...</p>}
          </TabsContent>
          <TabsContent value="files">
            {details ? (
              <ul>
                {details.fileStats.map((file: any, index: number) => (
                  <li key={index}>{file.name} ({formatBytes(file.length)})</li>
                ))}
              </ul>
            ) : <p>Loading files...</p>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
