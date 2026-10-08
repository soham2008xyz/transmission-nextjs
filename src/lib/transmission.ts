/* eslint-disable @typescript-eslint/no-explicit-any -- axios errors and RPC payloads are untyped here */
import axios from "axios";
import { toast } from "sonner";

const client = axios.create({
  baseURL: "/api/transmission/rpc",
});

export class RpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RpcError";
  }
}

interface RpcResponse<T> {
  result: string;
  arguments: T;
}

/**
 * Sends one RPC call and returns its `arguments`.
 * Transmission reports most failures as HTTP 200 with a non-"success"
 * `result`, so this throws an RpcError in that case.
 */
export const rpc = async <T = any>(
  method: string,
  args: Record<string, unknown> = {},
): Promise<T> => {
  const { data } = await client.post<RpcResponse<T>>("", {
    method,
    arguments: args,
  });
  if (data?.result !== "success") {
    throw new RpcError(data?.result || "Unexpected RPC response");
  }
  return data.arguments;
};

// torrent-add reports a duplicate as a successful call
const assertNotDuplicate = (data: any) => {
  if (data?.["torrent-duplicate"]) {
    throw new RpcError("Torrent already exists");
  }
};

export const getTorrents = async () => {
  try {
    const data = await rpc("torrent-get", {
      fields: [
        "id",
        "name",
        "totalSize",
        "percentDone",
        "rateDownload",
        "rateUpload",
        "status",
      ],
    });
    return data.torrents;
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};

export const getTorrentDetails = async (id: number) => {
  try {
    const data = await rpc("torrent-get", {
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
        "trackerStats",
      ],
    });
    return data.torrents[0];
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};

export const startTorrent = async (id: number) => {
  try {
    await rpc("torrent-start-now", {
      ids: [id],
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};

export const stopTorrent = async (id: number) => {
  try {
    await rpc("torrent-stop", {
      ids: [id],
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};

export const removeTorrent = async (id: number, deleteLocalData = false) => {
  try {
    await rpc("torrent-remove", {
      ids: [id],
      "delete-local-data": deleteLocalData,
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};

export const getFreeSpace = async (
  path: string,
): Promise<{ free: number; total: number }> => {
  try {
    const data = await rpc("free-space", {
      path,
    });
    // Transmission returns 'size-bytes' (free) and 'total-size-bytes' (total)
    return {
      free: data["size-bytes"],
      total: data["total-size-bytes"] ?? data["size-bytes"], // fallback if not present
    };
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};

export const addTorrentByMagnet = async (
  magnet: string,
  destination?: string,
) => {
  try {
    const data = await rpc("torrent-add", {
      filename: magnet,
      ...(destination ? { "download-dir": destination } : {}),
    });
    assertNotDuplicate(data);
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};

export const addTorrentByFile = async (file: File, destination?: string) => {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const data = await rpc("torrent-add", {
      metainfo: btoa(binary),
      ...(destination ? { "download-dir": destination } : {}),
    });
    assertNotDuplicate(data);
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};

export const setFileWantedState = async (
  torrentId: number,
  fileIndices: number[],
  wanted: boolean,
) => {
  try {
    await rpc("torrent-set", {
      ids: [torrentId],
      ...(wanted
        ? { "files-wanted": fileIndices }
        : { "files-unwanted": fileIndices }),
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Network Error") ||
      error?.code === "ECONNREFUSED"
    ) {
      toast("Connection Error: Could not connect to Transmission RPC.");
    }
    throw error;
  }
};
