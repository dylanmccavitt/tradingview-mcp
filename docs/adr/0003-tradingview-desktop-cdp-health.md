# ADR 0003: TradingView Desktop CDP Health

## Status

Accepted

## Decision

Use TradingView Desktop's local Chromium DevTools Protocol port as the first connection boundary. The repo provides macOS commands to launch TradingView Desktop with `--remote-debugging-port=<port>` and a health check that reads `/json/version` and `/json/list` to verify CDP reachability and an active TradingView chart page.

## Why

The project needs a small, inspectable connection layer before chart control or chartbook work can be safe. CDP HTTP discovery is enough to confirm that TradingView Desktop is reachable and that a chart page is open without automating login, bypassing access controls, or adding broker/scanner behavior.

## Options Considered

- Launch and verify TradingView Desktop through local CDP HTTP discovery.
- Add a browser automation dependency immediately.
- Build chart-control MCP tools before connection health exists.

## Tradeoffs

CDP HTTP discovery keeps this slice small and testable with fake responses, but it only proves connection health. Later issues still need explicit chart-control, screenshot, and extraction layers. A browser automation dependency may be useful later, but adding it now would widen the first connection slice.

## Consequences

- Local launch and health commands are part of the supported run workflow.
- Health results must return actionable messages for missing app, unreachable or wrong CDP port, invalid CDP response shape, and no open chart target.
- Tests should cover target discovery and health-result shaping without requiring a live TradingView session.
- The connection layer remains charting-only and must not automate login, bypass subscriptions, scan/rank symbols, or place orders.
