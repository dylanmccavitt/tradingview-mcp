# Issue 72 - Intraday 9 EMA Chop Review Overlay

## Status

Implemented on `feat/issue-72-intraday-9ema-chop`.

Added a standalone manually installed Pine overlay with visible study name
`TVMCP Intraday 9 EMA Chop Review`. The overlay is separate from the objective
drawing-extraction overlay and is scoped to SPY/QQQ 5-minute and 15-minute
manual review.

The source plots only the 9 EMA, shows a compact support/chop/slope table,
lightly shades objective chop areas, and marks closed-bar bounce, rejection,
reclaim, and loss review points only when the chop filter is inactive.

## Next

PR #73 is open with `Closes #72`. Next, manually open the Pine Editor in
TradingView Desktop, install/compile the source, then visually validate SPY and
QQQ on 5-minute and 15-minute charts.

## TradingView MCP Validation

Attempted live validation through the TradingView MCP on port `9333`.

What worked:

- `tradingview_status` reported a healthy TradingView Desktop chart target.
- `tradingview_raw_set_symbol` changed the active chart to `AMEX:SPY`.
- `tradingview_raw_set_timeframe` changed the active chart to `5`.
- `tradingview_capture_current_chart` wrote a screenshot and levels JSON under
  `/Users/dylanmccavitt/projects/tradingview-mcp/artifacts/tradingview-validation/issue-72-spy-5m-mcp-validation/`.
- After the Pine Editor was opened manually, `tradingview_pine_set_source`
  loaded the script into the editor and `tradingview_pine_get_source` read back
  the full 76-line source.
- `tradingview_pine_get_errors` reported zero Pine errors. It initially caught
  a long-shorttitle warning; the repo source now uses the shorter `9EMA Rev`
  shorttitle and the warning is resolved.

What remains blocked:

- `tradingview_pine_compile` could not find a visible Pine compile,
  add-to-chart, or update button.
- `tradingview_pine_save` and later runtime-based calls timed out after the
  editor source interaction.
- `tradingview_raw_add_indicator` could not add
  `TVMCP Intraday 9 EMA Chop Review` before save/install because TradingView
  did not yet know a saved study with that name.
- The capture JSON reported `Study 'TVMCP Intraday 9 EMA Chop Review' was not
  found in the compact TradingView payload.`

This means MCP chart routing and screenshot capture were validated, but Pine
source loading and syntax validation were also validated after the editor was
opened manually. The remaining manual pass is clicking the visible add/update
control, then visually checking overlay readability on SPY/QQQ 5-minute and
15-minute charts.

## Risks

- Static tests validate the Pine/source-doc contract only. TradingView visual
  readability still needs a human pass.
- The overlay source was loaded into Pine Editor and had zero Pine error
  markers, but the MCP compile/add/update click remains blocked by the visible
  button not being discoverable.
- The overlay intentionally does not modify the existing
  `TVMCP Objective Drawing Overlay` extraction contract.

## Files

- `pine/intraday-9ema-chop-review.pine`
- `docs/pine/intraday-9ema-chop-review.md`
- `docs/architecture.md`
- `test/pine-overlay.test.ts`
- `docs/handoffs/issue-72-intraday-9ema-chop-review.md`

## Checks

- `npm run test:pine` passes.
- `npm test` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `git diff --check` passes.
- TradingView MCP partial live validation: chart target healthy on port `9333`,
  SPY 5-minute chart routing and screenshot capture pass; Pine source load and
  readback pass; Pine error markers report zero errors; add/update click remains
  blocked by the visible button not being discoverable.
