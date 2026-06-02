# Issue 39 - Native TradingView Drawing Tools

## Status

Implemented on `feat/issue-39-native-tradingview-drawing-tools`.

The raw-gated MCP surface now registers these native drawing tools only when
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is enabled:

- `tradingview_draw_shape`
- `tradingview_draw_list`
- `tradingview_draw_properties`
- `tradingview_draw_remove`
- `tradingview_draw_clear_all`

`tradingview_draw_shape` supports horizontal line, trend line, rectangle, and
text drawings from explicit price/time anchors. The tools use exposed
TradingView chart/drawing APIs only and return clear failure reasons when
required APIs such as `createShape()`, `createMultipointShape()`,
`getAllShapes()`, `getShapeById()`, `removeEntity()`, or `removeAllShapes()`
are unavailable. `tradingview_draw_clear_all` requires
`confirmClearAll: true` because it removes every native drawing on the active
chart.

## Next

Push the branch, open the PR for issue #39, run review, address findings, then
merge and sync canonical `main`.

## Risks

- TradingView native chart/drawing APIs are unstable and may not be exposed in
  every Desktop chart session. The tools intentionally report unsupported API
  failures instead of scraping broad internals.
- Native drawing tools are MCP-only in this slice. The existing `tv:raw` CLI
  remains limited to evaluate/input/selector/scroll primitives.
- Clear-all is destructive by design and must only run through the explicit
  confirmation schema and caller intent.

## Files

- `src/tradingview/raw-automation.ts`
- `src/mcp/tradingview-tools.ts`
- `test/raw-automation.test.ts`
- `test/mcp-tools.test.ts`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/handoffs/issue-39-native-tradingview-drawing-tools.md`

## Checks

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
