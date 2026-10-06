---
name: babysit-pr
description: Monitor a pull request through review and CI. Use when the user asks to monitor, watch or babysit a PR.
license: MIT
metadata:
  author: binbandit
  harness: cursor,claude,codex,pi
---

# Babysit PR

All the repos we work in have various AI review bots. They're helpful, even if they are not always right.

## Mode and permissions

Choose the mode from the user's request and existing authorization:

- **Check once:** read the current state, report, and stop.
- **Watch and report:** monitor and report meaningful changes; do not mutate code or the PR.
- **Fix within permission:** verify and fix real findings within the original scope, using only the already-authorized actions.

A request to monitor alone defaults to watch and report. Permission to fix locally does not by itself authorize pushes, replies, thread resolution, CI reruns, rebases, or merge. Carry forward permissions already granted; do not ask again. In fix mode, when a needed external action lacks permission, prepare the local fix or reply where possible and ask only for that action. In report modes, return the finding and proposed next action. Merge always requires the user's explicit request.

## Read the current state

If your harness offers tools to monitor a PR, use them so you can respond when comments arrive. Otherwise poll the PR for new comments and checks.

Record the repository, PR, base SHA, and exact head SHA. Read required checks, reviews, thread resolution, required human approval policy, and mergeability. Follow pagination to completion for checks, reviews, and threads; a first page is not a complete review. Missing permissions, truncated data, and unknown mergeability are unresolved evidence, not green states. In watch modes, use supported events or bounded polling and stay quiet when nothing changes.

Use checks and bot reviews tied to the exact current PR HEAD to decide readiness; their timestamps alone do not prove they cover it. Ignore your own "AI reply on behalf of Brayden" comments as new reviewer feedback. After you push a fix, wait for bots on that new commit before answering again.

Read thread resolution and any explicit reviewer withdrawal, and verify unresolved findings against current HEAD regardless of when they were posted. An old timestamp or outdated line location alone is not grounds for dismissal. Carry findings forward until they are addressed and verified on current HEAD, explicitly withdrawn by the reviewer, or demonstrably false or obsolete with a written reason. Do not repeat replies or fixes for resolved threads unless the issue remains or recurs on current HEAD.

## Act within scope

Verify every bot finding against the source before changing code. In fix mode, fix real findings and run relevant verification before an authorized commit and push. Rerun an infrastructure flake only when reruns are authorized. Reply with a written reason when dismissing a false positive only when replies are authorized.

Before editing or rebasing, check local changes, branch ownership, and whether the checkout is shared. Do not reset, stash, switch, or rebase over unrelated work; isolate the intended PR revision when necessary. Verify that local HEAD is the PR revision you intend to change. Before pushing, re-read the remote head; inspect unexpected movement instead of overwriting it.

After any code change, rebase, or conflict resolution, invalidate affected local verification and wait for checks and bot review on the new exact head. Base movement can also invalidate integration evidence. Keep prior evidence as history, not proof of the current revision.

A human comment gets reported. The reply format below is for bots.

Keep an eye on the PR's base branch. In report mode, report movement that affects the PR. In fix mode, update the branch only with authorization and repo policy, preserving shared or published history unless rewriting it was explicitly authorized.
If an overlapping PR makes this one obsolete, stop monitoring, report it to the user, and ask before closing the PR unless closure was explicitly authorized.

When replies and thread resolution are authorized, reply and resolve bot feedback you have verified is not worth addressing. A bot question that needs nothing can just be resolved, with no reply. Otherwise report it with the prepared reason. Format comments left on Brayden's behalf as:

```
###### AI reply on behalf of Brayden - [dismissed | fixed]

[actual reply]
```

Use `dismissed` for a false positive and `fixed` when the change is in. The reply is the reason a reviewer can check. For a fix, say what changed and cite the commit. Six hashes keep the byline smaller than the reply.

When an authorized reply is about something a reviewer can see, attach a screenshot or short video. When the installed `gh` supports it, use `gh pr comment --attach './shot.png#What it shows'` and reference it where it belongs as `![what it shows](./shot.png)`; `gh` rewrites that reference instead of appending the file at the end. Otherwise use available hosting upload support or report the local evidence and upload limitation. If a new image replaces an out-of-date one, edit the authorized comment or body, drop the old image reference, and put the new image where the old one was. Skip images when there is nothing to show.

Do not let review feedback expand the PR beyond the user's original goal.
Address real shortcomings, but avoid scope creep.

If nothing has changed, stay quiet rather than posting filler comments.
For check-once mode, return after the snapshot. For watch modes, stop when the PR is closed or merged, the user stops the watch, a named blocker needs attention, or readiness is confirmed. Do not silently promise future monitoring after the session ends; use an authorized scheduling facility if the user requested an ongoing watch.

Report ready only when required checks and expected bot reviews cover the exact current head, no actionable findings remain, required human approval is satisfied under current repo policy, and mergeability is known and permits merging. Re-read head and base before that conclusion; if either moved, refresh affected evidence. If approval policy or coverage cannot be established, report the precise gap as blocked or inconclusive. Include the observed head/base identities and checks, review, approval, and mergeability evidence in the report.

Merge only when the user explicitly requested it, then recheck these conditions against the intended head immediately before merging.
