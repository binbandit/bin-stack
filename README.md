# bin-stack

A harness-agnostic agent skill stack.

Skills follow the [Agent Skills](https://agentskills.io/specification) format (`SKILL.md` + optional scripts/references/assets). One source of truth under `skills/`. Works with Cursor, Claude Code, Codex, and any other agent that discovers skills the standard way.

Inspired by stacks like pstack, but not locked to a single product.

## Install

### Via skills CLI

```bash
npx skills add binbandit/bin-stack
```

Pick specific skills:

```bash
npx skills add binbandit/bin-stack --skill file-pr --skill babysit-pr --skill arena --skill bro
```

### Symlink a clone (one copy, every harness)

```bash
git clone https://github.com/binbandit/bin-stack.git ~/Developer/ai/bin-stack
cd ~/Developer/ai/bin-stack
./scripts/link-skills.sh
```

That links each skill directory into the harness roots you already have (`~/.agents/skills`, `~/.cursor/skills`, `~/.claude/skills`, `~/.codex/skills`, …). Edit here; every harness sees the same files.

## Skills

| Skill | When to use |
| --- | --- |
| [`file-pr`](skills/file-pr/SKILL.md) | File or update a concise pull request |
| [`babysit-pr`](skills/babysit-pr/SKILL.md) | Monitor a PR through review bots and CI |
| [`arena`](skills/arena/SKILL.md) | Run competing attempts, then graft the strongest ideas into one result |
| [`bro`](skills/bro/SKILL.md) | Restate the last message in plain language |
| [`verify`](skills/verify/SKILL.md) | Prove a behavior change on the user surface with revision-bound evidence |
| [`review`](skills/review/SKILL.md) | Filter adversarial findings by reachable failure and concrete evidence |
| [`anatomy`](skills/anatomy/SKILL.md) | Build detailed, interactive isometric illustrations that explain technical ideas as physical machines |

`anatomy` includes its rendering kit, reference guides, examples, and helper scripts. It needs Node.js 20.10+; browser checks also need Chrome or Chromium (set `CHROME_PATH` if it is not in a standard location). Build and capture the smallest example from the skill directory:

```bash
cd skills/anatomy
node examples/dial-indicator/build.mjs --light
node scripts/capture.mjs examples/dial-indicator/dial-indicator-light.html --out /tmp/anatomy-preview.png
```

See [`anatomy`'s setup](skills/anatomy/SKILL.md#setup) and [verification guide](skills/anatomy/references/verify.md) for the other script commands.

## Mods

Claude Code mods: plugins of function hooks that change how Claude Code looks and behaves. They are Claude Code only.

| Mod | What it does |
| --- | --- |
| [`glamour-dark`](mods/glamour-dark) | Draws replies as rich markdown in glamour's dark style, one sentence per line |
| [`redact-secrets`](mods/redact-secrets) | Swaps secrets for placeholders before Claude reads them or the session logs them; Write and Edit put the real values back |
| [`tool-lines`](mods/tool-lines) | Draws each tool call as one compact line; click a call to open its result, click it again to close it |
| [`ascii-spinner`](mods/ascii-spinner) | Swaps the working line (verb, timer, tokens, effort, tip) for a one-row WEAVEworm rethreading synthsilk, in Sekiguchi colors |
| [`slopothon`](mods/slopothon) | Paints a SLOPOTHON lockup over the Claude logo: block wordmark, a dot-matrix card naming the model and branch, and a livery strip with a tagline and barcode per session. Fullscreen (`"tui": "fullscreen"`) only; it starts each session with a `/slopothon` row and the logo shows for ~130ms first. Type `/slopothon` to redraw it inline |

Install specific mods at user scope (requires Claude Code on `PATH` and Python 3):

```bash
./scripts/install-mods.sh --list
./scripts/install-mods.sh glamour-dark tool-lines
```

The script validates every requested name before changing anything, adds `mods/` as the `bin-stack` marketplace, and installs only the named mods. No arguments prints usage and exits without installing anything; `--list` lists available names without making changes. Duplicate names are installed once per invocation, and re-running an install is safe. Claude Code reads the mods in place from this clone, so an edit here applies on the next session or `/reload-plugins`.

Run the installer's isolated fixture tests with `python3 -m unittest discover -s scripts/tests -v`.

## Layout

```
skills/
  file-pr/SKILL.md
  babysit-pr/SKILL.md
  arena/SKILL.md
  bro/SKILL.md
  verify/SKILL.md
  review/SKILL.md
  anatomy/        # SKILL.md, kit, references, examples, and helper scripts
mods/
  .claude-plugin/marketplace.json
  glamour-dark/
  redact-secrets/
  tool-lines/
  ascii-spinner/
  slopothon/
scripts/
  link-skills.sh   # optional: symlink into local harness skill roots
  install-mods.sh  # install named Claude Code mods
```

Canonical skills live in `skills/`. Harness-specific paths are adapters (symlinks or CLI installs), not forks of the content.

## Authoring

1. Add `skills/<name>/SKILL.md` with required `name` and `description` frontmatter.
2. Keep `name` matching the directory. Lowercase, hyphens only.
3. Put long reference material in `references/`; keep `SKILL.md` short enough to load on activation.
4. Prefer harness-neutral wording. Call out Cursor / Claude / Codex only when a step truly differs.

See [agentskills.io/specification](https://agentskills.io/specification).

## License

MIT

The `verify` and `review` skills adapt selected pstack guidance by Lauren Tan at revision `9f451cf875ad1239912762f67741e8e5ba6ac0f1`. Each skill bundles its provenance and the original MIT notice in `LICENSE-pstack` so attribution travels with individual skill installs.

The `anatomy` skill is imported from [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy) at revision `689dcf966e63d92be10a5d593c6e19e10acd4422`. Its [source notes](skills/anatomy/SOURCE.md) and original [MIT license](skills/anatomy/LICENSE) travel with individual skill installs.
