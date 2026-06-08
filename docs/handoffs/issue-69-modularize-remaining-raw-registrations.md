# Issue 69 - Modularize Remaining Raw MCP Control Registrations

## Status

Implemented on `feat/issue-69-modularize-remaining-raw-registrations`.

The refactor keeps the public raw MCP tool list, env gate, handler mappings,
input schema behavior, annotations, guardrail descriptions, and structured
result shape compatible while moving the remaining raw registration families out
of `src/mcp/tradingview-tools.ts`.

`src/mcp/tradingview-tools.ts` now owns high-level MCP tools, handler defaults,
and the `TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1` gate. After the gate passes,
it delegates to raw family modules:

- `src/mcp/raw-input-tools.ts`
- `src/mcp/raw-chart-tools.ts`
- `src/mcp/raw-workspace-tools.ts`
- `src/mcp/raw-replay-tools.ts`
- `src/mcp/raw-drawing-tools.ts`
- `src/mcp/raw-pine-tools.ts`

Shared raw MCP endpoint/result/guardrail helpers live in:

- `src/mcp/raw-common.ts`

## Next

Run the full required check set, commit, push, and open the PR with `Closes #69`.

## Risks

- This issue decomposes MCP registration and schema ownership only. The shared
  raw TradingView page/runtime implementation remains in
  `src/tradingview/raw/session.ts`.
- `src/mcp/raw-pine-tools.ts` still has its pre-existing local endpoint/result
  helpers; it can be moved onto `raw-common.ts` later if desired, but this
  issue avoided touching already-merged Pine behavior unnecessarily.
- No product behavior was added. The change is refactor-only.

## Files

- `src/mcp/tradingview-tools.ts`
- `src/mcp/raw-common.ts`
- `src/mcp/raw-input-tools.ts`
- `src/mcp/raw-chart-tools.ts`
- `src/mcp/raw-workspace-tools.ts`
- `src/mcp/raw-replay-tools.ts`
- `src/mcp/raw-drawing-tools.ts`
- `docs/architecture.md`
- `docs/handoffs/issue-69-modularize-remaining-raw-registrations.md`

## Checks

- `npm test` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `git diff --check` passes.
