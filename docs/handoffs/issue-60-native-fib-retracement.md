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

## Next

Open a PR for issue #60, run independent review, address findings, then merge
and sync canonical `main`.

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
- `npm run tv:health -- --port 9333`
- Live native Fib draw/list/capture script through `dist/src/tradingview/raw-automation.js`
- Live GOOGL chart redraw/list/capture on port `9333`
