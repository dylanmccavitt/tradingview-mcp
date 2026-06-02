# Issue 38 - Direct Chart State And Manipulation Tools

## Status

Implemented on `feat/issue-38-direct-chart-state-tools`, restacked from
`feat/issue-37-raw-ui-selector-actions` after the stacked review found sibling
PR conflicts with issue #37. Draft PR #48 should remain stacked until #37 merges,
then be retargeted to `main`.

The raw-gated MCP surface now registers these additional tools only when
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is enabled:

- `tradingview_raw_chart_state`
- `tradingview_raw_set_symbol`
- `tradingview_raw_set_timeframe`
- `tradingview_raw_set_chart_type`
- `tradingview_raw_set_visible_range`
- `tradingview_raw_add_indicator`
- `tradingview_raw_remove_entity`

The tools target only the active local TradingView chart target through the
existing raw health/client path. They return compact before/after chart state
or explicit failure reasons when TradingView does not expose the required chart
API. The default high-level MCP surface remains unchanged when the raw gate is
absent.

## Next

Keep PR #48 draft/stacked while #37 / PR #47 is open. After #37 is merged or
retargeted, retarget PR #48 as needed and then mark it ready for review.

## Risks

- PR #47 is the parent dependency; do not treat this branch as based on
  canonical `main` until the stack is merged or retargeted.
- TradingView charting-library APIs may not be exposed in all desktop chart
  sessions. The tools report API-unavailable failures instead of scraping broad
  internals.
- The direct chart-control tools are MCP-only in this slice. Existing `tv:raw`
  CLI commands remain limited to evaluate/click/keypress/type-text plus
  selector and scroll primitives from issue #37.

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
- `docs/handoffs/issue-38-direct-chart-state-tools.md`

## Checks

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
