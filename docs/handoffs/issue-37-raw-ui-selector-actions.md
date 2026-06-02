# Issue 37 - Raw UI Selector Actions

## Status

Implemented on `feat/issue-37-raw-ui-selector-actions`, stacked on
`feat/issue-36-gated-raw-primitives`.

PR #45 for issue #35 is still open, and PR #46 for issue #36 is still an open
draft stacked on `feat/issue-35-raw-automation-boundary`. Keep this issue
stacked until both parent PRs are merged or explicitly retargeted.

The raw automation gate remains:

```text
TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1
```

The gated raw surface now includes:

- `tradingview_raw_evaluate`
- `tradingview_raw_click`
- `tradingview_raw_keypress`
- `tradingview_raw_type_text`
- `tradingview_raw_find_element`
- `tradingview_raw_selector_click`
- `tradingview_raw_selector_hover`
- `tradingview_raw_scroll`

The new selector actions find visible TradingView UI elements by `text`,
`aria-label`, `data-name`, or `css`, return compact element metadata, click or
hover selected element centers, optionally DOM-click, and report missing or
ambiguous selector matches clearly. Scroll is bounded and directional.

## Next

Push the branch, open a stacked PR against
`feat/issue-36-gated-raw-primitives`, and keep both dependencies explicit:

- issue #35 / PR #45
- issue #36 / PR #46

After parent PRs merge, restack or retarget this PR to the updated base before
merge.

## Risks

- Selector matching is intentionally DOM-surface based and may drift if
  TradingView changes labels or data attributes.
- Text, aria-label, and data-name strategies use compact case-insensitive
  contains matching. Ambiguous action selectors require `matchIndex`.
- Raw tools remain experimental and must not target non-TradingView pages,
  broker/order workflows, TradingView account or security settings, scanners,
  rankings, unattended alerts, or financial-advice workflows.

## Files

- `src/tradingview/raw-automation.ts`
- `src/mcp/tradingview-tools.ts`
- `src/cli.ts`
- `test/raw-automation.test.ts`
- `test/mcp-tools.test.ts`
- `test/cli-core.test.ts`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/handoffs/issue-37-raw-ui-selector-actions.md`

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `git diff --check`
