import axios from "axios";
import { toast } from "@/lib/useToast";

const client = axios.create({
  baseURL: "/api/transmission/rpc"
});

export const getTorrents = async () => {
  try {
    const { data } = await client.post("", {
      method: "torrent-get",
      arguments: {
        fields: [
          "id",
          "name",
          "totalSize",
          "percentDone",
          "rateDownload",
          "rateUpload",
          "status"
        ]
      }
    });
    return data.arguments.torrents;
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};

export const getTorrentDetails = async (id: number) => {
  try {
    const { data } = await client.post("", {
      method: "torrent-get",
      arguments: {
        ids: [id],
        fields: [
          "id",
          "name",
          "totalSize",
          "percentDone",
          "rateDownload",
          "rateUpload",
          "status",
          "peers",
          "pieces",
          "fileStats",
          "files",
          "addedDate",
          "activityDate",
          "doneDate",
          "eta",
          "uploadRatio",
          "uploadedEver",
          "downloadedEver",
          "errorString",
          "creator",
          "comment",
          "hashString",
          "downloadDir",
          "isPrivate",
          "pieceCount",
          "pieceSize",
          "trackerStats"
        ]
      }
    });
    return data.arguments.torrents[0];
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};

export const startTorrent = async (id: number) => {
  try {
    await client.post("", {
      method: "torrent-start-now",
      arguments: {
        ids: [id]
      }
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};

export const stopTorrent = async (id: number) => {
  try {
    await client.post("", {
      method: "torrent-stop",
      arguments: {
        ids: [id]
      }
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};

export const removeTorrent = async (id: number, deleteLocalData = false) => {
  try {
    await client.post("", {
      method: "torrent-remove",
      arguments: {
        "ids": [id],
        "delete-local-data": deleteLocalData
      }
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};

export const getFreeSpace = async (
  path: string
): Promise<{ free: number; total: number }> => {
  try {
    const { data } = await client.post("", {
      method: "free-space",
      arguments: {
        path
      }
    });
    // Transmission returns 'size-bytes' (free) and 'total-size-bytes' (total)
    return {
      free: data.arguments["size-bytes"],
      total: data.arguments["total-size-bytes"] ?? data.arguments["size-bytes"] // fallback if not present
    };
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};

export const addTorrentByMagnet = async (
  magnet: string,
  destination?: string
) => {
  try {
    await client.post("", {
      method: "torrent-add",
      arguments: {
        filename: magnet,
        ...(destination ? { "download-dir": destination } : {})
      }
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};

export const addTorrentByFile = async (file: File, destination?: string) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (destination) formData.append("download-dir", destination);
    await client.post("/upload", formData);
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};

export const setFileWantedState = async (
  torrentId: number,
  fileIndices: number[],
  wanted: boolean
) => {
  try {
    await client.post("", {
      method: "torrent-set",
      arguments: {
        ids: [torrentId],
        ...(wanted
          ? { "files-wanted": fileIndices }
          : { "files-unwanted": fileIndices })
      }
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast({
        title: "Connection Error",
        description: "Could not connect to Transmission RPC.",
        variant: "destructive"
      });
    }
    throw error;
  }
};
