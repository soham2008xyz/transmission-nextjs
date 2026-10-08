# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

AGENTS.md above holds the commands, verification order, and wiring gotchas. The README covers setup, env vars, and the security model.

## Request flow

Everything is one round trip, and each hop owns a different concern:

```
page.tsx → src/lib/transmission.ts → POST /api/transmission/rpc → Transmission daemon
                                      ▲ src/proxy.ts (basic auth, Origin check) runs first
```

- **`src/lib/transmission.ts`** is the only browser-side RPC client. Every feature goes through `rpc()`; the typed helpers (`getTorrents`, `startTorrent`, …) pick the `fields` and arguments. `torrent-get` field lists live here, so a new column or detail needs its field added here and in `src/lib/types.ts`.
- **`route.ts`** is a server-side allowlisting proxy, not a passthrough. It holds the daemon credentials and the module-level `sessionId` (Transmission's `X-Transmission-Session-Id` handshake), so the browser never sees either.
- **`src/proxy.ts`** guards the page and the API alike; the route itself does no auth.

## UI state

`src/app/page.tsx` owns the torrent list, polling, and table/dialog state. The table and navbar get callbacks; `add-torrent-dialog` (free space) and `torrent-details-dialog` (details, file selection) call `lib/transmission.ts` themselves.

- Polling chains `setTimeout` (never `setInterval`) every 5 s, stops while `document.hidden`, and restarts on `visibilitychange`. A failed poll keeps the last rows and sets `disconnected` (one banner) rather than toasting each tick.
- Table sorting, filters, column visibility, and paging persist through `useLocalStorage` (`table_*` keys). Row selection and dialog state stay in memory.
- `src/components/ui/` is generated shadcn/ui (`components.json`), excluded from coverage. Prefer composing it over editing it.
- `@/` maps to `src/` in TypeScript and in `vitest.config.mts`.
