import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/msw";
import {
  RpcError,
  addTorrentByFile,
  addTorrentByMagnet,
  getFreeSpace,
  getTorrentDetails,
  getTorrents,
  removeTorrent,
  rpc,
  setFileWantedState,
  startTorrent,
  stopTorrent,
} from "@/lib/transmission";

const ENDPOINT = "*/api/transmission/rpc";

interface RpcBody {
  method: string;
  arguments: Record<string, unknown>;
}

/** Answers every RPC with `respond` and records what the client sent. */
function mockRpc(respond: (body: RpcBody) => Response = () => ok()) {
  const calls: RpcBody[] = [];
  server.use(
    http.post(ENDPOINT, async ({ request }) => {
      const body = (await request.json()) as RpcBody;
      calls.push(body);
      return respond(body);
    }),
  );
  return calls;
}

const ok = (args: object = {}) => HttpResponse.json({ result: "success", arguments: args });

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  const error = await promise.then(
    () => {
      throw new Error("expected the call to fail");
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(RpcError);
  return error as RpcError;
}

describe("rpc", () => {
  it("posts the method and arguments and returns the arguments", async () => {
    const calls = mockRpc(() => ok({ answer: 42 }));
    await expect(rpc("torrent-get", { ids: [1] })).resolves.toEqual({ answer: 42 });
    expect(calls).toEqual([{ method: "torrent-get", arguments: { ids: [1] } }]);
  });

  it("sends empty arguments by default", async () => {
    const calls = mockRpc();
    await rpc("torrent-get");
    expect(calls[0].arguments).toEqual({});
  });

  it("throws Transmission's result when it is not success", async () => {
    mockRpc(() => HttpResponse.json({ result: "invalid or corrupt torrent file", arguments: {} }));
    const error = await rejection(rpc("torrent-add"));
    expect(error.message).toBe("invalid or corrupt torrent file");
    expect(error.unreachable).toBe(false);
  });

  it("throws a generic message for a response without a result", async () => {
    mockRpc(() => HttpResponse.json({}));
    expect((await rejection(rpc("torrent-get"))).message).toBe("Unexpected RPC response");
  });

  it.each([502, 503, 504])("marks HTTP %d as unreachable", async (status) => {
    mockRpc(() => HttpResponse.json({ result: "Transmission is unreachable" }, { status }));
    const error = await rejection(rpc("torrent-get"));
    expect(error.unreachable).toBe(true);
    expect(error.message).toBe("Could not connect to Transmission.");
  });

  it("marks a network failure as unreachable", async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.error()));
    expect((await rejection(rpc("torrent-get"))).unreachable).toBe(true);
  });

  it("uses the server's result as the message for other HTTP errors", async () => {
    mockRpc(() => HttpResponse.json({ result: "method not allowed" }, { status: 403 }));
    const error = await rejection(rpc("session-set"));
    expect(error.message).toBe("method not allowed");
    expect(error.unreachable).toBe(false);
  });

  it("falls back to the status code when the error body has no result", async () => {
    mockRpc(() => new HttpResponse("Authentication required", { status: 401 }));
    expect((await rejection(rpc("torrent-get"))).message).toBe("Request failed (401)");
  });
});

