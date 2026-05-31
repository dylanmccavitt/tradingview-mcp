import assert from "node:assert/strict";
import test from "node:test";

import { chartOneSymbol } from "../src/tradingview/chart-runner.js";
import type { TradingViewChartPageClient } from "../src/tradingview/chart-page.js";
import {
  ChartPlanError,
  type ChartTimeframePlan
} from "../src/tradingview/chart-plan.js";
import type { TradingViewHealthResult } from "../src/tradingview/health.js";
import type { CdpTarget } from "../src/tradingview/targets.js";

const chartTarget: CdpTarget = {
  id: "chart-target",
  title: "NVDA Chart",
  type: "page",
  url: "https://www.tradingview.com/chart/chartid/?symbol=NASDAQ%3ANVDA",
  webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/chart-target"
};

const healthyResult: TradingViewHealthResult = {
  ok: true,
  status: "healthy",
  message: "healthy",
  endpoint: "http://127.0.0.1:9222",
  nextSteps: [],
  checkedAt: "2026-05-31T12:00:00.000Z",
  app: {
    found: true,
    executablePath: "/Applications/TradingView.app/Contents/MacOS/TradingView",
    checkedPaths: ["/Applications/TradingView.app/Contents/MacOS/TradingView"],
    source: "option"
  },
  target: chartTarget,
  targetCount: 1
};

function closedChartResult(): TradingViewHealthResult {
  return {
    ok: false,
    status: "no-chart-target",
    message: "CDP is reachable, but no active TradingView chart target was found.",
    endpoint: "http://127.0.0.1:9222",
    nextSteps: ["Open a TradingView chart tab."],
    checkedAt: "2026-05-31T12:00:00.000Z",
    app: {
      found: true,
      checkedPaths: ["/Applications/TradingView.app/Contents/MacOS/TradingView"],
      source: "option"
    },
    targetCount: 0
  };
}

class FakeChartPageClient implements TradingViewChartPageClient {
  readonly navigatedUrls: string[] = [];
  readonly waitedTimeframes: string[] = [];
  closed = false;

  constructor(readonly failTimeframes = new Set<string>()) {}

  navigate(url: string): Promise<void> {
    this.navigatedUrls.push(url);
    return Promise.resolve();
  }

  waitForRender(plan: ChartTimeframePlan): Promise<void> {
    this.waitedTimeframes.push(plan.id);

    if (this.failTimeframes.has(plan.id)) {
      return Promise.reject(new Error(`render failed for ${plan.id}`));
    }

    return Promise.resolve();
  }

  captureScreenshot(): Promise<Buffer> {
    return Promise.resolve(Buffer.from("fake-png"));
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

void test("chartOneSymbol captures every default timeframe with deterministic outputs", async () => {
  const fakeClient = new FakeChartPageClient();
  const writtenFiles: string[] = [];

  const result = await chartOneSymbol({
    symbol: "NASDAQ:NVDA",
    outputRoot: "/tmp/chart-runner",
    checkHealth: () => Promise.resolve(healthyResult),
    chartClientFactory: () => Promise.resolve(fakeClient),
    fileSystem: {
      mkdir: () => Promise.resolve(undefined),
      writeFile: (path) => {
        writtenFiles.push(path.toString());
        return Promise.resolve();
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(fakeClient.closed, true);
  assert.deepEqual(fakeClient.waitedTimeframes, ["weekly", "daily", "65-minute"]);
  assert.deepEqual(
    result.results.map((item) => item.outputPath),
    [
      "/tmp/chart-runner/NASDAQ-NVDA/NASDAQ-NVDA-weekly.png",
      "/tmp/chart-runner/NASDAQ-NVDA/NASDAQ-NVDA-daily.png",
      "/tmp/chart-runner/NASDAQ-NVDA/NASDAQ-NVDA-65-minute.png"
    ]
  );
  assert.deepEqual(writtenFiles, result.results.map((item) => item.outputPath));
  assert.equal(result.results.every((item) => item.ok), true);
});

void test("chartOneSymbol reports per-timeframe render failures and continues", async () => {
  const fakeClient = new FakeChartPageClient(new Set(["daily"]));

  const result = await chartOneSymbol({
    symbol: "NASDAQ:NVDA",
    outputRoot: "/tmp/chart-runner",
    checkHealth: () => Promise.resolve(healthyResult),
    chartClientFactory: () => Promise.resolve(fakeClient),
    fileSystem: {
      mkdir: () => Promise.resolve(undefined),
      writeFile: () => Promise.resolve()
    }
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.results.map((item) => [item.timeframe, item.ok]),
    [
      ["weekly", true],
      ["daily", false],
      ["65-minute", true]
    ]
  );
  assert.match(result.results[1]?.error ?? "", /render failed for daily/);
  assert.equal(fakeClient.closed, true);
});

void test("chartOneSymbol reports health failures for every planned timeframe", async () => {
  let clientFactoryCalled = false;

  const result = await chartOneSymbol({
    symbol: "NASDAQ:NVDA",
    outputRoot: "/tmp/chart-runner",
    checkHealth: () => Promise.resolve(closedChartResult()),
    chartClientFactory: () => {
      clientFactoryCalled = true;
      return Promise.resolve(new FakeChartPageClient());
    },
    fileSystem: {
      mkdir: () => Promise.resolve(undefined),
      writeFile: () => Promise.resolve()
    }
  });

  assert.equal(result.ok, false);
  assert.equal(clientFactoryCalled, false);
  assert.equal(result.results.length, 3);
  assert.equal(result.results.every((item) => item.ok === false), true);
  assert.match(result.results[0]?.error ?? "", /no active TradingView chart/i);
});

void test("chartOneSymbol validates exchange-qualified symbols before health checks", async () => {
  let healthCalled = false;

  await assert.rejects(
    chartOneSymbol({
      symbol: "NVDA",
      checkHealth: () => {
        healthCalled = true;
        return Promise.resolve(healthyResult);
      }
    }),
    ChartPlanError
  );

  assert.equal(healthCalled, false);
});
