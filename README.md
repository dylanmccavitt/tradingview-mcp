# tradingview-mcp

Local Codex MCP project for charting software, semiconductor, AI, infrastructure, and cybersecurity stock universes in TradingView Desktop.

V1 is a charting assistant, not a scanner, broker integration, or trade execution system.

## Status

This repo has a TypeScript MCP server with high-level charting tools, a local TradingView Desktop CDP launch/health workflow, a narrow one-symbol chart capture CLI, a local universe config workflow, compact extraction for the installed objective Pine drawing overlay, structured chart facts for user-selected review profiles, current-chart capture, local chartbook artifact output, and an explicitly gated experimental raw automation surface for bounded chart-target CDP primitives, compact chart data extraction, native drawings, chart controls, replay practice controls, and Pine Editor actions.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- TradingView Desktop for local chart workflows

## Setup

```bash
npm install
```

For the full v1 Codex MCP setup and operating path, use
[docs/v1-workflow.md](./docs/v1-workflow.md).

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
npm run tv:chart-universe -- --group semis --tier core --port 9222
npm run tv:chartbook -- --group semis --tier core --port 9222
npm run tv:chartbook -- --group semis --tier core --profile breakout --port 9222
npm run tv:breakout-dashboard -- --group semis --tier core --session manual-breakout --port 9333
npm run tv:drawings -- --port 9222 --json
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- evaluate --expression "document.title" --port 9222 --json
npm run tv:universe -- list
npm run tv:universe -- resolve --group semis --tier core
```

## Pine Drawing Overlay

The first objective drawing overlay source is tracked at [`pine/objective-drawing-overlay.pine`](./pine/objective-drawing-overlay.pine). Install it manually in TradingView Desktop and keep the visible study name exactly:

```text
TVMCP Objective Drawing Overlay
```

The overlay draws deterministic objects from chart OHLCV: prior day/week/month levels, 20D/50D high-low levels, confirmed swings, gap zones, ATR compression range boxes, intraday premarket/opening-range levels, and anchored VWAP from a major gap or confirmed pivot. It defaults to the quieter `focus` style preset with restrained 1 px horizontal levels, short text-only labels, and a compact trend/reclaim/support table. It keeps `clean`, `levels`, and `full-debug` available, and is tuned for the v1 weekly, daily, and 65-minute review flow.

Manual install and visual inspection guidance lives in [docs/pine/objective-drawing-overlay.md](./docs/pine/objective-drawing-overlay.md). Static repo tests validate the source and docs; live TradingView rendering remains a human validation boundary for overlay changes.

## Pine Drawing Extraction

After TradingView Desktop is running with CDP enabled, a chart tab is open, and the objective overlay is installed, extract compact structured drawing data from the visible chart:

```bash
npm run tv:drawings -- --port 9222 --json
```

The extractor targets the configured study name, `TVMCP Objective Drawing Overlay`, and does not scrape every visible indicator by default. It returns deduplicated horizontal levels, high/low zones from boxes, compact labels, and compact tables for chartbook artifacts and Codex review. When TradingView exposes only the visible indicator legend, the extractor falls back to the objective overlay's known Pine plot order and recovers plotted levels such as `PDH`, `PWH`, `20D-H`, `OR-H`, and `AVWAP` from the compact legend text. Chartbook and current-chart artifacts also include a `facts` object for objective breakout, squeeze, and momentum review fields derived from the extracted overlay data. Use `--study-name <name>` only when intentionally validating a differently named local copy of the overlay.

Use `--debug` with `--json` only when diagnosing a TradingView payload shape. Normal output avoids dumping large raw TradingView internals.

## Local Universe Config

The v1 universe source of truth is a local JSON file, not TradingView watchlists. The tracked sample lives at [`config/universe.sample.json`](./config/universe.sample.json) and includes core and extended groups for semiconductors, AI software, AI infrastructure, enterprise software, and cybersecurity.

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

## Chart Universe

For a repeatable smoke run across a selected local universe, use the direct
chart-universe CLI command:

```bash
npm run tv:chart-universe -- --group semis --tier core --port 9222
```

The command resolves symbols from the same local universe config used by the
MCP `tradingview_chart_universe` tool, then charts each symbol across the
default weekly, daily, and 65-minute timeframes. It preserves configured order,
de-duplicates through the universe resolver, and reports per-symbol/per-timeframe
success or failure.

Use the same `--group`, `--tier`, and `--config` options as universe resolution.
Use `--json` for structured output suitable for smoke checks. This is still a
charting workflow only; it does not scan, score, rank, recommend trades, place
orders, use broker APIs, or bypass TradingView access controls.

## Chartbook Output

After TradingView Desktop is running with CDP enabled, a chart tab is open, and the objective overlay is installed, create a local chartbook for a selected universe:

```bash
npm run tv:chartbook -- --group semis --tier core --port 9222
```

By default, the command writes an ignored local session directory under:

```text
artifacts/tradingview-chartbooks/<session-id>/
  index.md
  index.html
  NASDAQ-NVDA/
    notes.md
    NASDAQ-NVDA-weekly.png
    NASDAQ-NVDA-weekly-levels.json
    NASDAQ-NVDA-daily.png
    NASDAQ-NVDA-daily-levels.json
    NASDAQ-NVDA-65-minute.png
    NASDAQ-NVDA-65-minute-levels.json
