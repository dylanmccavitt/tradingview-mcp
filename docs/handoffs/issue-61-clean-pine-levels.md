# Issue 61 Clean Pine Levels Handoff

## Status

Recovered and ported onto `feat/issue-61-clean-pine-levels-recovery` from
current `main`.

The issue #61 changes from the old reference branch were applied without
bringing forward stale branch history. The objective Pine overlay now uses
restrained 1 px solid horizontal reference and swing lines, shows short
text-only labels in the default `focus` preset, and replaces the old focus
compression context with a compact timeframe/trend/reclaim/support table. Daily
and 65-minute `focus` include confirmed swing high/low levels for
pullback/reclaim review while keeping scanner, ranking, alert, advice, and
trade-action language out of the overlay.

The required visible study name `TVMCP Objective Drawing Overlay` and existing
plot titles were preserved for downstream extraction compatibility.

## Next

Open a PR for issue #61 from
`feat/issue-61-clean-pine-levels-recovery`, run review, and stop before merge
until the user explicitly approves merging.

Human visual inspection is still needed on weekly, daily, and 65-minute charts
to confirm the cleaner level presentation is acceptable in TradingView Desktop.

## Risks

- Static tests validate the source/docs contract but do not prove chart
  readability in TradingView.
- Live TradingView apply/visual validation was not rerun in this recovery
  worktree. The old reference run reported the source could be applied with zero
  Pine errors but still needed human visual review.
- Prior live extraction on the old branch found the study but returned zero
  extracted levels because TradingView exposed the study without compact
  plot/drawing values. Treat that as a live extraction/API exposure limitation
  to revisit if chartbook levels remain empty after manual visual validation.

## Files

- `pine/objective-drawing-overlay.pine`
- `test/pine-overlay.test.ts`
- `docs/pine/objective-drawing-overlay.md`
- `docs/adr/0006-objective-pine-drawing-overlay.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `README.md`
- `docs/handoffs/issue-61-clean-pine-levels.md`

## Checks

- `npm install`
- `npm run test:pine` passed
- `npm test` passed, 166 tests
- `npm run lint` passed
- `npm run typecheck` passed
