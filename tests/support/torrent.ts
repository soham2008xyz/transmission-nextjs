import { createHash, randomBytes } from "node:crypto";

type Bencodable = number | string | Buffer | Bencodable[] | { [key: string]: Bencodable };

/** Minimal bencode encoder, enough to build .torrent files. */
export function bencode(value: Bencodable): Buffer {
  if (typeof value === "number") return Buffer.from(`i${Math.trunc(value)}e`);
  if (typeof value === "string") value = Buffer.from(value);
  if (Buffer.isBuffer(value)) {
    return Buffer.concat([Buffer.from(`${value.length}:`), value]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([Buffer.from("l"), ...value.map(bencode), Buffer.from("e")]);
  }
  // Keys must be sorted as raw byte strings.
  const keys = Object.keys(value).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return Buffer.concat([
    Buffer.from("d"),
    ...keys.flatMap((k) => [bencode(k), bencode(value[k])]),
    Buffer.from("e"),
  ]);
}

export interface PayloadFile {
  /** Path inside the torrent, such as "sub/file.bin". */
  path: string;
  content: Buffer;
}

export interface BuiltTorrent {
  name: string;
  /** The bencoded .torrent file. */
  torrent: Buffer;
  /** Lowercase hex SHA-1 of the info dictionary, as Transmission reports it. */
  infoHash: string;
  files: PayloadFile[];
}

const PIECE_LENGTH = 16 * 1024;

// BitTorrent v1 defines piece hashes and the info-hash as SHA-1. The file
// format requires it; it protects nothing here.
const sha1 = (data: Buffer) => createHash("sha1").update(data).digest(); // NOSONAR

/**
 * Builds a trackerless .torrent for the given payload. One file makes a
 * single-file torrent; more make a multi-file torrent rooted at `name`.
 */
export function makeTorrent(name: string, files: PayloadFile[]): BuiltTorrent {
  const all = Buffer.concat(files.map((f) => f.content));
  const pieces: Buffer[] = [];
  for (let i = 0; i < all.length; i += PIECE_LENGTH) {
    pieces.push(sha1(all.subarray(i, i + PIECE_LENGTH)));
  }
  const info: Record<string, Bencodable> = {
    name,
    "piece length": PIECE_LENGTH,
    pieces: Buffer.concat(pieces),
  };
  if (files.length === 1 && !files[0].path.includes("/")) {
    info.length = files[0].content.length;
  } else {
    info.files = files.map((f) => ({ length: f.content.length, path: f.path.split("/") }));
  }
  return {
    name,
    torrent: bencode({ "created by": "transmission-nextjs tests", info }),
    infoHash: sha1(bencode(info)).toString("hex"),
    files,
  };
}

/**
 * Builds a .torrent of roughly `bytes` bytes. The piece hashes are random, so
 * Transmission accepts it but never verifies it; use it to test upload size.
 */
export function makeOversizedTorrent(name: string, bytes: number): BuiltTorrent {
  const pieceCount = Math.ceil(bytes / 20);
  const info = {
    name,
    "piece length": PIECE_LENGTH,
    pieces: randomBytes(pieceCount * 20),
    length: pieceCount * PIECE_LENGTH,
  };
  return {
    name,
    torrent: bencode({ info }),
    infoHash: sha1(bencode(info)).toString("hex"),
    files: [],
  };
}

/** A unique name, so tests sharing one daemon never collide. */
export function uniqueName(prefix: string) {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

/** A magnet link for a random info hash. It never finds peers, which is fine. */
export function randomMagnet(name: string) {
  const hash = randomBytes(20).toString("hex");
  return { hash, magnet: `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}` };
}
