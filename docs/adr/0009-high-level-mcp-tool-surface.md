# ADR 0009: High-Level MCP Tool Surface

## Status

Accepted

## Decision

Expose v1 TradingView workflows through a small set of high-level MCP tools:

- `tradingview_connect`
- `tradingview_status`
- `tradingview_list_universe`
- `tradingview_chart_symbol`
- `tradingview_chart_universe`
- `tradingview_capture_current_chart`
- `tradingview_build_chartbook`

Do not expose raw click, type, evaluate, or generic browser-control tools in
the default v1 surface.

ADR 0011 allows a separate experimental raw automation surface in later issues,
but only when explicitly enabled and clearly namespaced outside the default
high-level charting tools.

## Why

Codex should choose charting outcomes, not micromanage TradingView Desktop UI operations. A narrow MCP surface keeps the project aligned with the manual-only charting boundary, makes tool selection easier, and avoids accidentally adding scanner, ranking, broker, or order behavior.

## Options Considered

- Register only high-level charting workflow tools.
- Expose lower-level CDP browser controls.
- Keep the MCP server empty and rely on CLI commands only.

## Tradeoffs

High-level tools require small wrapper code around the existing runners, but they keep request validation and guardrails close to the tool definitions. Raw CDP controls would be more flexible, but they would make Codex reason about browser mechanics instead of charting workflows. CLI-only behavior would remain useful locally, but would not give Codex a reliable MCP tool surface.

## Consequences

- MCP tool descriptions must include charting-only guardrails.
- Tool schemas must stay concise and explicit.
- Tests must cover tool registration and request validation without requiring a live TradingView session.
- Future default MCP work should add new high-level charting outcomes or extend
  existing schemas, not expose generic browser micromanagement.
- Future raw automation work must follow ADR 0011 and stay opt-in, namespaced,
  local-chart-target scoped, and guardrailed.
