# Issue 23: Chart-Analysis Profile Boundary

## Status

Implemented on `feat/issue-23-chart-analysis-profile-boundary`.

## Next

Open a PR for review and merge after review passes.

## Risks

- This issue defines the profile boundary only. It does not add CLI or MCP
  profile arguments yet.
- Future profile behavior must continue to treat profiles as user-selected
  chart review modes, not scanner presets.

## Files

- `src/domain.ts`
- `test/domain.test.ts`
- `test/docs-v1-workflow.test.ts`
- `docs/adr/0010-chart-analysis-profile-boundary.md`
- `CONTEXT.md`
- `docs/architecture.md`
- `docs/v1-workflow.md`

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
