# Issue 3 Chart One Symbol Handoff

## Status

Implementation complete in branch `feat/issue-3-chart-one-symbol-end-to-end`.

## Next

Review PR for issue #3 and run live TradingView validation on a machine with TradingView Desktop launched with CDP and a chart tab open.

## Risks

- Automated tests use fake health and chart-page clients by design; they do not prove a live TradingView Desktop session can navigate or render charts on this machine.
- The live path depends on TradingView Desktop exposing a chart target `webSocketDebuggerUrl`.
- The render wait checks URL `symbol` and `interval` parameters plus a sized canvas; if TradingView changes URL behavior, the live command may need a more specific render signal.

## Files

- `.gitignore`
- `package.json`
- `package-lock.json`
- `README.md`
- `AGENTS.md`
- `docs/architecture.md`
- `docs/adr/0004-one-symbol-chart-capture.md`
- `docs/handoffs/issue-3-chart-one-symbol.md`
- `src/cli.ts`
- `src/tradingview/cdp-session.ts`
- `src/tradingview/chart-page.ts`
- `src/tradingview/chart-plan.ts`
- `src/tradingview/chart-runner.ts`
- `test/chart-plan.test.ts`
- `test/chart-runner.test.ts`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `node dist/src/cli.js --help`
- `node dist/src/cli.js chart --symbol NVDA` (expected exit 2; verifies exchange-qualified symbol validation before live CDP use)
- `node dist/src/cli.js chart --symbol NASDAQ:NVDA --timeout-ms 1 --json` (expected exit 1 with per-timeframe CDP-unreachable failures because no live TradingView CDP session was open)
- `npm start < /dev/null`
