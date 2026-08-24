#!/usr/bin/env bash
# Points git at the repo's versioned hooks (.githooks/) — run automatically
# via package.json's postinstall. Never overwrites a hooksPath a developer
# already has configured (e.g. via husky, or their own setup) — only sets
# it when nothing is configured yet.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

if git config --get core.hooksPath >/dev/null 2>&1; then
  exit 0
fi

git config core.hooksPath .githooks
