# Issue 10 Codex MCP V1 Workflow Handoff

## Status

Implementation complete in branch `feat/issue-10-document-codex-mcp-v1-workflow`.

Added a durable v1 operator guide at `docs/v1-workflow.md` that documents the
end-to-end Codex MCP and TradingView Desktop workflow: dependency install,
build, global Codex MCP config, TradingView Desktop CDP launch and health
checks, manual Pine overlay install/update, symbol and universe charting, and
chartbook artifact review.

The README and AGENTS Codex MCP config blocks now include the canonical local
server path and `cwd` so default universe config reads and artifact writes stay
relative to the repo when configured globally.

Added docs consistency tests to pin the issue acceptance criteria against the
workflow guide.

## Next

Open the PR for human review. There are no later seeded issues to start from
this thread.

After merge, configure or update `~/.codex/config.toml` with the documented
`[mcp_servers.tradingview]` block, restart Codex or reload MCP settings, launch
TradingView Desktop with CDP, and run the documented health check.

## Risks

- The issue is docs-focused; no live chartbook, symbol chart, or MCP tool call
  against TradingView Desktop was run.
- Live TradingView commands navigate the active chart tab, so they should be
  run only when the user is ready for chart navigation.
- The documented Codex MCP config assumes the canonical repo path
  `/Users/dylanmccavitt/projects/tradingview-mcp`. Users with a different clone
  path must replace that path in the config.
- The workflow remains charting-only. It does not scan, rank, recommend trades,
  place orders, use broker APIs, automate Robinhood or Alpaca, or bypass
  TradingView access controls.

## Files

- `AGENTS.md`
- `README.md`
- `docs/handoffs/issue-10-codex-mcp-v1-workflow.md`
- `docs/v1-workflow.md`
- `test/docs-v1-workflow.test.ts`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test` (failed once while tightening the new docs guardrail assertion,
  then passed after the docs/test fix)
- `npm run build`
- `node dist/src/cli.js --help`
- `npm start < /dev/null`
- `npm run test:pine`
