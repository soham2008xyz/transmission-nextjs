#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)"
NODE_DIR="/home/ubuntu/.nvm/versions/node/v${NODE_VERSION}"
export PATH="${NODE_DIR}/bin:/usr/local/bin:${PATH}"

if [[ ! -x "${NODE_DIR}/bin/node" ]]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck source=/dev/null
  [[ -s "${NVM_DIR}/nvm.sh" ]] && . "${NVM_DIR}/nvm.sh"
  nvm install "${NODE_VERSION}"
fi

for cmd in node npm npx; do
  sudo ln -sf "${NODE_DIR}/bin/${cmd}" "/usr/local/bin/${cmd}"
done

node -v | grep -q "v${NODE_VERSION}" || {
  echo "Expected Node v${NODE_VERSION}, got $(node -v)" >&2
  exit 1
}

npm ci --ignore-scripts

if ! command -v docker >/dev/null; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io iptables
  sudo update-alternatives --set iptables /usr/sbin/iptables-legacy 2>/dev/null || true
fi

if [[ ! -f /etc/docker/daemon.json ]]; then
  sudo mkdir -p /etc/docker
  echo '{"storage-driver":"fuse-overlayfs"}' | sudo tee /etc/docker/daemon.json >/dev/null
fi

if ! groups | tr ' ' '\n' | grep -qx docker; then
  sudo usermod -aG docker "${USER}" || true
fi
if [[ -S /var/run/docker.sock ]]; then
  sudo chmod 666 /var/run/docker.sock
fi

npx --ignore-scripts playwright install chromium
