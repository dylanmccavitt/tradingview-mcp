# Issue 65 - Modularize Raw TradingView Control Surfaces

## Status

Implemented a narrow first split on `feat/issue-65-modularize-raw-control-surfaces`.

This refactor keeps the public raw MCP names, schemas, handler behavior, and
`TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` gate intact while moving the Pine
Editor family out of the central raw/control files.

The raw compatibility import remains:

```text
src/tradingview/raw-automation.ts
```

It now re-exports the shared session module and the focused Pine Editor module:

- `src/tradingview/raw/session.ts`
- `src/tradingview/raw/pine-editor.ts`

The Pine MCP tool schemas and seven `tradingview_pine_*` registrations now live
in:

```text
src/mcp/raw-pine-tools.ts
```

`src/mcp/tradingview-tools.ts` delegates Pine registration through
`registerRawPineMcpTools(server, handlers)`. The default high-level MCP surface
is unchanged when the raw gate is absent.

## Next

Open the PR with `Closes #65` and stop for independent review.

## Risks

- This is intentionally a first scoped decomposition, not the full final raw
  module map. Drawing, chart data/control, workspace, replay, and selector/input
  registrations still remain in the central MCP module.
- The shared injected Pine evaluator still lives in `raw/session.ts` because it
  depends on the existing shared chart-control evaluation path. A later cleanup
  can move evaluator construction once more raw families have their own modules.
- No product behavior was added. The change is refactor-only.

## Files

- `src/tradingview/raw-automation.ts`
- `src/tradingview/raw/session.ts`
- `src/tradingview/raw/pine-editor.ts`
- `src/mcp/tradingview-tools.ts`
- `src/mcp/raw-pine-tools.ts`
- `test/raw-automation.test.ts`
- `docs/architecture.md`
- `docs/handoffs/issue-65-modularize-raw-control-surfaces.md`

## Checks

- `npm test -- --test-name-pattern "raw Pine|Pine editor|raw automation facade|MCP server registers Pine|Pine MCP|gated raw Pine"` passes.
- `npm test` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `git diff --check` passes.
