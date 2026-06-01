import assert from "node:assert/strict";
import test from "node:test";

import {
  CHART_ANALYSIS_PROFILE_NAMES,
  CHART_ANALYSIS_PROFILE_OUTPUT,
  CHART_ANALYSIS_PROFILES,
  getProjectInfo,
  PROJECT_GUARDRAILS
} from "../src/domain.js";

void test("project info documents the manual-only boundary", () => {
  const info = getProjectInfo();

  assert.equal(info.name, "tradingview-mcp");
  assert.match(info.purpose, /manual TradingView Desktop charting/i);
  assert.match(info.guardrails.trading, /No broker connections/i);
  assert.match(info.guardrails.scanner, /No unattended scanners/i);
  assert.deepEqual([...info.chartAnalysisProfiles.names], [
    "focus",
    "breakout",
    "squeeze",
    "momentum"
  ]);
});

void test("guardrails do not include trade execution behavior", () => {
  const guardrailText = Object.values(PROJECT_GUARDRAILS).join(" ");

  assert.match(guardrailText, /No broker connections/i);
  assert.match(guardrailText, /No unattended scanners/i);
  assert.doesNotMatch(guardrailText, /place orders automatically/i);
});

void test("chart-analysis profiles are stable user-selected review modes", () => {
  assert.deepEqual([...CHART_ANALYSIS_PROFILE_NAMES], [
    "focus",
    "breakout",
    "squeeze",
    "momentum"
  ]);
  assert.deepEqual(Object.keys(CHART_ANALYSIS_PROFILES), [
    "focus",
    "breakout",
    "squeeze",
    "momentum"
  ]);

  for (const profile of Object.values(CHART_ANALYSIS_PROFILES)) {
    assert.match(profile.description, /review mode/i);
    assert.match(profile.description, /objective/i);
    assert.doesNotMatch(profile.description, /scan|rank|broker|order/i);
  }
});

void test("chart-analysis profile outputs forbid scanner and execution behavior", () => {
  assert.deepEqual([...CHART_ANALYSIS_PROFILE_OUTPUT.allowed], [
    "objective_chart_facts",
    "extracted_levels",
    "setup_checklist_fields",
    "chartbook_notes",
    "user_review_prompts"
  ]);
  assert.deepEqual([...CHART_ANALYSIS_PROFILE_OUTPUT.forbidden], [
    "rankings",
    "watchlist_scoring",
    "financial_advice",
    "order_actions",
    "broker_calls",
    "unattended_alerts"
  ]);

  const allowedText = CHART_ANALYSIS_PROFILE_OUTPUT.allowed.join(" ");
  const forbiddenText = CHART_ANALYSIS_PROFILE_OUTPUT.forbidden.join(" ");

  assert.doesNotMatch(
    allowedText,
    /ranking|scoring|financial_advice|order|broker|alert/i
  );
  assert.match(forbiddenText, /rankings/);
  assert.match(forbiddenText, /watchlist_scoring/);
  assert.match(forbiddenText, /financial_advice/);
  assert.match(forbiddenText, /order_actions/);
  assert.match(forbiddenText, /broker_calls/);
  assert.match(forbiddenText, /unattended_alerts/);
});
