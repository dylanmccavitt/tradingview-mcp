# Issue 27 - Review Profiles CLI And MCP Surface

## Status

Implemented on `feat/issue-27-review-profiles-cli-mcp`.
PR #33 is open.

The CLI chartbook path now routes through injectable handlers so tests can pin
`--profile` parsing without a live TradingView session. Human chartbook output
prints the selected profile. Unsupported chartbook profiles fail before universe
config loading or chartbook execution.

The MCP surface keeps the same high-level tool list. Only
`tradingview_capture_current_chart` and `tradingview_build_chartbook` expose the
accepted `focus`, `breakout`, `squeeze`, and `momentum` review-profile enum.
`tradingview_chart_universe` remains ordered smoke charting and does not accept
a profile.

## Next

Push the stale-handoff follow-up fix, get follow-up subagent review, then
merge PR #33 and sync canonical `main` if review stays clean.

## Risks

- No live TradingView Desktop run was performed; validation uses in-memory MCP
  transports and fake chartbook handlers.
- No Pine overlay changes were made, so `npm run test:pine` is not required for
  this issue.
- Profile wording must remain review/prep only and must not imply scanning,
  ranking, recommendations, alerts, broker calls, or order actions.
- Initial subagent review found only this stale handoff next-step text; no
  runtime, schema, guardrail, or test findings were reported.

## Files

- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `src/cli.ts`
- `src/mcp/tradingview-tools.ts`
- `test/cli-core.test.ts`
- `test/mcp-tools.test.ts`
- `docs/handoffs/issue-27-review-profiles-cli-mcp.md`

## Checks

- `npm ci`
- `npm run typecheck`
- `npm test -- --test-name-pattern "profile|chartbook"`
- `npm run lint`
- `npm test`
- `git diff --check`
