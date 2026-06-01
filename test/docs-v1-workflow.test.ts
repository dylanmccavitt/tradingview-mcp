import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workflowPath = resolve(process.cwd(), "docs/v1-workflow.md");
const readmePath = resolve(process.cwd(), "README.md");
const workflow = readFileSync(workflowPath, "utf8");
const readme = readFileSync(readmePath, "utf8");

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
  assert.match(workflow, /weekly, daily, and 65-minute/i);
});

void test("v1 workflow explains chartbook artifacts", () => {
  assert.match(workflow, /artifacts\/tradingview-chartbooks\/manual-smoke/);
  assert.match(workflow, /index\.md/);
  assert.match(workflow, /notes\.md/);
  assert.match(workflow, /NASDAQ-NVDA-weekly\.png/);
  assert.match(workflow, /NASDAQ-NVDA-weekly-levels\.json/);
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

void test("README links the v1 workflow", () => {
  assert.match(readme, /\[docs\/v1-workflow\.md\]\(\.\/docs\/v1-workflow\.md\)/);
});
