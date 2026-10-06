---
name: file-pr
description: File a concise pull request. Use when the user asks to file, open, or create a PR or pull request.
license: MIT
metadata:
  author: binbandit
  harness: cursor,claude,codex,pi
---

# File PR

Review the diff against the repo's default branch, or the base the user named, and make sure its contents match the goal. Commit only the work that belongs in the PR.

## Prepare and verify

Identify the repository, base, branch, local HEAD, remote head, and working-tree changes before mutating anything. Check for a shared checkout or branch. Do not reset, stash, switch, or rebase over someone else's work. Use an isolated checkout when needed, explicitly carrying only the selected changes; uncommitted work is not copied automatically. Bring the base up to date using repo policy without rewriting published or shared history unless authorized.

Use the permissions already granted by the user. A request to file a PR normally includes committing, pushing its branch, and creating or updating that PR; honor any narrower publication or draft limits. If publication is not authorized, prepare the diff, validation, and proposed PR text first, then request the specific remaining action. Filing a PR never grants merge permission.

Run the relevant verification on the final code. Record the tested revision and any working-tree diff with its observed results. After a fix, rebase, conflict resolution, or other code change, invalidate affected evidence and rerun those checks. Confirm the commit to push contains the tested code. Checks still pending are pending evidence, not passes; opening a PR can precede CI completion.

## Publish once

Look for an existing PR using the repository, full head owner/branch, and base. If an open PR already tracks it, push and update that PR. Otherwise push and create one. Confirm the resulting PR's base and exact head match the intended change; if the branch moved unexpectedly, inspect and reverify before claiming the PR contains tested code.

If creation times out or its outcome is uncertain, look up that same head/base across all PR states before retrying. Reuse a matching open PR rather than creating a duplicate; report a matching closed or merged PR before taking further action. If lookup is unavailable or ambiguous, report the uncertainty and stop creation attempts. Do not force-push over an unexpected remote head.

Return the confirmed URL, head revision, validation and remaining limits, or the prepared result with the specific publication blocker.

## Write for the reviewer

PR titles should follow the repository's title conventions.
Look at recently merged PRs and Git history for examples.
Prefer a concise, human-readable title that explains why the changes matter:

BAD
> ❌ perf(server): negotiate permessage-deflate on the websocket

GOOD
> ✅ perf(server): cut websocket frame size by 70%+ with gzipping

Open the description with a simple explanation of the problem based on the
user's original prompt, then briefly explain the solution. Do not lead with
an implementation inventory:

BAD
> ❌ Removed implicit workspace carry-over from every "new thread" entry
point (cmd+n / cmd+shift+o, sidebar v1/v2 buttons, command palette). New
threads inherit only the project from context; branch, worktree, and env
mode always come from the configured defaults. Deleted buildContextualThreadOptions,
startNewThreadInProjectFromContext, and the v1 sidebar's seed-context machinery.

GOOD
> ✅ My "new worktree" default was ignored when starting new threads on existing
worktrees. Super unintuitive. Now your preferences always apply: new threads
keep the project from context and use your configured defaults for branch,
worktree, and env mode.

If the change is something a reviewer can see, attach a screenshot or short video where it explains the change. When the installed `gh` supports `--attach`, reference it in the body as `![what it shows](./shot.png)` and pass that same path to `--attach` on `gh pr create` or `gh pr edit`. Alt text goes after `#`: `--attach './shot.png#What it shows'`. `gh` rewrites a matching body reference to the uploaded file. An attachment the body never mentions is appended at the end, so put the reference where it belongs. Otherwise use available hosting upload support or report the local evidence and upload limitation. Skip images when the change has nothing to show.

When publication is authorized, open a real PR so review bots run. Open a draft only if the user asked for one. If the user also asked to babysit it, continue with the `babysit-pr` skill.
