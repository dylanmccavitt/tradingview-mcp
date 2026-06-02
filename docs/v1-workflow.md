# V1 Codex MCP Workflow

This is the end-to-end local setup and operating path for the v1
TradingView MCP workflow. It assumes the canonical checkout is:

```text
/Users/dylanmccavitt/projects/tradingview-mcp
```

If the repo is cloned somewhere else, replace that path in the examples below.

## Boundary

V1 is a manual TradingView Desktop charting assistant. It can launch and check
the local TradingView Desktop CDP connection, chart user-selected symbols or
configured universe groups, capture screenshots, extract objective overlay
levels, write local chartbooks, and, when explicitly enabled, run bounded raw
CDP primitives against the active local TradingView chart target.

V1 is not a scanner, ranking engine, broker integration, signal service, or
trade execution system. It must not place orders, connect to Robinhood, connect
to Alpaca, automate broker actions, recommend trades, run unattended scans, or
bypass TradingView access controls.

Chart-analysis profiles are user-selected review modes. The stable profile
names are `focus`, `breakout`, `squeeze`, and `momentum`. A profile may
emphasize objective chart facts, extracted levels, setup checklist fields,
chartbook notes, and prompts for user review. A profile must not rank symbols,
score a watchlist, provide financial advice, trigger order actions, call
brokers, create unattended alerts, or generate candidates outside the user's
selected chart or configured universe selection.

Short version: no scanner, no broker actions, no order placement, no Robinhood
automation, and no Alpaca automation.

## Install And Build

From the repo root:

```bash
cd /Users/dylanmccavitt/projects/tradingview-mcp
npm install
npm run build
```

Run the local verification checks after setup or after pulling updates:

```bash
npm run typecheck
npm run lint
npm test
```

Run the Pine static check when the tracked Pine source or Pine docs change:

```bash
npm run test:pine
```

## Configure Codex MCP

Codex reads MCP servers from `~/.codex/config.toml` for global setup. Add this
local stdio server block after `npm run build` succeeds:

```toml
[mcp_servers.tradingview]
command = "node"
args = ["/Users/dylanmccavitt/projects/tradingview-mcp/dist/src/index.js"]
cwd = "/Users/dylanmccavitt/projects/tradingview-mcp"
startup_timeout_sec = 20
tool_timeout_sec = 45
```

The `cwd` setting keeps default universe config reads and artifact writes
relative to the repo. Restart Codex, reload MCP settings, or start a new Codex
thread after changing the config. OpenAI's Codex MCP docs are at
<https://developers.openai.com/codex/mcp>.

The v1 MCP server exposes high-level charting tools by default:

- `tradingview_connect`
- `tradingview_status`
- `tradingview_list_universe`
- `tradingview_chart_symbol`
- `tradingview_chart_universe`
- `tradingview_capture_current_chart`
- `tradingview_build_chartbook`

The default surface does not expose raw click, type, page-evaluate, or generic
browser-control tools.

## Experimental Raw Automation Boundary

The experimental raw automation slice supports bounded CDP/page evaluation,
basic mouse, keyboard, and text input, visible UI element discovery,
selector-based click/hover, and bounded scroll against the active local
TradingView chart target. It also supports MCP-only direct chart controls and
compact chart data extraction when the active chart exposes the needed
chart APIs, native TradingView drawing tools when chart/drawing APIs are
available, plus quant drawing macros for Fib-style levels, measured-move
projections, range projections, MCP-only workspace tab/pane/layout controls,
bounded explicit batch chart actions, and MCP-only Pine Editor tools.
Raw automation is not part of the default high-level chartbook workflow.

Raw automation tools must be explicitly enabled with:

```text
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1
```

Raw tool names must use clear namespaces:

- `tradingview_raw_*` for raw CDP/page evaluation, input, UI discovery, and
  direct chart controls
- `tradingview_draw_*` for native TradingView drawing creation, inspection, and
  removal
- `tradingview_pine_*` for explicit Pine Editor source, compile, save, errors,
  and console actions

Current enabled MCP raw tools are:

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
- `tradingview_draw_shape`
- `tradingview_draw_list`
- `tradingview_draw_properties`
- `tradingview_draw_remove`
- `tradingview_draw_clear_all`
- `tradingview_draw_fib_levels`
- `tradingview_draw_projection`
- `tradingview_pine_open_editor`
- `tradingview_pine_set_source`
- `tradingview_pine_get_source`
- `tradingview_pine_get_errors`
- `tradingview_pine_get_console`
- `tradingview_pine_compile`
- `tradingview_pine_save`

