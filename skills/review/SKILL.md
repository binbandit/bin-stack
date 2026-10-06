---
name: review
description: Evidence-filtered adversarial review of a diff or selected code. Use for "adversarial review", "challenge this change", "find blind spots", or "what could this break". Produces findings without applying fixes.
license: MIT
metadata:
  author: binbandit
  harness: cursor,claude,codex,pi
---

# Review

Challenge the implementation against the stated goal. Return problems a maintainer can act on, with evidence strong enough to distinguish a reachable failure from a preference.

## Scope and independence

Pin the base and head revisions and any uncommitted diff. State the intended behavior and known constraints from the request and repo. Read changed files and the surrounding callers, validators, types, and integration boundaries needed to judge them.

Use independent read-only reviewers when available and permitted; give each the same intent, scope, raw code, and finding requirements below, without your suspected answer. Use available harness defaults; no particular tool or model is required. If delegation is unavailable, do a separate read-only pass and disclose that independence was limited.

This is a review, not authorization to edit code, post comments, resolve threads, or merge. Run safe local checks when they clarify a claim.

## Finding requirements

For each candidate finding, require all four:

1. **Location:** a file and line or precise symbol at the reviewed revision.
2. **Reachable failure:** the actual input, state, caller, or ordering that reaches the problem. Trace upstream guards and downstream consumers; "could be null" is insufficient when validation rejects null.
3. **Consequence:** the concrete incorrect behavior, data loss, security exposure, or demonstrated maintenance cost under the task's constraints.
4. **Evidence:** a reproduction, failing check, observed artifact, or explicit source trace. Name which kind you have; do not present a source-only conclusion as a runtime result.

Probe the boundaries relevant to this change: failure and retry paths, stale state, concurrency, permission checks, and contracts consumed outside the diff. Investigate one concrete safety assumption instead of listing speculative risks. Avoid forcing architecture or abstraction critiques onto a narrow fix.

## Lead judgment

Read every candidate and verify its location and path yourself. Agreement can prioritize investigation, but multiple reviewers repeating a claim does not prove it. A lone finding with good evidence can still block the change.

Deduplicate by root cause. Resolve disagreements using the current code and constraints, not a vote. Classify findings as:

- **Act on:** all four requirements hold and the consequence warrants fixing within scope. Set severity from the demonstrated impact.
- **Investigate:** a plausible, consequential path still lacks necessary evidence or context. Name the missing check; this is uncertainty, not a confirmed defect.
- **Dismissed:** unreachable, contradicted by evidence, outside scope, or a style preference without a concrete cost. Give a short reason for material rejected claims.

Do not inflate nits to fill a review or impose a quota that hides real defects. An empty review is valid. Offer a fix only when the evidence supports it; leave implementation to an authorized follow-up.

## Result

Return the reviewed identities, scope, and verified findings with location, trigger/path, consequence, evidence, and severity. Include consequential uncertainties, material dismissals, and coverage limits. Say "no actionable findings" when appropriate; a review is not proof that all behavior works.

If code or relevant configuration changes during review, mark affected conclusions stale and recheck against the new revision before presenting them as current.

Adapted from selected [pstack](https://github.com/cursor/plugins/tree/9f451cf875ad1239912762f67741e8e5ba6ac0f1/pstack) interrogate, lead-judgment, and blast-radius guidance. See [LICENSE-pstack](LICENSE-pstack) for provenance and the retained MIT notice.
