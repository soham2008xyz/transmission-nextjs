import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw/http";
import { server } from "../setup/msw";
import { MAX_RPC_BODY_BYTES, MAX_TORRENT_FILE_BYTES } from "@/lib/limits";

const UPSTREAM = "http://transmission.test:9091";
const RPC_URL = `${UPSTREAM}/transmission/rpc`;

const ENV = {
  TRANSMISSION_RPC_URL: UPSTREAM,
  TRANSMISSION_RPC_USERNAME: "rpc-user",
  TRANSMISSION_RPC_PASSWORD: "rpc-pass",
};

// The route reads its env and keeps the session id at module scope, so each
// test loads a fresh copy.
async function loadRoute(env: Record<string, string | undefined> = ENV) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("@/app/api/transmission/rpc/route");
}

function rpcRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/transmission/rpc", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

interface Seen {
  body: unknown;
  sessionId: string | null;
  authorization: string | null;
}

/** Records upstream requests and answers each with the next responder. */
function upstream(...responders: Array<(seen: Seen) => Response>) {
  const seen: Seen[] = [];
  server.use(
    http.post(RPC_URL, async ({ request }) => {
      const entry = {
        body: await request.json(),
        sessionId: request.headers.get("x-transmission-session-id"),
        authorization: request.headers.get("authorization"),
      };
      seen.push(entry);
      const respond = responders[Math.min(seen.length, responders.length) - 1];
      return respond(entry);
    }),
  );
  return seen;
}

const success = (args: object = {}) => () => HttpResponse.json({ result: "success", arguments: args });
const conflict = (sessionId?: string) => () =>
  new HttpResponse("<h1>409: Conflict</h1>", {
    status: 409,
    headers: sessionId ? { "X-Transmission-Session-Id": sessionId } : {},
  });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("configuration", () => {
  it("answers 500 when TRANSMISSION_RPC_URL is not set", async () => {
    const { POST } = await loadRoute({ ...ENV, TRANSMISSION_RPC_URL: undefined });
    const res = await POST(rpcRequest({ method: "torrent-get" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ result: "server is not configured" });
  });

  it("signs upstream requests with the RPC credentials", async () => {
    const seen = upstream(success());
    const { POST } = await loadRoute();
    await POST(rpcRequest({ method: "torrent-get", arguments: {} }));
    const expected = "Basic " + Buffer.from("rpc-user:rpc-pass").toString("base64");
    expect(seen[0].authorization).toBe(expected);
  });
});

describe("request checks", () => {
  it.each([undefined, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data"])(
    "answers 415 for content type %j",
    async (contentType) => {
      const { POST } = await loadRoute();
      const req = new NextRequest("http://localhost:3000/api/transmission/rpc", {
        method: "POST",
        headers: contentType ? { "content-type": contentType } : {},
        body: JSON.stringify({ method: "torrent-get" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(415);
    },
  );

  it.each(["application/json; charset=utf-8", "Application/JSON"])(
    "accepts content type %j",
    async (contentType) => {
      upstream(success());
      const { POST } = await loadRoute();
      const res = await POST(rpcRequest({ method: "torrent-get" }, { "content-type": contentType }));
      expect(res.status).toBe(200);
    },
  );

  it("answers 400 for a body that is not JSON", async () => {
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ result: "invalid JSON body" });
  });

  it("answers 413 from the declared length without reading the body", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      rpcRequest({ method: "torrent-get" }, { "content-length": String(MAX_RPC_BODY_BYTES + 1) }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).result).toMatch(/limited to 20 MB/);
  });

  it("answers 413 when the body itself is too large", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify({ method: "torrent-get", pad: "x".repeat(MAX_RPC_BODY_BYTES) });
    const res = await POST(rpcRequest(body));
    expect(res.status).toBe(413);
  });

  it("answers 413 when the decoded .torrent is over the cap", async () => {
    const seen = upstream(success());
    const { POST } = await loadRoute();
    // Just over 20 MB once decoded, but under the body limit.
    const metainfo = "A".repeat(Math.ceil((MAX_TORRENT_FILE_BYTES * 4) / 3) + 8);
    const res = await POST(rpcRequest({ method: "torrent-add", arguments: { metainfo } }));
    expect(res.status).toBe(413);
    expect(seen).toHaveLength(0);
  });

  it("forwards a .torrent of exactly the maximum size", async () => {
    const seen = upstream(success({ "torrent-added": { id: 1 } }));
    const { POST } = await loadRoute();
    const metainfo = Buffer.alloc(MAX_TORRENT_FILE_BYTES, 1).toString("base64");
    const res = await POST(rpcRequest({ method: "torrent-add", arguments: { metainfo } }));
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
  });
});

describe("method allowlist", () => {
  it.each([
    ["torrent-get", { ids: [1], fields: ["id"] }],
    ["torrent-start-now", { ids: [1] }],
    ["torrent-stop", { ids: [1] }],
    ["torrent-remove", { ids: [1], "delete-local-data": true }],
    ["torrent-add", { filename: "magnet:?xt=urn:btih:abc" }],
    ["torrent-set", { ids: [1], "files-wanted": [0] }],
    ["free-space", { path: "/downloads" }],
  ])("forwards %s unchanged", async (method, args) => {
    const seen = upstream(success());
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest({ method, arguments: args }));
    expect(res.status).toBe(200);
    expect(seen[0].body).toEqual({ method, arguments: args });
  });

  it.each([
    ["session-set", { method: "session-set", arguments: { "download-dir": "/" } }],
    ["session-get", { method: "session-get" }],
    ["torrent-set-location", { method: "torrent-set-location", arguments: { ids: [1], location: "/" } }],
    ["port-test", { method: "port-test" }],
    ["a missing method", { arguments: {} }],
    ["a non-string method", { method: ["torrent-get"] }],
    ["a JSON array", [{ method: "torrent-get" }]],
    ["JSON null", null],
  ])("rejects %s with 403 and never calls Transmission", async (_label, body) => {
    const seen = upstream(success());
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest(body));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ result: "method not allowed" });
    expect(seen).toHaveLength(0);
  });

  it.each([
    ["torrent-set", { ids: [1], location: "/etc" }],
    ["torrent-set", { ids: [1], "files-wanted": [0], downloadLimit: 1 }],
    ["torrent-add", { filename: "magnet:?xt=urn:btih:abc", cookies: "a=b" }],
    ["torrent-add", { filename: "/etc/passwd.torrent", "peer-limit": 1 }],
  ])("rejects extra %s arguments with 403", async (method, args) => {
    const seen = upstream(success());
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest({ method, arguments: args }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ result: "argument not allowed" });
    expect(seen).toHaveLength(0);
  });

  it.each([
    ["torrent-set", { ids: [1], "files-wanted": [0] }],
    ["torrent-set", { ids: [1], "files-unwanted": [0, 2] }],
    ["torrent-add", { filename: "magnet:?xt=urn:btih:abc", "download-dir": "/data", paused: true }],
  ])("allows the UI's %s arguments", async (method, args) => {
    upstream(success());
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest({ method, arguments: args }));
    expect(res.status).toBe(200);
  });
});

