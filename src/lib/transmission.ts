import axios from "axios";

const client = axios.create({
  baseURL: "/api/transmission/rpc"
});

export const getTorrents = async () => {
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
};

export const getTorrentDetails = async (id: number) => {
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
        "fileStats"
      ]
    }
  });
  return data.arguments.torrents[0];
};

export const startTorrent = async (id: number) => {
  await client.post("", {
    method: "torrent-start-now",
    arguments: {
      ids: [id]
    }
  });
};

export const stopTorrent = async (id: number) => {
  await client.post("", {
    method: "torrent-stop",
    arguments: {
      ids: [id]
    }
  });
};

export const removeTorrent = async (id: number, deleteLocalData = false) => {
  await client.post("", {
    method: "torrent-remove",
    arguments: {
      "ids": [id],
      "delete-local-data": deleteLocalData
    }
  });
};

export const getFreeSpace = async (
  path: string
): Promise<{ free: number; total: number }> => {
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
};
