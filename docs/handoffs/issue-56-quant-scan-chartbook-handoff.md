# Issue 56 - Quant Scan Chartbook Handoff Input

## Status

Implemented on `feat/issue-56-quant-scan-handoff-input`.

TradingView MCP chartbooks now accept Quant Scan setup-scan handoff input via
`--quant-scan-handoff` in the CLI and `quantScanHandoffPath` in the MCP
`tradingview_build_chartbook` tool. The path can point at a setup-scan run
directory, `scan.json`, or `chartbook.universe.local.json`.

The new parser charts only the explicit handoff candidates in Quant Scan order.
When `scan.json` is available, per-symbol chartbook metadata preserves the scan
run id, scan order, setup lane, matching lanes, score, trigger, invalidation,
warnings, and source artifact paths. `notes.md`, `index.html`, result objects,
and each `*-levels.json` artifact carry the context for manual chart review.

## Next

Open a PR with `Closes #56`, run independent review, address any findings, and
merge if clean. After merge, sync canonical `main` and start issue #57 in a new
thread only if GitHub still shows it open and `ready-for-agent`.

## Risks

- Universe-only `chartbook.universe.local.json` input can preserve symbol order
  but cannot invent lane, score, trigger, or invalidation metadata without a
  sibling `scan.json`.
- No live TradingView Desktop run was performed; tests use fixtures and fake
  chart clients.

## Files

- `src/chartbook/quant-scan-handoff.ts`
- `src/chartbook/chartbook.ts`
- `src/cli.ts`
- `src/mcp/tradingview-tools.ts`
- `test/quant-scan-handoff.test.ts`
- `test/chartbook.test.ts`
- `test/cli-core.test.ts`
- `test/mcp-tools.test.ts`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `docs/handoffs/issue-56-quant-scan-chartbook-handoff.md`

## Checks

- `npm test -- --test-name-pattern "Quant Scan|chartbook|CLI chartbook|MCP.*chartbook"`
- `npm test`
- `npm run lint`
- `npm run typecheck`
