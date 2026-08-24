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
# shell integration, so `node`/`npm` can silently resolve to a wrong (or
# missing) system install. Sourcing nvm.sh alone only defines the `nvm`
# function — it doesn't select a version on its own — so follow it with
# `nvm use default` to actually put the right node on PATH before it
# matters below (launching `next dev`). Never fatal: if nvm isn't
# installed, or no default alias is set, fall back to whatever's already
# on PATH rather than aborting the whole restart under set -e.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  \. "$HOME/.nvm/nvm.sh"
  nvm use default >/dev/null 2>&1 || true
fi

# -P (not the default `pwd`) resolves symlinks, matching what `readlink -f`
# below also resolves — otherwise a repo path with any symlink component
# would never match and this would always fail to detect its own server.
REPO_ROOT="$(pwd -P)"

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

# Poll for the old process(es) to actually exit rather than a fixed sleep —
# a slow shutdown could otherwise race with deleting .next out from under
# it, or with the new server trying to bind the same port before the old
# one has released it. SIGKILL any stragglers once the timeout is up.
# (Every check below uses `if`, not a bare `&&`/`||` chain — under set -e,
# a failing left-hand side of a top-level `&&` aborts the whole script,
# and "the process has already exited" is the expected, common case here.)
still_running=""
for _ in $(seq 1 20); do
  still_running=""
  for pid in $PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      still_running="$still_running $pid"
    fi
  done
  if [ -z "$still_running" ]; then
    break
  fi
  sleep 0.25
done
if [ -n "$still_running" ]; then
  # shellcheck disable=SC2086
  kill -9 $still_running 2>/dev/null || true
fi

rm -rf .next

# nohup already detaches this from the shell/terminal — disown isn't
# needed on top of it, and can itself fail under `set -e` in a
# non-interactive shell (git hooks included) where job control is off.
# Launched via `npm run dev` (not a hardcoded `next dev` invocation) so
# this can never drift from whatever the canonical dev script actually
# does — e.g. if it ever grows flags or env setup in package.json.
nohup npm run dev >/tmp/kbm-dev.log 2>&1 </dev/null &
echo "[restart-dev-server] dev server restarting (log: /tmp/kbm-dev.log)"
