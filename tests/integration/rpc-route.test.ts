import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CONTAINER_DOWNLOAD_DIR, createDaemonClient, seedPayload, waitFor } from "../support/daemon";
import { makeTorrent, randomMagnet, uniqueName, type PayloadFile } from "../support/torrent";

// The real route handler, talking to a real Transmission daemon in Docker.

const daemon = inject("daemon");
const direct = createDaemonClient(daemon);

type Env = Record<string, string | undefined>;

const routeEnv: Env = {
  TRANSMISSION_RPC_URL: daemon.url,
  TRANSMISSION_RPC_USERNAME: daemon.username,
  TRANSMISSION_RPC_PASSWORD: daemon.password,
};

// A fresh module has no session id yet, so its first call does the 409 handshake.
async function loadRoute(env: Env = routeEnv) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { POST } = await import("@/app/api/transmission/rpc/route");
  return async (method: string, args?: Record<string, unknown>) => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/transmission/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args ? { method, arguments: args } : { method }),
      }),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC payloads are untyped
    return { status: res.status, body: (await res.json()) as any };
  };
}

let rpc: Awaited<ReturnType<typeof loadRoute>>;

beforeAll(async () => {
  rpc = await loadRoute();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function payload(...files: Array<[string, number]>): PayloadFile[] {
  return files.map(([p, size], i) => ({
    path: p,
    content: Buffer.from(Array.from({ length: size }, (_, j) => (i * 7 + j * 13) % 256)),
  }));
}

/** Adds a seeded torrent through the route and waits for the daemon to verify it. */
async function addSeeded(files: PayloadFile[], prefix = "seeded") {
  const built = makeTorrent(uniqueName(prefix), files);
  seedPayload(daemon.downloadDir, built.name, files);
  const added = await rpc("torrent-add", {
    metainfo: built.torrent.toString("base64"),
    "download-dir": CONTAINER_DOWNLOAD_DIR,
  });
  expect(added.status).toBe(200);
  expect(added.body.result).toBe("success");
  const id: number = added.body.arguments["torrent-added"].id;
  await waitFor(
    async () => (await direct.getTorrent(built.infoHash, ["percentDone"]))?.percentDone === 1,
    { message: `${built.name} to verify` },
  );
  return { ...built, id };
}

describe("RPC route against Transmission", () => {
  it("completes the session handshake on a fresh module", async () => {
    const fresh = await loadRoute();
    const res = await fresh("torrent-get", { fields: ["id"] });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("success");
    expect(Array.isArray(res.body.arguments.torrents)).toBe(true);
  });

  it("answers 401 with a generic message when the RPC password is wrong", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const wrong = await loadRoute({ ...routeEnv, TRANSMISSION_RPC_PASSWORD: "nope" });
    const res = await wrong("torrent-get", { fields: ["id"] });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ result: "Transmission returned an error" });
  });

  it("answers 502 when nothing is listening", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = await loadRoute({ ...routeEnv, TRANSMISSION_RPC_URL: "http://127.0.0.1:1" });
    const res = await down("torrent-get", { fields: ["id"] });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ result: "Transmission is unreachable" });
  });

  it("reports free space in the shape the UI reads", async () => {
    const res = await rpc("free-space", { path: CONTAINER_DOWNLOAD_DIR });
    expect(res.body.result).toBe("success");
    expect(res.body.arguments["size-bytes"]).toBeGreaterThan(0);
    // getFreeSpace reads total_size, falling back to total-size-bytes.
    const total = res.body.arguments.total_size ?? res.body.arguments["total-size-bytes"];
    expect(total).toBeGreaterThanOrEqual(res.body.arguments["size-bytes"]);
  });

  it("passes Transmission's error result through for a missing path", async () => {
    const res = await rpc("free-space", { path: "/does/not/exist" });
    expect(res.status).toBe(200);
    expect(res.body.result).not.toBe("success");
  });

  it("refuses a disallowed method before it reaches Transmission", async () => {
    const before = await direct.call("session-get", { fields: ["download-dir"] });
    const res = await rpc("session-set", { "download-dir": "/tmp/hijacked" });
    expect(res.status).toBe(403);
    const after = await direct.call("session-get", { fields: ["download-dir"] });
    expect(after["download-dir"]).toBe(before["download-dir"]);
  });

  it("refuses torrent-set arguments the UI does not use", async () => {
    const { infoHash, id } = await addSeeded(payload(["solo.bin", 20_000]), "limits");
    const res = await rpc("torrent-set", { ids: [id], downloadLimited: true, downloadLimit: 1 });
    expect(res.status).toBe(403);
    expect((await direct.getTorrent(infoHash, ["downloadLimited"])).downloadLimited).toBe(false);
  });

  describe("magnet links", () => {
    it("adds a magnet and reports a second add as a duplicate", async () => {
      const name = uniqueName("magnet");
      const { hash, magnet } = randomMagnet(name);

      const first = await rpc("torrent-add", { filename: magnet, paused: true });
      expect(first.body.result).toBe("success");
      expect(first.body.arguments["torrent-added"]).toMatchObject({ hashString: hash, name });

      const second = await rpc("torrent-add", { filename: magnet });
      expect(second.body.result).toBe("success");
      expect(second.body.arguments["torrent-duplicate"]).toMatchObject({ hashString: hash });

      await rpc("torrent-remove", { ids: [first.body.arguments["torrent-added"].id] });
    });

    it("honours a custom download directory", async () => {
      const { hash, magnet } = randomMagnet(uniqueName("magnet-dir"));
      const res = await rpc("torrent-add", { filename: magnet, "download-dir": "/downloads/custom", paused: true });
      const torrent = await direct.getTorrent(hash, ["downloadDir", "status"]);
      expect(torrent).toMatchObject({ downloadDir: "/downloads/custom", status: 0 });
      await rpc("torrent-remove", { ids: [res.body.arguments["torrent-added"].id] });
    });
  });

  describe("a seeded .torrent file", () => {
    it("verifies, then stops, starts and is removed with its data", async () => {
      const files = payload(["disk.img", 50_000]);
      const { id, name, infoHash } = await addSeeded(files);
      const onDisk = path.join(daemon.downloadDir, name);
      expect(existsSync(onDisk)).toBe(true);

      // The list query the UI makes sees it.
      const list = await rpc("torrent-get", { fields: ["id", "name", "totalSize", "percentDone", "status"] });
      expect(list.body.arguments.torrents).toContainEqual(
        expect.objectContaining({ id, name, totalSize: 50_000, percentDone: 1 }),
      );

      expect((await rpc("torrent-stop", { ids: [id] })).body.result).toBe("success");
      await waitFor(async () => (await direct.getTorrent(infoHash, ["status"])).status === 0, {
        message: "torrent to stop",
      });

      expect((await rpc("torrent-start-now", { ids: [id] })).body.result).toBe("success");
      await waitFor(async () => (await direct.getTorrent(infoHash, ["status"])).status === 6, {
        message: "torrent to seed",
      });

      expect((await rpc("torrent-remove", { ids: [id], "delete-local-data": true })).body.result).toBe("success");
      await waitFor(async () => !(await direct.getTorrent(infoHash, ["id"])), { message: "torrent to go" });
      await waitFor(async () => !existsSync(onDisk), { message: "data to be deleted" });
    });

    it("removes a torrent but keeps its data when asked to", async () => {
      const { id, name, infoHash } = await addSeeded(payload(["keep.bin", 30_000]), "keep");
      await rpc("torrent-remove", { ids: [id], "delete-local-data": false });
      await waitFor(async () => !(await direct.getTorrent(infoHash, ["id"])), { message: "torrent to go" });
      expect(existsSync(path.join(daemon.downloadDir, name))).toBe(true);
    });

    it("reports a duplicate .torrent file", async () => {
      const files = payload(["dup.bin", 10_000]);
      const { torrent, id } = await addSeeded(files, "dup");
      const again = await rpc("torrent-add", { metainfo: torrent.toString("base64") });
      expect(again.body.arguments["torrent-duplicate"]).toMatchObject({ id });
    });

    it("rejects a file that is not a torrent", async () => {
      const res = await rpc("torrent-add", { metainfo: Buffer.from("not a torrent").toString("base64") });
      expect(res.status).toBe(200);
      expect(res.body.result).not.toBe("success");
    });

    it("acts on several torrents in one call", async () => {
      const a = await addSeeded(payload(["a.bin", 5_000]), "bulk");
      const b = await addSeeded(payload(["b.bin", 6_000]), "bulk");
      await rpc("torrent-stop", { ids: [a.id, b.id] });
      await waitFor(
        async () => {
          const { torrents } = await direct.call("torrent-get", { ids: [a.infoHash, b.infoHash], fields: ["status"] });
          return torrents.every((t: { status: number }) => t.status === 0);
        },
        { message: "both to stop" },
      );
      await rpc("torrent-remove", { ids: [a.id, b.id], "delete-local-data": true });
    });
  });

  describe("file selection and details", () => {
    it("returns every details field the dialog reads", async () => {
      const files = payload(["album/01.flac", 40_000], ["album/02.flac", 20_000], ["album/cover.jpg", 3_000]);
      const { id, name, infoHash } = await addSeeded(files, "album");

      const details = await rpc("torrent-get", {
        ids: [id],
        fields: [
          "id", "name", "totalSize", "percentDone", "status", "peers", "pieces", "fileStats", "files",
          "addedDate", "eta", "uploadRatio", "hashString", "downloadDir", "isPrivate", "pieceCount",
          "pieceSize", "trackerStats", "creator",
        ],
      });
      const t = details.body.arguments.torrents[0];
      expect(t).toMatchObject({
        id,
        name,
        hashString: infoHash,
        totalSize: 63_000,
        downloadDir: CONTAINER_DOWNLOAD_DIR,
        isPrivate: false,
        pieceSize: 16 * 1024,
        pieceCount: 4,
        creator: "transmission-nextjs tests",
        peers: [],
        trackerStats: [],
      });
      expect(t.files.map((f: { name: string }) => f.name)).toEqual([
        `${name}/album/01.flac`,
        `${name}/album/02.flac`,
        `${name}/album/cover.jpg`,
      ]);
      expect(t.fileStats.every((s: { wanted: boolean }) => s.wanted)).toBe(true);
      // All four pieces present: the first nibble of the bitfield is set.
      expect(Buffer.from(t.pieces, "base64")[0] & 0xf0).toBe(0xf0);
    });

    it("toggles files by index", async () => {
      const files = payload(["show/e01.mkv", 10_000], ["show/e02.mkv", 10_000], ["show/e03.mkv", 10_000]);
      const { id, infoHash } = await addSeeded(files, "show");

      expect((await rpc("torrent-set", { ids: [id], "files-unwanted": [0, 2] })).body.result).toBe("success");
      let stats = (await direct.getTorrent(infoHash, ["fileStats"])).fileStats;
      expect(stats.map((s: { wanted: boolean }) => s.wanted)).toEqual([false, true, false]);

      await rpc("torrent-set", { ids: [id], "files-wanted": [2] });
      stats = (await direct.getTorrent(infoHash, ["fileStats"])).fileStats;
      expect(stats.map((s: { wanted: boolean }) => s.wanted)).toEqual([false, true, true]);
    });
  });
});
