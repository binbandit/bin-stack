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

## Layout

```
skills/
  file-pr/SKILL.md
  babysit-pr/SKILL.md
  arena/SKILL.md
  bro/SKILL.md
  verify/SKILL.md
  review/SKILL.md
scripts/
  link-skills.sh   # optional: symlink into local harness skill roots
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
