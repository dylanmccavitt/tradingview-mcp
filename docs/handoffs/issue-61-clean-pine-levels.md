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

PR #71 is open from `feat/issue-61-clean-pine-levels-recovery` to `main`:
https://github.com/DylanMcCavitt/tradingview-mcp/pull/71

Stop before merge until the user explicitly approves merging.

Human visual inspection is partially run but not yet a clean pass. TradingView
Desktop is reachable on port `9333`, the active chart includes the study
`TVMCP Objective Drawing Overlay`, and weekly/daily/65-minute screenshots were
captured after the TradeStation bottom panel was collapsed. The screenshots are
not isolated enough to prove the issue #61 presentation because the active chart
still includes unrelated studies and drawings:

- `Swing high low support & resistance, by Patternsmart.com`
- `Smart Money Concepts [LuxAlgo]`
- two `Moving Average Exponential` studies
- `Squeeze Momentum Indicator [LazyBear]`
- three native drawings: `trend_line`, `long_position`, and `fib_retracement`

Next human proof step: hide or remove unrelated studies/drawings on a disposable
or temporary layout so only the objective overlay plus expected baseline chart
context remain, then recapture weekly, daily, and 65-minute screenshots.

## Risks

- Static tests validate the source/docs contract but do not prove chart
  readability in TradingView.
- Live TradingView visual validation in this recovery worktree is partial, not
  countable as a clean human pass, because unrelated active chart layers obscure
  the overlay.
- Prior live extraction on the old branch found the study but returned zero
  extracted levels because TradingView exposed the study without compact
  plot/drawing values. Treat that as a live extraction/API exposure limitation
  to revisit if chartbook levels remain empty after manual visual validation.
- In the current proof run, `npm run tv:drawings -- --port 9333 --json` found
  `TVMCP Objective Overlay` but returned zero extracted levels/zones/labels with
  legend-only fallback warnings.

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
- `npm run tv:health -- --port 9333` passed against the real TradingView
  Desktop process.
- `tradingview_raw_list_tabs` on port `9333` found one chart target:
  `D5A291B1C7109D8657F2C695709C2300`.
- `tradingview_raw_chart_state` on port `9333` confirmed active symbol
  `NASDAQ:NVDA`, timeframe `65`, and active study
  `TVMCP Objective Drawing Overlay`.
- `tradingview_draw_list` on port `9333` found three unrelated native drawings:
  `trend_line`, `long_position`, and `fib_retracement`.
- Partial human-proof screenshots captured after the bottom panel was collapsed:
  - `artifacts/human-proof/issue-61-nvda-clean-panel/NASDAQ-NVDA/NASDAQ-NVDA-weekly.png`
  - `artifacts/human-proof/issue-61-nvda-clean-panel/NASDAQ-NVDA/NASDAQ-NVDA-daily.png`
  - `artifacts/human-proof/issue-61-nvda-clean-panel/NASDAQ-NVDA/NASDAQ-NVDA-65-minute.png`
