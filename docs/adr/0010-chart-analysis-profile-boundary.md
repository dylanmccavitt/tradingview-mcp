# ADR 0010: Chart-Analysis Profile Boundary

## Status

Accepted

## Decision

Chart-analysis profiles are user-selected chart review modes. They may change
which objective chart facts, extracted levels, setup checklist fields,
chartbook notes, and user-review prompts are emphasized during manual chart
review.

The allowed profile names are:

- `focus`
- `breakout`
- `squeeze`
- `momentum`

Profile output may contain:

- objective chart facts from the visible chart, configured universe metadata,
  screenshots, and extracted drawing JSON
- extracted levels, zones, labels, tables, and warnings already available from
  local TradingView chart artifacts
- setup checklist fields for user review
- chartbook notes
- prompts that ask the user to inspect or decide

Profile output must not contain:

- symbol rankings
- watchlist scoring
- financial advice
- buy, sell, hold, or option recommendations
- order actions
- broker calls
- unattended alerts
- generated candidates outside the user's selected symbol or configured
  universe selection

## Why

The project needs vocabulary for breakout, squeeze, and momentum chart review
without weakening the manual-only charting boundary. Profiles give future CLI
and MCP schemas concise, stable names while keeping all analysis tied to
user-selected chart review.

## Options Considered

- Define profiles as chart review modes with explicit output limits.
- Treat profiles as scanner presets that search a universe for candidates.
- Avoid profile names until each future feature is implemented.

## Tradeoffs

Profiles make future chartbook and MCP work easier to describe, but they create
a boundary that tests and docs must keep precise. Rejecting scanner-style
profiles means the user still selects the symbol or universe first.

## Consequences

- Future profile schemas should use the stable names `focus`, `breakout`,
  `squeeze`, and `momentum`.
- Profile behavior must preserve configured symbol order and must not rank,
  score, recommend, alert, or place orders.
- Tests should keep pinning the no-scanner, no-ranking, no-advice, no-broker,
  and no-order profile boundary.
- Issues that require candidate generation, rankings, broker calls, order
  actions, or unattended alerts belong outside this project.
