# ADR 0002: Manual-Only Charting Boundary

## Status

Accepted

## Decision

V1 is limited to manual charting assistance for TradingView Desktop. The project must not add broker actions, order placement, portfolio management, scanner/ranking behavior, unattended alerts, or financial advice.

## Why

The project exists to make user-directed chart review more repeatable. Keeping the scope charting-only reduces risk, keeps the repo locally inspectable, and prevents future issues from accidentally turning this into a trading system.

## Options Considered

- Charting-only MCP assistant.
- Charting plus scanner/ranking workflows.
- Charting plus broker execution.

## Tradeoffs

The charting-only boundary means later features may require more manual user action. That is acceptable because it keeps the first version safer, easier to test, and aligned with the documented purpose.

## Consequences

- Tool names and docs must avoid trade-execution language.
- Tests should continue to pin no-broker and no-scanner guardrails.
- New issues that propose scanner, ranking, broker, or execution behavior should be rejected or split into a separate project.
