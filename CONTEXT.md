# tradingview-mcp Context

## Purpose

`tradingview-mcp` is a local MCP server for helping Codex drive manual TradingView Desktop charting workflows for a software, semiconductor, and AI stock universe.

## Product Boundary

V1 is charting-only. It can become a local assistant for opening charts, applying chart context, organizing chartbooks, and extracting user-visible drawing data from TradingView Desktop. It is not a scanner, broker integration, signal service, or trade execution system.

Chart-analysis profiles are user-selected review modes, not candidate
generation. The stable profile names are `focus`, `breakout`, `squeeze`, and
`momentum`. Profile output may emphasize objective chart facts, extracted
levels, setup checklist fields, chartbook notes, and user-review prompts. It
must not include rankings, watchlist scoring, financial advice, order actions,
broker calls, unattended alerts, or generated candidates.

## Users

The primary user is a local operator using Codex and TradingView Desktop on their own machine. The repo should optimize for inspectable local workflows, repeatable setup, and clear guardrails.

## Operating Model

- Local TypeScript/Node MCP server over stdio.
- Minimal local CLI commands expose the same setup, status, one-symbol charting,
  and universe charting workflows for repeatable smoke/debug runs outside Codex.
- MCP exposes high-level v1 charting tools only: connect/status, universe
  listing, one-symbol charting, universe charting, current-chart capture, and
  chartbook creation.
- TradingView Desktop integration starts with a local macOS launch command and CDP health check against the user's own desktop session.
- Local universe configuration is the v1 source of truth for chart symbol lists; TradingView watchlists are not required for universe resolution.
- Pine drawing overlays are tracked as repo source and manually installed into TradingView; the first required visible study name is `TVMCP Objective Drawing Overlay`.
- Pine drawing extraction targets that configured study name and returns compact levels, zones, labels, and tables for chartbook review. If TradingView only exposes the overlay legend, extraction may recover plotted objective levels from the known Pine plot order while leaving unavailable box/label/table internals empty.
- Current-chart capture writes a local screenshot and matching objective drawing
  JSON for the visible chart without navigating the chart to another symbol.
- Chartbook output writes ignored local review artifacts with screenshots, per-timeframe drawing JSON, notes, and an index.
- Configuration should stay repo-local or user-local; secrets and paid-service credentials must not be committed.
- GitHub Issues are the source of task scope.

## Durable Guardrails

- No broker APIs.
- No order placement.
- No scanner or ranking engine.
- No unattended trading workflow.
- No profile-based rankings, watchlist scoring, financial advice, order
  actions, broker calls, unattended alerts, or generated candidates.
- No bypassing TradingView subscriptions or access controls.
- No generated Pine injection or subjective chart-pattern labels in v1 overlays.
