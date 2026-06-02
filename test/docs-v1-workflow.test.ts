import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workflowPath = resolve(process.cwd(), "docs/v1-workflow.md");
const readmePath = resolve(process.cwd(), "README.md");
const rawAutomationAdrPath = resolve(
  process.cwd(),
  "docs/adr/0011-experimental-raw-automation-surface.md"
);
const workflow = readFileSync(workflowPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
const rawAutomationAdr = readFileSync(rawAutomationAdrPath, "utf8");

void test("v1 workflow documents global Codex MCP configuration", () => {
  assert.match(workflow, /\[mcp_servers\.tradingview\]/);
  assert.match(workflow, /command = "node"/);
  assert.match(
    workflow,
    /args = \["\/Users\/dylanmccavitt\/projects\/tradingview-mcp\/dist\/src\/index\.js"\]/
  );
  assert.match(
    workflow,
    /cwd = "\/Users\/dylanmccavitt\/projects\/tradingview-mcp"/
  );
  assert.match(workflow, /~\/\.codex\/config\.toml/);
});

void test("v1 workflow documents current setup and TradingView commands", () => {
  const commands = [
    "npm install",
    "npm run build",
    "npm run tv:launch -- --port 9222",
    "npm run tv:launch-command -- --port 9222",
    "npm run tv:health -- --port 9222",
    "npm run tv:chart -- --symbol NASDAQ:NVDA --port 9222",
    "npm run tv:chart-universe -- --group semis --tier core --port 9222",
    "npm run tv:drawings -- --port 9222 --json",
    "npm run tv:chartbook -- --group semis --tier core --session manual-smoke --port 9222"
  ];

  for (const command of commands) {
    assert.ok(workflow.includes(command), `Missing command: ${command}`);
  }
});

void test("v1 workflow documents Pine install requirements", () => {
  assert.match(workflow, /pine\/objective-drawing-overlay\.pine/);
  assert.match(workflow, /TVMCP Objective Drawing Overlay/);
  assert.match(workflow, /visible study name/i);
  assert.match(workflow, /Style preset/);
  assert.match(workflow, /default `focus`/);
  assert.match(workflow, /Use `levels` for deeper level\/zone review/);
  assert.match(workflow, /weekly, daily, and\s+65-minute/i);
});

void test("v1 workflow explains chartbook artifacts", () => {
  assert.match(workflow, /artifacts\/tradingview-chartbooks\/manual-smoke/);
  assert.match(workflow, /index\.md/);
  assert.match(workflow, /index\.html/);
  assert.match(workflow, /notes\.md/);
  assert.match(workflow, /NASDAQ-NVDA-weekly\.png/);
  assert.match(workflow, /NASDAQ-NVDA-weekly-levels\.json/);
  assert.match(workflow, /primary local review dashboard/i);
  assert.match(workflow, /Codex Analysis briefs/i);
  assert.match(workflow, /horizontal levels, zones from boxes, labels, tables/);
  assert.match(workflow, /Partial failures are recorded/);
});

void test("v1 workflow restates guardrails", () => {
  assert.match(workflow, /not a scanner/i);
  assert.match(workflow, /broker integration/i);
  assert.match(workflow, /must not place orders/i);
  assert.match(workflow, /no broker actions/i);
  assert.match(workflow, /no order placement/i);
  assert.match(workflow, /no Robinhood\s+automation/i);
  assert.match(workflow, /no Alpaca\s+automation/i);
  assert.match(workflow, /bypass TradingView access controls/i);
});

void test("v1 workflow documents chart-analysis profile boundaries", () => {
  assert.match(workflow, /Chart-analysis profiles are user-selected review modes/);
  assert.match(workflow, /`focus`/);
  assert.match(workflow, /`breakout`/);
  assert.match(workflow, /`squeeze`/);
  assert.match(workflow, /`momentum`/);
  assert.match(workflow, /objective chart facts/);
  assert.match(workflow, /extracted levels/);
  assert.match(workflow, /setup checklist fields/);
  assert.match(workflow, /chartbook notes/);
  assert.match(workflow, /prompts for user review/);
  assert.match(workflow, /must not rank symbols/);
  assert.match(workflow, /score a watchlist/);
  assert.match(workflow, /financial advice/);
  assert.match(workflow, /order actions/);
  assert.match(workflow, /call\s+brokers/);
  assert.match(workflow, /unattended alerts/);
  assert.match(workflow, /generate candidates/);
});

void test("v1 workflow documents experimental raw automation boundary", () => {
  assert.match(workflow, /Experimental Raw Automation Boundary/);
  assert.match(workflow, /TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1/);
  assert.match(workflow, /`tradingview_raw_\*`/);
  assert.match(workflow, /`tradingview_draw_\*`/);
  assert.match(workflow, /`tradingview_pine_\*`/);
  assert.match(workflow, /tradingview_raw_chart_data_summary/);
  assert.match(workflow, /tradingview_raw_quote_snapshot/);
  assert.match(workflow, /tradingview_raw_study_values/);
  assert.match(workflow, /tradingview_raw_list_tabs/);
  assert.match(workflow, /tradingview_raw_batch_chart/);
  assert.match(workflow, /tradingview_raw_replay_open/);
  assert.match(workflow, /tradingview_raw_replay_set_speed/);
  assert.match(workflow, /bounded\s+OHLCV summary stats/i);
  assert.match(workflow, /caller-provided order/i);
  assert.match(workflow, /unsupported-control errors/i);
  assert.match(workflow, /chart-practice\/review/i);
  assert.match(workflow, /does not scan, rank, score/i);
  assert.match(workflow, /set bounded source without\s+compiling or saving/i);
  assert.match(workflow, /truncation warnings/i);
  assert.match(workflow, /active local `tradingview\.com\/chart` page/);
  assert.match(workflow, /not part of the default high-level\s+chartbook workflow/i);
  assert.match(workflow, /broker\/order pages/i);
  assert.match(workflow, /TradingView account or security settings/i);
  assert.match(workflow, /Raw outputs should stay compact by default/i);
});

void test("raw automation ADR pins opt-in naming and guardrails", () => {
  assert.match(rawAutomationAdr, /Experimental Raw Automation Surface/);
  assert.match(rawAutomationAdr, /TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1/);
  assert.match(rawAutomationAdr, /`tradingview_raw_\*`/);
  assert.match(rawAutomationAdr, /`tradingview_draw_\*`/);
  assert.match(rawAutomationAdr, /`tradingview_pine_\*`/);
  assert.match(rawAutomationAdr, /tradingview_raw_chart_data_summary/);
  assert.match(rawAutomationAdr, /quote\/current-bar fields/i);
  assert.match(rawAutomationAdr, /review context only/i);
  assert.match(rawAutomationAdr, /tradingview_raw_batch_chart/);
  assert.match(rawAutomationAdr, /tradingview_raw_replay_open/);
  assert.match(rawAutomationAdr, /tradingview_raw_replay_set_speed/);
  assert.match(rawAutomationAdr, /caller-provided order/i);
  assert.match(rawAutomationAdr, /unsupported-control\s+errors/i);
  assert.match(rawAutomationAdr, /unattended replay sessions/i);
  assert.match(rawAutomationAdr, /Source\s+retrieval is bounded/i);
  assert.match(rawAutomationAdr, /disabled by default/i);
  assert.match(rawAutomationAdr, /active local TradingView chart target/i);
  assert.match(rawAutomationAdr, /must not automate broker\/order workflows/i);
  assert.match(rawAutomationAdr, /scanner\/ranking behavior/i);
});

void test("README links the v1 workflow", () => {
  assert.match(readme, /\[docs\/v1-workflow\.md\]\(\.\/docs\/v1-workflow\.md\)/);
  assert.match(readme, /defaults to the quieter `focus` style preset/);
  assert.match(readme, /keeps `clean`, `levels`, and `full-debug` available/);
  assert.match(readme, /TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1/);
  assert.match(readme, /`tradingview_raw_\*`/);
  assert.match(readme, /`tradingview_draw_\*`/);
  assert.match(readme, /`tradingview_pine_\*`/);
  assert.match(readme, /tradingview_raw_chart_data_summary/);
  assert.match(readme, /latest current-bar quote fields/i);
  assert.match(readme, /tradingview_raw_list_tabs/);
  assert.match(readme, /tradingview_raw_batch_chart/);
  assert.match(readme, /tradingview_raw_replay_open/);
  assert.match(readme, /tradingview_raw_replay_set_speed/);
  assert.match(readme, /without scanner\/ranking/i);
  assert.match(readme, /unsupported-control errors/i);
  assert.match(readme, /chart-practice\/review/i);
  assert.match(readme, /read bounded source with truncation\s+warnings/i);
});
