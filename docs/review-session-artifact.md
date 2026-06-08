# Review Session Artifact Contract

Review Session Artifact JSON is the durable source of truth for one manual
setup review pass over one or more symbols. Markdown, HTML, and future reader
surfaces are views over this JSON contract, not the contract itself.

The current contract is additive. Existing chartbook outputs remain compatible;
a future writer can add a `review-session.json` artifact beside current
chartbook or current-chart artifacts without replacing `index.md`,
`index.html`, `setup-review-index.json`, per-timeframe `*-levels.json`, or
per-symbol `setup-review.json` files.

## Version

- `schemaVersion`: `1`
- `kind`: `review_session_artifact`
- Fixture: `test/fixtures/review-session-artifact.v1.json`
- TypeScript contract: `src/review-session/artifact.ts`

## Session Fields

The top-level `session` object records:

- `id` and optional `name`
- `createdAt` as an ISO UTC timestamp
- `sourceType`: `chartbook`, `current_chart_capture`, `quant_scan_handoff`,
  `manual_import`, or `mixed`
- `sourceArtifacts`: local artifact references such as chartbook indexes,
  HTML reader views, setup-review indexes, current-chart captures, and Quant
  Scan handoffs
- optional profile context with the user-selected review profile, overlay
  preset, and whether it was user-selected or a workflow default
- session warnings

## Symbol Fields

Each symbol entry can contain:

- `chartCaptures`: screenshot references for prepared chart evidence
- `objectiveEvidence`: extracted objective evidence references such as
  `*-levels.json`
- `setupEvidenceLabels`: deterministic labels from setup-review artifacts using
  `validated`, `invalidated`, `watch`, or `insufficient_data`
- `drawingMetadataArtifacts`: durable records of native drawing or macro
  context
- `reviewMarks`: human-authored marks from the manual review pass
- `thesisNotes`: human-authored interpretation or rationale from the manual
  review pass
- symbol warnings

Review marks and thesis notes must have `humanAuthored: true`. Setup evidence
labels must have `deterministic: true`. These fields stay separate so objective
chart evidence is never confused with the user's discretionary notes.

## Guardrails

The artifact is chart-review context only. It must not contain scanners,
rankings, alerts, generated candidates, trade recommendations, broker/order or
account behavior, P&L tracking, or financial advice. Quant Scan handoffs may be
referenced as external source artifacts, but this repo must not generate
candidates or rank symbols inside the Review Session artifact.
