/* eslint-disable @typescript-eslint/no-explicit-any -- axios errors and RPC payloads are untyped here */
import axios from "axios";

const client = axios.create({
  baseURL: "/api/transmission/rpc",
  // A hung request must fail so the chained poll can retry.
  timeout: 15000,
});

export class RpcError extends Error {
  /** True when Transmission (or this app's server) could not be reached. */
  unreachable: boolean;

  constructor(message: string, unreachable = false) {
    super(message);
    this.name = "RpcError";
    this.unreachable = unreachable;
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
  let data: RpcResponse<T>;
  try {
    ({ data } = await client.post<RpcResponse<T>>("", {
      method,
      arguments: args,
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (!error.response || status === 502 || status === 503 || status === 504) {
        throw new RpcError("Could not connect to Transmission.", true);
      }
      const reason = error.response.data?.result;
      throw new RpcError(
        typeof reason === "string" ? reason : `Request failed (${status})`,
      );
    }
    throw error;
  }
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
  const data = await rpc("torrent-get", {
    fields: [
      "id",
      "name",
      "totalSize",
      "percentDone",
      "rateDownload",
      "rateUpload",
      "status",
      "error",
      "errorString",
    ],
  });
  return data.torrents;
};

export const getTorrentDetails = async (id: number) => {
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
};

// The three actions below take one id or an array, and send one RPC call.
export const startTorrent = async (ids: number | number[]) => {
  await rpc("torrent-start-now", {
    ids: [ids].flat(),
  });
};

export const stopTorrent = async (ids: number | number[]) => {
  await rpc("torrent-stop", {
    ids: [ids].flat(),
  });
};

export const removeTorrent = async (
  ids: number | number[],
  deleteLocalData = false,
) => {
  await rpc("torrent-remove", {
    ids: [ids].flat(),
    "delete-local-data": deleteLocalData,
  });
};

export const getFreeSpace = async (
  path: string,
): Promise<{ free: number; total: number }> => {
  const data = await rpc("free-space", {
    path,
  });
  // Transmission returns 'size-bytes' (free) and 'total-size-bytes' (total)
  return {
    free: data["size-bytes"],
    total: data["total-size-bytes"] ?? data["size-bytes"], // fallback if not present
  };
};

export const addTorrentByMagnet = async (
  magnet: string,
  destination?: string,
) => {
  const data = await rpc("torrent-add", {
    filename: magnet,
    ...(destination ? { "download-dir": destination } : {}),
  });
  assertNotDuplicate(data);
};

export const addTorrentByFile = async (file: File, destination?: string) => {
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
};

export const setFileWantedState = async (
  torrentId: number,
  fileIndices: number[],
  wanted: boolean,
) => {
  await rpc("torrent-set", {
    ids: [torrentId],
    ...(wanted
      ? { "files-wanted": fileIndices }
      : { "files-unwanted": fileIndices }),
  });
};
