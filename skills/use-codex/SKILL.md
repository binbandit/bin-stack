---
name: use-codex
description: >-
  Run GPT-6.1-Sol via the Codex CLI from Claude Code using a thin wrapper subagent.
  Use when shelling out to Codex, gpt-6.1-sol or gpt-6-luna, `codex exec`,
  `codex review`, computer-use via Codex, or when Agent/Workflow needs GPT
  (those model params only accept Claude).
---

# Use Codex

GPT only via Codex CLI. Never pass `gpt-*` as an Agent/Workflow `model`
(Claude only). Always pass the model explicitly (`-m gpt-6.1-sol`); the
`~/.codex/config.toml` default is not `gpt-6.1-sol`. *When* to pick Codex vs
Claude is the caller's call - this skill is the *how*.

## Wrapper (required in Claude Code)

Spawn a thin Claude agent that runs Codex. It must not solve the task itself.
Outside Claude Code (no Agent/Workflow tool), run the [commands](#commands)
directly from the shell.

| Field | Value |
|-------|--------|
| `model` | `sonnet` |
| `effort` | `low` (when supported) |
| `label` | `gpt-6.1-sol:<task>` (or `gpt-6-luna:<task>` for bulk work) |
| `isolation` | `worktree` for parallel **implementation** |
| `schema` | optional, structured return |

The wrapper's `effort: low` is Claude effort; Codex reasoning effort is set
separately in the commands below.

Wrapper does: write a **self-contained** Codex prompt → Bash `codex …` (long timeout or background+poll) → return exit status, report path, summary. No invented results.

```text
You are a thin Codex launcher. Do not solve the task yourself.
1. Self-contained prompt: cwd, goal, constraints, scope, done criteria; for code changes, existing behavior/invariants to preserve and regression checks.
2. Run Codex via Bash (timeout often >10m; or background and poll report).
3. Return exit status, report path, summary of findings/changes and test evidence (commands, results, unrun checks).
```

## Commands

```bash
# Implement / computer-use (writable)
codex exec -m gpt-6.1-sol -c 'model_reasoning_effort="medium"' -s workspace-write -C "$PWD" -o /tmp/codex-report.md --ephemeral "<PROMPT>" </dev/null

# Investigate / ad-hoc review (read-only)
codex exec -m gpt-6.1-sol -c 'model_reasoning_effort="medium"' -s read-only -C "$PWD" -o /tmp/codex-report.md --ephemeral "<PROMPT>" </dev/null

# Built-in review (no -m/-o/--ephemeral - use -c + stdout)
codex review --uncommitted -c 'model="gpt-6.1-sol"' -c 'model_reasoning_effort="medium"' > /tmp/codex-report.md
codex review --base main -c 'model="gpt-6.1-sol"' -c 'model_reasoning_effort="medium"' > /tmp/codex-report.md
```

| Mode | Model | Sandbox / cmd |
|------|-------|----------------|
| Bulk/mechanical impl | `gpt-6-luna` | `workspace-write` |
| Harder impl / computer-use | `gpt-6.1-sol` | `workspace-write` |
| Review / investigate | `gpt-6.1-sol` | `read-only` or `codex review` |

## Reasoning and regression checks

Use explicit `medium` reasoning effort for routine work unless the caller specifies
otherwise. Choose `high` for difficult debugging, ambiguous requirements or changes
spanning several components; use `xhigh` when supported and the problem warrants it.
After a failed attempt, inspect the failure and refine the prompt before escalating.
Change `model_reasoning_effort` in the command; model selection remains separate.

For code changes, include the existing behavior and invariants to preserve, allowing
only the requested behavior to change. Ask for a focused regression check that
reproduces a bug before the fix and passes afterward where feasible, plus relevant
existing tests. Require commands and outcomes in the report, and disclose checks
that could not run. For investigation or review, report evidence without editing.

## Gotchas

- Prefer `-o` + `--ephemeral` on `codex exec`. Capture stdout for `codex review`.
- `-C` must point inside a git repo, or Codex exits with "Not inside a trusted directory" (add `--skip-git-repo-check` for scratch dirs).
- `codex exec` reads extra input from a non-TTY stdin; redirect `</dev/null` so it doesn't block.
- Avoid `danger-full-access` unless already externally sandboxed and requested.
- Escalate `gpt-6-luna` → `gpt-6.1-sol` if output is mediocre (no asking). Codex tokens ignore `budget.spent()`.
