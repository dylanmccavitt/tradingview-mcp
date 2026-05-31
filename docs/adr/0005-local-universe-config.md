# ADR 0005: Local Universe Config

## Status

Accepted

## Decision

Use a local JSON universe config as the v1 source of truth for chart symbol lists. The tracked sample lives at `config/universe.sample.json` and organizes exchange-qualified TradingView symbols into named groups with `core` and `extended` tiers, aliases, optional company names, and tags.

The CLI exposes `universe list` for group summaries and `universe resolve` for deterministic ordered symbol selection. Resolution can target one or more groups and `core`, `extended`, or `all` tiers.

## Why

The charting workflow needs repeatable local input before chartbooks and Pine extraction exist. A local JSON file is inspectable, easy to test, and avoids coupling v1 behavior to TradingView watchlists, account state, login state, or UI layout.

## Options Considered

- Local JSON config committed as a sample plus ignored user-local copies.
- TradingView watchlists as the source of truth.
- Hard-coded symbol arrays in TypeScript.

## Tradeoffs

Local JSON requires the user to maintain a config file, but keeps behavior deterministic and reviewable. TradingView watchlists would be convenient but would make resolution depend on remote account/UI state. Hard-coded arrays would be easy to compile but harder for the user to adjust locally.

## Consequences

- Universe commands read local files only.
- Symbols must be exchange-qualified TradingView identifiers.
- Selection preserves configured order and de-duplicates repeated symbols without ranking or scoring them.
- The universe workflow remains charting-only and must not become a scanner, broker action, order workflow, or TradingView login/paywall bypass.
