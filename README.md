# tradingview-mcp

Local Codex MCP project for charting a software, semiconductor, and AI stock universe in TradingView Desktop.

V1 is a charting assistant, not a scanner, broker integration, or trade execution system.

## Status

This repo has a TypeScript MCP server scaffold, a local TradingView Desktop CDP launch/health workflow, a narrow one-symbol chart capture CLI, a local universe config workflow, compact extraction for the installed objective Pine drawing overlay, and local chartbook artifact output.

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
npm run test:pine
npm run tv:launch -- --port 9222
npm run tv:health -- --port 9222
npm run tv:chart -- --symbol NASDAQ:NVDA --port 9222
npm run tv:chartbook -- --group semis --tier core --port 9222
npm run tv:drawings -- --port 9222 --json
npm run tv:universe -- list
npm run tv:universe -- resolve --group semis --tier core
```

## Pine Drawing Overlay

The first objective drawing overlay source is tracked at [`pine/objective-drawing-overlay.pine`](./pine/objective-drawing-overlay.pine). Install it manually in TradingView Desktop and keep the visible study name exactly:

```text
TVMCP Objective Drawing Overlay
```

The overlay draws deterministic objects from chart OHLCV: prior day/week/month levels, 20D/50D high-low levels, confirmed swings, gap zones, ATR compression range boxes, intraday premarket/opening-range levels, and anchored VWAP from a major gap or confirmed pivot. It has `clean`, `levels`, and `full-debug` style presets and is tuned for the v1 weekly, daily, and 65-minute review flow.

Manual install and visual inspection guidance lives in [docs/pine/objective-drawing-overlay.md](./docs/pine/objective-drawing-overlay.md). Static repo tests validate the source and docs; live TradingView rendering remains a human validation boundary for overlay changes.

## Pine Drawing Extraction

After TradingView Desktop is running with CDP enabled, a chart tab is open, and the objective overlay is installed, extract compact structured drawing data from the visible chart:

```bash
npm run tv:drawings -- --port 9222 --json
```

The extractor targets the configured study name, `TVMCP Objective Drawing Overlay`, and does not scrape every visible indicator by default. It returns deduplicated horizontal levels, high/low zones from boxes, compact labels, and compact tables for chartbook artifacts and Codex review. Use `--study-name <name>` only when intentionally validating a differently named local copy of the overlay.

Use `--debug` with `--json` only when diagnosing a TradingView payload shape. Normal output avoids dumping large raw TradingView internals.

## Local Universe Config

The v1 universe source of truth is a local JSON file, not TradingView watchlists. The tracked sample lives at [`config/universe.sample.json`](./config/universe.sample.json) and includes core and extended groups for semiconductors, AI software, AI infrastructure, and enterprise software.

List the configured groups:

```bash
npm run tv:universe -- list
```

Resolve ordered chart symbols for a group and tier:

```bash
npm run tv:universe -- resolve --group semis --tier core
```

Use `--tier extended` or `--tier all` to change the selection. Use comma-separated group ids to resolve more than one group:

```bash
npm run tv:universe -- resolve --group semis,ai-software --tier all
```

Use `--config <path>` to point at a user-local copy, for example `config/universe.local.json`. Local `*.local.json` universe files are ignored by Git. Resolution de-duplicates symbols while preserving the first configured order and keeping source group/tier metadata in JSON output.

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

## Chart One Symbol

After TradingView Desktop is running with CDP enabled and a chart tab is open, capture one exchange-qualified symbol across the default weekly, daily, and 65-minute timeframes:

```bash
npm run tv:chart -- --symbol NASDAQ:NVDA --port 9222
```

The command navigates the active TradingView chart target by URL, waits for each timeframe to render, and writes PNG screenshots to a deterministic local directory:

```text
artifacts/tradingview-charts/NASDAQ-NVDA/
  NASDAQ-NVDA-weekly.png
  NASDAQ-NVDA-daily.png
  NASDAQ-NVDA-65-minute.png
```

Use `--output-dir <path>` to choose a different artifact root. The command reports each timeframe as `OK` or `FAILED`; it does not scan, rank, place orders, or bypass TradingView access controls.

## Chartbook Output

After TradingView Desktop is running with CDP enabled, a chart tab is open, and the objective overlay is installed, create a local chartbook for a selected universe:

```bash
npm run tv:chartbook -- --group semis --tier core --port 9222
```

By default, the command writes an ignored local session directory under:

```text
artifacts/tradingview-chartbooks/<session-id>/
  index.md
  NASDAQ-NVDA/
    notes.md
    NASDAQ-NVDA-weekly.png
    NASDAQ-NVDA-weekly-levels.json
    NASDAQ-NVDA-daily.png
    NASDAQ-NVDA-daily-levels.json
    NASDAQ-NVDA-65-minute.png
    NASDAQ-NVDA-65-minute-levels.json
```

Use `--session <id>` for a deterministic session name, `--output-dir <path>` for a different local artifact root, `--preset <name>` to record the manually selected overlay preset, and the same `--group`, `--tier`, and `--config` options as universe resolution. Partial failures remain recorded in `index.md`, `notes.md`, and the matching `*-levels.json` files without deleting successful screenshots.

Chartbooks are local review/prep artifacts only. They do not rank symbols, recommend trades, place orders, use broker APIs, or bypass TradingView access controls.

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
