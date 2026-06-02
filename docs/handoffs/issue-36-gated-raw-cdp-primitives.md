# Issue 36 - Gated Raw CDP Primitives

## Status

Implemented on `feat/issue-36-gated-raw-primitives`, stacked on
`feat/issue-35-raw-automation-boundary` because PR #45 is still open.

The default MCP surface remains the high-level charting tool list. When
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` is set in the server environment, the
server also registers:

- `tradingview_raw_evaluate`
- `tradingview_raw_click`
- `tradingview_raw_keypress`
- `tradingview_raw_type_text`

The CLI exposes matching gated commands through `npm run tv:raw -- ...`.

## Next

Push the branch, open a stacked PR against `feat/issue-35-raw-automation-boundary`,
and keep the PR dependency on #35 / PR #45 explicit. After #45 merges, restack
or retarget this PR to updated `main`.

## Risks

- PR #45 is still the parent dependency; do not treat this branch as based on
  canonical `main` until #45 merges.
- Raw keypress/text behavior is CDP-level and intentionally basic. More
  selector-oriented or native drawing behavior should remain separate later
  issues behind the same raw gate.
- Raw evaluate is compact by default and rejects oversized results; callers
  should return purpose-built structured values instead of broad DOM dumps.

## Files

- `src/tradingview/raw-automation.ts`
- `src/mcp/tradingview-tools.ts`
- `src/cli.ts`
- `package.json`
- `test/raw-automation.test.ts`
- `test/mcp-tools.test.ts`
- `test/cli-core.test.ts`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/handoffs/issue-36-gated-raw-cdp-primitives.md`

## Checks

- `npm test -- --test-name-pattern "raw automation|raw MCP|CLI raw|MCP server advertises raw"` (red first, then green)
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `git diff --check`
