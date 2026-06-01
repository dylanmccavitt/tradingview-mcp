# Universe Expansion Handoff

## Status

The tracked sample universe was expanded with larger core and extended tiers for
the existing groups and a new `cybersecurity` group. The requested `$AI` and
`$S` symbols are present as `NYSE:AI` in `ai-software` core and `NYSE:S` in
`cybersecurity` core.

Follow-up fix: `PLTR` and `SHOP` now use their current TradingView U.S. listings,
`NASDAQ:PLTR` and `NASDAQ:SHOP`. Shopify is also included in
`enterprise-software` core so it appears in the core watchlist import file.

## Next

Use `npm run tv:universe -- list` or resolve a selected group before running a
chartbook. No live TradingView Desktop validation is required for the local
config change itself.

## Risks

- The tracked universe is a charting watchlist sample, not financial advice or a
  scanner/ranking result.
- Expanded `all` selections now produce materially larger chartbook runs.
- User-local overrides should continue to live in ignored paths such as
  `config/universe.local.json`.
- TradingView import files under `artifacts/tradingview-watchlists/` are
  generated local artifacts and should be regenerated after universe symbol
  changes.

## Files

- `README.md`
- `config/universe.sample.json`
- `docs/architecture.md`
- `docs/handoffs/universe-expansion.md`
- `src/domain.ts`
- `test/cli-universe.test.ts`
- `test/universe-config.test.ts`

## Checks

- `node -e "JSON.parse(require('fs').readFileSync('config/universe.sample.json','utf8')); console.log('json ok')"`
- `npm run tv:universe -- list`
- `npm run tv:universe -- resolve --group cybersecurity --tier core`
- `npm run tv:universe -- resolve --group ai-software,cybersecurity --tier all --json`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run tv:universe -- resolve --group ai-software --tier core`
- `npm run tv:universe -- resolve --group enterprise-software --tier core`
- `npm test -- --test-name-pattern=universe`
- `npm run tv:chart -- --symbol NASDAQ:PLTR --port 9333 --render-timeout-ms 20000`
- `npm run tv:chart -- --symbol NASDAQ:SHOP --port 9333 --render-timeout-ms 20000`
