# ADR 0007: Structured Pine Drawing Extraction

## Status

Accepted

## Decision

Extract structured chart context from the manually installed objective Pine overlay by targeting the configured study name `TVMCP Objective Drawing Overlay`.

The extraction layer returns compact JSON for horizontal levels, high/low zones, labels, and tables. It omits large raw TradingView internals by default and includes them only when debug mode is explicit.

## Why

Screenshots are useful for human review, but later chartbook artifacts need machine-readable levels and zones that Codex can inspect without re-parsing image pixels. Targeting the known overlay study keeps the behavior scoped to the user-installed deterministic Pine source instead of scraping unrelated indicators.

## Options Considered

- Target the configured overlay study and normalize compact payloads.
- Scrape every visible indicator and drawing.
- Infer levels and zones from screenshot pixels.
- Recompute the Pine logic outside TradingView from separate market data.

## Tradeoffs

Configured-study extraction is narrow and testable with fixture-like payloads, but the live TradingView payload shape can still change and may require probe updates. Scraping every indicator would be noisier and could mix unrelated user studies into chartbooks. Pixel inference would be brittle. Recomputing the overlay outside TradingView would duplicate Pine logic and drift from the visible chart.

## Consequences

- Extraction must target `TVMCP Objective Drawing Overlay` by default.
- Horizontal line and plot output should be deduplicated into levels.
- Boxes should become high/low zones.
- Labels and tables should stay compact.
- Raw TradingView internals require explicit debug mode.
- The extraction workflow remains charting-only and must not add scanners, rankings, broker actions, order placement, or access-control bypasses.
