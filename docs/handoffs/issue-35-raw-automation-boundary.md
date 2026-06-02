# Issue 35 - Raw Automation Boundary

## Status

Implemented on `feat/issue-35-raw-automation-boundary`.

Issue #35 documents the next product boundary: the existing high-level MCP
chartbook/review tools remain the default surface, while future raw TradingView
automation tools may be added only as an explicitly enabled experimental
surface.

The accepted raw automation gate is:

```text
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1
```

Raw tools must be namespaced as `tradingview_raw_*` or `tradingview_draw_*`,
must target only the active local TradingView chart target, and must keep
outputs compact by default. The raw boundary still forbids broker/order
automation, scanner/ranking behavior, financial advice, unattended alerts,
generated candidates, account/security-setting automation, arbitrary browser
targets, and access-control bypasses.

## Next

PR review is the next external step. After the PR merges and canonical `main`
is synced, start issue #36 to implement the first gated raw CDP evaluate/input
primitives.

## Risks

- This issue intentionally does not register raw MCP tools yet; #36 is the
  first implementation slice.
- Existing MCP tests still assert that the default tool list contains only the
  high-level tools.
- Later raw implementation issues must preserve the opt-in gate and target
  restrictions documented here.

## Files

- `src/domain.ts`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/adr/0009-high-level-mcp-tool-surface.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/v1-workflow.md`
- `docs/handoffs/issue-35-raw-automation-boundary.md`
- `test/domain.test.ts`
- `test/docs-v1-workflow.test.ts`

## Checks

- `npm test -- --test-name-pattern "domain|raw automation|v1 workflow|README"`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `git diff --check`
