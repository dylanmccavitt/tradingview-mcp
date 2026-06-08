# tradingview-mcp Context

## Purpose

`tradingview-mcp` is a local MCP server for helping Codex drive manual TradingView Desktop charting workflows for a software, semiconductor, and AI stock universe.

## Product Boundary

V1 is charting-only. It can become a local assistant for opening charts,
applying chart context, organizing chartbooks, extracting user-visible drawing
data, and, when explicitly enabled, using experimental raw automation against a
local TradingView Desktop chart target. It is not a scanner, broker
integration, signal service, or trade execution system.

Chart-analysis profiles are user-selected review modes, not candidate
generation. The stable profile names are `focus`, `breakout`, `squeeze`, and
`momentum`. Profile output may emphasize objective chart facts, extracted
levels, setup checklist fields, chartbook notes, and user-review prompts. It
must not include rankings, watchlist scoring, financial advice, order actions,
broker calls, unattended alerts, or generated candidates.

## Language

**Automated Charting**:
The repo prepares TradingView charts, chart context, captures, and local review
artifacts through deterministic local workflows.
_Avoid_: Trading bot, scanner, signal engine

**Manual Setup Review**:
The user's discretionary inspection of the prepared chart evidence after
automated charting has produced the context.
_Avoid_: Automated trading decision, recommendation, advice

**Review Session**:
A durable local evidence packet for one manual review pass over one or more
symbols. Each symbol in the session can have chart captures, extracted
objective evidence, setup evidence labels, drawing metadata, warnings, and
optional review notes.
_Avoid_: Trade journal, P&L tracker, recommendation engine, broker workflow

**Review Session Artifact**:
The machine-readable JSON source of truth for a review session. Markdown, HTML,
and other reader surfaces are views over this artifact, not the durable
contract.
_Avoid_: HTML as source of truth, Markdown-only session record

**Workflow Outcome**:
A user-facing result such as creating charts, building a chartbook, capturing
current-chart evidence, drawing review context, iterating a Pine overlay, or
running replay practice.
_Avoid_: Generic tool bucket, raw feature pile

**TradingView Control Surface**:
A lower-level local TradingView interaction primitive or API wrapper that
supports workflow outcomes but is not the product identity.
_Avoid_: Product surface, strategy engine

**Quant Scan Handoff**:
An external input contract from Quant Scan containing ordered candidates,
metadata, and source artifact links for chart preparation and manual review.
_Avoid_: Scanner inside this repo, candidate generation

**Setup Evidence Label**:
A deterministic label from extracted chartbook evidence, currently represented
in JSON as `verdict`, that summarizes evidence state without ranking or advice.
_Avoid_: Trade verdict, buy signal, recommendation

**Review Mark**:
The user's manual mark or note after inspecting prepared chart evidence in a
review session.
_Avoid_: Machine-generated recommendation, broker action, automated signal

**Thesis Note**:
Human-authored interpretation or rationale recorded during a review session.
It is distinct from objective evidence and must not be presented as generated
advice.
_Avoid_: Machine recommendation, automated signal, trade instruction

**Objective Pine Overlay**:
A manually installed TradingView Pine study whose deterministic output provides
repeatable chart evidence for extraction and chartbook artifacts.
_Avoid_: Editable annotation layer, generated scanner, broker signal

**Native Drawing Tool**:
A raw-gated tool for creating or inspecting editable TradingView chart
annotations from explicit user or workflow inputs.
_Avoid_: Replacement for deterministic Pine evidence, scanner, recommendation

**Native Chart Annotation**:
An editable drawing or object in TradingView chart state that helps the user
inspect a setup during manual review.
_Avoid_: Durable local artifact, persisted TradingView state

**Drawing Metadata Artifact**:
A durable local record of drawing context such as ids, anchors, levels, ratios,
source macro, and warnings.
_Avoid_: Guarantee that TradingView can later recreate the exact visual state

## Users

