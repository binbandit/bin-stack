#!/usr/bin/env bash
# Add a named agents-md/<name>.md snippet to an AGENTS.md (or CLAUDE.md) file as a
# marked block. An existing block is replaced in place; otherwise the block is
# appended. --remove deletes the block. Symlinked targets are edited where they point.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && /bin/pwd -P)"
SNIPPETS_DIR="$ROOT/agents-md"

usage() {
  echo "Usage: $0 [--remove] SNIPPET FILE"
  echo "       $0 --list"
  echo "Example: $0 herdr ~/AGENTS.md"
  echo "Requires Python 3."
}

if [[ $# -eq 1 && "$1" == "--list" ]]; then
  shopt -s nullglob
  for snippet in "$SNIPPETS_DIR"/*.md; do
    basename "$snippet" .md
  done
  exit 0
fi

if [[ $# -eq 1 && "$1" == "--help" ]]; then
  usage
  exit 0
fi

remove=0
if [[ "${1:-}" == "--remove" ]]; then
  remove=1
  shift
fi

if [[ $# -ne 2 ]]; then
  usage >&2
  exit 1
fi

name="$1"
file="$2"
snippet="$SNIPPETS_DIR/$name.md"

if [[ ! "$name" =~ ^[a-z][a-z0-9-]*$ || ! -f "$snippet" ]]; then
  echo "error: unknown snippet: $name; use --list" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is not on PATH" >&2
  exit 1
fi

python3 - "$name" "$snippet" "$file" "$remove" <<'PY'
import os
import sys
import tempfile
from pathlib import Path

name, snippet, file, remove = sys.argv[1], Path(sys.argv[2]), sys.argv[3], sys.argv[4] == "1"
begin = f"<!-- BEGIN bin-stack:{name} -->"
end = f"<!-- END bin-stack:{name} -->"

target = Path(os.path.realpath(file))
text = target.read_text(encoding="utf-8") if target.exists() else ""
lines = text.splitlines(keepends=True)
starts = [i for i, line in enumerate(lines) if line.strip() == begin]
ends = [i for i, line in enumerate(lines) if line.strip() == end]

if len(starts) > 1 or len(starts) != len(ends) or (starts and ends[0] < starts[0]):
    sys.exit(f"error: {file} has unbalanced or repeated {name} markers; fix them by hand")

block = f"{begin}\n{snippet.read_text(encoding='utf-8').strip()}\n{end}"


def join(*parts):
    kept = [part.strip("\n") for part in parts if part.strip()]
    return "\n\n".join(kept) + "\n" if kept else ""


if starts:
    before, after = "".join(lines[: starts[0]]), "".join(lines[ends[0] + 1 :])
    if remove:
        updated, action = join(before, after), "remove"
    else:
        updated = before + block + "\n" + after
        action = "ok" if updated == text else "update"
elif remove:
    updated, action = text, "ok"
else:
    updated, action = join(text, block), "append"

if updated != text:
    mode = target.stat().st_mode & 0o7777 if target.exists() else 0o644
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target.parent, delete=False) as tmp:
        tmp.write(updated)
    os.chmod(tmp.name, mode)
    os.replace(tmp.name, target)

print(f"{action:<6} {file}")
PY
