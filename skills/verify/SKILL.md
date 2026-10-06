---
name: verify
description: Verify a fix or feature with revision-bound evidence from the real user surface. Use for "verify this", "prove the fix", or before claiming a behavior change works.
license: MIT
metadata:
  author: binbandit
  harness: cursor,claude,codex,pi
---

# Verify

Prove the behavior the user cares about. A green helper test, a screenshot of the final state, or another agent's summary is supporting evidence; it does not replace exercising the affected path.

## Pin the claim

State the expected behavior, the smallest trigger, and the surface a user touches: UI, CLI, API, or public library entry point. Read the repo's run and test instructions and reuse its existing control or verification setup.

Record the exact revision, relevant working-tree diff, build, and environment used for each check. A commit SHA alone does not identify uncommitted code. Confirm the running instance comes from that code before driving it; a stale server or binary proves a different claim.

Use an isolated instance and scratch data where possible. Do not reset a dirty checkout, drive a shared user session, install tools, or perform external writes without authorization. If the safe local path cannot reach the behavior, report that specific limit. Stop only instances you started; keep evidence outside scratch cleanup.

## Before and after

For a bug fix, reproduce the failure on the before revision before changing code. Capture the action, result, and failure reason. If a cheap regression test fits the existing harness, run it failing first; otherwise use a focused command or manual drive. An unrelated startup failure does not reproduce the bug.

If the fix already exists, use an isolated before checkout when practical. If the before revision or required state is unavailable, record the missing evidence and continue the checks that are possible. Never invent a failing-before result.

Run the original trigger on the after revision through the same surface and comparable state. Check both the visible outcome and relevant side effects, such as a saved file or response body. A unit test cannot prove a UI action works; a screenshot alone cannot prove a save persisted. Report a substitute surface as partial coverage.

Check the one or two nearby contracts the change could break. Follow callers and integration boundaries to find the safety assumption that matters, then exercise it when feasible. Prefer a small check of real behavior over broad mock or fixture work. Do not weaken assertions to make the fix pass.

## Evidence and conclusion

Keep commands or driving steps, exit codes or observed results, and artifact paths so another person can inspect them. Read artifacts produced by delegated work instead of trusting its completion claim.

Label each claimed behavior:

| Status | Meaning |
| --- | --- |
| `verified` | The expected behavior was observed on the affected surface at the stated revision; for a bug fix, the matching before failure was also demonstrated. |
| `failed` | A valid check at the stated revision contradicted the expected behavior. |
| `partial` | Useful checks passed, but before evidence, part of the user path, or a relevant side effect is missing. |
| `blocked` | A named prerequisite prevented a valid check from running. |
| `inconclusive` | The result is ambiguous, flaky, or cannot be tied to the intended revision or state. |

After any code, configuration, build, or relevant state change, invalidate affected evidence and rerun those checks. Before reporting, compare the current revision and diff with the tested version. Keep old results as history, never as proof for new code.

Return the claim, before/after identities, status, concise observed evidence, and remaining limits. Passing checks with gaps remain `partial`; they do not become an overall pass.

Adapted from selected [pstack](https://github.com/cursor/plugins/tree/9f451cf875ad1239912762f67741e8e5ba6ac0f1/pstack) bug-fix, TDD, create-verification-skill, and blast-radius guidance. See [LICENSE-pstack](LICENSE-pstack) for provenance and the retained MIT notice.
