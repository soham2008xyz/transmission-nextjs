import type { DaemonInfo } from "../tests/support/daemon";

export const PORT = 3100;
// Served on loopback but reached as "localhost": proxy.ts compares Origin with
// req.nextUrl.origin, which `next start` always reports as localhost. See the
// known-bug test in server.spec.ts.
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
