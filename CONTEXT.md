# tradingview-mcp Context

## Purpose

`tradingview-mcp` is a local MCP server for helping Codex drive manual TradingView Desktop charting workflows for a software, semiconductor, and AI stock universe.

## Product Boundary

V1 is charting-only. It can become a local assistant for opening charts, applying chart context, organizing chartbooks, and extracting user-visible drawing data from TradingView Desktop. It is not a scanner, broker integration, signal service, or trade execution system.

## Users

The primary user is a local operator using Codex and TradingView Desktop on their own machine. The repo should optimize for inspectable local workflows, repeatable setup, and clear guardrails.

## Operating Model

- Local TypeScript/Node MCP server over stdio.
- TradingView Desktop integration starts with a local macOS launch command and CDP health check against the user's own desktop session.
- Local universe configuration is the v1 source of truth for chart symbol lists; TradingView watchlists are not required for universe resolution.
- Pine drawing overlays are tracked as repo source and manually installed into TradingView; the first required visible study name is `TVMCP Objective Drawing Overlay`.
- Pine drawing extraction targets that configured study name and returns compact levels, zones, labels, and tables for chartbook review.
- Chartbook output writes ignored local review artifacts with screenshots, per-timeframe drawing JSON, notes, and an index.
- Configuration should stay repo-local or user-local; secrets and paid-service credentials must not be committed.
- GitHub Issues are the source of task scope.

## Durable Guardrails

- No broker APIs.
- No order placement.
- No scanner or ranking engine.
- No unattended trading workflow.
- No bypassing TradingView subscriptions or access controls.
- No generated Pine injection or subjective chart-pattern labels in v1 overlays.
