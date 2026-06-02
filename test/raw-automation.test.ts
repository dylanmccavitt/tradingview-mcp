import assert from "node:assert/strict";
import test from "node:test";

import {
  RAW_AUTOMATION_ENV,
  isRawAutomationEnabled,
  runRawClick,
  runRawEvaluate,
  runRawFindElement,
  runRawKeypress,
  runRawScroll,
  runRawSelectorClick,
  runRawSelectorHover,
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

  private evaluateValues: unknown[];

  constructor(evaluateValue: unknown = { title: "NVDA" }) {
    const values = Array.isArray(evaluateValue)
      ? (evaluateValue as unknown[])
      : [evaluateValue];
    this.evaluateValues = values.slice();
  }

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
    return Promise.resolve(
      this.evaluateValues.length > 1
        ? this.evaluateValues.shift()
        : this.evaluateValues[0]
    );
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

  hover(options: { x: number; y: number }): Promise<void> {
    this.calls.push({
      method: "hover",
      args: [options]
    });
    return Promise.resolve();
  }

  scroll(options: {
    direction: "up" | "down" | "left" | "right";
    amount: number;
    x: number;
    y: number;
  }): Promise<void> {
    this.calls.push({
      method: "scroll",
      args: [options]
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

void test("raw find-element returns compact visible element metadata", async () => {
  const fakeClient = new FakeRawPageClient({
    query: {
      strategy: "text",
      value: "Watchlist"
    },
    count: 1,
    truncated: false,
    elements: [
      {
        index: 0,
        tagName: "button",
        text: "Watchlist",
        ariaLabel: "Open Watchlist",
        dataName: "watchlist-button",
        rect: {
          x: 10,
          y: 20,
          width: 80,
          height: 30,
          centerX: 50,
          centerY: 35
        }
      }
    ]
  });

  const result = await runRawFindElement({
    strategy: "text",
    value: "Watchlist",
    maxMatches: 5,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, "find-element");
  assert.deepEqual(result.value, {
    query: {
      strategy: "text",
      value: "Watchlist"
    },
    count: 1,
    truncated: false,
    elements: [
      {
        index: 0,
        tagName: "button",
        text: "Watchlist",
        ariaLabel: "Open Watchlist",
        dataName: "watchlist-button",
        rect: {
          x: 10,
          y: 20,
          width: 80,
          height: 30,
          centerX: 50,
          centerY: 35
        }
      }
    ]
  });
  assert.equal(fakeClient.calls[0]?.method, "evaluate");
  assert.match(String(fakeClient.calls[0]?.args[0]), /querySelectorAll/);
  assert.equal(fakeClient.closed, true);
});

void test("raw selector actions report not-found and ambiguous matches clearly", async () => {
  const notFoundClient = new FakeRawPageClient({
    query: {
      strategy: "aria-label",
      value: "Missing"
    },
    count: 0,
    truncated: false,
    elements: []
  });
  const ambiguousClient = new FakeRawPageClient({
    query: {
      strategy: "css",
      value: ".button"
    },
    count: 2,
    truncated: false,
    elements: [
      {
        index: 0,
        tagName: "button",
        text: "One",
        rect: { x: 0, y: 0, width: 20, height: 20, centerX: 10, centerY: 10 }
      },
      {
        index: 1,
        tagName: "button",
        text: "Two",
        rect: { x: 30, y: 0, width: 20, height: 20, centerX: 40, centerY: 10 }
      }
    ]
  });

  const notFound = await runRawSelectorClick({
    strategy: "aria-label",
    value: "Missing",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(notFoundClient)
  });
  const ambiguous = await runRawSelectorHover({
    strategy: "css",
    value: ".button",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(ambiguousClient)
  });

  assert.equal(notFound.ok, false);
  assert.match(notFound.error ?? "", /did not match/i);
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.error ?? "", /matched 2 visible elements/i);
});

void test("raw selector click rejects forbidden and broad click scopes", async () => {
  let clientCalled = false;
  const forbiddenText = await runRawSelectorClick({
    strategy: "text",
    value: "Buy order",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      clientCalled = true;
      return Promise.resolve(new FakeRawPageClient());
    }
  });
  const broadCss = await runRawSelectorClick({
    strategy: "css",
    value: "body *",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      clientCalled = true;
      return Promise.resolve(new FakeRawPageClient());
    }
  });
  const accountElementClient = new FakeRawPageClient({
    query: {
      strategy: "data-name",
      value: "menu-item"
    },
    count: 1,
    truncated: false,
    elements: [
      {
        index: 0,
        tagName: "button",
        text: "Account security",
        dataName: "menu-item",
        rect: { x: 0, y: 0, width: 20, height: 20, centerX: 10, centerY: 10 }
      }
    ]
  });

  const accountElement = await runRawSelectorClick({
    strategy: "data-name",
    value: "menu-item",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(accountElementClient)
  });

  assert.equal(forbiddenText.ok, false);
  assert.match(forbiddenText.error ?? "", /broker\/order|account|security/i);
  assert.equal(broadCss.ok, false);
  assert.match(broadCss.error ?? "", /narrow TradingView chart-control/i);
  assert.equal(clientCalled, false);
  assert.equal(accountElement.ok, false);
  assert.match(accountElement.error ?? "", /account|security/i);
  assert.equal(accountElementClient.calls.length, 1);
});

void test("raw selector click, hover, and scroll dispatch bounded page input", async () => {
  const elementPayload = {
    query: {
      strategy: "data-name",
      value: "drawing-toolbar"
    },
    count: 1,
    truncated: false,
    elements: [
      {
        index: 0,
        tagName: "button",
        dataName: "drawing-toolbar",
        rect: {
          x: 100,
          y: 50,
          width: 40,
          height: 30,
          centerX: 120,
          centerY: 65
        }
      }
    ]
  };
  const fakeClient = new FakeRawPageClient(elementPayload);

  const click = await runRawSelectorClick({
    strategy: "data-name",
    value: "drawing-toolbar",
    button: "middle",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });
  const hover = await runRawSelectorHover({
    strategy: "data-name",
    value: "drawing-toolbar",
    matchIndex: 0,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });
  const scroll = await runRawScroll({
    direction: "down",
    amount: 450,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient)
  });

  assert.equal(click.ok, true);
  assert.equal(hover.ok, true);
  assert.equal(scroll.ok, true);
  assert.deepEqual(fakeClient.calls, [
    {
      method: "evaluate",
      args: [fakeClient.calls[0]?.args[0], undefined]
    },
    {
      method: "click",
      args: [{ x: 120, y: 65, button: "middle" }]
    },
    {
      method: "evaluate",
      args: [fakeClient.calls[2]?.args[0], undefined]
    },
    {
      method: "hover",
      args: [{ x: 120, y: 65 }]
    },
    {
      method: "scroll",
      args: [{ direction: "down", amount: 450, x: 500, y: 500 }]
    }
  ]);
});

void test("raw selector validation rejects invalid payloads before CDP", async () => {
  let clientCalled = false;
  const invalidSelector = await runRawFindElement({
    strategy: "css",
    value: "",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      clientCalled = true;
      return Promise.resolve(new FakeRawPageClient());
    }
  });
  const invalidScroll = await runRawScroll({
    direction: "down",
    amount: 5000,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      clientCalled = true;
      return Promise.resolve(new FakeRawPageClient());
    }
  });

  assert.equal(invalidSelector.ok, false);
  assert.match(invalidSelector.error ?? "", /selector value/i);
  assert.equal(invalidScroll.ok, false);
  assert.match(invalidScroll.error ?? "", /scroll amount/i);
  assert.equal(clientCalled, false);
});