The primary user is a local operator using Codex and TradingView Desktop on their own machine. The repo should optimize for inspectable local workflows, repeatable setup, and clear guardrails.

## Operating Model

- Local TypeScript/Node MCP server over stdio.
- Minimal local CLI commands expose the same setup, status, one-symbol charting,
  and universe charting workflows for repeatable smoke/debug runs outside Codex.
- MCP exposes high-level v1 charting tools by default: connect/status, universe
  listing, one-symbol charting, universe charting, current-chart capture, and
  chartbook creation.
- Experimental raw automation is allowed only as an opt-in surface gated by
  `TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1`, namespaced as
  `tradingview_raw_*`, `tradingview_draw_*`, or `tradingview_pine_*`, and
  scoped to the active local TradingView chart target.
- The current raw automation slice exposes bounded evaluate, coordinate click,
  keypress, text insertion, visible element discovery, selector click/hover,
  and bounded scroll primitives through CLI and MCP only when that gate is
  enabled. It also exposes MCP-only direct chart state/control tools for current
  symbol, timeframe, chart type, visible range, visible studies, indicator
  creation, and entity removal when TradingView exposes the needed chart API;
  MCP-only compact chart data extraction for bounded OHLCV summaries,
  quote/current-bar snapshots, and visible study values; plus MCP-only native
  drawing creation, listing, inspection, one-drawing removal, explicit
  clear-all, and quant drawing macro tools when TradingView exposes drawing
  APIs. It also exposes MCP-only workspace controls for listing/focusing local
  chart tabs, listing/focusing panes, setting common pane layouts, listing or
  switching saved layouts when exposed, and bounded explicit symbol/timeframe
  batch chart actions in caller-provided order only; plus MCP-only replay
  controls for explicit chart-practice/review when TradingView exposes reliable
  local replay APIs. Chart data, macro output, batch output, and replay output
  are mechanical review context only: bounded values, created drawing ids,
  anchors, levels, input-ordered action results, compact replay action/status
  context, and warnings. They must not be presented as scans, predictions,
  recommendations, rankings, alerts, performance scoring, generated candidates,
  unattended replay sessions, or advice. The gated MCP surface also exposes
  Pine Editor tools for
  opening/focusing the editor, setting bounded source, reading bounded source,
  reading compact errors/console output, and explicit compile or save actions.
- TradingView Desktop integration starts with a local macOS launch command and CDP health check against the user's own desktop session.
- Local universe configuration is the v1 source of truth for chart symbol lists; TradingView watchlists are not required for universe resolution.
- Pine drawing overlays are tracked as repo source and manually installed into TradingView; the first required visible study name is `TVMCP Objective Drawing Overlay`.
- Pine drawing extraction targets that configured study name and returns compact levels, zones, labels, and tables for chartbook review. If TradingView only exposes the overlay legend, extraction may recover plotted objective levels from the known Pine plot order while leaving unavailable box/label/table internals empty.
- Current-chart capture writes a local screenshot and matching objective drawing
  JSON for the visible chart without navigating the chart to another symbol.
- Chartbook output writes ignored local review artifacts with screenshots, per-timeframe drawing JSON, notes, and an index.
- Configuration should stay repo-local or user-local; secrets and paid-service credentials must not be committed.
- GitHub Issues are the source of task scope.

## Durable Guardrails

- No broker APIs.
- No order placement.
- No scanner or ranking engine.
- No unattended trading workflow.
- No profile-based rankings, watchlist scoring, financial advice, order
  actions, broker calls, unattended alerts, or generated candidates.
- No bypassing TradingView subscriptions or access controls.
- No Pine editor automation or subjective chart-pattern labels in the default
  high-level workflow. Pine editor automation must be explicit and opt-in under
  the experimental raw automation boundary; setting source, compiling, and
  saving remain separate calls.
- Raw automation must not target non-TradingView pages, automate account or
  security settings, create broker/order actions, add unattended alerts, rank
  symbols, or generate candidates.
