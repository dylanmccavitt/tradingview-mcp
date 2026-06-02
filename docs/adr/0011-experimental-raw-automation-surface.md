# ADR 0011: Experimental Raw Automation Surface

## Status

Accepted

## Decision

Keep the existing high-level charting tools as the default MCP surface, and
allow an explicitly opt-in experimental raw automation surface for local
TradingView Desktop chart work.

Raw automation tools must be disabled by default. They may be registered or run
only when the user explicitly enables the raw surface, using the stable gate:

```text
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1
```

Raw tools must use clear namespaces:

- `tradingview_raw_*` for CDP/page evaluation, input, element discovery, and
  direct chart controls/data extraction
- `tradingview_draw_*` for native TradingView drawing creation, inspection, and
  removal
- `tradingview_pine_*` for explicit Pine Editor source, compile, save, errors,
  and console actions

The raw surface may support local chart-target evaluation, mouse/keyboard/text
input, selector-oriented UI actions, native TradingView drawings, and direct
chart manipulation. It must target only the active local TradingView chart target
discovered through the repo's CDP health flow.

## Why

The project now needs native TradingView drawings, direct chart manipulation,
and quant-style charting macros that Pine-generated overlays cannot fully
provide. The reference TradingView MCP exposes a broad raw/control-heavy
surface, but replacing this repo with that fork would discard the existing
TypeScript tests, local universe workflow, chartbook artifacts, and explicit
guardrails.

An opt-in raw surface lets the project expand toward native drawings and
chart-control workflows while preserving the safer default chartbook/review
tools.

## Options Considered

- Keep only the current high-level MCP tools.
- Replace the repo with a fork of the reference TradingView MCP.
- Add an opt-in experimental raw surface beside the high-level tools.

## Tradeoffs

Raw automation is powerful but brittle. TradingView UI and internal chart APIs
can change, coordinate clicks can drift, and page evaluation can accidentally
return oversized or unrelated data. Keeping the raw surface opt-in, namespaced,
and local-chart-target scoped makes the risk explicit and testable.

Retaining the current repo avoids a full fork migration, but it means future
issues must port reference behavior in small slices.

## Consequences

- High-level chartbook/review tools remain the default documented workflow.
- Raw tools must not be registered unless
  `TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is set or a later ADR replaces this
  gate.
- Raw tools must target only the active local TradingView chart page, not
  arbitrary browser pages.
- Raw tool output must be compact by default.
- Raw tools must not automate broker/order workflows, TradingView account or
  security settings, scanner/ranking behavior, financial advice, unattended
  alerts, or generated candidates.
- The current accepted raw slice exposes `tradingview_raw_evaluate`,
  `tradingview_raw_click`, `tradingview_raw_keypress`, and
  `tradingview_raw_type_text` plus `tradingview_raw_find_element`,
  `tradingview_raw_selector_click`, `tradingview_raw_selector_hover`, and
  `tradingview_raw_scroll` as gated primitives for the active chart target
  only.
- The direct chart-control slice adds MCP-only raw tools for compact chart
  state, set symbol, set timeframe, set chart type, set visible range, add
  indicator, and remove entity by id when TradingView exposes the required
  chart API.
- The compact chart data slice adds MCP-only
  `tradingview_raw_chart_data_summary`, `tradingview_raw_quote_snapshot`, and
  `tradingview_raw_study_values` behind the same gate. These tools read bounded
  OHLCV summary stats, active-chart quote/current-bar fields, and compact
  visible study values only when TradingView exposes them. Their output is
  review context only, not scanner/ranking output, market-data service output,
  alerts, generated candidates, recommendations, or advice.
- The workspace-control slice adds MCP-only `tradingview_raw_list_tabs`,
  `tradingview_raw_focus_tab`, `tradingview_raw_list_panes`,
  `tradingview_raw_focus_pane`, `tradingview_raw_set_pane_layout`,
  `tradingview_raw_list_layouts`, `tradingview_raw_switch_layout`, and
  `tradingview_raw_batch_chart` behind the same gate. These tools may list or
  focus local chart tabs, inspect or focus panes, set common pane layouts, and
  list or switch saved layouts only when TradingView exposes the needed local
  chart/widget APIs. The batch tool applies bounded explicit symbol/timeframe
  actions in caller-provided order and reports per-step results; it must not
  scan, rank, score, alert, recommend, or generate candidates.
- The replay-control slice adds MCP-only `tradingview_raw_replay_open`,
  `tradingview_raw_replay_play_pause`, `tradingview_raw_replay_step`,
  `tradingview_raw_replay_set_speed`, and `tradingview_raw_replay_exit` behind
  the same gate. These tools are explicit chart-practice/review controls only.
  They use exposed local TradingView replay APIs and report unsupported-control
  errors when reliable replay controls are unavailable. They return compact
  action/status context only and must not start unattended replay sessions,
  score performance, scan, rank, alert, recommend, generate candidates, provide
  financial advice, or touch broker/order/account workflows.
- The native drawing slice adds MCP-only `tradingview_draw_shape`,
  `tradingview_draw_list`, `tradingview_draw_properties`,
  `tradingview_draw_remove`, and `tradingview_draw_clear_all` tools behind the
  same gate. These tools use exposed TradingView chart/drawing APIs only,
  return compact native drawing ids and properties when available, and report
  unsupported API paths clearly. The clear-all tool requires explicit
  confirmation because it removes every native drawing on the active chart.
- The first quant macro slice adds MCP-only `tradingview_draw_fib_levels` and
  `tradingview_draw_projection` behind the same gate. These tools build native
  drawing sets for Fib-style retracement/extension levels, measured moves, and
  range projections from explicit anchors or caller-selected extracted range
  facts. They return created drawing ids, anchors, levels, and warnings as
  review context only; they must not output predictions, recommendations,
  rankings, or advice. Current-chart and chartbook artifact requests may record
  returned macro metadata through an explicit `macroMetadata` field.
- The Pine Editor slice adds MCP-only `tradingview_pine_open_editor`,
  `tradingview_pine_set_source`, `tradingview_pine_get_source`,
  `tradingview_pine_get_errors`, `tradingview_pine_get_console`,
  `tradingview_pine_compile`, and `tradingview_pine_save` behind the same gate.
  Setting source, compiling, and saving are explicit separate calls. Source
  retrieval is bounded by default and reports truncation warnings for larger
  scripts. These tools use the active local chart target and exposed
  TradingView/Monaco Pine Editor surfaces only.
- Future native drawing, chart manipulation, workspace-control, replay-control,
  Pine editor, data extraction, and quant macro issues should build behind this
  boundary.
