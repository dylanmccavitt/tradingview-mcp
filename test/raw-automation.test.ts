import assert from "node:assert/strict";
import test from "node:test";
import { runInThisContext } from "node:vm";

import {
  RAW_AUTOMATION_ENV,
  isRawAutomationEnabled,
  runRawAddIndicator,
  runRawChartState,
  runRawClick,
  runRawDrawClearAll,
  runRawDrawList,
  runRawDrawRemove,
  runRawDrawShape,
  runRawDrawingProperties,
  runRawEvaluate,
  runRawFindElement,
  runRawKeypress,
  runRawRemoveEntity,
  runRawScroll,
  runRawSelectorClick,
  runRawSelectorHover,
  runRawSetChartType,
  runRawSetSymbol,
  runRawSetTimeframe,
  runRawSetVisibleRange,
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

const runExpressionInThisContext = runInThisContext as unknown as (
  expression: string
) => Promise<unknown>;

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
      awaitPromise?: boolean;
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

interface FakeStudy {
  id: string;
  name: string;
}

interface FakeDrawingPoint {
  time: number;
  price: number;
}

interface FakeDrawing {
  id: string;
  shapeType: string;
  title: string;
  points: FakeDrawingPoint[];
  text?: string;
  visible: boolean;
  locked: boolean;
  selectable: boolean;
  properties: Record<string, string | number | boolean | null>;
  style: Record<string, string | number | boolean | null>;
  getPoints(): FakeDrawingPoint[];
  getProperties(): Record<string, string | number | boolean | null>;
  getStyle(): Record<string, string | number | boolean | null>;
  isVisible(): boolean;
  isLocked(): boolean;
  isSelectable(): boolean;
}

interface FakeChartApi {
  symbol(): string;
  resolution(): string;
  chartType(): string | number;
  getVisibleRange(): {
    from: number;
    to: number;
  };
  getAllStudies(): FakeStudy[];
  setSymbol?: (symbol: string, timeframeOrDone?: unknown, done?: () => void) => void;
  setResolution?: (timeframe: string, done?: () => void) => void;
  setChartType?: (chartType: string | number) => void;
  setVisibleRange?: (range: { from: number; to: number }) => void;
  createStudy?: (name: string) => string;
  removeEntity?: (entityId: string) => void;
  getAllShapes?: () => string[];
  getShapeById?: (entityId: string) => FakeDrawing | undefined;
  createShape?: (
    point: FakeDrawingPoint,
    options: {
      shape: string;
      text?: string;
      overrides?: Record<string, string | number | boolean | null>;
      lock?: boolean;
      disableSelection?: boolean;
    }
  ) => string;
  createMultipointShape?: (
    points: FakeDrawingPoint[],
    options: {
      shape: string;
      overrides?: Record<string, string | number | boolean | null>;
      lock?: boolean;
      disableSelection?: boolean;
    }
  ) => string;
  removeAllShapes?: () => void;
}

class EvaluatingRawPageClient implements RawTradingViewPageClient {
  closed = false;
  calls: {
    expression: string;
    awaitPromise?: boolean;
    throwOnSideEffect?: boolean;
  }[] = [];

  async evaluate(
    expression: string,
    options?: {
      awaitPromise?: boolean;
      throwOnSideEffect?: boolean;
    }
  ): Promise<unknown> {
    const call: {
      expression: string;
      awaitPromise?: boolean;
      throwOnSideEffect?: boolean;
    } = {
      expression
    };

    if (typeof options?.awaitPromise === "boolean") {
      call.awaitPromise = options.awaitPromise;
    }

    if (typeof options?.throwOnSideEffect === "boolean") {
      call.throwOnSideEffect = options.throwOnSideEffect;
    }

    this.calls.push(call);

    return await runExpressionInThisContext(expression);
  }

  click(): Promise<void> {
    throw new Error("not implemented");
  }

  keypress(): Promise<void> {
    throw new Error("not implemented");
  }

  typeText(): Promise<void> {
    throw new Error("not implemented");
  }

  hover(): Promise<void> {
    throw new Error("not implemented");
  }

  scroll(): Promise<void> {
    throw new Error("not implemented");
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

function installFakeWidget(chart: FakeChartApi): () => void {
  const globalRecord = globalThis as typeof globalThis & {
    tvWidget?: unknown;
  };
  const previous = globalRecord.tvWidget;

  globalRecord.tvWidget = {
    activeChart: () => chart
  };

  return () => {
    globalRecord.tvWidget = previous;
  };
}

function fakeChartApi(options: {
  withMutators?: boolean;
  studyCount?: number;
  withDrawingApi?: boolean;
  withClearAll?: boolean;
} = {}): FakeChartApi {
  let symbol = "NASDAQ:NVDA";
  let timeframe = "65";
  let chartType: string | number = "candles";
  let range = {
    from: 1_780_000_000,
    to: 1_780_086_400
  };
  let studies: FakeStudy[] = Array.from(
    {
      length: options.studyCount ?? 2
    },
    (_value, index) => ({
      id: `study-${index + 1}`,
      name: index === 0 ? "Volume" : `Study ${index + 1}`
    })
  );
  let drawings: FakeDrawing[] = [
    makeFakeDrawing("shape-1", "horizontal_line", [
      {
        time: 1_780_000_000,
        price: 512.25
      }
    ])
  ];

  const chart: FakeChartApi = {
    symbol: () => symbol,
    resolution: () => timeframe,
    chartType: () => chartType,
    getVisibleRange: () => range,
    getAllStudies: () => studies
  };

  if (options.withMutators) {
    chart.setSymbol = (
      nextSymbol: string,
      timeframeOrDone?: unknown,
      done?: () => void
    ) => {
      symbol = nextSymbol;
      if (typeof timeframeOrDone === "string") {
        timeframe = timeframeOrDone;
      }
      if (typeof timeframeOrDone === "function") {
        const doneCallback = timeframeOrDone as () => void;
        doneCallback();
      }
      done?.();
    };
    chart.setResolution = (nextTimeframe: string, done?: () => void) => {
      timeframe = nextTimeframe;
      done?.();
    };
    chart.setChartType = (nextChartType: string | number) => {
      chartType = nextChartType;
    };
    chart.setVisibleRange = (nextRange: { from: number; to: number }) => {
      range = nextRange;
    };
    chart.createStudy = (name: string) => {
      const id = `study-${studies.length + 1}`;
      studies = [
        ...studies,
        {
          id,
          name
        }
      ];
      return id;
    };
    chart.removeEntity = (entityId: string) => {
      studies = studies.filter((study) => study.id !== entityId);
      drawings = drawings.filter((drawing) => drawing.id !== entityId);
    };
  }

  if (options.withDrawingApi) {
    chart.getAllShapes = () => drawings.map((drawing) => drawing.id);
    chart.getShapeById = (entityId: string) =>
      drawings.find((drawing) => drawing.id === entityId);
    chart.createShape = (point, createOptions) => {
      const id = `shape-${drawings.length + 1}`;
      const drawingOptions: {
        text?: string;
        lock?: boolean;
        disableSelection?: boolean;
        overrides?: Record<string, string | number | boolean | null>;
      } = {};

      if (createOptions.text !== undefined) {
        drawingOptions.text = createOptions.text;
      }

      if (createOptions.lock !== undefined) {
        drawingOptions.lock = createOptions.lock;
      }

      if (createOptions.disableSelection !== undefined) {
        drawingOptions.disableSelection = createOptions.disableSelection;
      }

      if (createOptions.overrides !== undefined) {
        drawingOptions.overrides = createOptions.overrides;
      }

      drawings = [
        ...drawings,
        makeFakeDrawing(id, createOptions.shape, [point], drawingOptions)
      ];
      return id;
    };
    chart.createMultipointShape = (points, createOptions) => {
      const id = `shape-${drawings.length + 1}`;
      const drawingOptions: {
        lock?: boolean;
        disableSelection?: boolean;
        overrides?: Record<string, string | number | boolean | null>;
      } = {};

      if (createOptions.lock !== undefined) {
        drawingOptions.lock = createOptions.lock;
      }

      if (createOptions.disableSelection !== undefined) {
        drawingOptions.disableSelection = createOptions.disableSelection;
      }

      if (createOptions.overrides !== undefined) {
        drawingOptions.overrides = createOptions.overrides;
      }

      drawings = [
        ...drawings,
        makeFakeDrawing(id, createOptions.shape, points, drawingOptions)
      ];
      return id;
    };
  }

  if (options.withClearAll) {
    chart.removeAllShapes = () => {
      drawings = [];
    };
  }

  return chart;
}

function makeFakeDrawing(
  id: string,
  shapeType: string,
  points: FakeDrawingPoint[],
  options: {
    text?: string;
    lock?: boolean;
    disableSelection?: boolean;
    overrides?: Record<string, string | number | boolean | null>;
  } = {}
): FakeDrawing {
  const drawing: FakeDrawing = {
    id,
    shapeType,
    title: shapeType.replace("_", " "),
    points,
    visible: true,
    locked: options.lock ?? false,
    selectable: options.disableSelection ? false : true,
    properties: {
      linewidth: 2,
      color: "#ff0000",
      showLabel: true
    },
    style: options.overrides ?? {
      linecolor: "#ff0000"
    },
    getPoints: () => points,
    getProperties: () => drawing.properties,
    getStyle: () => drawing.style,
    isVisible: () => drawing.visible,
    isLocked: () => drawing.locked,
    isSelectable: () => drawing.selectable
  };

  if (options.text) {
    drawing.text = options.text;
  }

  return drawing;
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

void test("raw chart state reads compact chart API fields without a live TradingView session", async () => {
  const restore = installFakeWidget(fakeChartApi({ studyCount: 55 }));
  const fakeClient = new EvaluatingRawPageClient();

  try {
    const result = await runRawChartState({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(fakeClient),
      now: () => new Date("2026-06-02T15:00:00.000Z")
    });

    const value = result.value as {
      before: {
        symbol: string;
        timeframe: string;
        chartType: string;
        visibleRange: {
          from: number;
          to: number;
        };
        studies: FakeStudy[];
        warnings: string[];
      };
      after: {
        studies: FakeStudy[];
      };
    };

    assert.equal(result.ok, true);
    assert.equal(result.action, "chart-state");
    assert.equal(result.executedAt, "2026-06-02T15:00:00.000Z");
    assert.equal(value.before.symbol, "NASDAQ:NVDA");
    assert.equal(value.before.timeframe, "65");
    assert.equal(value.before.chartType, "candles");
    assert.deepEqual(value.before.visibleRange, {
      from: 1_780_000_000,
      to: 1_780_086_400
    });
    assert.equal(value.before.studies.length, 50);
    assert.equal(value.after.studies.length, 50);
    assert.match(value.before.warnings.join(" "), /truncated to 50/i);
    assert.equal(fakeClient.calls[0]?.awaitPromise, true);
    assert.equal(fakeClient.calls[0]?.throwOnSideEffect, false);
    assert.equal(fakeClient.closed, true);
  } finally {
    restore();
  }
});

void test("raw chart control tools return before and after state for supported chart APIs", async () => {
  const restore = installFakeWidget(fakeChartApi({ withMutators: true }));

  try {
    const makeClient = () => Promise.resolve(new EvaluatingRawPageClient());
    const common = {
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: makeClient
    };
    const setSymbol = await runRawSetSymbol({
      ...common,
      symbol: "NASDAQ:AMD"
    });
    const setTimeframe = await runRawSetTimeframe({
      ...common,
      timeframe: "1D"
    });
    const setChartType = await runRawSetChartType({
      ...common,
      chartType: 1
    });
    const setVisibleRange = await runRawSetVisibleRange({
      ...common,
      range: {
        from: 1_780_100_000,
        to: 1_780_200_000
      }
    });
    const addIndicator = await runRawAddIndicator({
      ...common,
      name: "Relative Strength Index"
    });
    const removeEntity = await runRawRemoveEntity({
      ...common,
      entityId: "study-1"
    });

    assert.equal(setSymbol.ok, true);
    assert.equal(setSymbol.action, "set-symbol");
    assert.equal(
      (setSymbol.value as { after: { symbol: string } }).after.symbol,
      "NASDAQ:AMD"
    );
    assert.equal(
      (setTimeframe.value as { after: { timeframe: string } }).after.timeframe,
      "1D"
    );
    assert.equal(
      (setChartType.value as { after: { chartType: number } }).after.chartType,
      1
    );
    assert.deepEqual(
      (setVisibleRange.value as { after: { visibleRange: unknown } }).after
        .visibleRange,
      {
        from: 1_780_100_000,
        to: 1_780_200_000
      }
    );
    assert.equal(
      (addIndicator.value as { entityId: string }).entityId,
      "study-3"
    );
    assert.equal(removeEntity.ok, true);
    assert.doesNotMatch(
      JSON.stringify(
        (removeEntity.value as { after: { studies: FakeStudy[] } }).after.studies
      ),
      /"id":"study-1"/
    );
  } finally {
    restore();
  }
});

void test("raw chart control validation and missing API failures are explicit", async () => {
  let pageClientCalled = false;
  const invalidSymbol = await runRawSetSymbol({
    symbol: "NVDA",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });

  assert.equal(invalidSymbol.ok, false);
  assert.match(invalidSymbol.error ?? "", /exchange-qualified/i);
  assert.equal(pageClientCalled, false);

  const restore = installFakeWidget(fakeChartApi());
  const fakeClient = new EvaluatingRawPageClient();

  try {
    const missingApi = await runRawAddIndicator({
      name: "MACD",
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(fakeClient)
    });

    assert.equal(missingApi.ok, false);
    assert.match(missingApi.error ?? "", /createStudy/i);
    assert.equal(
      (missingApi.value as { before: { symbol: string } }).before.symbol,
      "NASDAQ:NVDA"
    );
    assert.equal(fakeClient.closed, true);
  } finally {
    restore();
  }
});

void test("raw native drawing tools create, list, inspect, remove, and clear shapes", async () => {
  const restore = installFakeWidget(
    fakeChartApi({
      withMutators: true,
      withDrawingApi: true,
      withClearAll: true
    })
  );

  try {
    const makeClient = () => Promise.resolve(new EvaluatingRawPageClient());
    const common = {
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: makeClient
    };
    const horizontalLine = await runRawDrawShape({
      ...common,
      shapeType: "horizontal-line",
      points: [
        {
          time: 1_780_010_000,
          price: 520.5
        }
      ],
      lock: true,
      overrides: {
        linecolor: "#00ff00"
      }
    });
    const rectangle = await runRawDrawShape({
      ...common,
      shapeType: "rectangle",
      points: [
        {
          time: 1_780_010_000,
          price: 525
        },
        {
          time: 1_780_020_000,
          price: 510
        }
      ]
    });
    const text = await runRawDrawShape({
      ...common,
      shapeType: "text",
      points: [
        {
          time: 1_780_020_000,
          price: 530
        }
      ],
      text: "Earnings gap"
    });
    const list = await runRawDrawList(common);
    const properties = await runRawDrawingProperties({
      ...common,
      entityId: "shape-2"
    });
    const remove = await runRawDrawRemove({
      ...common,
      entityId: "shape-2"
    });
    const clearAll = await runRawDrawClearAll({
      ...common,
      confirmClearAll: true
    });

    assert.equal(horizontalLine.ok, true);
    assert.equal(horizontalLine.action, "draw-shape");
    assert.equal(
      (horizontalLine.value as { entityId: string }).entityId,
      "shape-2"
    );
    assert.deepEqual(
      (horizontalLine.value as { drawing: { type: string; points: unknown[] } })
        .drawing,
      {
        id: "shape-2",
        type: "horizontal-line",
        points: [
          {
            time: 1_780_010_000,
            price: 520.5
          }
        ]
      }
    );
    assert.equal(rectangle.ok, true);
    assert.equal((rectangle.value as { entityId: string }).entityId, "shape-3");
    assert.equal(text.ok, true);
    assert.equal((text.value as { drawing: { text: string } }).drawing.text, "Earnings gap");
    assert.equal(list.ok, true);
    assert.equal((list.value as { count: number }).count, 4);
    assert.equal(properties.ok, true);
    assert.deepEqual(
      (properties.value as { drawing: { id: string; locked: boolean } }).drawing
        .id,
      "shape-2"
    );
    assert.equal(
      (properties.value as { drawing: { locked: boolean } }).drawing.locked,
      true
    );
    assert.deepEqual(
      (properties.value as { drawing: { style: unknown } }).drawing.style,
      {
        linecolor: "#00ff00"
      }
    );
    assert.equal(remove.ok, true);
    assert.equal((remove.value as { entityId: string }).entityId, "shape-2");
    assert.equal(clearAll.ok, true);
    assert.equal((clearAll.value as { after: { count: number } }).after.count, 0);
  } finally {
    restore();
  }
});

void test("raw native drawing validation and missing API failures are explicit", async () => {
  let pageClientCalled = false;
  const invalidShape = await runRawDrawShape({
    shapeType: "trend-line",
    points: [
      {
        time: 1_780_010_000,
        price: 520.5
      }
    ],
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });
  const unconfirmedClear = await runRawDrawClearAll({
    confirmClearAll: false,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });

  assert.equal(invalidShape.ok, false);
  assert.match(invalidShape.error ?? "", /requires exactly 2/i);
  assert.equal(unconfirmedClear.ok, false);
  assert.match(unconfirmedClear.error ?? "", /confirmClearAll=true/i);
  assert.equal(pageClientCalled, false);

  const restore = installFakeWidget(fakeChartApi());

  try {
    const missingApi = await runRawDrawList({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });
    const missingProperties = await runRawDrawingProperties({
      entityId: "shape-1",
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });
    const missingClearAllApi = await runRawDrawClearAll({
      confirmClearAll: true,
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(missingApi.ok, false);
    assert.match(missingApi.error ?? "", /did not expose native drawing identifiers/i);
    assert.equal(missingProperties.ok, false);
    assert.match(missingProperties.error ?? "", /getShapeById/i);
    assert.equal(missingClearAllApi.ok, false);
    assert.match(
      missingClearAllApi.error ?? "",
      /did not expose native drawing identifiers/i
    );
  } finally {
    restore();
  }
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
