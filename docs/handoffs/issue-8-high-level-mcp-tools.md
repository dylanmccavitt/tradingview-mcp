# Issue 8 High-Level MCP Tools Handoff

## Status

Implementation complete in branch `feat/issue-8-expose-high-level-mcp-tools`.

The stdio MCP server now registers only high-level v1 charting tools:

- `tradingview_connect`
- `tradingview_status`
- `tradingview_list_universe`
- `tradingview_chart_symbol`
- `tradingview_chart_universe`
- `tradingview_capture_current_chart`
- `tradingview_build_chartbook`

Each tool description includes the v1 guardrails: charting-only, no scanner/ranking behavior, no financial-advice claims, and no broker/order actions. No raw click, type, evaluate, or generic browser-control tools are registered.

`tradingview_capture_current_chart` writes a local current-chart screenshot plus matching objective overlay drawing JSON without navigating the chart to a different symbol.

## Next

Open PR review for issue #8. Stay on issue #8 until it is reviewed and merged; do not start issue #9 from this worktree.

For live validation, configure Codex to run the built server over stdio, or launch a local MCP client against `node dist/src/index.js`, then verify the advertised tools match the list above.

## Risks

- Automated MCP tests use in-memory transports and injected handlers. They validate registration, instructions, guardrail descriptions, structured status output, request validation, and universe charting order without a live TradingView session.
- Live TradingView capture was not run for this issue because acceptance only requires registration and validation tests without a live TradingView session.
- A non-invasive live health probe on `127.0.0.1:9222` returned `cdp-unreachable`, so live MCP chart/capture tools were not exercised against TradingView Desktop.
- Current-chart capture depends on the existing CDP chart target and objective overlay payload shape.
- The MCP tools remain charting/prep only. They do not scan, rank, recommend trades, place orders, use broker APIs, or bypass TradingView access controls.

## Files

- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/adr/0009-high-level-mcp-tool-surface.md`
- `docs/handoffs/issue-8-high-level-mcp-tools.md`
- `package.json`
- `package-lock.json`
- `src/mcp/tradingview-tools.ts`
- `src/server.ts`
- `src/tradingview/current-chart-capture.ts`
- `test/mcp-tools.test.ts`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm test -- --test-name-pattern=mcp`
- `npm run lint`
- `npm test`
- `npm run test:pine`
- `npm run build`
- `node dist/src/cli.js --help`
- `npm start < /dev/null`
- `npm run tv:health -- --port 9222 --timeout-ms 2500` (expected exit 1 because CDP was unreachable)