Native drawing tools create supported shapes from explicit price/time anchors,
list drawing ids/types/names when available, inspect drawing points and
properties when exposed, remove one drawing by id, and clear all native drawings
only when `confirmClearAll` is explicitly true. They fail with clear
unsupported-API reasons when TradingView does not expose the required chart
API. Macro drawing tools use those same native drawing APIs to create
mechanical Fib-style, measured-move, and range-projection review levels from
explicit anchors or caller-selected extracted range facts. They return created
drawing ids, anchor metadata, levels used, and warnings; outputs are review
context only, not predictions, recommendations, rankings, or advice.
Pine Editor tools can open or focus the editor, set bounded source without
compiling or saving, read bounded source with truncation warnings, read compact
compile markers and console/output rows, and run explicit compile or save calls
as separate user-directed actions.
Replay tools are MCP-only chart-practice/review controls. They open, play or
pause, step, set speed, and exit replay mode only when TradingView exposes
reliable local replay APIs. If those controls are unavailable, they return
unsupported-control errors rather than scraping unrelated UI. Replay output is
compact action/status context only; it is not performance scoring, a scan,
ranking, alert, generated candidate, recommendation, financial advice, broker
action, order workflow, or unattended replay session.

The matching CLI commands are:

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

Raw tools must target only the active local `tradingview.com/chart` page found
by the repo's CDP health flow. They must not operate on arbitrary browser
pages, broker/order pages, TradingView account or security settings, or any
non-TradingView target. Raw evaluate output stays compact by default and should
return purpose-built structured values, not broad DOM dumps.
Raw outputs should stay compact by default.

The direct chart state/control tools are MCP-only in this slice. They return
compact before/after chart state or a clear failure when TradingView does not
expose the required chart API for chart type, visible range, study creation, or
entity removal.

The compact chart data tools are MCP-only in this slice. They return bounded
OHLCV summary stats, active-chart quote/current-bar snapshots, and compact
visible study values when TradingView exposes them. Data extraction output is
local chart-review context only; it is not a scan, ranking, alert,
recommendation, generated candidate, or market-data service replacement.

Workspace tools are MCP-only in this slice. They list/focus local chart tabs,
list/focus panes, set common pane layouts, and list/switch saved layouts only
when TradingView exposes the required APIs. The batch chart tool applies
bounded explicit symbol/timeframe actions in caller-provided order and reports
per-step results; it does not scan, rank, score, recommend, alert, or generate
candidates.

Replay tools are also MCP-only in this slice. They are explicit
caller-directed chart-practice controls and do not start unattended replay
sessions, score performance, scan, rank, recommend, alert, or generate
candidates.

Raw automation does not change the core guardrails: no broker actions, no order
placement, no scanner/ranking behavior, no financial advice, no unattended
alerts, and no generated candidates.

The review-producing MCP tools expose the accepted profile enum
`focus|breakout|squeeze|momentum`:

- `tradingview_capture_current_chart` for the currently selected chart
- `tradingview_build_chartbook` for ordered configured-universe chartbooks

These profile fields select objective review emphasis only. They do not turn
the workflow into a scan, ranking, recommendation, alert, broker call, or order
action. `tradingview_chart_universe` remains ordered smoke charting and does not
accept a profile.

## Launch TradingView Desktop With CDP

If TradingView Desktop is already open without CDP, quit it first. Then launch
it through the repo command:

```bash
npm run tv:launch -- --port 9222
```

If TradingView Desktop is installed outside `/Applications/TradingView.app` or
`~/Applications/TradingView.app`, pass the app path explicitly:

```bash
npm run tv:launch -- --app /Applications/TradingView.app --port 9222
```

To inspect the exact macOS launch command without starting TradingView:

```bash
npm run tv:launch-command -- --port 9222
```

After launch, open or focus a TradingView chart tab manually. Log in manually
if TradingView asks for it.

Check CDP and chart-target health:

```bash
npm run tv:health -- --port 9222
```

Healthy output means the app was found, CDP answered, and an active
`tradingview.com/chart` page target was discovered. Unhealthy output includes
next steps for a missing app, wrong or unreachable port, unexpected CDP
response, or no open chart tab.

## Install Or Update The Pine Overlay

The tracked Pine source lives at:

```text
pine/objective-drawing-overlay.pine
```

Manual install or update steps:

1. Open TradingView Desktop.
2. Open a chart tab for an exchange-qualified symbol such as `NASDAQ:NVDA`.
3. Open the Pine Editor.
4. Paste the full contents of `pine/objective-drawing-overlay.pine`.
5. Save the script with the exact visible study name:

```text
TVMCP Objective Drawing Overlay
```

6. Add the saved script to the chart.
7. Confirm the indicator list shows `TVMCP Objective Drawing Overlay`.
8. Leave `Style preset` at the default `focus` for normal weekly, daily, and
   65-minute review.

Do not rename the study in TradingView. Drawing extraction and chartbooks target
that visible study name by default.

Use `levels` for deeper level/zone review, `clean` for a sparse view, and
`full-debug` only when reviewing source events or debugging extraction. The
overlay is Pine-generated objective output from chart OHLCV and TradingView
time/session context; it is not native editable TradingView drawing automation.

