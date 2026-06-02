import assert from "node:assert/strict";
import test from "node:test";

import {
  RAW_AUTOMATION_ENV,
  isRawAutomationEnabled,
  runRawClick,
  runRawEvaluate,
  runRawKeypress,
  runRawTypeText,
  type RawTradingViewPageClient
} from "../src/tradingview/raw-automation.js";
import type { TradingViewHealthResult } from "../src/tradingview/health.js";
import type { CdpTarget } from "../src/tradingview/targets.js";

const chartTarget: CdpTarget = {
  id: "chart-target",
  title: "NVDA Chart",
  type: "page",
  url: "https://www.tradingview.com/chart/abc/?symbol=NASDAQ%3ANVDA",
  webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/chart-target"
};

const healthyResult: TradingViewHealthResult = {
  ok: true,
  status: "healthy",
  message: "TradingView Desktop CDP is reachable.",
  endpoint: "http://127.0.0.1:9222",
  nextSteps: [],
  checkedAt: "2026-06-02T14:00:00.000Z",
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
    checkedAt: "2026-06-02T14:00:00.000Z",
    app: {
      found: true,
      checkedPaths: ["/Applications/TradingView.app/Contents/MacOS/TradingView"],
      source: "option"
    },
    targetCount: 0
  };
}

class FakeRawPageClient implements RawTradingViewPageClient {
  closed = false;
  calls: {
    method: string;
    args: unknown[];
  }[] = [];

  constructor(readonly evaluateValue: unknown = { title: "NVDA" }) {}

  evaluate(
    expression: string,
    options?: {
      throwOnSideEffect?: boolean;
    }
  ): Promise<unknown> {
    this.calls.push({
      method: "evaluate",
      args: [expression, options]
    });
    return Promise.resolve(this.evaluateValue);
  }

  click(options: {
    x: number;
    y: number;
    button: "left" | "middle" | "right";
  }): Promise<void> {
    this.calls.push({
      method: "click",
      args: [options]
    });
    return Promise.resolve();
  }

  keypress(key: string): Promise<void> {
    this.calls.push({
      method: "keypress",
      args: [key]
    });
    return Promise.resolve();
  }

  typeText(text: string): Promise<void> {
    this.calls.push({
      method: "typeText",
      args: [text]
    });
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

void test("raw automation env gate is enabled only by the exact stable value", () => {
  assert.equal(isRawAutomationEnabled({}), false);
  assert.equal(isRawAutomationEnabled({ [RAW_AUTOMATION_ENV]: "true" }), false);
  assert.equal(isRawAutomationEnabled({ [RAW_AUTOMATION_ENV]: "1" }), true);
});

void test("raw evaluate runs compact JavaScript only against a healthy TradingView chart target", async () => {
  const fakeClient = new FakeRawPageClient({
    title: "NVDA Chart",
    path: "/chart/abc/"
  });

  const result = await runRawEvaluate({
    expression: "({ title: document.title, path: location.pathname })",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient),
    now: () => new Date("2026-06-02T14:15:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, "evaluate");
  assert.equal(result.endpoint, "http://127.0.0.1:9222");
  assert.equal(result.target?.id, "chart-target");
  assert.equal(result.executedAt, "2026-06-02T14:15:00.000Z");
  assert.deepEqual(result.value, {
    title: "NVDA Chart",
    path: "/chart/abc/"
  });
  assert.deepEqual(fakeClient.calls, [
    {
      method: "evaluate",
      args: [
        "({ title: document.title, path: location.pathname })",
        {
          throwOnSideEffect: true
        }
      ]
    }
  ]);
  assert.equal(fakeClient.closed, true);
});

void test("raw evaluate reports target drift after a side-effect guarded expression", async () => {
  const fakeClient = new FakeRawPageClient({
    title: "NVDA Chart"
  });
  const healthResults = [healthyResult, closedChartResult()];

  const result = await runRawEvaluate({
    expression: "location.href = '/account/'; document.title",
    checkHealth: () => Promise.resolve(healthResults.shift() ?? closedChartResult()),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /active local TradingView chart target/i);
  assert.deepEqual(fakeClient.calls, [
    {
      method: "evaluate",
      args: [
        "location.href = '/account/'; document.title",
        {
          throwOnSideEffect: true
        }
      ]
    }
  ]);
});

void test("raw evaluate refuses oversized expressions and compact-output overflow before CDP", async () => {
  let clientCalled = false;

  const invalidExpressionResult = await runRawEvaluate({
    expression: "",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      clientCalled = true;
      return Promise.resolve(new FakeRawPageClient());
    }
  });

  assert.equal(invalidExpressionResult.ok, false);
  assert.match(invalidExpressionResult.error ?? "", /expression/i);
  assert.equal(clientCalled, false);

  const largeResult = await runRawEvaluate({
    expression: "document.body.innerText",
    maxResultBytes: 20,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(new FakeRawPageClient({
      text: "this result is too large for compact raw output"
    }))
  });

  assert.equal(largeResult.ok, false);
  assert.match(largeResult.error ?? "", /compact output/i);
});

void test("raw primitives report health failures without opening a page client", async () => {
  let pageClientCalled = false;

  const result = await runRawClick({
    x: 120,
    y: 220,
    checkHealth: () => Promise.resolve(closedChartResult()),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new FakeRawPageClient());
    }
  });

  assert.equal(result.ok, false);
  assert.equal(pageClientCalled, false);
  assert.match(result.error ?? "", /no active TradingView chart/i);
  assert.match(result.warnings.join(" "), /Open a TradingView chart tab/i);
});

void test("raw input primitives validate payloads and dispatch click, keypress, and text", async () => {
  const fakeClient = new FakeRawPageClient();

  const clickResult = await runRawClick({
    x: 100,
    y: 200,
    button: "right",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });
  const keyResult = await runRawKeypress({
    key: "Escape",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });
  const textResult = await runRawTypeText({
    text: "NVDA",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });
  const invalidClickResult = await runRawClick({
    x: -1,
    y: 200,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });

  assert.equal(clickResult.ok, true);
  assert.equal(keyResult.ok, true);
  assert.equal(textResult.ok, true);
  assert.equal(invalidClickResult.ok, false);
  assert.match(invalidClickResult.error ?? "", /coordinates/i);
  assert.deepEqual(fakeClient.calls, [
    {
      method: "click",
      args: [{ x: 100, y: 200, button: "right" }]
    },
    {
      method: "keypress",
      args: ["Escape"]
    },
    {
      method: "typeText",
      args: ["NVDA"]
    }
  ]);
});
