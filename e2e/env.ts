import type { DaemonInfo } from "../tests/support/daemon";

export const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
export const LOOPBACK_URL = `http://127.0.0.1:${PORT}`;

// Basic auth is on for the whole E2E run, so every test also covers proxy.ts.
export const APP_USERNAME = "e2e-admin";
export const APP_PASSWORD = "e2e:pass";

/** The daemon global-setup started; workers inherit it through the environment. */
export function daemonInfo(): DaemonInfo {
  const raw = process.env.E2E_DAEMON;
  if (!raw) throw new Error("E2E_DAEMON is not set; run through playwright.config.ts");
  return JSON.parse(raw);
}
