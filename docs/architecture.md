# Architecture

## Current System Shape

The current repo is a local TypeScript/Node MCP server for high-level TradingView Desktop charting workflows. It has:

- a strict TypeScript project configuration
- a stdio MCP server entry point
- a small domain module that records project identity and guardrails
- a TradingView Desktop CDP launch and health CLI
- a narrow one-symbol chart capture CLI for weekly, daily, and 65-minute screenshots
- a direct chart-universe CLI/MCP runner for smoke charting selected local universe symbols
- a local universe config parser and CLI selection workflow
- a manually installed objective Pine drawing overlay source for deterministic chart objects
- a compact Pine drawing extraction path for the visible objective overlay study
- a structured chart-facts layer for objective breakout, squeeze, and momentum review fields
- a current-chart capture workflow that writes a screenshot plus compact drawing JSON for the visible chart
- a local chartbook output workflow that combines universe selection, screenshots, drawing JSON, notes, and an index
- a v1 MCP tool surface made only of high-level charting workflows
- typed internal health-result shaping for CLI and MCP tools
- a shared chart-analysis profile boundary for user-selected `focus`,
  `breakout`, `squeeze`, and `momentum` review modes
- tests that pin the manual-only boundary, universe parsing behavior, and Pine overlay source contract
- tests for CDP target discovery, health failures, chart planning, output naming, chart-runner failures, chartbook artifact creation, and Pine drawing extraction normalization without requiring a live TradingView session
- MCP protocol tests for tool registration, server instructions, guardrail descriptions, and request validation without requiring a live TradingView session
- repo docs for issue-driven development

No scanner or broker behavior exists.

## Major Components

### MCP Server

`src/index.ts` starts a stdio MCP server created by `src/server.ts`. Codex can launch the built server with a local `node dist/src/index.js` command.

`src/mcp/tradingview-tools.ts` registers the v1 high-level tool surface:

- `tradingview_connect`
- `tradingview_status`
- `tradingview_list_universe`
- `tradingview_chart_symbol`
- `tradingview_chart_universe`
- `tradingview_capture_current_chart`
- `tradingview_build_chartbook`

The server instructions and every tool description state the charting-only guardrails. V1 does not expose raw click, type, page evaluate, or generic browser-control tools.

### Domain Contract

`src/domain.ts` records the project purpose and guardrails. It also defines the
stable chart-analysis profile names and the allowed/forbidden profile output
categories. This gives tests and future tools a shared place to reference the
charting-only boundary.

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

`src/tradingview/chart-universe-runner.ts` resolves a local universe selection,
then charts each resolved symbol through the same one-symbol chart runner used
by the CLI and MCP `tradingview_chart_universe` tool. It preserves configured
order and reports per-symbol chart results without scoring or ranking.

### Local Universe Config

`config/universe.sample.json` is the tracked v1 sample universe. It defines core and extended lists for semiconductors, AI software, AI infrastructure, enterprise software, and cybersecurity using exchange-qualified TradingView symbols, display aliases, optional company names, and tags.

`src/universe/config.ts` validates the local JSON format, normalizes TradingView symbols, lists group summaries, and resolves selected groups/tiers into an ordered, de-duplicated symbol list for charting.

`src/cli.ts` exposes `universe list` and `universe resolve` commands. These commands read local config only and do not depend on TradingView watchlists.

### Objective Pine Drawing Overlay

`pine/objective-drawing-overlay.pine` is the first tracked Pine source for user-installed chart drawings. Its required visible TradingView study name is `TVMCP Objective Drawing Overlay`.

The overlay is self-contained from chart OHLCV and TradingView time/session context. It creates line, label, box, table, plot, and plotshape output for prior day/week/month levels, 20D/50D high-low levels, confirmed swing highs/lows, gap zones, ATR compression range boxes, intraday premarket/opening-range levels, and anchored VWAP from a major gap or confirmed pivot. It exposes `focus`, `clean`, `levels`, and `full-debug` style presets and uses timeframe checks to emphasize weekly, daily, and 65-minute review contexts. `focus` is the default quieter preset: weekly charts show major context, daily charts show breakout context, and 65-minute charts show timing context while preserving price-scale plot output for extraction.

The repo does not inject Pine into TradingView. Manual install and visual inspection instructions live in `docs/pine/objective-drawing-overlay.md`.

### Pine Drawing Extraction

