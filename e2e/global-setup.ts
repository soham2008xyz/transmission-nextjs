import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { startDaemon, waitFor } from "../tests/support/daemon";
import { APP_PASSWORD, APP_USERNAME, BASE_URL, PORT } from "./env";

const root = path.resolve(__dirname, "..");

// Starts a throwaway daemon, then the production build pointed at it.
export default async function globalSetup() {
  if (!existsSync(path.join(root, ".next", "BUILD_ID"))) {
    throw new Error("No production build found. Run `npm run build` before the E2E tests.");
  }

  const daemon = await startDaemon();
  const { stop, ...info } = daemon;
  process.env.E2E_DAEMON = JSON.stringify(info);

  let server: ChildProcess | undefined;
  try {
    // Set every variable explicitly: Next.js only fills in .env values that are
    // unset, so a developer's real daemon in .env can never be used here.
    server = spawn(
      process.execPath,
      [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT), "-H", "127.0.0.1"],
      {
        cwd: root,
        env: {
          ...process.env,
          TRANSMISSION_RPC_URL: info.url,
          TRANSMISSION_RPC_USERNAME: info.username,
          TRANSMISSION_RPC_PASSWORD: info.password,
          APP_USERNAME,
          APP_PASSWORD,
        },
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    const exited = new Promise<never>((_, reject) =>
      server!.once("exit", (code) => reject(new Error(`next start exited with code ${code}`))),
    );
    // A 401 means the app is up and the proxy picked up the credentials.
    await Promise.race([
      exited,
      waitFor(async () => (await fetch(BASE_URL).catch(() => undefined))?.status === 401, {
        timeoutMs: 60_000,
        message: "next start to answer",
      }),
    ]);
  } catch (e) {
    server?.kill();
    await stop();
    throw e;
  }

  return async () => {
    server?.kill();
    await stop();
  };
}
