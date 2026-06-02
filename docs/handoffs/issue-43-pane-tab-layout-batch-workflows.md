# Issue 43 - Pane, Tab, Layout, And Batch Workflow Controls

## Status

Implemented on `feat/issue-43-add-pane-tab-layout-and-batch-chart-workflow-controls`.

The default MCP surface remains unchanged. When
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is enabled, the gated raw MCP surface
now also registers:

- `tradingview_raw_list_tabs`
- `tradingview_raw_focus_tab`
- `tradingview_raw_list_panes`
- `tradingview_raw_focus_pane`
- `tradingview_raw_set_pane_layout`
- `tradingview_raw_list_layouts`
- `tradingview_raw_switch_layout`
- `tradingview_raw_batch_chart`

The workspace tools stay local-chart scoped. Tab listing filters CDP targets to
TradingView chart pages, and tab focus uses the selected target id plus
`Page.bringToFront`. Pane and layout tools use exposed TradingView chart/widget
APIs only and report unsupported cases clearly. The batch tool applies bounded
explicit symbol/timeframe steps in caller-provided order and reports per-step
results; it does not scan, rank, score, alert, recommend, or generate
candidates.

## Next

Commit, push, open the PR for issue #43, request review, address any findings,
then merge once checks and review are complete.

## Risks

- TradingView pane and saved-layout APIs are not stable public APIs. The tools
  fail with explicit unsupported-API errors when those methods are absent.
- Batch chart actions are intentionally limited to explicit symbol/timeframe
  steps and do not capture screenshots or generate chartbook artifacts.
- Tab focus depends on CDP exposing a page WebSocket for the selected
  TradingView chart target.

## Files

- `src/tradingview/raw-automation.ts`
- `src/mcp/tradingview-tools.ts`
- `src/domain.ts`
- `test/raw-automation.test.ts`
- `test/mcp-tools.test.ts`
- `test/domain.test.ts`
- `test/docs-v1-workflow.test.ts`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/handoffs/issue-43-pane-tab-layout-batch-workflows.md`

## Checks

- `npm install`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
