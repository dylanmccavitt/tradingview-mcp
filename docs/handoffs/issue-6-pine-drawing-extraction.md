# Issue 6 Pine Drawing Extraction Handoff

## Status

Implementation complete in branch `feat/issue-6-extract-pine-drawing-data`.
PR #16 was reviewed locally with the automated checks below.

## Next

Merge PR #16, then start issue #7 from updated `main`.

For live validation, launch TradingView Desktop with CDP, open a chart with the manually validated `TVMCP Objective Drawing Overlay` installed, then run:

```bash
npm run tv:drawings -- --port 9222 --json
```

## Risks

- Automated tests use fixture-like CDP payloads by design; they do not prove the current live TradingView Desktop internals expose every Pine drawing object.
- A review-time live probe on `127.0.0.1:9222` returned CDP unreachable because the current TradingView Desktop session was not launched with the remote debugging port.
- The live page probe is bounded and compact. If TradingView changes or hides its chart/widget payloads, extraction may return the visible study with no supported drawing objects and a warning.
- Normal extraction output omits raw TradingView internals. Use `--debug` only to diagnose payload shape.
- The extractor remains charting-only. It does not scan, rank, advise, place orders, use broker APIs, or bypass TradingView access controls.

## Files

- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/adr/0007-structured-pine-drawing-extraction.md`
- `docs/handoffs/issue-6-pine-drawing-extraction.md`
- `docs/pine/objective-drawing-overlay.md`
- `package.json`
- `src/cli.ts`
- `src/tradingview/pine-drawing-page.ts`
- `src/tradingview/pine-drawing-runner.ts`
- `src/tradingview/pine-drawings.ts`
- `test/pine-drawing-runner.test.ts`
- `test/pine-drawings.test.ts`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run test:pine`
- `npm run build`
- `node dist/src/cli.js --help`
- `node dist/src/cli.js drawings --json --timeout-ms 1` (expected exit 1 with CDP-unreachable failure)
- `npm start < /dev/null`
- `npm run tv:health -- --port 9222 --timeout-ms 2500` (review-time live probe; expected exit 1 because CDP was unreachable)
