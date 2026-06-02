# Issue 54 Replay Controls

## Status

Implemented opt-in MCP replay controls behind
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1`:

- `tradingview_raw_replay_open`
- `tradingview_raw_replay_play_pause`
- `tradingview_raw_replay_step`
- `tradingview_raw_replay_set_speed`
- `tradingview_raw_replay_exit`

The tools target the active local TradingView chart target through the existing
raw chart-control path. They use exposed local replay APIs only, return compact
action/status context, and report unsupported-control errors when reliable
replay controls are unavailable.

CodeRabbit review raised two major issues. Both were addressed:

- Default replay play/pause mode is now deterministic `play`, not `toggle`.
- Replay controller detection no longer treats generic chart/widget `play` or
  `pause` methods as replay support unless they come from an explicit replay
  namespace or replay-prefixed API.

Second CodeRabbit pass raised one major issue asking to treat `timeoutMs` as a
replay-exit settle window. That was skipped as invalid because `timeoutMs` is
the repo-wide CDP/client timeout from `endpointShape`, not an action settle
parameter, and other raw chart-control actions do not repurpose it for waits.

## Next

PR #55 is ready to merge after pushing the review-fix amend.

## Risks

- TradingView Desktop may not expose replay APIs in every chart session. In that
  case these tools intentionally fail with unsupported-control errors instead
  of scraping UI controls.
- Replay controls are MCP-only and experimental; the default high-level MCP
  surface and CLI raw commands remain unchanged.

## Files

- `src/tradingview/raw-automation.ts`
- `src/mcp/tradingview-tools.ts`
- `src/domain.ts`
- `test/raw-automation.test.ts`
- `test/mcp-tools.test.ts`
- `test/domain.test.ts`
- `test/docs-v1-workflow.test.ts`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/architecture.md`
- `docs/adr/0011-experimental-raw-automation-surface.md`
- `docs/v1-workflow.md`
- `docs/handoffs/issue-54-replay-controls.md`

## Checks

- `npm test` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `git diff --check` passes.
- `coderabbit review --agent -t committed -c AGENTS.md` completed with 2 major
  issues, both fixed locally before merge.
- Second `coderabbit review --agent -t committed -c AGENTS.md` completed with 1
  major issue, skipped as invalid for the `timeoutMs` contract.