```

Use `--session <id>` for a deterministic session name, `--output-dir <path>` for a different local artifact root, `--preset <name>` to record the manually selected overlay preset, `--profile focus|breakout|squeeze|momentum` to choose the chart-facts emphasis, and the same `--group`, `--tier`, and `--config` options as universe resolution. Open `index.html` for the scannable local dashboard with screenshots, warnings, generated Codex Analysis briefs, profile-specific review panels, links to JSON artifacts, and local manual-note fields. Each `notes.md` remains a per-symbol Markdown fallback with the same profile-aware checklist. Partial failures remain recorded in `index.html`, `index.md`, `notes.md`, and the matching `*-levels.json` files without deleting successful screenshots.

Chartbooks are local review/prep artifacts only. They do not rank symbols, recommend trades, place orders, use broker APIs, or bypass TradingView access controls.

For the common Codex breakout-review path, use the shortcut command:

```bash
npm run tv:breakout-dashboard -- --group semis --tier core --session manual-breakout --port 9333
```

It runs chartbook with `--profile breakout`, `--preset focus`, a longer render
timeout, and a longer settle delay, then prints the generated `index.html`
dashboard path.

## Review Profiles

The stable chart-analysis review profiles are `focus`, `breakout`, `squeeze`,
and `momentum`. Profiles change objective chart-facts emphasis and chartbook
review checklists only; they do not scan, score, rank, recommend, alert, or
trade.

The CLI exposes review profiles on chartbooks:

```bash
npm run tv:chartbook -- --group semis --tier core --profile momentum --port 9222
```

The MCP surface exposes the same profile enum only on
`tradingview_capture_current_chart` and `tradingview_build_chartbook`, because
those tools produce review artifacts with objective facts and notes.
`tradingview_chart_universe` remains ordered smoke charting over configured
symbols and does not accept a profile. Universe selections preserve local config
order and do not emit score or rank fields.

## Experimental Raw Automation

Raw automation is disabled by default. Enable it only for a separate local
session that intentionally needs bounded TradingView chart-target primitives:

```bash
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- evaluate --expression "document.title" --port 9222 --json
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- click --x 100 --y 200 --button left --port 9222
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- keypress --key Escape --port 9222
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- type-text --text "NASDAQ:NVDA" --port 9222
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- find-element --strategy text --value "Watchlist" --port 9222 --json
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- selector-click --strategy css --value "[data-name=watchlist-button]" --port 9222
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- selector-hover --strategy aria-label --value "Watchlist" --port 9222
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1 npm run tv:raw -- scroll --direction down --amount 600 --port 9222
```

The raw runner first uses the same CDP health flow as the charting tools and
will not run without an active local `tradingview.com/chart` target. Raw
evaluate returns compact structured output by default and rejects oversized
expressions/results. Raw input primitives dispatch coordinate clicks, one
keypress, bounded text insertion, visible element discovery, selector-based
click/hover, or bounded scroll only against the active chart target. The MCP
raw surface also exposes direct chart state/control tools for reading compact
current chart state, setting symbol/timeframe/chart type/visible range, adding
a named indicator, and removing a chart entity by id when TradingView exposes
the required chart API. Those tools return before/after state or an explicit
API-unavailable failure. MCP-only workspace tools list/focus local chart tabs,
list/focus panes, set common pane layouts, and list/switch saved layouts only
when TradingView exposes the required APIs. The bounded batch chart tool applies
explicit user-provided symbol/timeframe actions in caller order only; it does
not scan, rank, score, recommend, alert, or generate candidates. MCP-only raw
data tools read bounded OHLCV summary stats, quote/current-bar snapshots, and
compact visible study values when TradingView exposes them; those outputs are
local chart-review context only, not scans, rankings, alerts, recommendations,
or advice. MCP-only quant drawing tools can also create one native TradingView
Fib Retracement object, line-based Fib-style retracement/extension fallback
levels, and measured-move or range-projection review levels from explicit
anchors or caller-selected extracted range facts when native drawing APIs are
exposed. Drawing output records created drawing ids, anchor metadata, levels
used, and warnings; it is review context only, not a prediction,
recommendation, ranking, or advice.
Preset-aware drawing tools accept `drawingPreset` values `clean-thesis`,
`minimal-levels`, and `risk-map`; the default `clean-thesis` keeps every drawn
line at 1px and uses low-opacity shaded areas for boxes and Fib backgrounds.

Raw automation remains experimental local chart control. It must not operate on
arbitrary browser pages, broker/order pages, TradingView account or security
settings, scanners, rankings, unattended alerts, generated candidates, or
financial-advice workflows.

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
args = ["/Users/dylanmccavitt/projects/tradingview-mcp/dist/src/index.js"]
cwd = "/Users/dylanmccavitt/projects/tradingview-mcp"
startup_timeout_sec = 20
tool_timeout_sec = 45
```

