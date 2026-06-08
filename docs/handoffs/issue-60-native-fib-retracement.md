# Issue 60 - Native Fib Retracement Drawing

## Status

Implemented on `feat/issue-60-native-fib-retracement`.

The raw-gated MCP surface now registers `tradingview_draw_fib_retracement`
only when `TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is enabled. The tool
creates one native TradingView `fib_retracement` object through
`createMultipointShape()` from explicit low/high anchors, and returns compact
metadata: entity id, drawing type, anchors, levels/ratios, and review-only
warnings. `tradingview_draw_fib_levels` remains the existing line-based fallback
macro.

Preset-aware drawing tools now accept `drawingPreset` values `clean-thesis`,
`minimal-levels`, and `risk-map`. The default `clean-thesis` applies to direct
shape drawings, native Fib Retracements, Fib-level macros, and projection
macros. Presets enforce 1px line widths and use low-opacity shaded areas for
boxes and Fib backgrounds.

After the user manually adjusted the live GOOGL Fib and drawings for lighter
opacity, no further live redraw was performed. The preset work is code-path
behavior for future drawing calls.

The inherited active-chart resolver patch is preserved: raw chart controls can
fall back from `tvWidget.activeChart()` to watched TradingView chart values
such as `TradingViewApi._activeChartWidgetWV.value()`.

Later live chart-review update on 2026-06-03: TradingView was restarted through
`npm run tv:launch -- --port 9333` after the app had been running without CDP.
`npm run tv:health -- --port 9333` returned healthy, and the active chart was
`BATS:GOOGL` on daily candles. The user manually adjusted the prior live Fib
and annotations; the live chart still listed one native `fib_retracement`
object, `ampg44`, plus the user's manually tweaked support/reclaim annotations.

For the user's earlier-entry review context, a small light/dashed layer was
added without clearing existing drawings:

- `IYmY8K` rectangle: early review zone, `358.44-367.09`.
- `hkX8GK` horizontal line: first reclaim check, `367.09`.
- `XoIhqW` horizontal line: momentum proof/reclaim ladder, `375.97`.
- `rLuPp6` horizontal line: `380-382` confirmation shelf, `382.20`.
- `ZlV1my` rectangle: target band, `388.43-400.00`.
- `LDCnvs` trend line: dashed review path from `365.82` to `396.14`.
- `Emt1sU` text: early review label.
- `34Hiiy` text: `380-382` confirmation label.

An extra target text label `2M2jo2` was removed to reduce clutter. Final live
capture screenshot:
`artifacts/tradingview-current-chart/googl-reclaim-380-review-clean-20260603/current-chart.png`.
The chart capture succeeded for the screenshot, but Pine overlay fact extraction
reported no supported objective overlay drawing payload. Alpaca option data
calls for the June 26 GOOGL chain failed with timeout/upstream transport errors,
so the user's provided 385C context (`4.50`, `.23` delta) remained
user-supplied rather than connector-verified.

Live verification on port `9333` succeeded against the GOOGL chart. The
target URL was `NASDAQ:GOOGL`; the exposed active chart API reported
`BATS:GOOGL` after setting `NASDAQ:GOOGL`.

Initial live verification created native Fib id `0jEhIY`, but it used the
latest day high/low and did not line up with the visible swing. That object was
removed. A later full-swing Fib `A7IXEZ` anchored from `272.11` to `408.61` was
also removed because it was too broad for the user's current gap-bounce thesis.

The current live GOOGL chart state uses a compact gap-base Fib Retracement:
native `fib_retracement` id `ampg44`, anchored from the earnings-gap shelf
`355.79` at timestamp `1777469400` to the May high `408.61` at timestamp
`1779111000`. This is one native TradingView Fib object, not multiple
horizontal lines. It is accompanied by support/projection annotations:
`d2XEcG` rectangle, `tapxL8` and `8HGxmi` horizontal lines, `frCnmc` and
`8kNzWv` arrows, and text ids `kOIh1G`, `xzHh4s`, and `EDK5uf`.
Screenshot artifact:
`artifacts/tradingview-current-chart/googl-gap-base-fib-reclaim-final/current-chart.png`.

Validation rerun on 2026-06-08 from this worktree after `npm install` restored
local dependencies. `npm test`, `npm run lint`, `npm run typecheck`, and
`git diff --check` passed on `feat/issue-60-native-fib-retracement`.

PR opened: https://github.com/DylanMcCavitt/tradingview-mcp/pull/66

Independent review on 2026-06-08 tightened the native Fib review-only warning
so the tool output explicitly says native Fib levels are not predictions,
recommendations, or financial advice. `npm test`, `npm run lint`,
`npm run typecheck`, and `git diff --check` passed after the change.

## Next

Merge PR #66 after final GitHub review, then sync canonical `main`.

## Risks

- TradingView's native chart/drawing APIs remain unstable. The new tool fails
  clearly when `createMultipointShape()` is unavailable.
- `tradingview_draw_properties` failed on the live native Fib object because
  TradingView's property payload did not include a usable drawing id. The
  live verification used `tradingview_draw_list` to confirm the object type.
- The live Fib object `ampg44` and the eight companion chart-review annotations
  remain on the user's GOOGL chart unless the user removes them.

## Files

- `src/tradingview/raw-automation.ts`
- `src/tradingview/drawing-presets.ts`
- `src/mcp/tradingview-tools.ts`
- `test/raw-automation.test.ts`
- `test/mcp-tools.test.ts`
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/handoffs/issue-60-native-fib-retracement.md`

## Checks

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
- 2026-06-08 rerun: `npm test`, `npm run lint`, `npm run typecheck`, and
  `git diff --check`
- 2026-06-08 independent-review rerun: `npm test`, `npm run lint`,
  `npm run typecheck`, and `git diff --check`
- `npm run tv:health -- --port 9333`
- Live native Fib draw/list/capture script through `dist/src/tradingview/raw-automation.js`
- Live GOOGL chart redraw/list/capture on port `9333`
