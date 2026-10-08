# AGENTS.md

A Next.js 16 (App Router, TypeScript, React 19, Tailwind v4) web UI for a Transmission daemon. Single-page app: `src/app/page.tsx` renders everything. The README is the source of truth for setup, env vars, and the security model.

## Verify before claiming done

CI's order (`.github/workflows/ci.yml`) is the definition of passing:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm test` (unit + component only)

Run a single test while iterating instead of the whole suite:

- `npx vitest run --project unit tests/unit/origin.test.ts`
- `npx vitest run --project dom tests/dom/torrent-table.test.tsx`
- `npx playwright test e2e/ui.spec.ts` (needs Docker and `npm run build` first)

`npm run test:coverage` enforces thresholds (90/80/85/90 in `vitest.config.mts`): new code under `src/` needs tests or the run fails. `npm run test:integration` and `npm run test:e2e` need Docker; e2e exits without `.next/BUILD_ID`. Node: `.nvmrc` pins 22.22.2 and `engines` excludes odd-numbered releases.

## Wiring that is easy to miss

- **RPC allowlist**: `src/app/api/transmission/rpc/route.ts` forwards only `ALLOWED_METHODS` / `ALLOWED_ARGUMENTS`. A UI feature calling a new RPC method or passing a new argument gets a 403 until both sets are updated. The same file owns the 409 session-id retry.
- **Auth lives in `src/proxy.ts`** (Next 16's proxy, the former middleware): basic auth stays off unless both `APP_USERNAME` and `APP_PASSWORD` are set; with auth on it also rejects cross-origin state-changing requests (`src/lib/origin.ts`).
- **Upload limits travel in pairs**: `MAX_TORRENT_FILE_BYTES` in `src/lib/limits.ts` and `proxyClientMaxBodySize` in `next.config.mjs` must stay consistent (uploads travel as base64 JSON, ~4/3 of file size; Next's default 10 MB proxy cap broke large uploads).
- **Transmission failures arrive as HTTP 200**: the daemon reports errors in `result`, so `src/lib/transmission.ts` throws `RpcError` on any `result !== "success"`; `RpcError.unreachable` marks the network case.
- **Env vars are read at module load** in `route.ts` and `proxy.ts`: tests need `vi.resetModules()` + `vi.stubEnv()` + re-import (pattern in `tests/unit/rpc-route.test.ts`). `e2e/global-setup.ts` sets every variable explicitly because Next only fills unset ones.

## Testing quirks

- MSW runs with `onUnhandledRequest: "error"` (`tests/setup/msw.ts`): every HTTP call in unit/dom tests needs an explicit handler via `server.use(...)`.
- Layers are Vitest projects (`vitest.config.mts`): `unit` (Node), `dom` (jsdom), `integration` (real daemon via Testcontainers, image pinned in `tests/support/daemon.ts`). `npm test` runs only the first two; CI runs all four layers including Playwright.
- e2e runs one worker against one throwaway daemon on port 3100 with basic auth on, so it covers `proxy.ts` too.

## Repo conventions

- Default branch is `master`; PR titles use conventional commits (`feat:`, `fix:`, `chore(scope):`).
- `.github/PULL_REQUEST_TEMPLATE.md` is the checklist: typecheck, lint, all test layers, screenshots for UI changes, and README + `.env.example` updated for any new env var.
- `.mcp.json` registers a SonarQube Cloud MCP server that needs `SONARQUBE_TOKEN` in the environment (see `.env.example`).
