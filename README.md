# tradingview-mcp

Local Codex MCP project for charting a software, semiconductor, and AI stock universe in TradingView Desktop.

This repository is intentionally planning-first. V1 is a charting assistant, not a scanner, broker integration, or trade execution system.

## Status

This repo is in the bootstrap phase. The current code is a minimal TypeScript MCP server scaffold that can compile, lint, and run locally, but it does not automate TradingView yet.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- TradingView Desktop, when later chart automation issues add CDP integration

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
```

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
