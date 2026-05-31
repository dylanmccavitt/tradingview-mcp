# Architecture

## Current System Shape

The current repo is a planning-first TypeScript/Node MCP server scaffold. It has:

- a strict TypeScript project configuration
- a stdio MCP server entry point
- a small domain module that records project identity and guardrails
- tests that pin the manual-only boundary
- repo docs for issue-driven development

No TradingView Desktop automation exists yet.

## Major Components

### MCP Server

`src/index.ts` starts a stdio MCP server created by `src/server.ts`. Codex can launch the built server with a local `node dist/src/index.js` command.

### Domain Contract

`src/domain.ts` records the project purpose and guardrails. This gives tests and future tools a shared place to reference the charting-only boundary.

### Tests

`test/domain.test.ts` verifies that the bootstrap project contract continues to state the manual-only, no-broker, no-scanner boundary.

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

### MCP Startup

1. Build with `npm run build`.
2. Configure Codex to run `node dist/src/index.js` as a stdio MCP server.
3. Codex starts the local server process when the MCP server is enabled.

## Important Invariants

- The server must remain local-first.
- TradingView Desktop access must be user-controlled and subscription-respecting.
- The repo must not grow broker, scanner, or execution behavior through incidental helper code.
- Architecture docs describe current system shape only; future task plans belong in `docs/plans/` while active.
