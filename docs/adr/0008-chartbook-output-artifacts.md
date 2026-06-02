# ADR 0008: Chartbook Output Artifacts

## Status

Accepted

## Decision

Generate chartbooks as ignored local artifact directories under `artifacts/tradingview-chartbooks/<session-id>/`.

Each chartbook session contains an `index.md` file, a static `index.html` review dashboard, and one directory per resolved universe symbol. Each symbol directory contains weekly, daily, and 65-minute screenshots, matching `*-levels.json` structured drawing artifacts, and a `notes.md` page with local screenshot embeds, extraction warnings, and a profile-aware human review checklist.

The HTML dashboard is the primary human review surface. It presents session metadata, profile/preset context, per-symbol warnings, profile-specific review panels, screenshots, links to JSON/Markdown artifacts, and local manual-note fields. The Markdown and JSON artifacts remain the durable machine-readable and fallback text surfaces for Codex review and debugging.

The chartbook runner records partial failures in the HTML dashboard, Markdown index, notes, and per-timeframe JSON. It continues through later timeframes and symbols without deleting successful captures.

## Why

Chart review needs durable artifacts that Codex and the user can inspect after the TradingView Desktop state changes. Keeping chartbooks local, deterministic, and Git-ignored makes repeated review sessions reproducible without turning the project into a scanner, signal service, or broker workflow.

## Options Considered

- Write one local session directory with HTML, Markdown, and JSON artifacts.
- Write one local session directory with only Markdown and JSON artifacts.
- Keep screenshots only and rely on transient TradingView state for levels.
- Export a single combined JSON file without Markdown notes.
- Store chartbooks in tracked docs.

## Tradeoffs

Per-symbol directories produce more files, but they are easy to inspect, diff locally, and archive manually. Matching JSON next to each screenshot makes partial failures explicit and keeps later notes workflows simple. A static HTML dashboard adds another artifact, but makes profile review materially easier to scan than Markdown alone without introducing a hosted app, external service, scanner, or broker workflow. Git-ignored artifacts avoid repository churn, but users must copy or preserve sessions themselves if they want long-term storage outside the local artifact root.

## Consequences

- Chartbook paths must be deterministic from the selected session id, symbol slug, and timeframe.
- Default output must stay under ignored artifact roots.
- Dashboard, notes, and index copy must describe chartbooks as review/prep artifacts only.
- Chartbook generation must not rank symbols, recommend trades, place orders, call broker APIs, or bypass TradingView access controls.
