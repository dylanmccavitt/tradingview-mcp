# Issue 41 - Pine Editor Automation Tools

## Status

Implemented on `feat/issue-41-pine-editor-tools`.

The default MCP surface remains unchanged. When
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is enabled, the gated MCP surface now
also registers:

- `tradingview_pine_open_editor`
- `tradingview_pine_set_source`
- `tradingview_pine_get_source`
- `tradingview_pine_get_errors`
- `tradingview_pine_get_console`
- `tradingview_pine_compile`
- `tradingview_pine_save`

The Pine tools target only the active local TradingView chart target found by
the existing CDP health flow. Set source, compile, and save are explicit
separate calls. Source retrieval is bounded by default and returns truncation
warnings when the editor source exceeds the requested limit.

## Next

Push the branch, open PR for issue #41, run review, address any findings, then
merge when review and remote checks are complete.

## Risks

- TradingView's Pine Editor and Monaco/React surfaces are not stable public
  APIs. The tools report unsupported editor/API failures clearly instead of
  scraping non-chart targets.
- `tradingview_pine_compile` depends on visible Pine Editor compile/add/update
  buttons. If TradingView changes the button text or hides controls, the tool
  will fail with an explicit not-found message.
- `tradingview_pine_save` is intentionally separate from source setting and
  compile. Callers must only invoke it when the user explicitly wants to save
  the current Pine Editor source.

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
- `docs/handoffs/issue-41-pine-editor-automation-tools.md`

## Checks

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
