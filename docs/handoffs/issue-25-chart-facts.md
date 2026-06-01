# Issue 25 - Structured Chart Facts

## Status

Implemented on `feat/issue-25-chart-facts`. The chartbook and current-chart
artifact paths now include profile-aware structured facts derived from the
objective overlay extraction. The MCP current-chart and chartbook tools accept
the stable `focus`, `breakout`, `squeeze`, and `momentum` profiles.

## Next

Push the branch, open the PR with `Closes #25`, and merge after the follow-up
review stays clean.

## Risks

- Facts are limited to extracted overlay data and explicit chart context.
  TradingView may not expose a current price, compression box, AVWAP, or timing
  levels for every chart; those cases surface as warnings.
- No live TradingView Desktop run was performed in this thread; validation used
  fixture-style unit tests and fake CDP clients.

## Files

- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `src/chart-analysis/chart-facts.ts`
- `src/chartbook/chartbook.ts`
- `src/cli.ts`
- `src/mcp/tradingview-tools.ts`
- `src/tradingview/current-chart-capture.ts`
- `src/tradingview/pine-drawings.ts`
- `test/chart-facts.test.ts`
- `test/chartbook.test.ts`
- `test/current-chart-capture.test.ts`
- `test/mcp-tools.test.ts`

## Checks

- `npm run typecheck`
- `npm test`
- `npm run lint`
- `git diff --check`

`npm run test:pine` was not required because the Pine overlay source did not
change.
