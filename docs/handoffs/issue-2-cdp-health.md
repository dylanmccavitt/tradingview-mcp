# Issue 2 CDP Health Handoff

## Status

Implementation complete in branch `feat/issue-2-connect-tradingview-desktop-over-cdp`.

## Next

Open the PR for issue #2, confirm CI, and review the TradingView launch/health commands on a machine with TradingView Desktop installed.

## Risks

- Automated tests use fake CDP responses by design; they do not prove a live TradingView Desktop session is installed or open on this machine.
- `npm run tv:launch` does not force-quit an existing TradingView process. If TradingView is already running without CDP, quit it first and re-run the launch command.
- Later chart-control work still needs explicit implementation and tests.

## Files

- `package.json`
- `package-lock.json`
- `README.md`
- `AGENTS.md`
- `CONTEXT.md`
- `docs/architecture.md`
- `docs/adr/0003-tradingview-desktop-cdp-health.md`
- `docs/handoffs/issue-2-cdp-health.md`
- `src/cli.ts`
- `src/tradingview/cdp.ts`
- `src/tradingview/desktop.ts`
- `src/tradingview/health.ts`
- `src/tradingview/targets.ts`
- `test/tradingview-health.test.ts`
- `test/tradingview-targets.test.ts`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `node dist/src/cli.js --help`
- `npm start < /dev/null`
