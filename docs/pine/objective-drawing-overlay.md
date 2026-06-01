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

The labels use objective abbreviations such as `PDH`, `PWH`, `20D-H`, `SW-H`, and `OR-H`. Horizontal level lines extend across the chart like reference levels, while confirmed swing lines remain anchored from their pivot bar. The same level values are also published through scale-only Pine plots with `trackprice=true` so TradingView can show price markers on the right price axis. The overlay must not add subjective pattern labels.

## Manual Install

1. Open TradingView Desktop.
2. Open a chart tab for an exchange-qualified symbol such as `NASDAQ:NVDA`.
3. Open the Pine Editor panel.
4. Paste the contents of `pine/objective-drawing-overlay.pine`.
5. Save the script with the exact name `TVMCP Objective Drawing Overlay`.
6. Add the script to the chart.
7. Confirm the indicator is visible in the chart's indicator list with the exact study name.
8. Use the input `Style preset` to switch between `focus`, `clean`, `levels`, and `full-debug`.

This repo does not inject Pine into TradingView in v1. Installation is manual so the user controls what runs in TradingView.

## Style Presets

- `focus`: default quieter review mode. Hides most inline labels, keeps price markers on the right axis, and shows a compact top-right context table.
- `clean`: minimal context. Keeps the anchored VWAP and a reduced set of higher-timeframe levels.
- `levels`: deeper review mode. Shows levels, gap zones, and compression range boxes without debug event markers.
- `full-debug`: shows every supported object class plus debug markers for gap and VWAP anchor events.

## Timeframe Guidance

Use the same installed study across the current v1 chart capture timeframes:

- Weekly `focus`: inspect major context only: prior month levels, 50D high/low levels, anchored VWAP, and the compact context table.
- Daily `focus`: inspect breakout context only: prior week levels, 20D/50D high levels, anchored VWAP, and the active compression range box when present.
- 65-minute `focus`: inspect timing context only: prior day levels, opening range levels, anchored VWAP, and the compact context table.
- `levels`: inspect the deeper prior day/week/month, 20D/50D, gap-zone, compression, confirmed-swing, premarket, opening-range, and anchored VWAP context across weekly, daily, and 65-minute charts.

The Pine source uses `timeframe.isweekly`, `timeframe.isdaily`, and a 65-minute intraday check to emphasize different object classes on those charts.

Other intraday timeframes, such as 5-minute charts, intentionally use a restrained safe view in the `levels` preset. They do not show the full daily/65-minute object set unless `full-debug` is selected.

## Visual Inspection Boundary

Static repo tests only verify the source and docs contain the required deterministic contract. They do not prove that TradingView renders the overlay readably.

Before changing extraction assumptions or overlay source, a human should inspect the overlay in TradingView Desktop and confirm:

- the study is visible as `TVMCP Objective Drawing Overlay`
- weekly, daily, and 65-minute charts remain readable in the default `focus` preset
- `focus` hides most inline labels while keeping price markers and the compact table usable
- `levels` and `full-debug` remain available for deeper review and extraction debugging
- key level values appear on the right price axis, not only inside small chart tags
- horizontal reference levels extend across the chart rather than starting only near the latest candle
- unsupported intraday charts such as 5-minute do not become noisy in the `levels` preset
- `full-debug` exposes event markers without hiding price bars
- labels and zones do not overlap so heavily that screenshots become unusable
- no subjective pattern names, scanner terms, ranking terms, or trade-action text appears on chart

Record that manual result in the related issue or handoff. Do not mark live visual validation complete from local static tests alone.

## Structured Extraction

With TradingView Desktop launched through CDP and a chart tab open, run:

```bash
npm run tv:drawings -- --port 9222 --json
```

The extractor targets `TVMCP Objective Drawing Overlay` by default and returns compact JSON for:

- deduplicated horizontal levels from line/plot output
- high/low zones from boxes
- compact label text and price context when available
- compact table rows when available

Normal output omits large raw TradingView internals. Use `--debug` only when diagnosing the live payload shape.

For reliable chartbook extraction, keep the overlay visible with either the
default `focus` style preset or the deeper `levels` style preset during weekly,
daily, and 65-minute runs. If TradingView exposes
only the compact indicator legend instead of structured line, box, label, or
table internals, the extractor can recover the plotted objective level values
from the overlay's known Pine plot order. In that fallback mode, unavailable
box zones, labels, and table internals remain empty instead of being inferred
from pixels or unrelated indicators.
