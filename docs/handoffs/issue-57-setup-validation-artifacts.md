# Issue 57 - Setup Validation Artifacts

## Status

Implemented on `feat/issue-57-setup-validation-artifacts`.

Chartbook runs now write one per-symbol `setup-review.json` artifact and one
session-level `setup-review-index.json` artifact. Per-symbol artifacts include
the verdict enum `validated`, `invalidated`, `watch`, or `insufficient_data`,
objective reasons from existing chartbook facts, levels JSON status, warnings,
profile context, screenshot/levels references, timeframe coverage, and Quant
Scan source metadata when available.

The chartbook Markdown and HTML indexes summarize verdict counts and link to
the setup review artifacts without ranking or recommending symbols.

## Next

Push the branch, open a PR with `Closes #57`, run independent review, address
any findings, and merge if clean. After merge, sync canonical `main`.

## Risks

- Verdicts are deterministic chart-review labels from already-extracted
  chartbook evidence; they are not trade recommendations.
- No live TradingView Desktop run was performed; tests use fixtures and fake
  chart clients.

## Files

- `src/chartbook/setup-review.ts`
- `src/chartbook/chartbook.ts`
- `src/cli.ts`
- `test/chartbook.test.ts`
- `test/docs-v1-workflow.test.ts`
- `docs/architecture.md`
- `docs/adr/0008-chartbook-output-artifacts.md`
- `docs/v1-workflow.md`
- `docs/handoffs/issue-57-setup-validation-artifacts.md`

## Checks

- `npm test -- --test-name-pattern "chartbook|v1 workflow"`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
