#!/usr/bin/env bash
# Install named Claude Code mods at user scope from this clone.
set -euo pipefail

# Claude Code keys the marketplace on its exact path, so record the on-disk spelling: /bin/pwd reads it
# from the filesystem, where bash's builtin keeps the casing it was reached by on a case-insensitive disk.
ROOT="$(cd "$(dirname "$0")/.." && /bin/pwd -P)"
MODS_DIR="$ROOT/mods"
# Must match "name" in mods/.claude-plugin/marketplace.json.
MARKETPLACE="bin-stack"

usage() {
  echo "Usage: $0 MOD [MOD ...]"
  echo "       $0 --list"
  echo "Requires Claude Code and Python 3. Only the named mods are installed."
}

if [[ $# -eq 0 ]]; then
  usage >&2
  exit 1
fi

if [[ $# -eq 1 && "$1" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is not on PATH" >&2
  exit 1
fi

selected="$(python3 - "$MODS_DIR" "$MARKETPLACE" "$@" <<'PY'
import json
import re
import sys
from pathlib import Path

mods_dir = Path(sys.argv[1])
marketplace = sys.argv[2]
requested = sys.argv[3:]

try:
    catalog = json.loads((mods_dir / ".claude-plugin/marketplace.json").read_text())
    if catalog["name"] != marketplace:
        raise ValueError("unexpected marketplace name")
    plugins = {plugin["name"]: plugin for plugin in catalog["plugins"]}
    if any(not re.fullmatch(r"[a-z][a-z0-9-]*", name) for name in plugins):
        raise ValueError("invalid mod name in marketplace")
    if requested == ["--list"]:
        names = list(plugins)
    else:
        names = list(dict.fromkeys(requested))
        unknown = [name for name in names if name not in plugins]
        if unknown:
            raise ValueError("unknown mod(s): " + ", ".join(unknown) + "; use --list")
        for name in names:
            if plugins[name]["source"] != "./" + name:
                raise ValueError("unexpected source for mod: " + name)
            manifest = json.loads((mods_dir / name / ".claude-plugin/plugin.json").read_text())
            if manifest["name"] != name:
                raise ValueError("manifest name does not match mod: " + name)
    print("\n".join(names))
except (OSError, ValueError, KeyError, TypeError) as error:
    sys.exit("error: " + str(error))
PY
)"

if [[ $# -eq 1 && "$1" == "--list" ]]; then
  printf '%s\n' "$selected"
  exit 0
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "error: claude is not on PATH" >&2
  exit 1
fi

# Claude's marketplace add and plugin install commands are safe to repeat.
claude plugin marketplace add "$MODS_DIR" --scope user

while IFS= read -r name; do
  claude plugin install "$name@$MARKETPLACE" --scope user
done <<< "$selected"

echo "Start a new Claude Code session, or run /reload-plugins in an open one."
