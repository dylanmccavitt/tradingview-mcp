# Intraday 9 EMA Chop Review Overlay

The standalone intraday timing overlay source lives at:

```text
pine/intraday-9ema-chop-review.pine
```

The required visible TradingView study name is:

```text
TVMCP Intraday 9 EMA Chop Review
```

This overlay is separate from `TVMCP Objective Drawing Overlay`. It is for
manual SPY and QQQ 5-minute and 15-minute chart review only, and it is not part
of the chartbook drawing-extraction contract.

## What It Shows

The overlay uses only the visible chart's OHLCV and TradingView timeframe
context. It does not request higher-timeframe data or external metadata.

It creates:

- one visible 9 EMA line
- a compact top-right table for symbol support, timeframe support, chop state,
  and 9 EMA slope state
- light chart shading when objective chop conditions are active
- closed-bar 9 EMA review markers when the chop filter is inactive

Chop state is derived from objective chart conditions:

- low ADX
- low range efficiency
- compressed recent range versus ATR
- repeated 9 EMA crosses

The review marker labels are deliberately manual: `Bounce`, `Reject`,
`Reclaim`, and `Loss`. They are visual review points only.

## Manual Install

1. Open TradingView Desktop.
2. Open a SPY or QQQ chart.
3. Switch the chart to 5-minute or 15-minute.
4. Open the Pine Editor panel.
5. Paste the contents of `pine/intraday-9ema-chop-review.pine`.
6. Save the script with the exact name `TVMCP Intraday 9 EMA Chop Review`.
7. Add the script to the chart.
8. Confirm the indicator is visible in the chart's indicator list with the
   exact study name.

This repo does not inject Pine into TradingView in v1. Installation is manual
so the user controls what runs in TradingView.

## Supported Charts

Use this overlay on:

- SPY 5-minute
- SPY 15-minute
- QQQ 5-minute
- QQQ 15-minute

On other symbols or timeframes, the table remains visible and reports the
unsupported condition. The 9 EMA line and review markers are hidden outside the
supported chart set.

## Visual Inspection Boundary

Static repo tests verify the source and docs contain the required deterministic
contract. They do not prove TradingView renders the overlay readably.

Before treating the overlay as ready for live manual chart review, inspect it
in TradingView Desktop and confirm:

- the study is visible as `TVMCP Intraday 9 EMA Chop Review`
- only one EMA line is visible from this overlay
- the support table correctly distinguishes SPY/QQQ 5-minute and 15-minute
  charts from unsupported charts
- chop shading is light enough to leave candles readable
- review markers appear only on closed bars when chop is inactive
- marker text stays limited to manual review language
- the overlay remains visually quiet beside any other user-installed studies

Record the manual visual result in the related issue or handoff. Do not mark
live visual validation complete from local static tests alone.
