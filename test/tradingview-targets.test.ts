import assert from "node:assert/strict";
import test from "node:test";

import {
  findTradingViewChartTarget,
  isTradingViewChartTarget,
  normalizeCdpTargets,
  type CdpTarget
} from "../src/tradingview/targets.js";

void test("target discovery selects an active TradingView chart page", () => {
  const targets: CdpTarget[] = [
    {
      id: "settings",
      title: "TradingView Settings",
      type: "page",
      url: "https://www.tradingview.com/account/"
    },
    {
      id: "chart",
      title: "AAPL Chart",
      type: "page",
      url: "https://www.tradingview.com/chart/?symbol=NASDAQ%3AAAPL",
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/chart"
    }
  ];

  assert.equal(findTradingViewChartTarget(targets)?.id, "chart");
});

void test("target discovery rejects non-chart and non-page targets", () => {
  const targets: CdpTarget[] = [
    {
      id: "worker",
      title: "TradingView Worker",
      type: "service_worker",
      url: "https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA"
    },
    {
      id: "home",
      title: "TradingView",
      type: "page",
      url: "https://www.tradingview.com/"
    },
    {
      id: "external",
      title: "TradingView article",
      type: "page",
      url: "https://example.com/chart/"
    }
  ];

  assert.equal(findTradingViewChartTarget(targets), null);
  for (const target of targets) {
    assert.equal(isTradingViewChartTarget(target), false);
  }
});

void test("target normalization keeps valid CDP targets and drops malformed entries", () => {
  const targets = normalizeCdpTargets([
    {
      id: "chart",
      title: "AAPL Chart",
      type: "page",
      url: "https://www.tradingview.com/chart/abc/",
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/chart"
    },
    {
      id: "missing-url",
      title: "Bad Target",
      type: "page"
    },
    "not a target"
  ]);

  assert.equal(targets?.length, 1);
  assert.equal(targets?.[0]?.id, "chart");
});
