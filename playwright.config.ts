import { defineConfig, devices } from "@playwright/test";
import { APP_PASSWORD, APP_USERNAME, BASE_URL } from "./e2e/env";

// End-to-end tests: the production build, behind basic auth, against a real
// Transmission daemon in Docker. Run `npm run build` first.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One daemon and one app for the run, so tests take turns.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    httpCredentials: { username: APP_USERNAME, password: APP_PASSWORD, send: "always" },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
