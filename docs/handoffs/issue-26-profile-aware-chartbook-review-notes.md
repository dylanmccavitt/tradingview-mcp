# Issue 26 - Profile-Aware Chartbook Review Notes

## Status

Implemented on `feat/issue-26-profile-aware-chartbook-review-notes`.
Chartbook `notes.md` output now renders profile-aware human review checklists
for `focus`, `breakout`, `squeeze`, and `momentum` profiles. Notes surface
per-timeframe extraction warnings, including legend-only fallback warnings, and
keep review language scoped to chart prep rather than recommendations.

## Next

Push the branch, open the PR with `Closes #26`, run the requested subagent
review, and merge after review stays clean.

## Risks

- Review templates only use extracted chart facts and warning strings already
  available in chartbook artifacts; unavailable chart facts remain warnings
  instead of inferred values.
- No live TradingView Desktop run was performed in this thread; validation used
  fixture-style tests and fake CDP clients.

## Files

- `README.md`
- `docs/adr/0008-chartbook-output-artifacts.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `src/chartbook/chartbook.ts`
- `src/tradingview/pine-drawings.ts`
- `test/chartbook.test.ts`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `git diff --check`

`npm run test:pine` was not required because the Pine overlay source did not
change.