`src/tradingview/pine-drawings.ts` normalizes compact TradingView/CDP payloads for the configured study name `TVMCP Objective Drawing Overlay`. It returns deduplicated horizontal levels, box-derived high/low zones, compact labels, compact tables, chart context, and warnings. If TradingView only exposes the overlay through DOM legend text, it falls back to the known Pine plot order for that configured study and recovers plotted objective levels from the compact legend values. Raw TradingView internals are omitted unless debug mode is explicitly requested.

`src/tradingview/pine-drawing-page.ts` evaluates a bounded page probe against the active TradingView chart target. The probe targets the configured overlay study by name or the known Pine short title and collects compact study payload candidates from supported page/widget surfaces. Its legend-DOM fallback keeps only the matched overlay legend plus the smallest surrounding legend text needed for deterministic value recovery.

`src/tradingview/pine-drawing-runner.ts` combines the existing CDP health check, chart target WebSocket connection, page payload read, and normalizer into a single extraction result. `src/cli.ts` exposes this as `drawings`.

### Structured Chart Facts

`src/chart-analysis/chart-facts.ts` derives compact objective facts from normalized overlay extraction for user-selected `focus`, `breakout`, `squeeze`, and `momentum` review profiles. Facts include extracted breakout reference levels, nearest support/resistance when TradingView exposes a current chart price, compression range state from extracted boxes or focus tables, AVWAP presence/value, intraday timing levels, and warnings for unavailable fields. The facts layer does not score, rank, recommend, alert, or infer hidden zones from screenshots.

### Current Chart Capture

`src/tradingview/current-chart-capture.ts` captures the currently visible TradingView chart without navigating it to a different symbol. It checks CDP health, captures a PNG screenshot from the active chart target, reads the configured objective overlay payload, writes `current-chart.png` plus `current-chart-levels.json` under an ignored local artifact directory, includes structured chart facts in the JSON/result, and reports partial failures in the structured result.

### Chartbook Output

`src/chartbook/chartbook.ts` builds deterministic local chartbook session plans under `artifacts/tradingview-chartbooks/<session-id>/`. It resolves one directory per selected universe symbol and plans weekly, daily, and 65-minute screenshot plus `*-levels.json` artifact paths.

The chartbook runner uses the existing TradingView Desktop health check, chart page client, and Pine drawing page client. For each symbol/timeframe, it navigates the active chart target, waits for render, captures a screenshot, reads the objective overlay payload, writes compact structured drawing JSON with chart facts, and writes a per-symbol `notes.md` page. It writes a session `index.md` after the run.

Partial failures are recorded in-place. A failed timeframe still gets a matching `*-levels.json` with the screenshot/extraction error when the symbol directory can be written, and later timeframes/symbols continue. Existing successful captures are not deleted.

`src/cli.ts` exposes this as `chartbook`, with universe selection options plus `--session`, `--output-dir`, `--preset`, `--profile`, `--study-name`, and CDP/render timing options.

### Tests

`test/domain.test.ts` verifies that the bootstrap project contract continues to state the manual-only, no-broker, no-scanner boundary and that chart-analysis profiles stay user-selected review modes without ranking, advice, broker, order, or alert output.

`test/tradingview-targets.test.ts` and `test/tradingview-health.test.ts` cover CDP target filtering and health-result shaping with fake CDP responses.

`test/chart-plan.test.ts`, `test/chart-runner.test.ts`, `test/cli-core.test.ts`, and `test/cli-chart-universe.test.ts` cover command planning, deterministic output naming, core CLI parsing/formatting, chart-universe CLI parsing/formatting, and per-timeframe error handling with fake clients.

`test/universe-config.test.ts` and `test/cli-universe.test.ts` cover local universe parsing, duplicate handling, invalid symbols, group selection, and CLI formatting.

`test/pine-overlay.test.ts` statically validates the tracked Pine source and manual install docs without requiring a live TradingView session.

`test/pine-drawings.test.ts` and `test/pine-drawing-runner.test.ts` cover configured-study targeting, level de-duplication, zone/label/table normalization, debug raw-output gating, and health failure handling with fixture-like payloads.

`test/chart-facts.test.ts` covers fixture-like breakout, squeeze, and momentum facts without scoring, ranking, or recommendation fields.

`test/chartbook.test.ts` covers deterministic chartbook path generation, screenshot/levels JSON artifact creation, chart-facts artifact output, notes/index Markdown output, and partial failure recording with fake clients.

`test/mcp-tools.test.ts` uses in-memory MCP transports to verify the advertised v1 tool list, guardrail descriptions, server instructions, structured status output, request validation, and ordered universe charting without a live TradingView session.

