import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// Three projects:
// - unit: server code (route handler, proxy) and pure helpers, in Node.
// - dom: browser code (RPC client, hooks, components) in jsdom.
// - integration: the route handler against a real Transmission daemon in Docker.
// `npm test` runs unit and dom; `npm run test:integration` runs integration.
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["tests/setup/msw.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/dom/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/setup/msw.ts", "tests/setup/dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          // Pulling the image on a cold runner can take a while.
          hookTimeout: 180_000,
          testTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Generated shadcn/ui primitives and framework glue.
      exclude: ["src/components/ui/**", "src/app/layout.tsx", "src/lib/types.ts"],
      reporter: ["text", "html", "lcov"],
      // A floor a little under today's numbers, so coverage cannot quietly slide.
      thresholds: { statements: 90, branches: 80, functions: 85, lines: 90 },
    },
  },
});
