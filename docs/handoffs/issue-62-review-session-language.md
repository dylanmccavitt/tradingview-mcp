# Issue 62 - Review Session Language

## Status

Implemented on `feat/issue-62-review-session-language`.

`CONTEXT.md` now records the glossary terms resolved during the docs grilling
session: automated charting, manual setup review, Review Session, Review
Session Artifact, workflow outcomes, TradingView control surfaces, Quant Scan
handoffs, setup evidence labels, review marks, thesis notes, objective Pine
overlays, native drawing tools, native chart annotations, and drawing metadata
artifacts.

## Next

Push the branch, open a PR with `Closes #62`, and merge after review if clean.

## Risks

- This is a docs-only language update and does not define a JSON schema yet.
- Review Session Artifact is now the named source-of-truth concept, but the
  concrete artifact contract should be handled in a separate implementation
  issue.

## Files

- `CONTEXT.md`
- `docs/handoffs/issue-62-review-session-language.md`

## Checks

- `npm install`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`
