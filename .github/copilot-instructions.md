# Copilot instructions — transmission-nextjs

Next.js 16 (App Router, TypeScript, React 19, Tailwind v4) web UI for a Transmission daemon. Single-page app: `src/app/page.tsx` renders everything. README is the source of truth for setup, env vars, and the security model. `@/` maps to `src/`.

## Commands

CI order (`.github/workflows/ci.yml`) is the definition of passing:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm test` (unit + component only)

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Dev server / production build / serve build |
| `npm test` | `vitest run --project unit --project dom` — no Docker needed |
| `npm run test:coverage` | Same + coverage; thresholds 90/80/85/90 in `vitest.config.mts` — new `src/` code needs tests |
| `npm run test:integration` | RPC route vs real daemon via Testcontainers (needs Docker) |
| `npm run test:e2e` | Playwright vs `next start` + real daemon (needs Docker, `npm run build` first, `.next/BUILD_ID` present) |

Single test while iterating:

```bash
npx vitest run --project unit tests/unit/origin.test.ts
npx vitest run --project dom tests/dom/torrent-table.test.tsx
npx playwright test e2e/ui.spec.ts
```

Node: `.nvmrc` pins 22.22.2; `engines` excludes odd-numbered releases. First e2e run needs `npx playwright install chromium`.

## Architecture

One round trip, each hop owning a concern:

```
page.tsx → src/lib/transmission.ts → POST /api/transmission/rpc → Transmission daemon
                                          ▲ src/proxy.ts (basic auth, Origin check) runs first
```

- `src/lib/transmission.ts` is the only browser-side RPC client. Every feature goes through `rpc()`; typed helpers (`getTorrents`, `startTorrent`, …) pick `fields` and arguments. `torrent-get` field lists live here — a new column/detail needs its field added here and in `src/lib/types.ts`.
- `src/app/api/transmission/rpc/route.ts` is an allowlisting proxy, not a passthrough. It holds daemon credentials and module-level `sessionId` (`X-Transmission-Session-Id` handshake + 409 retry), so the browser never sees either. It forwards only `ALLOWED_METHODS` / `ALLOWED_ARGUMENTS` (403 otherwise) and answers 413 for oversize uploads.
- `src/proxy.ts` (Next 16 proxy, former middleware) guards page and API alike; the route does no auth. Basic auth stays off unless both `APP_USERNAME` and `APP_PASSWORD` are set; with auth on it rejects cross-origin state-changing requests (`src/lib/origin.ts`, `APP_ORIGIN` / `APP_TRUST_PROXY`).
- Env vars (`TRANSMISSION_RPC_URL`, `TRANSMISSION_RPC_USERNAME/PASSWORD`, `APP_USERNAME/PASSWORD`, `APP_ORIGIN`, `APP_TRUST_PROXY`) are read at module load in `route.ts` and `proxy.ts`. See `.env.example`.
- Transmission failures arrive as HTTP 200: `src/lib/transmission.ts` throws `RpcError` on any `result !== "success"`; `RpcError.unreachable` marks the network case.
- Upload cap travels in pairs: `MAX_TORRENT_FILE_BYTES` in `src/lib/limits.ts` and `proxyClientMaxBodySize` in `next.config.mjs` (base64 JSON ≈ 4/3 of file size; Next's default 10 MB proxy cap broke ~7.5 MB+ files).

UI state: `src/app/page.tsx` owns torrent list, polling, and table/dialog state. Polling chains `setTimeout` (never `setInterval`) every 5 s, pauses while `document.hidden`, restarts on `visibilitychange`; failed polls keep last rows and set `disconnected` (one banner, no per-tick toast). Table sort/filter/column-visibility/paging persist via `useLocalStorage` (`table_*` keys); selection and dialog state stay in memory. `src/components/ui/` is generated shadcn/ui (`components.json`), excluded from coverage — compose, don't edit.

## Conventions

- Tests are Vitest projects (`vitest.config.mts`): `unit` (Node), `dom` (jsdom), `integration` (real daemon, image pinned in `tests/support/daemon.ts`). MSW uses `onUnhandledRequest: "error"` (`tests/setup/msw.ts`) — every HTTP call in unit/dom tests needs an explicit `server.use(...)` handler. Env-at-module-load pattern: `vi.resetModules()` + `vi.stubEnv()` + re-import (see `tests/unit/rpc-route.test.ts`).
- e2e runs one worker against one throwaway daemon on port 3100 with basic auth on, so it covers `proxy.ts`; `e2e/global-setup.ts` sets every env var explicitly because Next only fills unset ones.
- Default branch is `master`; PR titles use conventional commits (`feat:`, `fix:`, `chore(scope):`). Follow `.github/PULL_REQUEST_TEMPLATE.md`: typecheck, lint, all test layers, screenshots for UI changes, README + `.env.example` updated for any new env var.
- Security model: anyone who can reach the app can control torrents — set both `APP_USERNAME` and `APP_PASSWORD` plus HTTPS before exposing beyond a trusted network.
