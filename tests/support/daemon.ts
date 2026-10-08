import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import type { PayloadFile } from "./torrent";

/** Pinned so a new upstream release cannot change test results unannounced. */
export const TRANSMISSION_IMAGE = "lscr.io/linuxserver/transmission:4.1.3-r0-ls363";

/** Where the container mounts the host download directory. */
export const CONTAINER_DOWNLOAD_DIR = "/downloads";

export interface DaemonInfo {
  /** Base URL without /transmission/rpc, as TRANSMISSION_RPC_URL expects. */
  url: string;
  username: string;
  password: string;
  /** Host directory mounted at CONTAINER_DOWNLOAD_DIR. */
  downloadDir: string;
}

export interface StartedDaemon extends DaemonInfo {
  stop: () => Promise<void>;
}

// Keep the daemon off the public swarm so runs are hermetic.
const SETTINGS = {
  "download-dir": CONTAINER_DOWNLOAD_DIR,
  "incomplete-dir-enabled": false,
  "dht-enabled": false,
  "pex-enabled": false,
  "lpd-enabled": false,
  "utp-enabled": false,
  "port-forwarding-enabled": false,
  "start-added-torrents": true,
  "rename-partial-files": false,
};

/**
 * Starts a throwaway Transmission daemon. Tests may delete anything it holds,
 * so never point them at any other daemon.
 */
export async function startDaemon(): Promise<StartedDaemon> {
  const username = "test-user";
  const password = "test-pass";
  const downloadDir = mkdtempSync(path.join(tmpdir(), "transmission-test-"));
  // The daemon runs as the host user, but a wide mode keeps macOS VMs happy too.
  chmodSync(downloadDir, 0o777);

  const container: StartedTestContainer = await new GenericContainer(TRANSMISSION_IMAGE)
    .withEnvironment({
      USER: username,
      PASS: password,
      PUID: String(process.getuid?.() ?? 1000),
      PGID: String(process.getgid?.() ?? 1000),
      TZ: "Etc/UTC",
    })
    .withCopyContentToContainer([
      { content: JSON.stringify(SETTINGS), target: "/config/settings.json" },
    ])
    .withBindMounts([{ source: downloadDir, target: CONTAINER_DOWNLOAD_DIR, mode: "rw" }])
    .withExposedPorts(9091)
    // 401 means the RPC server is up and enforcing the credentials we set.
    .withWaitStrategy(Wait.forHttp("/transmission/rpc", 9091).forStatusCode(401))
    .withStartupTimeout(120_000)
    .start();

  return {
    url: `http://${container.getHost()}:${container.getMappedPort(9091)}`,
    username,
    password,
    downloadDir,
    stop: async () => {
      await container.stop();
      rmSync(downloadDir, { recursive: true, force: true });
    },
  };
}

/**
 * Writes a torrent's payload into the download directory, so the daemon
 * verifies it as complete instead of downloading it.
 */
export function seedPayload(downloadDir: string, torrentName: string, files: PayloadFile[]) {
  const singleFile = files.length === 1 && !files[0].path.includes("/");
  for (const file of files) {
    const target = singleFile
      ? path.join(downloadDir, torrentName)
      : path.join(downloadDir, torrentName, file.path);
    mkdirSync(path.dirname(target), { recursive: true, mode: 0o777 });
    writeFileSync(target, file.content, { mode: 0o666 });
  }
}

/** Talks to the daemon directly, bypassing the app, to set up and check state. */
export function createDaemonClient(daemon: DaemonInfo) {
  const endpoint = `${daemon.url}/transmission/rpc`;
  const auth = "Basic " + Buffer.from(`${daemon.username}:${daemon.password}`).toString("base64");
  let sessionId = "";

  const post = (body: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        "X-Transmission-Session-Id": sessionId,
      },
      body,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC payloads are untyped
  async function call<T = any>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    const body = JSON.stringify({ method, arguments: args });
    let res = await post(body);
    if (res.status === 409) {
      // Retry once with the session id the daemon just handed out.
      sessionId = res.headers.get("x-transmission-session-id") ?? "";
      res = await post(body);
    }
    const json = await res.json();
    if (json.result !== "success") throw new Error(`${method} failed: ${json.result}`);
    return json.arguments;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- torrent fields vary by request
  async function getTorrent(hash: string, fields: string[]): Promise<any> {
    const { torrents } = await call("torrent-get", { ids: [hash], fields });
    return torrents[0];
  }

  return { call, getTorrent };
}

/** Polls until `check` returns a truthy value, or fails after `timeoutMs`. */
export async function waitFor<T>(
  check: () => Promise<T | undefined | false>,
  { timeoutMs = 30_000, intervalMs = 250, message = "condition" } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const reason = last instanceof Error ? `: ${last.message}` : "";
  throw new Error(`Timed out waiting for ${message}${reason}`);
}
