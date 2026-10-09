#!/usr/bin/env bash
# Install each mods/<name> Claude Code mod at user scope.
# mods/ is a folder marketplace, so Claude Code loads every mod in place from
# this repo: edit here, then /reload-plugins in an open session.
set -euo pipefail

# Claude Code keys the marketplace on its exact path, so record the on-disk spelling: /bin/pwd reads it
# from the filesystem, where bash's builtin keeps the casing it was reached by on a case-insensitive disk.
ROOT="$(cd "$(dirname "$0")/.." && /bin/pwd -P)"
MODS_DIR="$ROOT/mods"
# Must match "name" in mods/.claude-plugin/marketplace.json.
MARKETPLACE="bin-stack"

if ! command -v claude >/dev/null 2>&1; then
  echo "error: claude is not on PATH" >&2
  exit 1
fi

shopt -s nullglob
mod_dirs=("$MODS_DIR"/*/)
shopt -u nullglob

if [[ ${#mod_dirs[@]} -eq 0 ]]; then
  echo "error: no mod directories under $MODS_DIR" >&2
  exit 1
fi

# Both steps are no-ops when already done. `plugin install --marketplace` would do this in one,
# but it is too new for the Homebrew casks, which trail the latest release.
claude plugin marketplace add "$MODS_DIR"

for mod_path in "${mod_dirs[@]}"; do
  mod_path="${mod_path%/}"
  if [[ ! -f "$mod_path/.claude-plugin/plugin.json" ]]; then
    echo "skip $mod_path (no .claude-plugin/plugin.json)" >&2
    continue
  fi
  # Qualified by marketplace, so a same-named plugin from another marketplace is never picked.
  claude plugin install "$(basename "$mod_path")@$MARKETPLACE"
done

echo "Start a new Claude Code session, or run /reload-plugins in an open one."