The v1 MCP server advertises high-level charting tools by default:

- `tradingview_connect`
- `tradingview_status`
- `tradingview_list_universe`
- `tradingview_chart_symbol`
- `tradingview_chart_universe`
- `tradingview_capture_current_chart`
- `tradingview_build_chartbook`

Each tool description repeats the v1 guardrail: charting-only, no scanner or
ranking behavior, no financial-advice claims, and no broker or order actions.
The default MCP surface does not expose raw click, type, or page-evaluate
browser controls. When the server process is started with
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1`, it also advertises:

- `tradingview_raw_*`
- `tradingview_raw_evaluate`
- `tradingview_raw_click`
- `tradingview_raw_keypress`
- `tradingview_raw_type_text`
- `tradingview_raw_find_element`
- `tradingview_raw_selector_click`
- `tradingview_raw_selector_hover`
- `tradingview_raw_scroll`
- `tradingview_raw_chart_state`
- `tradingview_raw_chart_data_summary`
- `tradingview_raw_quote_snapshot`
- `tradingview_raw_study_values`
- `tradingview_raw_list_tabs`
- `tradingview_raw_focus_tab`
- `tradingview_raw_list_panes`
- `tradingview_raw_focus_pane`
- `tradingview_raw_set_pane_layout`
- `tradingview_raw_list_layouts`
- `tradingview_raw_switch_layout`
- `tradingview_raw_batch_chart`
- `tradingview_raw_replay_open`
- `tradingview_raw_replay_play_pause`
- `tradingview_raw_replay_step`
- `tradingview_raw_replay_set_speed`
- `tradingview_raw_replay_exit`
- `tradingview_raw_set_symbol`
- `tradingview_raw_set_timeframe`
- `tradingview_raw_set_chart_type`
- `tradingview_raw_set_visible_range`
- `tradingview_raw_add_indicator`
- `tradingview_raw_remove_entity`
- `tradingview_draw_*`
- `tradingview_draw_shape`
- `tradingview_draw_list`
- `tradingview_draw_properties`
- `tradingview_draw_remove`
- `tradingview_draw_clear_all`
- `tradingview_draw_fib_retracement`
- `tradingview_draw_fib_levels`
- `tradingview_draw_projection`
- `tradingview_pine_*`
- `tradingview_pine_open_editor`
- `tradingview_pine_set_source`
- `tradingview_pine_get_source`
- `tradingview_pine_get_errors`
- `tradingview_pine_get_console`
- `tradingview_pine_compile`
- `tradingview_pine_save`

These raw tools are experimental, scoped only to the active local TradingView
chart target, compact by default, and still governed by the no broker/order,
no scanner/ranking, no advice, no unattended-candidate guardrails. Native
drawing tools use TradingView chart/drawing APIs only when exposed and report
clear unsupported-API failures otherwise. The macro tools create native
drawings for mechanical chart-review levels and return metadata that can be
recorded in current-chart or chartbook artifacts via `macroMetadata`. Preset
aware drawing calls accept `drawingPreset` values `clean-thesis`,
`minimal-levels`, and `risk-map`; `clean-thesis` is the default and enforces
1px lines with low-opacity shaded areas.
`tradingview_draw_clear_all` requires an explicit `confirmClearAll: true`
argument because it removes every native drawing on the active chart.
Chart data tools are MCP-only in this slice. They return bounded OHLCV
summaries, latest current-bar quote fields, and compact visible study values
when exposed by TradingView, and they report clear unsupported-data failures
otherwise.
Workspace tools are MCP-only in this slice. They list/focus chart tabs, panes,
and saved layouts only when exposed, and the batch chart tool runs bounded
explicit symbol/timeframe actions in input order without scanner/ranking or
candidate-generation behavior.
Replay tools are MCP-only in this slice. They open, play/pause, step, set
speed, and exit replay mode for explicit chart-practice/review only when
TradingView exposes reliable local replay APIs. They return compact
action/status context and fail with unsupported-control errors rather than
scraping unrelated UI. They do not score performance, start unattended replay
sessions, scan, rank, recommend, alert, generate candidates, advise, or touch
broker/order/account workflows.
Pine Editor tools are MCP-only in this slice. They can open/focus the editor,
set source without compiling or saving, read bounded source with truncation
warnings for large scripts, read compact errors and console output, and run
explicit compile or save calls as separate user-directed actions.

## V1 Boundary

V1 is a manual-only charting assistant. It may help open, inspect, and organize TradingView Desktop charting workflows in later issues, but it must not place trades, route orders, connect to broker APIs, rank trade candidates, or run unattended scans.

See [CONTEXT.md](./CONTEXT.md), [AGENTS.md](./AGENTS.md), and [docs/architecture.md](./docs/architecture.md) before implementing later issues.