describe("torrent actions", () => {
  it("getTorrents asks for the list columns and returns the torrents", async () => {
    const torrents = [{ id: 1, name: "a" }];
    const calls = mockRpc(() => ok({ torrents }));
    await expect(getTorrents()).resolves.toEqual(torrents);
    expect(calls[0].method).toBe("torrent-get");
    expect(calls[0].arguments.ids).toBeUndefined();
    expect(calls[0].arguments.fields).toEqual(
      expect.arrayContaining(["id", "name", "status", "percentDone", "error", "errorString"]),
    );
  });

  it("getTorrentDetails asks for one torrent and returns it", async () => {
    const calls = mockRpc(() => ok({ torrents: [{ id: 7, name: "x" }] }));
    await expect(getTorrentDetails(7)).resolves.toEqual({ id: 7, name: "x" });
    expect(calls[0].arguments.ids).toEqual([7]);
    expect(calls[0].arguments.fields).toEqual(
      expect.arrayContaining(["files", "fileStats", "peers", "pieces", "pieceCount", "hashString"]),
    );
  });

  it.each([
    ["startTorrent", startTorrent, "torrent-start-now"],
    ["stopTorrent", stopTorrent, "torrent-stop"],
  ] as const)("%s takes one id or many", async (_name, action, method) => {
    const calls = mockRpc();
    await action(3);
    await action([4, 5]);
    expect(calls).toEqual([
      { method, arguments: { ids: [3] } },
      { method, arguments: { ids: [4, 5] } },
    ]);
  });

  it("removeTorrent keeps data unless asked to delete it", async () => {
    const calls = mockRpc();
    await removeTorrent(1);
    await removeTorrent([2, 3], true);
    expect(calls.map((c) => c.arguments)).toEqual([
      { ids: [1], "delete-local-data": false },
      { ids: [2, 3], "delete-local-data": true },
    ]);
  });

  it.each([
    [true, { ids: [9], "files-wanted": [0, 2] }],
    [false, { ids: [9], "files-unwanted": [0, 2] }],
  ])("setFileWantedState(wanted=%s) sends the matching key", async (wanted, expected) => {
    const calls = mockRpc();
    await setFileWantedState(9, [0, 2], wanted);
    expect(calls[0]).toEqual({ method: "torrent-set", arguments: expected });
  });
});

describe("getFreeSpace", () => {
  it("reads Transmission 4's size-bytes and total_size", async () => {
    const calls = mockRpc(() => ok({ path: "/d", "size-bytes": 100, total_size: 400 }));
    await expect(getFreeSpace("/d")).resolves.toEqual({ free: 100, total: 400 });
    expect(calls[0]).toEqual({ method: "free-space", arguments: { path: "/d" } });
  });

  it("falls back to total-size-bytes", async () => {
    mockRpc(() => ok({ "size-bytes": 100, "total-size-bytes": 500 }));
    await expect(getFreeSpace("/d")).resolves.toEqual({ free: 100, total: 500 });
  });

  it("leaves total unset when the daemon does not report it", async () => {
    mockRpc(() => ok({ "size-bytes": 100 }));
    await expect(getFreeSpace("/d")).resolves.toEqual({ free: 100, total: undefined });
  });
});

describe("adding torrents", () => {
  it("adds a magnet link, with a destination only when one is set", async () => {
    const calls = mockRpc(() => ok({ "torrent-added": { id: 1 } }));
    await addTorrentByMagnet("magnet:?xt=urn:btih:abc");
    await addTorrentByMagnet("magnet:?xt=urn:btih:abc", "/data");
    expect(calls.map((c) => c.arguments)).toEqual([
      { filename: "magnet:?xt=urn:btih:abc" },
      { filename: "magnet:?xt=urn:btih:abc", "download-dir": "/data" },
    ]);
  });

  it("reports a duplicate magnet as an error", async () => {
    mockRpc(() => ok({ "torrent-duplicate": { id: 1 } }));
    const error = await rejection(addTorrentByMagnet("magnet:?xt=urn:btih:abc"));
    expect(error.message).toBe("Torrent already exists");
  });

  it("sends a file as base64 that round-trips byte for byte", async () => {
    // Larger than the 32 KB chunk the encoder uses, and covering every byte value.
    const bytes = new Uint8Array(100_003);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) % 256;
    const calls = mockRpc(() => ok({ "torrent-added": { id: 1 } }));

    await addTorrentByFile(new File([bytes], "big.torrent"), "/data");

    const { metainfo, ...rest } = calls[0].arguments;
    expect(rest).toEqual({ "download-dir": "/data" });
    expect(new Uint8Array(Buffer.from(metainfo as string, "base64"))).toEqual(bytes);
  });

  it("omits the destination for a file when none is set", async () => {
    const calls = mockRpc(() => ok({ "torrent-added": { id: 1 } }));
    await addTorrentByFile(new File([new Uint8Array([1, 2, 3])], "a.torrent"));
    expect(calls[0].arguments).toEqual({ metainfo: "AQID" });
  });

  it("reports a duplicate file as an error", async () => {
    mockRpc(() => ok({ "torrent-duplicate": { id: 1 } }));
    const error = await rejection(addTorrentByFile(new File(["x"], "a.torrent")));
    expect(error.message).toBe("Torrent already exists");
  });
});
