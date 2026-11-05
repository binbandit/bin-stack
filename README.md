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

### Codex rules (opt-in)

```bash
./scripts/install-codex-rules.sh
```

Copies each `codex/rules/<name>.rules` into `~/.codex/rules/bin-stack-<name>.rules` (or `$CODEX_HOME/rules`). Codex skips symlinked rule files, so these are copies: re-run after pulling rule changes. Rules deleted from this repo are removed too, and your own rule files are never touched. Rules let Codex run matching commands outside its sandbox without asking, so read them first:

| Rule | What it allows |
| --- | --- |
| [`herdr`](codex/rules/herdr.rules) | Every `hc` command, so Codex can run the [`herdr`](skills/herdr/SKILL.md) skill (its sandbox cannot reach herdr-core's socket). This includes `hc run` and `hc exec`. |

### AGENTS.md snippets (opt-in)

```bash
./scripts/install-agents-md.sh --list
./scripts/install-agents-md.sh herdr ~/AGENTS.md
```

Adds `agents-md/<name>.md` to the instructions file you name (`~/AGENTS.md`, `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, …) between `<!-- BEGIN bin-stack:<name> -->` and `<!-- END bin-stack:<name> -->`. If that block exists it is replaced in place, so pull and re-run to update; otherwise it is appended at the bottom. Nothing outside the block changes, `--remove` takes it out, and a symlinked file is edited where it points. Needs Python 3.

| Snippet | What it adds |
| --- | --- |
| [`herdr`](agents-md/herdr.md) | Always-on Herdr rules: use `hc` for sub-agents inside Herdr, tell every helper how to report back, and treat `<hc from=...>` messages as agent reports, not user instructions |

## Skills

| Skill | When to use |
| --- | --- |
| [`file-pr`](skills/file-pr/SKILL.md) | File or update a concise pull request |
| [`babysit-pr`](skills/babysit-pr/SKILL.md) | Monitor a PR through review bots and CI |
| [`arena`](skills/arena/SKILL.md) | Run competing attempts, then graft the strongest ideas into one result |
| [`bro`](skills/bro/SKILL.md) | Restate the last message in plain language |
| [`verify`](skills/verify/SKILL.md) | Prove a behavior change on the user surface with revision-bound evidence |
| [`review`](skills/review/SKILL.md) | Filter adversarial findings by reachable failure and concrete evidence |
| [`unslop`](skills/unslop/SKILL.md) | Cut AI tells from writing while preserving meaning and tone |
| [`anatomy`](skills/anatomy/SKILL.md) | Build detailed, interactive isometric illustrations that explain technical ideas as physical machines |
| [`use-codex`](skills/use-codex/SKILL.md) | Hand work to GPT through the Codex CLI (`codex exec` / `codex review`), via a thin wrapper agent in Claude Code |
| [`herdr`](skills/herdr/SKILL.md) | Start, message and wait on sub-agents and other agents through Herdr's `hc`. Optional extras: the [Codex rule](#codex-rules-opt-in) Codex needs to reach `hc`, and an always-on [AGENTS.md snippet](#agentsmd-snippets-opt-in) |

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

Run the installers' isolated fixture tests with `python3 -m unittest discover -s scripts/tests -v`.

## Layout

```
skills/
  file-pr/SKILL.md
  babysit-pr/SKILL.md
  arena/SKILL.md
  bro/SKILL.md
  verify/SKILL.md
  review/SKILL.md
  unslop/         # SKILL.md, SOURCE.md, and LICENSE-pstack
  anatomy/        # SKILL.md, kit, references, examples, and helper scripts
  use-codex/SKILL.md
  herdr/SKILL.md
codex/
  rules/herdr.rules  # opt-in Codex rules, installed by scripts/install-codex-rules.sh
agents-md/
  herdr.md           # opt-in AGENTS.md snippets, installed by scripts/install-agents-md.sh
mods/
  .claude-plugin/marketplace.json
  glamour-dark/
  redact-secrets/
  tool-lines/
  ascii-spinner/
  slopothon/
scripts/
  link-skills.sh          # optional: symlink into local harness skill roots
  install-codex-rules.sh  # opt-in: copy codex/rules into ~/.codex/rules
  install-agents-md.sh    # opt-in: add or update a marked agents-md snippet in an AGENTS.md
  install-mods.sh         # install named Claude Code mods
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

The `unslop` skill is imported unchanged from [pstack](https://github.com/cursor/plugins/tree/180939f9e59cc9512e9330649175763e81fad16f/pstack) at revision `180939f9e59cc9512e9330649175763e81fad16f`. Its [source notes](skills/unslop/SOURCE.md) and original [MIT notice](skills/unslop/LICENSE-pstack), copyright 2026 Lauren Tan, travel with individual installs. It preserves upstream's `disable-model-invocation` frontmatter extension; harnesses that support it require explicit invocation.
