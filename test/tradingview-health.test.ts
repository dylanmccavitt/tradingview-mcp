import assert from "node:assert/strict";
import test from "node:test";

import {
  checkTradingViewHealth,
  type CdpJsonFetcher
} from "../src/tradingview/health.js";

const fixedNow = new Date("2026-05-31T12:00:00.000Z");
const versionJson = {
  Browser: "TradingView/2.14.0",
  "Protocol-Version": "1.3",
  "User-Agent": "TradingView Desktop",
  webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/session"
};
const chartTarget = {
  id: "chart-target",
  title: "NVDA Chart",
  type: "page",
  url: "https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA",
  webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/chart-target"
};

function mapFetch(responses: Record<string, unknown>): CdpJsonFetcher {
  return (pathname) => {
    if (!(pathname in responses)) {
      return Promise.reject(new Error(`Unexpected CDP path ${pathname}`));
    }

    return Promise.resolve(responses[pathname]);
  };
}

void test("health returns healthy when CDP and a chart target are available", async () => {
  const result = await checkTradingViewHealth({
    appPath: "/Applications/TradingView.app",
    fileExists: () => true,
    fetchJson: mapFetch({
      "/json/version": versionJson,
      "/json/list": [chartTarget]
    }),
    now: () => fixedNow
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "healthy");
  assert.equal(result.endpoint, "http://127.0.0.1:9222");
  assert.equal(result.target?.id, "chart-target");
  assert.equal(result.targetCount, 1);
});

void test("health shapes missing-app failures with install guidance", async () => {
  const result = await checkTradingViewHealth({
    appPath: "/missing/TradingView.app",
    fileExists: () => false,
    fetchJson: () => Promise.reject(new Error("connect ECONNREFUSED")),
    now: () => fixedNow
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing-app");
  assert.match(result.message, /not found/i);
  assert.match(result.nextSteps.join(" "), /Install TradingView Desktop/i);
});

void test("health shapes unreachable CDP failures with port guidance", async () => {
  const result = await checkTradingViewHealth({
    port: 9333,
    appPath: "/Applications/TradingView.app",
    fileExists: () => true,
    fetchJson: () => Promise.reject(new Error("connect ECONNREFUSED")),
    now: () => fixedNow
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "cdp-unreachable");
  assert.match(result.message, /different port/i);
  assert.match(result.nextSteps.join(" "), /--port 9333/i);
});

void test("health shapes closed-chart state when no chart target is open", async () => {
  const result = await checkTradingViewHealth({
    appPath: "/Applications/TradingView.app",
    fileExists: () => true,
    fetchJson: mapFetch({
      "/json/version": versionJson,
      "/json/list": [
        {
          id: "home",
          title: "TradingView",
          type: "page",
          url: "https://www.tradingview.com/"
        }
      ]
    }),
    now: () => fixedNow
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "no-chart-target");
  assert.equal(result.targetCount, 1);
  assert.match(result.nextSteps.join(" "), /Open a TradingView chart tab/i);
});

void test("health rejects unexpected CDP response shapes", async () => {
  const result = await checkTradingViewHealth({
    appPath: "/Applications/TradingView.app",
    fileExists: () => true,
    fetchJson: mapFetch({
      "/json/version": versionJson,
      "/json/list": {
        targets: [chartTarget]
      }
    }),
    now: () => fixedNow
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "cdp-invalid-response");
  assert.match(result.message, /target array/i);
});
