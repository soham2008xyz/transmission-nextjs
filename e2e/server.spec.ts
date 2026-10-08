import { expect, test } from "@playwright/test";
import { createDaemonClient, waitFor } from "../tests/support/daemon";
import { makeOversizedTorrent, uniqueName } from "../tests/support/torrent";
import { APP_PASSWORD, APP_USERNAME, BASE_URL, LOOPBACK_URL, daemonInfo } from "./env";

// HTTP-level checks against `next start`: the proxy, the RPC route, and the
// Next.js body limits that only show up in a real server.

const RPC = "/api/transmission/rpc";
const basic = (user: string, pass: string) =>
  "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

test.describe("basic auth", () => {
  // Plain fetch, because Playwright adds the config's credentials to its own
  // request contexts.
  const torrentGet = { method: "torrent-get", arguments: { fields: ["id"] } };
  const send = (target: string, init: { authorization?: string; post?: boolean } = {}) =>
    fetch(BASE_URL + target, {
      method: init.post ? "POST" : "GET",
      headers: {
        ...(init.authorization ? { Authorization: init.authorization } : {}),
        ...(init.post ? { "Content-Type": "application/json" } : {}),
      },
      body: init.post ? JSON.stringify(torrentGet) : undefined,
    });

  for (const target of ["/", RPC]) {
    test(`challenges an anonymous request to ${target}`, async () => {
      const res = await send(target, { post: target === RPC });
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toContain("Basic");
    });
  }

  test("rejects wrong credentials", async () => {
    const res = await send("/", { authorization: basic(APP_USERNAME, "wrong") });
    expect(res.status).toBe(401);
  });

  test("serves the app with the right credentials", async () => {
    const res = await send("/", { authorization: basic(APP_USERNAME, APP_PASSWORD) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Transmission");
  });

  test("blocks a cross-origin POST even with valid credentials", async ({ request }) => {
    const res = await request.post(RPC, { headers: { Origin: "https://evil.example" }, data: torrentGet });
    expect(res.status()).toBe(403);
  });

  test("allows a same-origin POST", async ({ request }) => {
    const res = await request.post(RPC, { headers: { Origin: BASE_URL }, data: torrentGet });
    expect(res.status()).toBe(200);
  });

  // Known bug (#48): proxy.ts compares Origin with req.nextUrl.origin, which `next
  // start` reports as http://localhost:<port> whatever the Host header says.
  // With auth on, a browser that reaches the app by IP or hostname gets 403 on
  // every POST, so the UI cannot even list torrents. Remove test.fail() once
  // the check uses the request's real host.
  test("allows a same-origin POST when the app is reached by IP", async () => {
    test.fail();
    const res = await fetch(LOOPBACK_URL + RPC, {
      method: "POST",
      headers: {
        Authorization: basic(APP_USERNAME, APP_PASSWORD),
        Origin: LOOPBACK_URL,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(torrentGet),
    });
    expect(res.status).toBe(200);
  });
});

test.describe("RPC route", () => {
  test("forwards an allowed call to Transmission", async ({ request }) => {
    const res = await request.post(RPC, { data: { method: "torrent-get", arguments: { fields: ["id"] } } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ result: "success", arguments: { torrents: expect.any(Array) } });
  });

  test("refuses a method the UI does not use", async ({ request }) => {
    const res = await request.post(RPC, { data: { method: "session-set", arguments: { "download-dir": "/" } } });
    expect(res.status()).toBe(403);
  });

  test("refuses a non-JSON body", async ({ request }) => {
    const res = await request.post(RPC, {
      headers: { "Content-Type": "text/plain" },
      data: '{"method":"torrent-get"}',
    });
    expect(res.status()).toBe(415);
  });

  test("answers 405 to GET", async ({ request }) => {
    expect((await request.get(RPC)).status()).toBe(405);
  });
});

test.describe("upload size", () => {
  const direct = () => createDaemonClient(daemonInfo());

  // Regression: Next.js used to cut proxied bodies off at 10 MB, which turned
  // .torrent files over about 7.5 MB into "invalid JSON body" errors.
  test("accepts a 15 MB .torrent", async ({ request }) => {
    const built = makeOversizedTorrent(uniqueName("big"), 15 * 1024 * 1024);
    const res = await request.post(RPC, {
      data: { method: "torrent-add", arguments: { metainfo: built.torrent.toString("base64"), paused: true } },
      timeout: 120_000,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.result).toBe("success");
    expect(body.arguments["torrent-added"].hashString).toBe(built.infoHash);
    await direct().call("torrent-remove", { ids: [built.infoHash] });
    await waitFor(async () => !(await direct().getTorrent(built.infoHash, ["id"])), { message: "cleanup" });
  });

  test("answers 413 with a readable message for a .torrent over 20 MB", async ({ request }) => {
    const built = makeOversizedTorrent(uniqueName("huge"), 21 * 1024 * 1024);
    const res = await request.post(RPC, {
      data: { method: "torrent-add", arguments: { metainfo: built.torrent.toString("base64") } },
      timeout: 120_000,
    });
    expect(res.status()).toBe(413);
    expect(await res.json()).toEqual({
      result: "request too large (.torrent files are limited to 20 MB)",
    });
  });
});
