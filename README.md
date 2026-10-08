# Transmission Next.js

A web UI for a Transmission daemon.

## Setup

You need Node.js 20.9 or newer and a running Transmission daemon with RPC enabled.

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
