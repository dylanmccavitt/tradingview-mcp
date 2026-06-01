# Issue 7 Chartbook Output Handoff

## Status

Implementation complete in branch `feat/issue-7-build-chartbook-output`.
PR #17 was opened and reviewed locally with the checks below.

The chartbook workflow now builds deterministic local sessions under `artifacts/tradingview-chartbooks/<session-id>/`, resolves local universe selections, writes per-symbol notes, writes weekly/daily/65-minute screenshots when CDP capture succeeds, writes matching `*-levels.json` artifacts for every timeframe, and records partial failures without deleting successful captures.

## Next

Merge PR #17, then start issue #8 from updated `main`.

For live validation, launch TradingView Desktop with CDP, open a chart with the manually installed `TVMCP Objective Drawing Overlay`, then run:

```bash
npm run tv:chartbook -- --group semis --tier core --session manual-smoke --port 9222
```

## Risks

- Automated tests use fake CDP clients and fixture-like Pine payloads. They validate artifact creation and partial-failure behavior, but not the current live TradingView Desktop payload shape.
- A review-time health probe on `127.0.0.1:9222` returned CDP unreachable because the current TradingView Desktop session was not launched with the remote debugging port.
- A live chartbook run intentionally was not executed in this thread because it would navigate the current TradingView chart session.
- Chartbook output remains review/prep only. It does not scan, rank, recommend trades, place orders, use broker APIs, or bypass TradingView access controls.

## Files

- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/adr/0008-chartbook-output-artifacts.md`
- `docs/handoffs/issue-7-build-chartbook-output.md`
- `package.json`
- `src/chartbook/chartbook.ts`
- `src/cli.ts`
- `test/chartbook.test.ts`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:pine`
- `npm run build`
- `node dist/src/cli.js --help`
- `node dist/src/cli.js chartbook --group missing --tier core --json` (expected exit 2)
- `npm run tv:health -- --port 9222 --timeout-ms 2500` (expected exit 1 because CDP was unreachable)
