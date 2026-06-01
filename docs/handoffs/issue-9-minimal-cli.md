# Issue 9 Minimal CLI Handoff

## Status

Implementation complete in branch `feat/issue-9-add-minimal-cli`.

The repo already had a broader CLI from earlier issues, so this issue reconciled
the explicit acceptance criteria by adding the missing direct `chart-universe`
smoke command. The new command resolves configured local universe symbols and
charts them through a shared `chartUniverse` runner. The MCP
`tradingview_chart_universe` tool now uses the same runner instead of keeping a
separate charting loop.

The CLI exposes the issue-requested setup/debug commands:

- `launch`
- `health`
- `chart`
- `chart-universe`

Human-readable output is the default, and `--json` returns structured results.
Focused CLI tests cover `launch`, `health`, `chart`, and `chart-universe`
argument parsing and output formatting without requiring live TradingView.

## Next

Open PR against `main`, then request human review. If live chart navigation is
desired, launch TradingView Desktop with CDP enabled and run:

```bash
npm run tv:chart-universe -- --group semis --tier core --port 9222
```

That command will navigate the active chart target through each resolved symbol
and timeframe.

## Risks

- Live `chart-universe` capture was not run because the non-invasive health
  probe on `127.0.0.1:9222` returned `cdp-unreachable`.
- Running live `chart-universe` will navigate the active TradingView chart tab,
  so it should be done only when the user is ready for chart navigation.
- `npm run test:pine` was not run because this issue did not change Pine source,
  Pine extraction, or overlay behavior.

## Files

- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/handoffs/issue-9-minimal-cli.md`
- `package.json`
- `src/cli.ts`
- `src/mcp/tradingview-tools.ts`
- `src/tradingview/chart-universe-runner.ts`
- `test/cli-core.test.ts`
- `test/cli-chart-universe.test.ts`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm test -- --test-name-pattern=chart-universe`
- `npm test -- --test-name-pattern=CLI`
- `npm run lint`
- `npm test`
- `npm run build`
- `node dist/src/cli.js --help`
- `node dist/src/cli.js chart-universe --group missing --tier core --json`
  (expected exit `2`)
- `npm run tv:health -- --port 9222 --timeout-ms 2500` (expected exit `1`,
  CDP unreachable)
- `npm start < /dev/null`
