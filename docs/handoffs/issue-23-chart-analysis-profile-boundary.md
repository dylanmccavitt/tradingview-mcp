# Issue 23: Chart-Analysis Profile Boundary

## Status

Implemented on `feat/issue-23-chart-analysis-profile-boundary`; PR #29 is open.

## Next

Complete PR review follow-through and merge after the subagent review findings
are resolved and checks pass.

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
