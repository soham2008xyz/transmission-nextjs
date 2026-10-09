# Transmission Next.js

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)
![Vitest](https://img.shields.io/badge/Vitest-5-6E9F18?logo=vitest)
![Playwright](https://img.shields.io/badge/Playwright-1.64-45ba4b?logo=playwright)
![Node.js](https://img.shields.io/badge/Node.js-22.22.2+-339933?logo=node.js)

[![nextjs](https://img.shields.io/badge/nextjs-black?logo=nextdotjs)](https://github.com/soham-banerjee/transmission-nextjs)
[![transmission-daemon](https://img.shields.io/badge/transmission--daemon-blue)](https://github.com/soham-banerjee/transmission-nextjs)
[![transmission-web](https://img.shields.io/badge/transmission--web-lightgrey)](https://github.com/soham-banerjee/transmission-nextjs)
[![react](https://img.shields.io/badge/react-%2361DAFB?logo=react)](https://github.com/soham-banerjee/transmission-nextjs)
[![typescript](https://img.shields.io/badge/typescript-%233178C6?logo=typescript)](https://github.com/soham-banerjee/transmission-nextjs)
[![tailwindcss](https://img.shields.io/badge/tailwindcss-%2338B2AC?logo=tailwindcss)](https://github.com/soham-banerjee/transmission-nextjs)
[![transmission-ui](https://img.shields.io/badge/transmission--ui-orange)](https://github.com/soham-banerjee/transmission-nextjs)

A web UI for a Transmission daemon.

## Setup

You need Node.js 22.22.2+, 24.15+ or 26+ (`.nvmrc` pins 22.22.2 for nvm, fnm and similar) and a running Transmission daemon with RPC enabled.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the sample env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

3. Start the dev server and open http://localhost:3000:

   ```bash
   npm run dev
   ```

## Tech Stack

- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/) with [React 19](https://react.dev/)
- **Language:** [TypeScript 5](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + shadcn/ui components
- **Testing:** [Vitest](https://vitest.dev/) (unit + component), [Playwright](https://playwright.dev/) (e2e), [Testcontainers](https://testcontainers.com/) (integration against real daemon)
- **RPC:** Axios to Transmission JSON-RPC
- **Daemon:** `lscr.io/linuxserver/transmission` (pinned in tests)

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Type-check with `tsc` |
| `npm test` | Run the unit and component tests |
| `npm run test:watch` | Run the unit and component tests in watch mode |
| `npm run test:coverage` | Run the unit and component tests with a coverage report |
| `npm run test:integration` | Run the RPC route against a real Transmission daemon (needs Docker) |
| `npm run test:e2e` | Run the browser tests against the production build and a real daemon (needs Docker and `npm run build`) |

## Testing

The tests come in four layers:

| Layer | Where | Runs against |
| --- | --- | --- |
| Unit | `tests/unit` | The RPC route, `proxy.ts` and helpers in Node, with HTTP mocked by [MSW](https://mswjs.io) |
| Component | `tests/dom` | The RPC client, hooks, dialogs, table and page in jsdom |
| Integration | `tests/integration` | The RPC route against a Transmission daemon in Docker ([Testcontainers](https://testcontainers.com/)) |
| End-to-end | `e2e` | `next start` with basic auth on, in Chromium, against a Transmission daemon in Docker |

`npm test` needs nothing but a supported Node.js version (Vitest and jsdom
support no odd-numbered releases, so `engines` excludes them). The integration and end-to-end tests start
their own throwaway daemon (`lscr.io/linuxserver/transmission`, pinned in
`tests/support/daemon.ts`) with [Testcontainers](https://testcontainers.com), so
Docker must be running. They create `.torrent` files on the fly, seed their data
into a temporary directory, and never touch the daemon in your `.env`.

Before the first end-to-end run, install the browser:

```bash
npx playwright install chromium
```

CI runs every layer on each pull request. The unit job also sends its
analysis and coverage to SonarCloud (`sonar-project.properties`), which needs a
`SONAR_TOKEN` repository secret and Automatic Analysis turned off in SonarCloud.

## Configuration

Set these in `.env.local` (see `.env.example`).

| Variable | Purpose |
| --- | --- |
| `TRANSMISSION_RPC_URL` | Base URL of the Transmission daemon, such as `http://localhost:9091`. The app adds `/transmission/rpc`, so leave off the trailing slash |
| `TRANSMISSION_RPC_USERNAME` | Transmission RPC username |
| `TRANSMISSION_RPC_PASSWORD` | Transmission RPC password |
| `APP_USERNAME` | Optional. Username for basic auth on this app |
| `APP_PASSWORD` | Optional. Password for basic auth on this app |
| `APP_ORIGIN` | Optional. Comma-separated origins (scheme, host, port) that may send state-changing requests when basic auth is on, such as `https://nas.example.com`. Needed only when a reverse proxy rewrites the `Host` header |
| `APP_TRUST_PROXY` | Optional. Set to `true` to read the public host from `X-Forwarded-Host` instead of `Host` for that check. Only enable it when a proxy you control sets or overwrites that header |

## Security

The app signs every request to Transmission with the server's RPC credentials.
**Anyone who can reach the app can control your torrents.**

Set `APP_USERNAME` and `APP_PASSWORD` to require basic auth on the UI and the
API. Auth stays off if you leave either unset, so set both before you expose the
app beyond a trusted network, and serve it over HTTPS.

With auth on, the app also refuses POST, PUT, PATCH and DELETE requests whose
`Origin` header names another site, because browsers resend cached basic-auth
credentials on cross-site requests. It compares the `Origin` host with the
request's `Host` header, so reaching the app by IP, LAN hostname or a proxy that
passes `Host` through works with no extra setup. Browsers set `Host` themselves,
and a page on another site cannot change it. Behind a proxy that rewrites
`Host`, set `APP_ORIGIN` to the public URL (preferred), or set
`APP_TRUST_PROXY=true` if the proxy always sets `X-Forwarded-Host`. Any client
can send that header, so leave `APP_TRUST_PROXY` off unless the app is reachable
only through that proxy.

The RPC route only forwards the methods the UI uses (`torrent-get`,
`torrent-start-now`, `torrent-stop`, `torrent-remove`, `torrent-add`,
`torrent-set` for file selection, and `free-space`). It rejects all others with 403.

## Upload size limit

`.torrent` files can be up to 20 MB. The Add dialog checks the size before it
uploads, and the RPC route answers `413` with a JSON message for larger
requests. To change the cap, edit `MAX_TORRENT_FILE_BYTES` in
`src/lib/limits.ts` and keep `proxyClientMaxBodySize` in `next.config.mjs`
above the matching request size (the file travels as base64, about 4/3 of its
size). Next.js cuts proxied request bodies off at 10 MB by default, which broke
files over about 7.5 MB.
