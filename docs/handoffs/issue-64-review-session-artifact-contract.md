# Issue 64 - Review Session Artifact Contract

## Status

Implemented on `feat/issue-64-review-session-artifact-contract` and opened as
PR #67.

Added an additive v1 Review Session Artifact JSON contract. The contract defines
one manual review pass over one or more symbols with session metadata, source
artifact references, optional profile context, per-symbol chart captures,
objective evidence references, deterministic setup evidence labels, drawing
metadata artifacts, human-authored review marks, human-authored thesis notes,
and warnings.

Existing chartbook runtime outputs are unchanged.

## Next

Review PR #67, merge if clean, then sync canonical `main`.

## Risks

- This issue defines and validates the contract only; it does not add a broad
  runtime writer for `review-session.json`.
- This issue defines the contract that later runtime writers should consume;
  broad writer integration remains separate follow-up work.

## Files

- `src/review-session/artifact.ts`
- `test/fixtures/review-session-artifact.v1.json`
- `test/review-session-artifact.test.ts`
- `docs/review-session-artifact.md`
- `docs/v1-workflow.md`
- `docs/architecture.md`
- `docs/adr/0008-chartbook-output-artifacts.md`
- `test/docs-v1-workflow.test.ts`
- `docs/handoffs/issue-64-review-session-artifact-contract.md`

## Checks

- `npm install`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
- 2026-06-08 rebase onto `origin/main`: `npm test`, `npm run lint`,
  `npm run typecheck`, and `git diff --check`