To check the structured overlay extraction on the currently visible chart:

```bash
npm run tv:drawings -- --port 9222 --json
```

Use `--debug` only while diagnosing TradingView payload shape because normal
output intentionally avoids large raw internals.

## Chart Symbols And Universes

The v1 universe source of truth is local JSON, not TradingView watchlists. The
tracked sample is:

```text
config/universe.sample.json
```

List configured universe groups:

```bash
npm run tv:universe -- list
```

Resolve a group and tier without chart navigation:

```bash
npm run tv:universe -- resolve --group semis --tier core
```

Chart one exchange-qualified symbol across the default weekly, daily, and
65-minute timeframes:

```bash
npm run tv:chart -- --symbol NASDAQ:NVDA --port 9222
```

Chart a local universe selection in configured order:

```bash
npm run tv:chart-universe -- --group semis --tier core --port 9222
```

`chart-universe` is a smoke charting workflow over configured symbols. It
preserves config order and de-duplicates repeated symbols. It does not score,
rank, scan, recommend, or create candidates.

Use `--config config/universe.local.json` for a user-local universe file.
`*.local.json` files under `config/` are ignored by Git.

## Build A Chartbook

With TradingView Desktop healthy, a chart tab open, and the objective overlay
visible, run:

```bash
npm run tv:chartbook -- --group semis --tier core --session manual-smoke --port 9222
npm run tv:chartbook -- --group semis --tier core --profile breakout --session manual-breakout --port 9222
npm run tv:breakout-dashboard -- --group semis --tier core --session manual-breakout --port 9333
```

The command navigates the active chart target through the selected symbols and
default timeframes, then writes an ignored local chartbook session under:

```text
artifacts/tradingview-chartbooks/manual-smoke/
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

Use `--json` for structured command output, `--output-dir <path>` for a
different artifact root, `--preset <name>` to record the manually selected
overlay preset in the chartbook metadata, and
`--profile focus|breakout|squeeze|momentum` to choose the objective chart-facts
emphasis.

For the common Codex breakout dashboard workflow, prefer
`npm run tv:breakout-dashboard -- --group <group> --tier <tier> --session <id>
--port <port>`. It fixes the chartbook profile to `breakout`, records the
overlay preset as `focus`, and uses longer render timing defaults for more
stable screenshot capture.

How to read chartbook artifacts:

- `index.html` is the primary local review dashboard. It shows session metadata,
  profile/preset, per-symbol warnings, profile-specific review panels,
  generated Codex Analysis briefs from extracted chart facts,
  weekly/daily/65-minute screenshots, links to levels JSON, and local manual
  note fields. These briefs are review context only; they do not rank, recommend,
  alert, trade, or call brokers.
- `index.md` is the session summary with the selected groups, tier, output
  paths, and per-symbol/timeframe status.
- Each PNG is the captured TradingView chart screenshot for that symbol and
  timeframe.
- Each `*-levels.json` file contains compact objective overlay extraction for
  the matching screenshot: horizontal levels, zones from boxes, labels, tables,
  counts, warnings, chart context, a `facts` object for breakout references,
  compression state, AVWAP, timing levels, and nearest support/resistance when
  TradingView exposes a current chart price, plus extraction or screenshot
  errors when a partial failure happened.
- Each `notes.md` file embeds that symbol's screenshots, surfaces extraction
  warnings, and includes a profile-aware human review checklist for the
  selected focus.

Partial failures are recorded in `index.html`, `index.md`, `notes.md`, and the
matching `*-levels.json` files. Successful captures are kept.

Chartbooks are local review/prep artifacts only. They do not rank symbols,
recommend trades, place orders, use broker APIs, connect to Robinhood, connect
to Alpaca, or bypass TradingView access controls.

## Typical Codex Operating Loop

1. Build the server with `npm run build`.
2. Confirm the global `~/.codex/config.toml` MCP block points at the built
   `dist/src/index.js` and repo `cwd`.
3. Launch TradingView Desktop with `npm run tv:launch -- --port 9222`.
4. Open a chart tab manually and confirm `npm run tv:health -- --port 9222`.
5. Install or update the Pine overlay and confirm the visible study name is
   `TVMCP Objective Drawing Overlay`.
6. Ask Codex to use the high-level TradingView MCP tools for status, one-symbol
   charting, universe charting, current-chart capture, or chartbook creation.
7. Open the generated `index.html` under `artifacts/tradingview-chartbooks/`
   for review, with Markdown and JSON available beside it.

If you want to use raw automation tools, start a separate session with
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` in the MCP server environment. Keep
the high-level workflow as the default when you only need chartbooks, captures,
and extraction artifacts.

If a Codex tool reports CDP unreachable, use the CLI health command first. If a
chartbook has empty or warning-heavy level JSON, confirm the overlay is visible
with the exact required study name and rerun `npm run tv:drawings -- --port
9222 --json` on the current chart.
