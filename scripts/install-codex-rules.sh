#!/usr/bin/env bash
# Install codex/rules/*.rules into Codex's rules folder as bin-stack-<name>.rules.
# Codex loads every *.rules file there at startup but skips symlinks, so these are
# copies: re-run after pulling rule changes. Rules removed from this repo are
# removed from Codex too. These rules let Codex run matching commands outside its
# sandbox without asking: read them before installing.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && /bin/pwd -P)"
RULES_DIR="$ROOT/codex/rules"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
TARGET="$CODEX_HOME/rules"
PREFIX="bin-stack-"

# Never invent a harness home the user does not have.
if [[ ! -d "$CODEX_HOME" ]]; then
  echo "skip: no Codex home at $CODEX_HOME" >&2
  exit 0
fi

mkdir -p "$TARGET"
shopt -s nullglob

for rule in "$RULES_DIR"/*.rules; do
  dest="$TARGET/$PREFIX$(basename "$rule")"
  if [[ -f "$dest" && ! -L "$dest" ]] && cmp -s "$rule" "$dest"; then
    echo "ok     $dest"
    continue
  fi
  rm -f "$dest"
  cp "$rule" "$dest"
  echo "copy   $dest"
done

for installed in "$TARGET/$PREFIX"*.rules; do
  name="$(basename "$installed")"
  if [[ ! -f "$RULES_DIR/${name#"$PREFIX"}" ]]; then
    rm -f "$installed"
    echo "remove $installed"
  fi
done
