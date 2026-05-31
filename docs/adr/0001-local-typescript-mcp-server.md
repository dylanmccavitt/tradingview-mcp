# ADR 0001: Local TypeScript MCP Server

## Status

Accepted

## Decision

Build `tradingview-mcp` as a local TypeScript/Node MCP server that runs over stdio and is launched by Codex as a local command.

## Why

The project needs inspectable local automation around TradingView Desktop. A local stdio MCP server keeps the integration simple for Codex, avoids hosted service complexity, and matches the expected local desktop workflow.

## Options Considered

- Local TypeScript/Node MCP server over stdio.
- Hosted HTTP MCP server.
- Fork the reference TradingView MCP implementation immediately.

## Tradeoffs

The local TypeScript server is easy to run and review, but it requires the user's local machine to provide TradingView Desktop and any later CDP access. A hosted server would complicate local desktop control and data boundaries. Forking immediately would bring more behavior than V1 needs.

## Consequences

- Build output lives in `dist/`.
- Codex configuration points to `node dist/src/index.js`.
- Later TradingView work should integrate through local desktop control and preserve the no-broker/no-scanner boundary.
