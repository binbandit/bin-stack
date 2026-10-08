#!/usr/bin/env bash
# Symlink each skills/<name> directory into local harness skill roots.
# Edit once under skills/; every linked harness sees the same files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$ROOT/skills"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "error: no skills/ directory at $SKILLS_DIR" >&2
  exit 1
fi

# Only create/link into roots that already exist, plus ~/.agents/skills
# (cross-harness convention). Never invent a harness home the user does not have.
CANDIDATE_ROOTS=(
  "$HOME/.agents/skills"
  "$HOME/.cursor/skills"
  "$HOME/.claude/skills"
  "$HOME/.codex/skills"
  "$HOME/.gemini/skills"
  "$HOME/.factory/skills"
  "$HOME/.grok/skills"
  "$HOME/.pi/agent/skills"
)

link_skill() {
  local skill_path="$1"
  local name
  name="$(basename "$skill_path")"
  local target_root="$2"
  local dest="$target_root/$name"

  mkdir -p "$target_root"

  if [[ -L "$dest" ]]; then
    local current
    current="$(readlink "$dest")"
    if [[ "$current" == "$skill_path" ]]; then
      echo "ok  $dest -> $skill_path"
      return
    fi
    rm "$dest"
  elif [[ -e "$dest" ]]; then
    echo "skip $dest (exists and is not a symlink to this repo)" >&2
    return
  fi

  ln -s "$skill_path" "$dest"
  echo "link $dest -> $skill_path"
}

# Always ensure the cross-agent root exists.
mkdir -p "$HOME/.agents/skills"

ACTIVE_ROOTS=()
for root in "${CANDIDATE_ROOTS[@]}"; do
  parent="$(dirname "$root")"
  if [[ "$root" == "$HOME/.agents/skills" || -d "$parent" ]]; then
    ACTIVE_ROOTS+=("$root")
  fi
done

shopt -s nullglob
skill_dirs=("$SKILLS_DIR"/*/)
shopt -u nullglob

if [[ ${#skill_dirs[@]} -eq 0 ]]; then
  echo "error: no skill directories under $SKILLS_DIR" >&2
  exit 1
fi

for skill_path in "${skill_dirs[@]}"; do
  skill_path="${skill_path%/}"
  if [[ ! -f "$skill_path/SKILL.md" ]]; then
    echo "skip $skill_path (no SKILL.md)" >&2
    continue
  fi
  for root in "${ACTIVE_ROOTS[@]}"; do
    link_skill "$skill_path" "$root"
  done
done
