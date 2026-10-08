#!/bin/bash
set -euo pipefail

# Only run in Claude Code cloud sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Chromium comes pre-installed in cloud sessions; don't let npm fetch another.
echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "$CLAUDE_ENV_FILE"

# Same install as CI. npm ci leaves package-lock.json untouched (npm install
# rewrites it on this npm version).
npm ci --ignore-scripts --no-audit --no-fund
