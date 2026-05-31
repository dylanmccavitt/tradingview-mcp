# tradingview-mcp

Local Codex MCP project for charting a software, semiconductor, and AI stock universe in TradingView Desktop.

V1 is a charting assistant, not a scanner, broker integration, or trade execution system.

## Status

This repo has a minimal TypeScript MCP server scaffold and a local TradingView Desktop CDP launch/health workflow. Chart control, chartbooks, Pine extraction, and screenshot capture are intentionally deferred.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- TradingView Desktop for local chart workflows

## Setup

```bash
npm install
```

## Commands

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run tv:launch -- --port 9222
npm run tv:health -- --port 9222
```

## TradingView Desktop CDP

Launch TradingView Desktop with Chrome DevTools Protocol enabled:

```bash
npm run tv:launch -- --port 9222
```

If TradingView is already running without CDP, quit it first and run the launch command again. If the app is installed outside `/Applications/TradingView.app` or `~/Applications/TradingView.app`, pass an explicit path:

```bash
npm run tv:launch -- --app /Applications/TradingView.app --port 9222
```

To print the exact macOS launch command without starting the app:

```bash
npm run tv:launch-command -- --port 9222
```

Verify CDP reachability and an active chart target:

```bash
npm run tv:health -- --port 9222
```

The health command reports actionable failures for a missing app, unreachable or wrong CDP port, unexpected CDP response shape, and a reachable session with no open TradingView chart page. It does not automate login, bypass subscriptions, place orders, or scan/rank symbols.

## Run the MCP Server

Build the project first:

```bash
npm run build
```

Then run the stdio MCP server:

```bash
npm start
```

For local Codex MCP configuration, point Codex at the built server:

```toml
[mcp_servers.tradingview]
command = "node"
args = ["/absolute/path/to/tradingview-mcp/dist/src/index.js"]
startup_timeout_sec = 20
tool_timeout_sec = 45
```

## V1 Boundary

V1 is a manual-only charting assistant. It may help open, inspect, and organize TradingView Desktop charting workflows in later issues, but it must not place trades, route orders, connect to broker APIs, rank trade candidates, or run unattended scans.

See [CONTEXT.md](./CONTEXT.md), [AGENTS.md](./AGENTS.md), and [docs/architecture.md](./docs/architecture.md) before implementing later issues.
