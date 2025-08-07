import axios from "axios";

const client = axios.create({
  baseURL: "/api/transmission/rpc"
});

export const addTorrentByMagnet = async (
  magnet: string,
  destination?: string
) => {
  await client.post("", {
    method: "torrent-add",
    arguments: {
      filename: magnet,
      ...(destination ? { "download-dir": destination } : {})
    }
  });
};

export const addTorrentByFile = async (file: File, destination?: string) => {
  const formData = new FormData();
  formData.append("file", file);
  if (destination) formData.append("download-dir", destination);
  await client.post("/upload", formData);
};
