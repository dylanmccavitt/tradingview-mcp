# Objective Pine Drawing Overlay

The first tracked Pine overlay source lives at:

```text
pine/objective-drawing-overlay.pine
```

The required visible TradingView study name is:

```text
TVMCP Objective Drawing Overlay
```

Downstream drawing extraction must target that visible study name exactly. Do not rename the TradingView study when installing it.

## What It Draws

The overlay is self-contained from the chart's OHLCV and TradingView time/session context. It does not use external metadata, generated Pine injection, native editable TradingView drawings, broker data, or account data.

It creates deterministic chart objects for:

- prior day, week, and month highs and lows
- 20-day and 50-day high/low breakout levels
- most recent confirmed swing high and confirmed swing low
- current-chart gap zones
- ATR compression range boxes
- premarket and opening-range levels on intraday charts
- anchored VWAP reset from a major gap or confirmed pivot

The labels use objective abbreviations such as `PDH`, `PWH`, `20D-H`, `SW-H`, `OR-H`, and `AVWAP`. The overlay must not add subjective pattern labels.

## Manual Install

1. Open TradingView Desktop.
2. Open a chart tab for an exchange-qualified symbol such as `NASDAQ:NVDA`.
3. Open the Pine Editor panel.
4. Paste the contents of `pine/objective-drawing-overlay.pine`.
5. Save the script with the exact name `TVMCP Objective Drawing Overlay`.
6. Add the script to the chart.
7. Confirm the indicator is visible in the chart's indicator list with the exact study name.
8. Use the input `Style preset` to switch between `clean`, `levels`, and `full-debug`.

This repo does not inject Pine into TradingView in v1. Installation is manual so the user controls what runs in TradingView.

## Style Presets

- `clean`: minimal context. Keeps the anchored VWAP and a reduced set of higher-timeframe levels.
- `levels`: default review mode. Shows levels, gap zones, and compression range boxes without debug event markers.
- `full-debug`: shows every supported object class plus debug markers for gap and VWAP anchor events.

## Timeframe Guidance

Use the same installed study across the current v1 chart capture timeframes:

- Weekly: inspect prior week/month levels, 50D high/low levels, confirmed swings, and anchored VWAP readability.
- Daily: inspect prior day/week/month levels, 20D/50D levels, gap zones, compression boxes, confirmed swings, and anchored VWAP readability.
- 65-minute: inspect prior day/week levels, opening range levels, premarket levels, gap zones, and anchored VWAP readability.

The Pine source uses `timeframe.isweekly`, `timeframe.isdaily`, and a 65-minute intraday check to emphasize different object classes on those charts.

Other intraday timeframes, such as 5-minute charts, intentionally use a restrained safe view in the `levels` preset. They do not show the full daily/65-minute object set unless `full-debug` is selected.

## Visual Inspection Boundary

Static repo tests only verify the source and docs contain the required deterministic contract. They do not prove that TradingView renders the overlay readably.

Before downstream extraction work proceeds, a human should inspect the overlay in TradingView Desktop and confirm:

- the study is visible as `TVMCP Objective Drawing Overlay`
- weekly, daily, and 65-minute charts remain readable in the `levels` preset
- unsupported intraday charts such as 5-minute do not become noisy in the `levels` preset
- `full-debug` exposes event markers without hiding price bars
- labels and zones do not overlap so heavily that screenshots become unusable
- no subjective pattern names, scanner terms, ranking terms, or trade-action text appears on chart

Record that manual result in the next issue or handoff. Do not mark live visual validation complete from local static tests alone.
