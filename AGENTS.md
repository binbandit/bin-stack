# AGENTS.md

Instructions for agents working on **bin-stack** itself.

## What this repo is

A portable skill library. Skills are the product. Keep them installable by any Agent Skills-compatible harness (Cursor, Claude Code, Codex, and others).

Canonical path: `skills/<skill-name>/SKILL.md`.

## Rules

- Follow [agentskills.io/specification](https://agentskills.io/specification).
- `name` in frontmatter must match the skill directory name.
- Prefer harness-neutral steps. If a step needs a Cursor-only or Claude-only tool, say so and provide a fallback.
- Do not duplicate skill bodies under `.cursor/`, `.claude/`, or `.agents/`. Those are install targets, not sources of truth.
- Keep each `SKILL.md` focused. Move long references into `references/`.
- Do not invent Cursor plugin packaging unless the user asks for a Cursor marketplace plugin. Loose skills + `npx skills add` come first.
- Work on `main` unless the user asks for a branch.
- Do not commit unless the user asks.

## Adding a skill

1. Create `skills/<name>/SKILL.md`.
2. Fill `name`, `description`, and instructions.
3. Update the skills table in `README.md`.
4. If you add scripts, document how to run them and what they need.

## Adding a mod

Claude Code mods live in `mods/<name>/` and are Claude Code only.

1. Create `mods/<name>/.claude-plugin/plugin.json`, `hooks/hooks.json` and `hooks/register.ts`.
2. List it in `mods/.claude-plugin/marketplace.json`.
3. Update the mods table in `README.md`.
4. Check it with `claude plugin validate mods/<name>` and `claude plugin test mods/<name>`.
5. Install it with `./scripts/install-mods.sh <name>`.

Mod code carries no comments. Names and structure carry the meaning; if code needs a comment to be understood, rewrite it.

## Linking locally

`./scripts/link-skills.sh` symlinks every skill directory into discovered user-level harness skill roots. Re-run after adding a skill.

`./scripts/install-codex-rules.sh` copies `codex/rules/*.rules` into `~/.codex/rules/` as `bin-stack-<name>.rules` (Codex skips symlinked rule files). Re-run after changing a rule. A rule lets Codex skip its sandbox and approval for matching commands, so keep each one as narrow as the skill that needs it, and list it in the README's Codex rules table.

`./scripts/install-agents-md.sh <name> <file>` adds `agents-md/<name>.md` to an instructions file between `<!-- BEGIN bin-stack:<name> -->` / `<!-- END bin-stack:<name> -->` markers, replacing that block in place when it exists. Snippets are short, always-on rules that pair with a skill; keep the details in the skill. Write them for any user (no personal names) and list them in the README's AGENTS.md snippets table.
