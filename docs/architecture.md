# Architecture

## Current System Shape

The current repo is a local TypeScript/Node MCP server scaffold with the first TradingView Desktop connection checks. It has:

- a strict TypeScript project configuration
- a stdio MCP server entry point
- a small domain module that records project identity and guardrails
- a TradingView Desktop CDP launch and health CLI
- a narrow one-symbol chart capture CLI for weekly, daily, and 65-minute screenshots
- a local universe config parser and CLI selection workflow
- a manually installed objective Pine drawing overlay source for deterministic chart objects
- a compact Pine drawing extraction path for the visible objective overlay study
- typed internal health-result shaping for later MCP tools
- tests that pin the manual-only boundary, universe parsing behavior, and Pine overlay source contract
- tests for CDP target discovery, health failures, chart planning, output naming, chart-runner failures, and Pine drawing extraction normalization without requiring a live TradingView session
- repo docs for issue-driven development

No chartbook generation, scanner, or broker behavior exists yet.

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

### One-Symbol Chart Capture

`src/tradingview/chart-plan.ts` validates exchange-qualified symbols, defines the default weekly/daily/65-minute timeframe plan, builds TradingView chart URLs, and maps screenshots to deterministic local artifact paths.

`src/tradingview/cdp-session.ts` maintains a small CDP WebSocket command client.

`src/tradingview/chart-page.ts` drives a single TradingView chart page through CDP navigation, render polling, and screenshot capture.

`src/tradingview/chart-runner.ts` combines health checks, page control, output directory creation, and per-timeframe success/failure reporting for one symbol.

### Local Universe Config

`config/universe.sample.json` is the tracked v1 sample universe. It defines core and extended lists for semiconductors, AI software, AI infrastructure, and enterprise software using exchange-qualified TradingView symbols, display aliases, optional company names, and tags.

`src/universe/config.ts` validates the local JSON format, normalizes TradingView symbols, lists group summaries, and resolves selected groups/tiers into an ordered, de-duplicated symbol list for charting.

`src/cli.ts` exposes `universe list` and `universe resolve` commands. These commands read local config only and do not depend on TradingView watchlists.

### Objective Pine Drawing Overlay

`pine/objective-drawing-overlay.pine` is the first tracked Pine source for user-installed chart drawings. Its required visible TradingView study name is `TVMCP Objective Drawing Overlay`.

The overlay is self-contained from chart OHLCV and TradingView time/session context. It creates line, label, box, plot, and plotshape output for prior day/week/month levels, 20D/50D high-low levels, confirmed swing highs/lows, gap zones, ATR compression range boxes, intraday premarket/opening-range levels, and anchored VWAP from a major gap or confirmed pivot. It exposes `clean`, `levels`, and `full-debug` style presets and uses timeframe checks to emphasize weekly, daily, and 65-minute review contexts.

The repo does not inject Pine into TradingView. Manual install and visual inspection instructions live in `docs/pine/objective-drawing-overlay.md`.

### Pine Drawing Extraction

`src/tradingview/pine-drawings.ts` normalizes compact TradingView/CDP payloads for the configured study name `TVMCP Objective Drawing Overlay`. It returns deduplicated horizontal levels, box-derived high/low zones, compact labels, compact tables, chart context, and warnings. Raw TradingView internals are omitted unless debug mode is explicitly requested.

`src/tradingview/pine-drawing-page.ts` evaluates a bounded page probe against the active TradingView chart target. The probe targets the configured overlay study by name or the known Pine short title and collects compact study payload candidates from supported page/widget surfaces.

`src/tradingview/pine-drawing-runner.ts` combines the existing CDP health check, chart target WebSocket connection, page payload read, and normalizer into a single extraction result. `src/cli.ts` exposes this as `drawings`.

### Tests

`test/domain.test.ts` verifies that the bootstrap project contract continues to state the manual-only, no-broker, no-scanner boundary.

`test/tradingview-targets.test.ts` and `test/tradingview-health.test.ts` cover CDP target filtering and health-result shaping with fake CDP responses.

`test/chart-plan.test.ts` and `test/chart-runner.test.ts` cover command planning, deterministic output naming, and per-timeframe error handling with fake clients.

`test/universe-config.test.ts` and `test/cli-universe.test.ts` cover local universe parsing, duplicate handling, invalid symbols, group selection, and CLI formatting.

`test/pine-overlay.test.ts` statically validates the tracked Pine source and manual install docs without requiring a live TradingView session.

`test/pine-drawings.test.ts` and `test/pine-drawing-runner.test.ts` cover configured-study targeting, level de-duplication, zone/label/table normalization, debug raw-output gating, and health failure handling with fixture-like payloads.

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

### One-Symbol Chart Capture

1. Complete the TradingView CDP health flow until a chart target is healthy.
2. Run `npm run tv:chart -- --symbol NASDAQ:NVDA --port 9222`.
3. The CLI navigates the active chart target through weekly, daily, and 65-minute URLs.
4. For each timeframe, it waits for a rendered chart canvas and writes a PNG under `artifacts/tradingview-charts/<SYMBOL-SLUG>/`.
5. The CLI prints per-timeframe success or failure.

### Pine Drawing Extraction

1. Complete the TradingView CDP health flow until a chart target is healthy.
2. Confirm the manually installed overlay is visible as `TVMCP Objective Drawing Overlay`.
3. Run `npm run tv:drawings -- --port 9222 --json`.
4. The CLI targets the configured overlay study and returns compact JSON for levels, zones, labels, and tables.
5. Use `--debug` only when diagnosing payload shape; normal output avoids large raw TradingView internals.

### Universe Selection

1. Keep the chart universe in a local JSON file such as `config/universe.sample.json` or ignored `config/universe.local.json`.
2. Run `npm run tv:universe -- list` to inspect configured groups.
3. Run `npm run tv:universe -- resolve --group semis --tier core` to produce an ordered symbol list.
4. Use `--tier all` or comma-separated group ids for broader manual charting selections.
5. The resolver de-duplicates repeated symbols in first-seen order and reports source groups and tiers without ranking or scoring them.

### Pine Overlay Installation

1. Open TradingView Desktop and a chart tab.
2. Paste `pine/objective-drawing-overlay.pine` into the Pine Editor.
3. Save and add it with the exact visible name `TVMCP Objective Drawing Overlay`.
4. Inspect weekly, daily, and 65-minute charts with the `levels` preset.
5. Use `full-debug` only when reviewing source events for extraction readiness.

### MCP Startup

1. Build with `npm run build`.
2. Configure Codex to run `node dist/src/index.js` as a stdio MCP server.
3. Codex starts the local server process when the MCP server is enabled.

## Important Invariants

- The server must remain local-first.
- TradingView Desktop access must be user-controlled and subscription-respecting.
- CDP health checks must use only the user's local TradingView Desktop session.
- One-symbol chart capture must stay user-directed and must report per-timeframe failures without converting them into scanner/ranking output.
- Local universe config is the v1 source of truth for chart symbol lists; TradingView watchlists are not required or read for universe resolution.
- Universe selection preserves configured order and de-duplicates symbols without scoring, ranking, or generating candidates.
- Pine overlay source must be manually installed, deterministic from chart OHLCV, and free of subjective pattern labels or scanner/ranking/trade-action text.
- Downstream Pine drawing extraction must target the visible study name `TVMCP Objective Drawing Overlay`.
- Pine drawing extraction must keep payloads compact by default and avoid raw TradingView internals unless debug mode is explicit.
- The repo must not grow broker, scanner, or execution behavior through incidental helper code.
- Architecture docs describe current system shape only; future task plans belong in `docs/plans/` while active.