describe("session handshake", () => {
  it("retries a 409 with the new session id and keeps using it", async () => {
    const seen = upstream(conflict("session-1"), success({ torrents: [] }));
    const { POST } = await loadRoute();

    const first = await POST(rpcRequest({ method: "torrent-get" }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ result: "success", arguments: { torrents: [] } });
    expect(seen.map((s) => s.sessionId)).toEqual([null, "session-1"]);

    await POST(rpcRequest({ method: "torrent-get" }));
    expect(seen).toHaveLength(3);
    expect(seen[2].sessionId).toBe("session-1");
  });

  it("does not loop when Transmission answers 409 twice", async () => {
    const seen = upstream(conflict("session-1"), conflict("session-2"), success());
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest({ method: "torrent-get" }));
    expect(res.status).toBe(409);
    expect(seen).toHaveLength(2);
  });

  it("does not retry a 409 without a session id header", async () => {
    const seen = upstream(conflict(), success());
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest({ method: "torrent-get" }));
    expect(res.status).toBe(409);
    expect(seen).toHaveLength(1);
  });
});

describe("upstream failures", () => {
  it("passes Transmission's status through with a generic message", async () => {
    upstream(
      () => new HttpResponse("<h1>401: Unauthorized</h1> internal-host.lan", { status: 401 }),
    );
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest({ method: "torrent-get" }));
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ result: "Transmission returned an error" });
    expect(text).not.toContain("internal-host");
  });

  it("answers 502 when Transmission cannot be reached", async () => {
    server.use(http.post(RPC_URL, () => HttpResponse.error()));
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest({ method: "torrent-get" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ result: "Transmission is unreachable" });
  });

  it("returns Transmission's own error results unchanged", async () => {
    upstream(() => HttpResponse.json({ result: "No such file or directory", arguments: {} }));
    const { POST } = await loadRoute();
    const res = await POST(rpcRequest({ method: "free-space", arguments: { path: "/nope" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "No such file or directory", arguments: {} });
  });
});
