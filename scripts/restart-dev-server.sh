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

REPO_ROOT="$(pwd)"

# `pgrep -f "next dev"` alone would match any Next.js dev server on the
# machine, including unrelated ones from other repos — only kill processes
# actually running from this repo's directory, verified via /proc (Linux
# only). Fails closed: a PID is excluded whenever its cwd can't be
# positively confirmed to be this repo — an unreadable /proc/$pid/cwd
# (e.g. a process owned by another user) or no /proc at all (e.g. macOS)
# must never fall back to "include it anyway", since that's exactly the
# unrelated-process-killing risk this check exists to prevent.
PIDS=""
for pid in $(pgrep -f "next dev" || true); do
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  if [ -n "$cwd" ] && [ "$cwd" = "$REPO_ROOT" ]; then
    PIDS="$PIDS $pid"
  fi
done

if [ -z "$PIDS" ]; then
  exit 0
fi

echo "[restart-dev-server] stale dev server detected, restarting with a clean .next..."
# shellcheck disable=SC2086
kill $PIDS 2>/dev/null || true
sleep 1
rm -rf .next

nohup node_modules/.bin/next dev >/tmp/kbm-dev.log 2>&1 </dev/null &
disown
echo "[restart-dev-server] dev server restarting (log: /tmp/kbm-dev.log)"
