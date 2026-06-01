# Issue 21 Pine Levels JSON Extraction

## Status

Implemented. The extractor now recovers objective plot levels from compact
TradingView legend text for the configured `TVMCP Objective Drawing Overlay`
study, and chartbook extraction retries briefly after each navigation so
`*-levels.json` artifacts do not capture the transient empty-legend state.

## Next

Open the PR for `feat/issue-21-improve-levels-json-extraction`, run the
requested PR review, and merge if the review is clean.

## Risks

- The legend fallback depends on the tracked overlay's Pine plot order. If the
  plot order changes, update the extraction constants and fixture tests
  together.
- Legend fallback recovers plotted levels only. Zones, labels, and tables remain
  empty when TradingView does not expose structured internals.

## Files

- `src/tradingview/pine-drawings.ts`
- `src/tradingview/pine-drawing-page.ts`
- `src/chartbook/chartbook.ts`
- `test/pine-drawings.test.ts`
- `test/chartbook.test.ts`
- `README.md`
- `CONTEXT.md`
- `docs/architecture.md`
- `docs/pine/objective-drawing-overlay.md`
- `docs/handoffs/issue-21-pine-levels-json-extraction.md`

## Checks

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run test:pine`
- `npm run tv:health -- --port 9333`
- `npm run tv:drawings -- --port 9333 --json`
- `npm run tv:chartbook -- --group semis --tier core --port 9333 --session issue-21-e2e-retry`

Live chartbook validation wrote 15/15 successful semis-core screenshot and
levels JSON pairs under
`artifacts/tradingview-chartbooks/issue-21-e2e-retry`, with non-empty recovered
levels in every `*-levels.json` file.
