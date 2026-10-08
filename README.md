# Transmission Next.js

A web UI for a Transmission daemon.

## Configuration

| Variable | Purpose |
| --- | --- |
| `TRANSMISSION_RPC_URL` | Base URL of the Transmission daemon |
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
