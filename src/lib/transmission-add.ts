import axios from "axios";

const client = axios.create({
  baseURL: "/api/transmission/rpc"
});

export const addTorrentByMagnet = async (magnet: string) => {
  await client.post("", {
    method: "torrent-add",
    arguments: {
      filename: magnet
    }
  });
};

export const addTorrentByFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  await client.post("/upload", formData);
};
