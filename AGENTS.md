# Project Flow

## How To Run

Install dependencies:

```bash
npm install
```

Build the TypeScript output:

```bash
npm run build
```

Run the stdio MCP server:

```bash
npm start
```

Launch TradingView Desktop with CDP enabled on macOS:

```bash
npm run tv:launch -- --port 9222
```

Check CDP health and chart-target discovery:

```bash
npm run tv:health -- --port 9222
```

Chart one exchange-qualified symbol across the default weekly, daily, and
65-minute timeframes:

```bash
npm run tv:chart -- --symbol NASDAQ:NVDA --port 9222
```

Chart a selected local universe across the default weekly, daily, and 65-minute
timeframes for smoke verification:

```bash
npm run tv:chart-universe -- --group semis --tier core --port 9222
```

Extract compact structured data from the installed objective Pine overlay on
the visible chart:

```bash
npm run tv:drawings -- --port 9222 --json
```

Run the explicitly gated raw automation CLI against the active local
TradingView chart target:

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

Create a local chartbook for a selected universe group and tier:

```bash
npm run tv:chartbook -- --group semis --tier core --port 9222
npm run tv:chartbook -- --group semis --tier core --profile breakout --port 9222
npm run tv:breakout-dashboard -- --group semis --tier core --session manual-breakout --port 9333
```

List local universe groups and resolve chart symbols from the sample config:

```bash
npm run tv:universe -- list
npm run tv:universe -- resolve --group semis --tier core
```

If TradingView is installed outside `/Applications/TradingView.app` or `~/Applications/TradingView.app`, pass `--app /path/to/TradingView.app` or set `TRADINGVIEW_APP_PATH`.

For Codex, configure the built server as a local stdio MCP command:

```toml
[mcp_servers.tradingview]
command = "node"
args = ["/Users/dylanmccavitt/projects/tradingview-mcp/dist/src/index.js"]
cwd = "/Users/dylanmccavitt/projects/tradingview-mcp"
startup_timeout_sec = 20
tool_timeout_sec = 45
```

The v1 MCP server advertises high-level charting tools by default for connecting
to TradingView, checking status, listing the local universe, charting one
symbol, charting a configured universe selection, capturing the current chart,
and building a chartbook. Experimental raw automation tools are opt-in only,
gated by `TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1`, namespaced as
`tradingview_raw_*` or `tradingview_draw_*`, and scoped to the active local
TradingView chart target. The current raw slice registers
`tradingview_raw_evaluate`, `tradingview_raw_click`,
`tradingview_raw_keypress`, `tradingview_raw_type_text`,
`tradingview_raw_find_element`, `tradingview_raw_selector_click`,
`tradingview_raw_selector_hover`, `tradingview_raw_scroll`,
`tradingview_raw_chart_state`, `tradingview_raw_set_symbol`,
`tradingview_raw_set_timeframe`, `tradingview_raw_set_chart_type`,
`tradingview_raw_set_visible_range`, `tradingview_raw_add_indicator`, and
`tradingview_raw_remove_entity` only when the gate is enabled.

## Test, Lint, And Typecheck

```bash
npm test
npm run lint
npm run typecheck
```

Run all three before marking an implementation issue ready for review.
For Pine overlay changes, also run the targeted static check:

```bash
npm run test:pine
```

## Coding Rules

- Use TypeScript with strict compiler settings.
- Keep runtime code local-first and deterministic.
- Keep MCP tool schemas small, explicit, and documented near the tool implementation.
- Keep MCP tool descriptions concise and guardrailed so Codex chooses charting
  workflows without scanner/ranking or broker/order behavior.
- Keep default MCP tools high-level. Any raw automation tool must be
  experimental, opt-in, clearly namespaced, compact by default, and restricted
  to the active local TradingView chart target.
- Prefer small modules with domain names over generic utility files.
- Keep screenshot output paths deterministic and under ignored local artifact directories unless a later issue documents an export format.
- Treat local universe config files as the v1 source of truth for chart symbol lists; do not depend on TradingView watchlists for universe resolution.
- Keep Pine overlays self-contained from chart OHLCV and manually installed in TradingView unless a later ADR explicitly changes that boundary.
- Keep docs durable; do not put scratch notes, issue-specific plans, or temporary findings in this file.
- Add or update tests when behavior changes.

## Guardrails

- This project is a manual-only TradingView Desktop charting assistant.
- Do not add broker actions, order placement, Robinhood automation, Alpaca automation, or portfolio management.
- Do not add scanners, rankings, alerts, or unattended candidate generation.
- Do not represent chart output as financial advice.
- Do not bypass TradingView access controls, paywalls, or licensing requirements.
- Do not let raw automation operate on broker/order pages, TradingView account
  or security settings, non-TradingView targets, or arbitrary browser pages.
- Keep all chart interaction local to the user's machine unless a later issue explicitly documents a safe export path.

## Definition Of Done

- The implementation matches the GitHub issue acceptance criteria.
- `npm test`, `npm run lint`, and `npm run typecheck` pass, or the handoff explains why a check could not run.
- Durable docs are updated when behavior, commands, architecture, or guardrails change.
- `docs/handoffs/` records the current state, files touched, checks run, risks, and next step.
- Work is committed or stashed before leaving the task.
