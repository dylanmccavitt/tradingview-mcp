# ADR 0008: Chartbook Output Artifacts

## Status

Accepted

## Decision

Generate chartbooks as ignored local artifact directories under `artifacts/tradingview-chartbooks/<session-id>/`.

Each chartbook session contains an `index.md` file, a static `index.html` review dashboard, a machine-readable `setup-review-index.json`, and one directory per resolved universe symbol. Each symbol directory contains weekly, daily, and 65-minute screenshots, matching `*-levels.json` structured drawing artifacts, a `setup-review.json` setup validation artifact, and a `notes.md` page with local screenshot embeds, extraction warnings, and a profile-aware human review checklist.

The HTML dashboard is the primary human review surface. It presents session metadata, profile/preset context, per-symbol warnings, generated Codex Analysis briefs from extracted facts, setup review verdict counts, profile-specific review panels, screenshots, links to JSON/Markdown artifacts, and local manual-note fields. The Markdown and JSON artifacts remain the durable machine-readable and fallback text surfaces for Codex review and debugging.

Review Session Artifact JSON is the versioned durable contract for a full
manual review pass. It can be written additively beside existing chartbook
outputs in a later issue; the current chartbook files stay compatible. Markdown
and HTML dashboards are reader views over JSON artifacts, not the source of
truth.

`setup-review.json` records one chart-review verdict label for the symbol:
`validated`, `invalidated`, `watch`, or `insufficient_data`. Reasons are
derived from existing screenshot status, extracted levels JSON, structured chart
facts, warnings, selected profile context, and preserved Quant Scan source
metadata when available. The session setup review index may summarize verdict
counts and link to per-symbol review artifacts, but it must not rank symbols or
recommend actions.

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
- Setup review verdict labels must remain chart-review evidence, not trade instructions.
- Review marks and thesis notes must remain human-authored and separate from
  deterministic setup evidence labels.
- Chartbook generation must not rank symbols, recommend trades, place orders, call broker APIs, or bypass TradingView access controls.
