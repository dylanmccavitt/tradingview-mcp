# Issue 34 - Chartbook HTML Review Dashboard

## Status

Implemented on `feat/issue-34-chartbook-html-review-dashboard`.

Chartbook runs now plan and write a static `index.html` dashboard next to the
existing `index.md`. The dashboard is local-only and shows session metadata,
profile/preset context, symbol navigation, warnings, generated Codex Analysis
briefs from extracted facts, profile-specific review panels,
weekly/daily/65-minute screenshots, links to `*-levels.json`, links to
per-symbol `notes.md`, and local manual-review fields. The breakout profile
surfaces weekly context, daily breakout levels, 65-minute timing levels, key
extracted levels, confirmation fields, and invalidation prompts in the HTML
dashboard.

The CLI human output now prints the dashboard path as `Dashboard: ...`.

Follow-up command ergonomics:

- Added `npm run tv:breakout-dashboard`, which wraps chartbook with
  `--profile breakout`, `--preset focus`, `--render-timeout-ms 30000`, and
  `--render-settle-ms 3000`. Pass `--group`, `--tier`, `--session`, and
  `--port` after `--`.

## Next

Open a PR for issue #34. If desired, run a live chartbook after TradingView
Desktop is relaunched with CDP and inspect the generated `index.html` visually.

## Risks

- No live TradingView chartbook run was performed in this thread because the
  current TradingView Desktop session is not reachable on CDP port `9222`.
- Manual review checkboxes and textarea values persist only in the local
  browser's `localStorage` for the generated dashboard session.
- The dashboard presents extracted facts and screenshots; it does not rank,
  score, recommend, alert, trade, or call broker/order APIs.
- The Codex Analysis section is deterministic and extraction-derived; it does
  not call an LLM or infer hidden chart state from pixels.

## Files

- `src/chartbook/chartbook.ts`
- `src/cli.ts`
- `package.json`
- `AGENTS.md`
- `test/chartbook.test.ts`
- `test/cli-core.test.ts`
- `test/docs-v1-workflow.test.ts`
- `test/mcp-tools.test.ts`
- `README.md`
- `docs/v1-workflow.md`
- `docs/architecture.md`
- `docs/adr/0008-chartbook-output-artifacts.md`
- `docs/handoffs/issue-34-chartbook-html-review-dashboard.md`

## Checks

- `npm test -- --test-name-pattern "chartbook|dashboard"`
- `npm run typecheck`
- `npm test`
- `npm run lint`
- `git diff --check`

Follow-up after user feedback:

- Added per-symbol `Codex Analysis` HTML sections with objective observations
  and review checks generated from extracted facts and warnings.
