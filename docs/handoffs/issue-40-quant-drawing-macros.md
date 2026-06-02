# Issue 40 - Quant Drawing Macros

## Status

Implemented on `feat/issue-40-quant-drawing-macros` and opened as PR #50.

The raw-gated MCP surface now registers these higher-level macro tools only
when `TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is enabled:

- `tradingview_draw_fib_levels`
- `tradingview_draw_projection`

`tradingview_draw_fib_levels` creates Fib-style retracement/extension drawing
sets from explicit high/low price-time anchors. `tradingview_draw_projection`
creates measured-move or range-projection drawing sets from explicit anchors or
caller-selected extracted range facts. Both tools use native TradingView
drawing APIs only, return created drawing ids, anchors, levels, and warnings,
and frame output as chart-review context only, not predictions,
recommendations, rankings, or advice.

Current-chart capture and chartbook artifact requests can record returned macro
metadata through an explicit `macroMetadata` field. Normal artifacts remain
unchanged when no macro metadata is supplied.

Subagent review found one minor compactness issue for bidirectional range
projections. The implementation now caps range-projection emitted levels, not
just raw multiplier count, and tests cover the `direction: "both"` overflow
case.

## Next

Merge PR #50 when remote state is still mergeable, then sync canonical `main`.

## Risks

- TradingView native chart/drawing APIs are unstable and may not be exposed in
  every Desktop chart session. Macro tools intentionally report unsupported API
  failures instead of scraping broader internals.
- Macro tools draw mechanical review levels only. Callers must not present
  projected levels as advice, predictions, rankings, or trade recommendations.
- Artifact macro recording is explicit. Callers must pass the macro metadata
  returned by a macro tool into capture/chartbook requests when they want the
  JSON artifact to record it.

## Files

- `src/tradingview/drawing-macros.ts`
- `src/tradingview/raw-automation.ts`
- `src/mcp/tradingview-tools.ts`
- `src/tradingview/current-chart-capture.ts`
- `src/chartbook/chartbook.ts`
- `test/drawing-macros.test.ts`
- `test/raw-automation.test.ts`
- `test/mcp-tools.test.ts`
- `test/current-chart-capture.test.ts`
- `test/chartbook.test.ts`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/handoffs/issue-40-quant-drawing-macros.md`

## Checks

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