### Project Docs

Root docs and `docs/` explain how agents should run the repo, what the system is allowed to do, and where durable decisions live.

## Boundaries

- In scope: local MCP server, user-directed TradingView Desktop chart workflows, chartbook artifacts, objective chart/drawing data extraction, and user-selected chart-analysis profile vocabulary.
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

### Universe Chart Smoke Run

1. Complete the TradingView CDP health flow until a chart target is healthy.
2. Run `npm run tv:chart-universe -- --group semis --tier core --port 9222`.
3. The CLI resolves symbols from the local universe config in configured order.
4. The shared chart-universe runner charts each symbol through the one-symbol weekly, daily, and 65-minute capture workflow.
5. The CLI prints per-symbol and per-timeframe success or failure, or returns structured JSON with `--json`.

### Pine Drawing Extraction

1. Complete the TradingView CDP health flow until a chart target is healthy.
2. Confirm the manually installed overlay is visible as `TVMCP Objective Drawing Overlay`.
3. Run `npm run tv:drawings -- --port 9222 --json`.
4. The CLI targets the configured overlay study and returns compact JSON for levels, zones, labels, and tables. When structured line/box internals are hidden, plotted levels can still be recovered from the overlay legend fallback.
5. Use `--debug` only when diagnosing payload shape; normal output avoids large raw TradingView internals.

### Chartbook Output

1. Complete the TradingView CDP health flow until a chart target is healthy.
2. Confirm the manually installed overlay is visible as `TVMCP Objective Drawing Overlay`.
3. Run `npm run tv:chartbook -- --group semis --tier core --port 9222`.
4. The CLI resolves the local universe selection without ranking or scoring symbols.
5. The runner writes a deterministic local session directory under `artifacts/tradingview-chartbooks/<session-id>/` with `index.md`, one directory per symbol, weekly/daily/65-minute screenshots, matching `*-levels.json` files with drawing extraction plus chart facts, and per-symbol `notes.md`.
6. Review failures from the index and notes. Partial failures do not remove successful captures.

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
4. Inspect weekly, daily, and 65-minute charts with the default `focus` preset.
5. Use `full-debug` only when reviewing source events for extraction readiness.

### MCP Startup

1. Build with `npm run build`.
2. Configure Codex to run `node dist/src/index.js` as a stdio MCP server.
3. Codex starts the local server process when the MCP server is enabled.
4. Codex sees only the high-level v1 charting tools; raw browser-control tools are not registered.

## Important Invariants

- The server must remain local-first.
- TradingView Desktop access must be user-controlled and subscription-respecting.
- CDP health checks must use only the user's local TradingView Desktop session.
- One-symbol chart capture must stay user-directed and must report per-timeframe failures without converting them into scanner/ranking output.
- Local universe config is the v1 source of truth for chart symbol lists; TradingView watchlists are not required or read for universe resolution.
- Universe selection preserves configured order and de-duplicates symbols without scoring, ranking, or generating candidates.
- Chart-universe CLI/MCP runs are smoke charting workflows over configured symbols, not scans or candidate-generation workflows.
- Pine overlay source must be manually installed, deterministic from chart OHLCV, and free of subjective pattern labels or scanner/ranking/trade-action text.
- Downstream Pine drawing extraction must target the visible study name `TVMCP Objective Drawing Overlay`.
- Pine drawing extraction must keep payloads compact by default and avoid raw TradingView internals unless debug mode is explicit.
- Pine legend fallback may recover objective plot levels for the configured overlay, but must not scrape unrelated indicator legends or infer hidden box zones from pixels.
- Current-chart capture must preserve the active chart context and avoid navigating the chart to a different symbol.
- Chartbook output is a local review/prep artifact only and must keep generated files under ignored artifact directories by default.
- Chartbook universe selection preserves configured order and metadata without scanner, ranking, recommendation, or execution language.
- Structured chart facts must stay objective and extraction-derived; unavailable fields should be represented with warnings instead of inferred from screenshots or pixels.
- Chart-analysis profiles are review modes over user-selected charts or configured universe selections; they may produce objective facts, levels, checklist fields, notes, and prompts, but not rankings, watchlist scoring, financial advice, broker calls, order actions, unattended alerts, or generated candidates.
- The MCP tool surface must stay high-level and must not expose raw browser micromanagement tools.
- The repo must not grow broker, scanner, or execution behavior through incidental helper code.
- Architecture docs describe current system shape only; future task plans belong in `docs/plans/` while active.
