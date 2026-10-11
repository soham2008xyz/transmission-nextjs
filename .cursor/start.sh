#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)"
export PATH="/home/ubuntu/.nvm/versions/node/v${NODE_VERSION}/bin:/usr/local/bin:${PATH}"

TRANSMISSION_IMAGE="lscr.io/linuxserver/transmission:4.1.3-r0-ls363"
TRANSMISSION_CONTAINER="transmission-dev"
RPC_USER="dev-user"
RPC_PASS="dev-pass"
RPC_PORT="9091"
APP_PORT="3000"

ensure_docker() {
  if sudo docker info >/dev/null 2>&1; then
    return
  fi
  if ! pgrep -x dockerd >/dev/null; then
    sudo dockerd >/tmp/dockerd.log 2>&1 &
    for _ in $(seq 1 60); do
      sudo docker info >/dev/null 2>&1 && return
      sleep 1
    done
    echo "Docker daemon failed to start; see /tmp/dockerd.log" >&2
    exit 1
  fi
}

wait_for_rpc() {
  for _ in $(seq 1 120); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${RPC_PORT}/transmission/rpc" || true)"
    if [[ "${code}" == "401" || "${code}" == "200" || "${code}" == "409" ]]; then
      return
    fi
    sleep 1
  done
  echo "Transmission RPC did not become ready on port ${RPC_PORT}" >&2
  exit 1
}

ensure_docker

if ! sudo docker ps -a --format '{{.Names}}' | grep -qx "${TRANSMISSION_CONTAINER}"; then
  sudo docker run -d \
    --name "${TRANSMISSION_CONTAINER}" \
    --restart unless-stopped \
    -p "127.0.0.1:${RPC_PORT}:9091" \
    -e "USER=${RPC_USER}" \
    -e "PASS=${RPC_PASS}" \
    -e "PUID=1000" \
    -e "PGID=1000" \
    -e "TZ=Etc/UTC" \
    "${TRANSMISSION_IMAGE}" >/dev/null
elif ! sudo docker ps --format '{{.Names}}' | grep -qx "${TRANSMISSION_CONTAINER}"; then
  sudo docker start "${TRANSMISSION_CONTAINER}" >/dev/null
fi

wait_for_rpc

ENV_FILE="${ROOT}/.env.local"
if [[ ! -f "${ENV_FILE}" ]]; then
  cat >"${ENV_FILE}" <<EOF
TRANSMISSION_RPC_URL=http://127.0.0.1:${RPC_PORT}
TRANSMISSION_RPC_USERNAME=${RPC_USER}
TRANSMISSION_RPC_PASSWORD=${RPC_PASS}
EOF
fi

if curl -sf "http://127.0.0.1:${APP_PORT}" >/dev/null 2>&1; then
  exit 0
fi

exec npm run dev -- --hostname 0.0.0.0 --port "${APP_PORT}"
