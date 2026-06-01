import assert from "node:assert/strict";
import test from "node:test";

import { extractPineDrawings } from "../src/tradingview/pine-drawing-runner.js";
import type { TradingViewPineDrawingPageClient } from "../src/tradingview/pine-drawing-page.js";
import { DEFAULT_PINE_DRAWING_STUDY_NAME } from "../src/tradingview/pine-drawings.js";
import type { TradingViewHealthResult } from "../src/tradingview/health.js";
import type { CdpTarget } from "../src/tradingview/targets.js";

const chartTarget: CdpTarget = {
  id: "chart-target",
  title: "TSM Chart",
  type: "page",
  url: "https://www.tradingview.com/chart/abc123/?symbol=NYSE%3ATSM",
  webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/chart-target"
};

const healthyResult: TradingViewHealthResult = {
  ok: true,
  status: "healthy",
  message: "healthy",
  endpoint: "http://127.0.0.1:9222",
  nextSteps: [],
  checkedAt: "2026-06-01T13:00:00.000Z",
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
    checkedAt: "2026-06-01T13:00:00.000Z",
    app: {
      found: true,
      checkedPaths: ["/Applications/TradingView.app/Contents/MacOS/TradingView"],
      source: "option"
    },
    targetCount: 0
  };
}

class FakePineDrawingPageClient implements TradingViewPineDrawingPageClient {
  closed = false;
  requestedStudyName = "";
  requestedDebug = false;

  constructor(readonly payload: unknown) {}

  readDrawingPayload(options: {
    studyName: string;
    debug: boolean;
  }): Promise<unknown> {
    this.requestedStudyName = options.studyName;
    this.requestedDebug = options.debug;
    return Promise.resolve(this.payload);
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

void test("extractPineDrawings reads and normalizes a payload from the healthy chart target", async () => {
  const fakeClient = new FakePineDrawingPageClient({
    chart: {
      url: "https://www.tradingview.com/chart/abc123/?symbol=NYSE%3ATSM&interval=D"
    },
    studies: [
      {
        studyName: DEFAULT_PINE_DRAWING_STUDY_NAME,
        lines: [
          {
            title: "PDH",
            price: 430.55
          }
        ]
      }
    ]
  });

  const result = await extractPineDrawings({
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => Promise.resolve(fakeClient),
    now: () => new Date("2026-06-01T13:30:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.equal(result.endpoint, "http://127.0.0.1:9222");
  assert.equal(result.target?.id, "chart-target");
  assert.equal(result.extractedAt, "2026-06-01T13:30:00.000Z");
  assert.equal(result.drawings.levels[0]?.name, "PDH");
  assert.equal(fakeClient.requestedStudyName, DEFAULT_PINE_DRAWING_STUDY_NAME);
  assert.equal(fakeClient.requestedDebug, false);
  assert.equal(fakeClient.closed, true);
});

void test("extractPineDrawings reports health failures without opening a page client", async () => {
  let pageClientCalled = false;

  const result = await extractPineDrawings({
    checkHealth: () => Promise.resolve(closedChartResult()),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new FakePineDrawingPageClient({}));
    }
  });

  assert.equal(result.ok, false);
  assert.equal(pageClientCalled, false);
  assert.match(result.error ?? "", /no active TradingView chart/i);
  assert.match(result.warnings.join(" "), /Open a TradingView chart tab/i);
});

void test("extractPineDrawings reports targets that cannot be opened over WebSocket", async () => {
  const result = await extractPineDrawings({
    checkHealth: () =>
      Promise.resolve({
        ...healthyResult,
        target: {
          id: "chart-target",
          title: "TSM Chart",
          type: "page",
          url: "https://www.tradingview.com/chart/abc123/?symbol=NYSE%3ATSM"
        }
      })
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /does not expose/i);
  assert.equal(result.target?.id, "chart-target");
});
