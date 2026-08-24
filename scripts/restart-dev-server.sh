#!/usr/bin/env bash
# Restarts a currently-running `next dev` server with a clean .next
# directory. Used by the git hooks in .githooks/ after a checkout or
# merge/pull, and can be run by hand any time.
#
# Deliberately does nothing if no dev server is currently running — this
# never starts one unprompted, only restarts one that's already up.
set -euo pipefail
cd "$(dirname "$0")/.."

# Non-interactive shells (git hooks included) don't get nvm's lazy-loaded
# shell integration, so `node`/`npm` can silently resolve to a wrong
# system install. Source nvm directly if it's present; otherwise fall back
# to whatever's already on PATH.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  \. "$HOME/.nvm/nvm.sh"
fi

PIDS="$(pgrep -f "next dev" || true)"
if [ -z "$PIDS" ]; then
  exit 0
fi

echo "[restart-dev-server] stale dev server detected, restarting with a clean .next..."
# shellcheck disable=SC2086
kill $PIDS 2>/dev/null || true
sleep 1
rm -rf .next

nohup node node_modules/.bin/next dev >/tmp/kbm-dev.log 2>&1 </dev/null &
disown
echo "[restart-dev-server] dev server restarting (log: /tmp/kbm-dev.log)"
