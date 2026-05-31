# Architecture

## Current System Shape

The current repo is a local TypeScript/Node MCP server scaffold with the first TradingView Desktop connection checks. It has:

- a strict TypeScript project configuration
- a stdio MCP server entry point
- a small domain module that records project identity and guardrails
- a TradingView Desktop CDP launch and health CLI
- typed internal health-result shaping for later MCP tools
- tests that pin the manual-only boundary
- tests for CDP target discovery and health failures without requiring a live TradingView session
- repo docs for issue-driven development

No chart control, chartbook generation, screenshot capture, Pine extraction, scanner, or broker behavior exists yet.

## Major Components

### MCP Server

`src/index.ts` starts a stdio MCP server created by `src/server.ts`. Codex can launch the built server with a local `node dist/src/index.js` command.

### Domain Contract

`src/domain.ts` records the project purpose and guardrails. This gives tests and future tools a shared place to reference the charting-only boundary.

### TradingView Desktop CDP

`src/tradingview/desktop.ts` resolves a local macOS TradingView Desktop app path and can launch the app executable with `--remote-debugging-port=<port>`.

`src/tradingview/cdp.ts` reads standard CDP HTTP discovery endpoints, including `/json/version` and `/json/list`.

`src/tradingview/targets.ts` filters CDP page targets to find an active `tradingview.com/chart` page.

`src/tradingview/health.ts` combines app discovery, CDP reachability, browser metadata, and chart-target discovery into a typed status result.

`src/cli.ts` exposes local commands for launch, launch-command, and health checks.

### Tests

`test/domain.test.ts` verifies that the bootstrap project contract continues to state the manual-only, no-broker, no-scanner boundary.

`test/tradingview-targets.test.ts` and `test/tradingview-health.test.ts` cover CDP target filtering and health-result shaping with fake CDP responses.

### Project Docs

Root docs and `docs/` explain how agents should run the repo, what the system is allowed to do, and where durable decisions live.

## Boundaries

- In scope: local MCP server, user-directed TradingView Desktop chart workflows, chartbook artifacts, objective chart/drawing data extraction in later issues.
- Out of scope: broker integrations, order placement, portfolio actions, scanners, rankings, unattended alerts, and financial advice.

## Main Flows

### Local Verification

1. Install dependencies with `npm install`.
2. Run `npm run typecheck`.
3. Run `npm run lint`.
4. Run `npm test`.

### TradingView CDP Health

1. Quit TradingView Desktop if it is already running without CDP.
2. Run `npm run tv:launch -- --port 9222`.
3. Open or focus a TradingView chart page in the desktop app.
4. Run `npm run tv:health -- --port 9222`.
5. Read the status and next steps from the CLI output.

### MCP Startup

1. Build with `npm run build`.
2. Configure Codex to run `node dist/src/index.js` as a stdio MCP server.
3. Codex starts the local server process when the MCP server is enabled.

## Important Invariants

- The server must remain local-first.
- TradingView Desktop access must be user-controlled and subscription-respecting.
- CDP health checks must use only the user's local TradingView Desktop session.
- The repo must not grow broker, scanner, or execution behavior through incidental helper code.
- Architecture docs describe current system shape only; future task plans belong in `docs/plans/` while active.
