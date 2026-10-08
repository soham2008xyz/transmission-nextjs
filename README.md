# Transmission Next.js

A web UI for a Transmission daemon.

## Setup

You need Node.js 22 or newer (`.nvmrc` pins 22 for nvm, fnm and similar) and a running Transmission daemon with RPC enabled.

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
| Integration | `tests/integration` | The RPC route against a Transmission daemon in Docker |
| End-to-end | `e2e` | `next start` with basic auth on, in Chromium, against a Transmission daemon in Docker |

`npm test` needs nothing but Node.js 22.22.2+, 24.15+ or 26+ (Vitest and jsdom
support no odd-numbered releases; the app itself needs Node.js 22+). The integration and end-to-end tests start
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

## Security

The app signs every request to Transmission with the server's RPC credentials.
**Anyone who can reach the app can control your torrents.**

Set `APP_USERNAME` and `APP_PASSWORD` to require basic auth on the UI and the
API. Auth stays off if you leave either unset, so set both before you expose the
app beyond a trusted network, and serve it over HTTPS.

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
