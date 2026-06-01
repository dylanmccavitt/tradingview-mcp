# Issue 24: Quieter Focus Preset

## Status

Implemented on `feat/issue-24-quieter-focus-preset`.

The Pine overlay now defaults `Style preset` to `focus`, keeps `clean`, `levels`,
and `full-debug` available, and reduces chart-visible objects by review
timeframe:

- Weekly `focus`: prior month levels, 50D high/low levels, anchored VWAP, and compact table context.
- Daily `focus`: prior week levels, 20D/50D high levels, anchored VWAP, and active compression range box when present.
- 65-minute `focus`: prior day levels, opening-range levels, anchored VWAP, and compact table context.

Inline level labels are hidden in `focus`; price-scale plots remain in place for
the objective levels so chartbook JSON extraction can still recover visible
values through the existing plot-title contract.

Subagent review found that the compact legend fallback parser also needed to
recognize the new `focus` preset. That compatibility fix and regression test
are included.

Follow-up subagent review found stale `docs/v1-workflow.md` install guidance
that still directed normal review to `levels`. The workflow doc now points
normal weekly/daily/65-minute review at default `focus`, with `levels` reserved
for deeper level/zone review.

Final subagent review found the top-level `README.md` still listed only the old
preset set. The README now documents default `focus` and the preserved heavier
presets.

## Next

Open the pull request review/merge flow. Live TradingView visual validation is
still needed after the updated Pine source is manually installed in TradingView
Desktop.

## Risks

- Local static checks cannot compile Pine in TradingView or prove chart
  readability. The new `focus` table and object mix still need human visual
  inspection on weekly, daily, and 65-minute charts.
- Extraction compatibility is preserved by keeping plot titles and plot order
  stable, but live TradingView legend/payload behavior still depends on the
  installed study rendering normally.

## Files

- `pine/objective-drawing-overlay.pine`
- `src/tradingview/pine-drawings.ts`
- `docs/pine/objective-drawing-overlay.md`
- `docs/v1-workflow.md`
- `README.md`
- `docs/architecture.md`
- `docs/adr/0006-objective-pine-drawing-overlay.md`
- `test/pine-overlay.test.ts`
- `test/pine-drawings.test.ts`
- `test/docs-v1-workflow.test.ts`
- `docs/handoffs/issue-24-quieter-focus-preset.md`

## Checks

- `npm install`
- `npm run test:pine`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- Subagent review: initial P1 fixed; follow-up P2 fixed; README P2 fixed; final follow-up review pending.
