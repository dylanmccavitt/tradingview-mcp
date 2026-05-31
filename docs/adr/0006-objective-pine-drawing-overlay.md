# ADR 0006: Objective Pine Drawing Overlay

## Status

Accepted

## Decision

Track the first Pine drawing overlay as `pine/objective-drawing-overlay.pine` and require manual installation into TradingView Desktop with the visible study name `TVMCP Objective Drawing Overlay`.

The overlay draws deterministic objects from chart OHLCV and TradingView time/session context only. It includes prior day/week/month highs and lows, 20D/50D high-low levels, confirmed swing highs/lows, gap zones, ATR compression range boxes, intraday premarket/opening-range levels, and anchored VWAP from a major gap or confirmed pivot. It exposes `clean`, `levels`, and `full-debug` style presets and emphasizes weekly, daily, and 65-minute charts differently.

## Why

Downstream chartbook and extraction work needs a stable visible Pine study whose line, label, box, and plot output can be inspected and eventually read by MCP tools. Keeping the source tracked in the repo makes the deterministic contract reviewable before any live extraction code exists.

Manual installation keeps the user in control of TradingView scripts and avoids adding generated Pine injection or TradingView account automation in v1.

## Options Considered

- Tracked Pine source with manual installation.
- Generate and inject Pine source through CDP.
- Use native editable TradingView drawings.
- Defer all drawing work until extraction tools exist.

## Tradeoffs

Manual installation requires a human setup step and visual review, but it is simpler and safer than script injection. Pine-generated objects are not native editable drawings, but they are deterministic and easier for later extraction tooling to target by study name. Deferring drawing work would delay validating readability across the chart capture timeframes.

## Consequences

- The exact visible study name is part of the integration contract.
- Static tests validate source and docs, but live readability remains a human review boundary.
- Pine source must remain self-contained from OHLCV and must not use external metadata, scanner/ranking language, broker actions, or subjective pattern labels.
- Later extraction work should read visible output from `TVMCP Objective Drawing Overlay` rather than trying to infer freehand chart drawings.
