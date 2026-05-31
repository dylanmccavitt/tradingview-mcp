# ADR 0004: One-Symbol Chart Capture

## Status

Accepted

## Decision

Implement the first chart-control path as a CLI command that charts one exchange-qualified TradingView symbol across weekly, daily, and 65-minute timeframes. The command uses the existing TradingView Desktop CDP health result, connects to the chart page WebSocket, navigates the active chart URL with deterministic `symbol` and `interval` query parameters, waits for a rendered chart canvas, and writes PNG screenshots to deterministic local artifact paths.

## Why

The project needs a narrow proof that CDP can drive an already open TradingView Desktop chart before adding chartbooks, universes, or Pine extraction. A one-symbol command keeps the behavior inspectable, testable without a live session through fake clients, and aligned with the manual-only charting boundary.

## Options Considered

- Add a one-symbol CLI command over the current CDP layer.
- Add a browser automation framework immediately.
- Add universe/chartbook generation in the same slice.

## Tradeoffs

The CDP WebSocket path is small and direct, but it depends on TradingView Desktop exposing a chart page target with `webSocketDebuggerUrl` and on TradingView honoring URL `symbol` and `interval` parameters. A browser automation framework could provide richer selectors later, but it would widen this issue. Universe and chartbook generation remain separate work.

## Consequences

- The command supports only one exchange-qualified symbol per run.
- Default captures are weekly, daily, and 65-minute.
- Screenshot artifacts are local and ignored by Git.
- The CLI reports per-timeframe success or failure and does not scan, rank, advise, place orders, or bypass TradingView access controls.
