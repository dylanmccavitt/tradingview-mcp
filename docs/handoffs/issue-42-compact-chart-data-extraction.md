# Issue 42 - Compact Chart Data Extraction Tools

## Status

Implemented on `feat/issue-42-compact-chart-data-extraction-tools`.

The default MCP surface remains unchanged. When
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is enabled, the gated MCP surface now
also registers:

- `tradingview_raw_chart_data_summary`
- `tradingview_raw_quote_snapshot`
- `tradingview_raw_study_values`

The chart data tools target only the active local TradingView chart target found
by the existing CDP health flow. They return bounded recent OHLCV summary stats,
latest current-bar quote fields, and compact visible study values when
TradingView exposes them. Output is review context only, not a scan, ranking,
alert, generated candidate, recommendation, market-data service replacement, or
financial advice.

## Next

Commit, push, open the PR for issue #42, request review, and address any
findings before merge.

## Risks

- TradingView's chart data and data-window study APIs are not stable public
  APIs. The tools report unsupported-data failures when the active chart does
  not expose bars or study values.
- OHLCV summary extraction is intentionally bounded. It does not provide raw
  historical data dumps or watchlist-wide scans.
- Study values depend on visible studies exposing compact data-window or value
  fields. Hidden or unsupported studies may be omitted with warnings.

## Files

- `src/tradingview/raw-automation.ts`
- `src/mcp/tradingview-tools.ts`
- `src/domain.ts`
- `test/raw-automation.test.ts`
- `test/mcp-tools.test.ts`
- `test/docs-v1-workflow.test.ts`
- `test/domain.test.ts`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/handoffs/issue-42-compact-chart-data-extraction.md`

## Checks

- `npm install`
- `npm run typecheck`
- `npm run build && node --test dist/test/raw-automation.test.js dist/test/mcp-tools.test.js`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
