import assert from "node:assert/strict";
import test from "node:test";

import { getProjectInfo, PROJECT_GUARDRAILS } from "../src/domain.js";

void test("project info documents the manual-only boundary", () => {
  const info = getProjectInfo();

  assert.equal(info.name, "tradingview-mcp");
  assert.match(info.purpose, /manual TradingView Desktop charting/i);
  assert.match(info.guardrails.trading, /No broker connections/i);
  assert.match(info.guardrails.scanner, /No unattended scanners/i);
});

void test("guardrails do not include trade execution behavior", () => {
  const guardrailText = Object.values(PROJECT_GUARDRAILS).join(" ");

  assert.match(guardrailText, /No broker connections/i);
  assert.match(guardrailText, /No unattended scanners/i);
  assert.doesNotMatch(guardrailText, /place orders automatically/i);
});
