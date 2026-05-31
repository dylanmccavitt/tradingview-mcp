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
args = ["/absolute/path/to/tradingview-mcp/dist/src/index.js"]
startup_timeout_sec = 20
tool_timeout_sec = 45
```

## Test, Lint, And Typecheck

```bash
npm test
npm run lint
npm run typecheck
```

Run all three before marking an implementation issue ready for review.

## Coding Rules

- Use TypeScript with strict compiler settings.
- Keep runtime code local-first and deterministic.
- Keep MCP tool schemas small, explicit, and documented near the tool implementation.
- Prefer small modules with domain names over generic utility files.
- Keep screenshot output paths deterministic and under ignored local artifact directories unless a later issue documents an export format.
- Treat local universe config files as the v1 source of truth for chart symbol lists; do not depend on TradingView watchlists for universe resolution.
- Keep docs durable; do not put scratch notes, issue-specific plans, or temporary findings in this file.
- Add or update tests when behavior changes.

## Guardrails

- This project is a manual-only TradingView Desktop charting assistant.
- Do not add broker actions, order placement, Robinhood automation, Alpaca automation, or portfolio management.
- Do not add scanners, rankings, alerts, or unattended candidate generation.
- Do not represent chart output as financial advice.
- Do not bypass TradingView access controls, paywalls, or licensing requirements.
- Keep all chart interaction local to the user's machine unless a later issue explicitly documents a safe export path.

## Definition Of Done

- The implementation matches the GitHub issue acceptance criteria.
- `npm test`, `npm run lint`, and `npm run typecheck` pass, or the handoff explains why a check could not run.
- Durable docs are updated when behavior, commands, architecture, or guardrails change.
- `docs/handoffs/` records the current state, files touched, checks run, risks, and next step.
- Work is committed or stashed before leaving the task.
