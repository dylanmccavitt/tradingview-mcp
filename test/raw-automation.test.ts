import assert from "node:assert/strict";
import test from "node:test";
import { runInThisContext } from "node:vm";

import {
  RAW_AUTOMATION_ENV,
  isRawAutomationEnabled,
  runRawAddIndicator,
  runRawBatchChart,
  runRawChartDataSummary,
  runRawChartState,
  runRawClick,
  runRawDrawClearAll,
  runRawDrawFibRetracement,
  runRawDrawFibLevels,
  runRawDrawList,
  runRawDrawProjection,
  runRawDrawRemove,
  runRawDrawShape,
  runRawDrawingProperties,
  runRawEvaluate,
  runRawFindElement,
  runRawFocusPane,
  runRawFocusTab,
  runRawKeypress,
  runRawListLayouts,
  runRawListPanes,
  runRawListTabs,
  runRawPineCompile,
  runRawPineGetConsole,
  runRawPineGetErrors,
  runRawPineGetSource,
  runRawPineOpenEditor,
  runRawPineSave,
  runRawPineSetSource,
  runRawQuoteSnapshot,
  runRawReplayExit,
  runRawReplayOpen,
  runRawReplayPlayPause,
  runRawReplaySetSpeed,
  runRawReplayStep,
  runRawRemoveEntity,
  runRawScroll,
  runRawSelectorClick,
  runRawSelectorHover,
  runRawSetPaneLayout,
  runRawSetChartType,
  runRawSetSymbol,
  runRawSetTimeframe,
  runRawSetVisibleRange,
  runRawStudyValues,
  runRawSwitchLayout,
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

  bringToFront(): Promise<void> {
    this.calls.push({
      method: "bringToFront",
      args: []
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
  visible?: boolean;
  values?: Record<string, string | number | boolean>;
  dataWindowView?: () => {
    items: () => {
      _title: string;
      _value: string | number | boolean;
    }[];
  };
  isVisible?: () => boolean;
}

interface FakeBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

interface FakePane {
  id: string;
  title: string;
  height: number;
  focused: boolean;
  focus(): void;
}

interface FakeLayout {
  id: string;
  name: string;
  modifiedAt: string;
}

interface FakeReplayApi {
  active: boolean;
  playing: boolean;
  speed: number;
  position: number;
  openReplayMode(): void;
  play(): void;
  pause(): void;
  stepForward(): void;
  stepBack(): void;
  setReplaySpeed(speed: number): void;
  exitReplayMode(): void;
  isReplayMode(): boolean;
  isPlaying(): boolean;
  getReplaySpeed(): number;
  getPosition(): number;
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
  getStudyById?: (entityId: string) => FakeStudy | undefined;
  exportData?: () => {
    bars: FakeBar[];
  };
  getPanes?: () => FakePane[];
  setActivePane?: (paneId: string) => void;
  setPaneLayout?: (layout: string) => void;
  getLayouts?: () => FakeLayout[];
  switchLayout?: (layoutId: string) => void;
  replay?: () => FakeReplayApi;
  play?: () => void;
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

  bringToFront(): Promise<void> {
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

function installFakeActiveWatchedChart(chart: FakeChartApi): () => void {
  const globalRecord = globalThis as typeof globalThis & {
    TradingViewApi?: unknown;
  };
  const previous = globalRecord.TradingViewApi;

  globalRecord.TradingViewApi = {
    _activeChartWidgetWV: {
      value: () => chart
    }
  };

  return () => {
    globalRecord.TradingViewApi = previous;
  };
}

interface FakePineMarker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  severity: number;
  message: string;
}

function installFakePineEditor(options: {
  source?: string;
  markers?: FakePineMarker[];
  consoleMessages?: string[];
  buttons?: string[];
} = {}): {
  restore: () => void;
  clicked: string[];
  source: () => string;
} {
  const globalRecord = globalThis as unknown as {
    monaco?: unknown;
    document?: unknown;
    getComputedStyle?: unknown;
    TradingView?: unknown;
  };
  const previousMonaco = globalRecord.monaco;
  const previousDocument = globalRecord.document;
  const previousComputedStyle = globalRecord.getComputedStyle;
  const previousTradingView = globalRecord.TradingView;
  let source = options.source ?? "//@version=6\nindicator(\"Before\")";
  const clicked: string[] = [];
  const markers = options.markers ?? [];

  const editor = {
    getValue: () => source,
    setValue: (nextSource: string) => {
      source = nextSource;
    },
    getModel: () => ({
      uri: "inmemory://pine/current.pine"
    })
  };
  const monacoEditor = {
    getEditors: () => [editor],
    getModelMarkers: () => markers
  };

  globalRecord.monaco = {
    editor: monacoEditor
  };
  globalRecord.TradingView = {
    bottomWidgetBar: {
      activateScriptEditorTab: () => {
        clicked.push("activateScriptEditorTab");
      }
    }
  };
  globalRecord.getComputedStyle = () => ({
    display: "block",
    visibility: "visible"
  });
  globalRecord.document = {
    querySelector: () => null,
    dispatchEvent: () => {
      clicked.push("keyboard-save-shortcut");
      return true;
    },
    querySelectorAll: (selector: string) => {
      if (selector === "button") {
        return (options.buttons ?? []).map((label) => ({
          textContent: label,
          innerText: label,
          className: "",
          getAttribute: (name: string) => name === "aria-label" ? label : null,
          getBoundingClientRect: () => ({
            width: 80,
            height: 24
          }),
          click: () => {
            clicked.push(label);
          }
        }));
      }

      if (selector.includes("console") || selector.includes("message")) {
        return (options.consoleMessages ?? []).map((message) => ({
          textContent: message,
          className: /error/i.test(message) ? "consoleRow error" : "consoleRow",
          getBoundingClientRect: () => ({
            width: 80,
            height: 24
          })
        }));
      }

      return [];
    }
  };

  return {
    restore: () => {
      globalRecord.monaco = previousMonaco;
      globalRecord.document = previousDocument;
      globalRecord.getComputedStyle = previousComputedStyle;
      globalRecord.TradingView = previousTradingView;
    },
    clicked,
    source: () => source
  };
}

function fakeChartApi(options: {
  withMutators?: boolean;
  studyCount?: number;
  withBars?: boolean;
  withStudyValues?: boolean;
  withPanes?: boolean;
  withLayouts?: boolean;
  withReplay?: boolean;
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
    (_value, index) => {
      const study: FakeStudy = {
        id: `study-${index + 1}`,
        name: index === 0 ? "Volume" : `Study ${index + 1}`
      };

      if (options.withStudyValues) {
        study.visible = true;
        study.isVisible = () => study.visible ?? true;
        study.dataWindowView = () => ({
          items: () => [
            {
              _title: index === 0 ? "Volume" : "Value",
              _value: index === 0 ? 45_000_000 : 52.25 + index
            },
            {
              _title: "Signal",
              _value: index === 0 ? "rising" : "neutral"
            }
          ]
        });
      }

      return study;
    }
  );
  const bars: FakeBar[] = [
    {
      timestamp: 1_780_000_000,
      open: 500,
      high: 512,
      low: 498,
      close: 510,
      volume: 41_000_000
    },
    {
      timestamp: 1_780_086_400,
      open: 510,
      high: 525,
      low: 505,
      close: 520,
      volume: 45_000_000
    },
    {
      timestamp: 1_780_172_800,
      open: 520,
      high: 531,
      low: 515,
      close: 528,
      volume: 49_000_000
    }
  ];
  let drawings: FakeDrawing[] = [
    makeFakeDrawing("shape-1", "horizontal_line", [
      {
        time: 1_780_000_000,
        price: 512.25
      }
    ])
  ];
  const panes: FakePane[] = [
    makeFakePane("pane-main", "Main chart", 420),
    makeFakePane("pane-volume", "Volume", 160)
  ];
  const layouts: FakeLayout[] = [
    {
      id: "layout-breakout",
      name: "Breakout Review",
      modifiedAt: "2026-06-02T14:00:00.000Z"
    },
    {
      id: "layout-clean",
      name: "Clean Review",
      modifiedAt: "2026-06-01T14:00:00.000Z"
    }
  ];
  const replay: FakeReplayApi = {
    active: false,
    playing: false,
    speed: 1,
    position: 10,
    openReplayMode: () => {
      replay.active = true;
      replay.playing = false;
    },
    play: () => {
      replay.active = true;
      replay.playing = true;
    },
    pause: () => {
      replay.playing = false;
    },
    stepForward: () => {
      replay.active = true;
      replay.position += 1;
    },
    stepBack: () => {
      replay.active = true;
      replay.position -= 1;
    },
    setReplaySpeed: (nextSpeed: number) => {
      replay.speed = nextSpeed;
    },
    exitReplayMode: () => {
      replay.active = false;
      replay.playing = false;
    },
    isReplayMode: () => replay.active,
    isPlaying: () => replay.playing,
    getReplaySpeed: () => replay.speed,
    getPosition: () => replay.position
  };

  const chart: FakeChartApi = {
    symbol: () => symbol,
    resolution: () => timeframe,
    chartType: () => chartType,
    getVisibleRange: () => range,
    getAllStudies: () => studies
  };

  if (options.withBars) {
    chart.exportData = () => ({
      bars
    });
  }

  if (options.withStudyValues) {
    chart.getStudyById = (entityId: string) =>
      studies.find((study) => study.id === entityId);
  }

  if (options.withPanes) {
    chart.getPanes = () => panes;
    chart.setActivePane = (paneId: string) => {
      for (const pane of panes) {
        pane.focused = pane.id === paneId;
      }
    };
    chart.setPaneLayout = () => {};
  }

  if (options.withLayouts) {
    chart.getLayouts = () => layouts;
    chart.switchLayout = () => {};
  }

  if (options.withReplay) {
    chart.replay = () => replay;
  }

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

function makeFakePane(id: string, title: string, height: number): FakePane {
  const pane: FakePane = {
    id,
    title,
    height,
    focused: false,
    focus: () => {
      pane.focused = true;
    }
  };

  return pane;
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

void test("raw tab tools list TradingView chart targets and focus a selected target", async () => {
  const secondaryTarget: CdpTarget = {
    id: "chart-target-2",
    title: "AMD Chart",
    type: "page",
    url: "https://www.tradingview.com/chart/def/?symbol=NASDAQ%3AAMD",
    webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/chart-target-2"
  };
  const nonChartTarget = {
    id: "home",
    title: "TradingView",
    type: "page",
    url: "https://www.tradingview.com/"
  };
  const fetchJson = (pathname: string) => {
    assert.equal(pathname, "/json/list");
    return Promise.resolve([chartTarget, nonChartTarget, secondaryTarget]);
  };
  const list = await runRawListTabs({
    fetchJson,
    now: () => new Date("2026-06-02T14:45:00.000Z")
  });
  const fakeClient = new FakeRawPageClient();
  const focused = await runRawFocusTab({
    targetId: "chart-target-2",
    fetchJson,
    pageClientFactory: (target) => {
      assert.equal(target.id, "chart-target-2");
      return Promise.resolve(fakeClient);
    },
    now: () => new Date("2026-06-02T14:46:00.000Z")
  });

  assert.equal(list.ok, true);
  assert.equal(list.action, "list-tabs");
  assert.equal(
    (list.value as { targetCount: number }).targetCount,
    2
  );
  assert.deepEqual(
    (list.value as { targets: { id: string }[] }).targets.map(
      (target) => target.id
    ),
    ["chart-target", "chart-target-2"]
  );
  assert.equal(focused.ok, true);
  assert.equal(focused.action, "focus-tab");
  assert.deepEqual(fakeClient.calls, [
    {
      method: "bringToFront",
      args: []
    }
  ]);
  assert.equal(fakeClient.closed, true);
});

void test("raw tab focus reports missing targets before opening a page client", async () => {
  let pageClientCalled = false;

  const result = await runRawFocusTab({
    targetId: "missing-target",
    fetchJson: () => Promise.resolve([chartTarget]),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new FakeRawPageClient());
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /matched the requested target id/i);
  assert.equal(pageClientCalled, false);
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

void test("raw chart state resolves TradingView active watched chart values", async () => {
  const restore = installFakeActiveWatchedChart(fakeChartApi());
  const fakeClient = new EvaluatingRawPageClient();

  try {
    const result = await runRawChartState({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(fakeClient)
    });

    const value = result.value as {
      before: {
        symbol: string;
        timeframe: string;
      };
    };

    assert.equal(result.ok, true);
    assert.equal(value.before.symbol, "NASDAQ:NVDA");
    assert.equal(value.before.timeframe, "65");
    assert.equal(fakeClient.closed, true);
  } finally {
    restore();
  }
});

void test("raw chart data summary returns bounded OHLCV stats without a live TradingView session", async () => {
  const restore = installFakeWidget(fakeChartApi({ withBars: true }));
  const fakeClient = new EvaluatingRawPageClient();

  try {
    const result = await runRawChartDataSummary({
      barCount: 2,
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(fakeClient)
    });

    const value = result.value as {
      requestedBarCount: number;
      barCount: number;
      period: {
        from: number;
        to: number;
      };
      open: number;
      close: number;
      high: number;
      low: number;
      range: number;
      change: number;
      changePct: number;
      volume: {
        average: number;
      };
      lastBar: {
        timestamp: number;
        close: number;
      };
    };

    assert.equal(result.ok, true);
    assert.equal(result.action, "chart-data-summary");
    assert.equal(value.requestedBarCount, 2);
    assert.equal(value.barCount, 2);
    assert.deepEqual(value.period, {
      from: 1_780_086_400,
      to: 1_780_172_800
    });
    assert.equal(value.open, 510);
    assert.equal(value.close, 528);
    assert.equal(value.high, 531);
    assert.equal(value.low, 505);
    assert.equal(value.range, 26);
    assert.equal(value.change, 18);
    assert.equal(value.changePct, 3.529412);
    assert.equal(value.volume.average, 47_000_000);
    assert.equal(value.lastBar.close, 528);
    assert.equal(fakeClient.closed, true);
  } finally {
    restore();
  }
});

void test("raw chart data summary validates bar count before opening CDP", async () => {
  let clientCalled = false;

  const result = await runRawChartDataSummary({
    barCount: 501,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      clientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /barCount/i);
  assert.equal(clientCalled, false);
});

void test("raw quote snapshot returns symbol and current bar data", async () => {
  const restore = installFakeWidget(fakeChartApi({ withBars: true }));

  try {
    const result = await runRawQuoteSnapshot({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    const value = result.value as {
      symbol: string;
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      last: number;
      volume: number;
    };

    assert.equal(result.ok, true);
    assert.equal(result.action, "quote-snapshot");
    assert.equal(value.symbol, "NASDAQ:NVDA");
    assert.equal(value.timestamp, 1_780_172_800);
    assert.equal(value.open, 520);
    assert.equal(value.high, 531);
    assert.equal(value.low, 515);
    assert.equal(value.close, 528);
    assert.equal(value.last, 528);
    assert.equal(value.volume, 49_000_000);
  } finally {
    restore();
  }
});

void test("raw study values returns compact visible indicator values and caps studies", async () => {
  const restore = installFakeWidget(
    fakeChartApi({ studyCount: 3, withStudyValues: true })
  );

  try {
    const result = await runRawStudyValues({
      maxStudies: 1,
      maxValuesPerStudy: 1,
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    const value = result.value as {
      studyCount: number;
      totalVisibleStudies: number;
      studies: {
        id: string;
        name: string;
        valueCount: number;
        values: {
          label: string;
          value: string | number | boolean;
        }[];
      }[];
      warnings: string[];
    };

    assert.equal(result.ok, true);
    assert.equal(result.action, "study-values");
    assert.equal(value.studyCount, 1);
    assert.equal(value.totalVisibleStudies, 3);
    assert.equal(value.studies[0]?.id, "study-1");
    assert.equal(value.studies[0]?.name, "Volume");
    assert.equal(value.studies[0]?.valueCount, 1);
    assert.deepEqual(value.studies[0]?.values, [
      {
        label: "Volume",
        value: 45_000_000
      }
    ]);
    assert.match(value.warnings.join(" "), /truncated to 1 visible studies/i);
  } finally {
    restore();
  }
});

void test("raw data extraction reports unsupported chart APIs explicitly", async () => {
  const restore = installFakeWidget(fakeChartApi());

  try {
    const summary = await runRawChartDataSummary({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });
    const quote = await runRawQuoteSnapshot({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(summary.ok, false);
    assert.match(summary.error ?? "", /OHLCV data/i);
    assert.match(summary.warnings.join(" "), /did not expose compact OHLCV/i);
    assert.equal(quote.ok, false);
    assert.match(quote.error ?? "", /current bar or quote price/i);
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

void test("raw pane and layout tools list, focus, and switch supported workspace APIs", async () => {
  const restore = installFakeWidget(
    fakeChartApi({
      withPanes: true,
      withLayouts: true
    })
  );

  try {
    const makeClient = () => Promise.resolve(new EvaluatingRawPageClient());
    const common = {
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: makeClient
    };
    const panes = await runRawListPanes(common);
    const focusPane = await runRawFocusPane({
      ...common,
      paneId: "pane-volume"
    });
    const setPaneLayout = await runRawSetPaneLayout({
      ...common,
      layout: "two-horizontal"
    });
    const layouts = await runRawListLayouts(common);
    const switchLayout = await runRawSwitchLayout({
      ...common,
      layoutId: "layout-clean"
    });

    assert.equal(panes.ok, true);
    assert.equal(panes.action, "list-panes");
    assert.deepEqual(
      (panes.value as { panes: { id: string; title: string }[] }).panes.map(
        (pane) => ({
          id: pane.id,
          title: pane.title
        })
      ),
      [
        {
          id: "pane-main",
          title: "Main chart"
        },
        {
          id: "pane-volume",
          title: "Volume"
        }
      ]
    );
    assert.equal(focusPane.ok, true);
    assert.equal(focusPane.action, "focus-pane");
    assert.equal(
      (focusPane.value as { pane: { id: string } }).pane.id,
      "pane-volume"
    );
    assert.equal(setPaneLayout.ok, true);
    assert.equal(
      (setPaneLayout.value as { layout: string }).layout,
      "two-horizontal"
    );
    assert.equal(layouts.ok, true);
    assert.deepEqual(
      (layouts.value as { layouts: { id: string }[] }).layouts.map(
        (layout) => layout.id
      ),
      ["layout-breakout", "layout-clean"]
    );
    assert.equal(switchLayout.ok, true);
    assert.equal(
      (switchLayout.value as { layoutId: string }).layoutId,
      "layout-clean"
    );
  } finally {
    restore();
  }
});

void test("raw pane and layout tools report unsupported APIs explicitly", async () => {
  let pageClientCalled = false;
  const invalidPane = await runRawFocusPane({
    paneId: "",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });

  assert.equal(invalidPane.ok, false);
  assert.match(invalidPane.error ?? "", /pane id/i);
  assert.equal(pageClientCalled, false);

  const restore = installFakeWidget(fakeChartApi());

  try {
    const panes = await runRawListPanes({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });
    const layouts = await runRawListLayouts({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(panes.ok, false);
    assert.match(panes.error ?? "", /pane identifiers/i);
    assert.equal(layouts.ok, false);
    assert.match(layouts.error ?? "", /saved layout identifiers/i);
  } finally {
    restore();
  }
});

void test("raw batch chart applies explicit ordered symbol and timeframe steps", async () => {
  const restore = installFakeWidget(fakeChartApi({ withMutators: true }));

  try {
    const result = await runRawBatchChart({
      steps: [
        {
          symbol: "NASDAQ:NVDA",
          timeframe: "65"
        },
        {
          symbol: "NASDAQ:AMD",
          timeframe: "1D"
        },
        {
          timeframe: "1W"
        }
      ],
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    const value = result.value as {
      requestedCount: number;
      completedCount: number;
      failedCount: number;
      orderPreserved: boolean;
      generatedCandidates: boolean;
      results: {
        index: number;
        requested: {
          symbol?: string;
          timeframe?: string;
        };
        ok: boolean;
        after?: {
          symbol?: string;
          timeframe?: string;
        };
      }[];
      warnings: string[];
    };

    assert.equal(result.ok, true);
    assert.equal(result.action, "batch-chart");
    assert.equal(value.requestedCount, 3);
    assert.equal(value.completedCount, 3);
    assert.equal(value.failedCount, 0);
    assert.equal(value.orderPreserved, true);
    assert.equal(value.generatedCandidates, false);
    assert.deepEqual(
      value.results.map((step) => ({
        index: step.index,
        requested: step.requested,
        after: step.after
      })),
      [
        {
          index: 0,
          requested: {
            symbol: "NASDAQ:NVDA",
            timeframe: "65"
          },
          after: {
            symbol: "NASDAQ:NVDA",
            timeframe: "65"
          }
        },
        {
          index: 1,
          requested: {
            symbol: "NASDAQ:AMD",
            timeframe: "1D"
          },
          after: {
            symbol: "NASDAQ:AMD",
            timeframe: "1D"
          }
        },
        {
          index: 2,
          requested: {
            timeframe: "1W"
          },
          after: {
            symbol: "NASDAQ:AMD",
            timeframe: "1W"
          }
        }
      ]
    );
    assert.match(value.warnings.join(" "), /do not scan, rank, score/i);
  } finally {
    restore();
  }
});

void test("raw batch chart validates bounds and reports per-step failures", async () => {
  let pageClientCalled = false;
  const tooManySteps = await runRawBatchChart({
    steps: Array.from({ length: 51 }, () => ({
      symbol: "NASDAQ:NVDA"
    })),
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });

  assert.equal(tooManySteps.ok, false);
  assert.match(tooManySteps.error ?? "", /at most 50/i);
  assert.equal(pageClientCalled, false);

  const restore = installFakeWidget(fakeChartApi());

  try {
    const unsupported = await runRawBatchChart({
      steps: [
        {
          symbol: "NASDAQ:AMD"
        }
      ],
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    const value = unsupported.value as {
      completedCount: number;
      failedCount: number;
      results: { ok: boolean; error?: string }[];
    };

    assert.equal(unsupported.ok, true);
    assert.equal(value.completedCount, 0);
    assert.equal(value.failedCount, 1);
    assert.equal(value.results[0]?.ok, false);
    assert.match(value.results[0]?.error ?? "", /setSymbol/i);
  } finally {
    restore();
  }
});

void test("raw replay controls use exposed chart replay APIs for explicit practice actions", async () => {
  const restore = installFakeWidget(fakeChartApi({ withReplay: true }));

  try {
    const makeClient = () => Promise.resolve(new EvaluatingRawPageClient());
    const common = {
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: makeClient
    };
    const opened = await runRawReplayOpen(common);
    const played = await runRawReplayPlayPause({
      ...common,
      mode: "play"
    });
    const stepped = await runRawReplayStep({
      ...common,
      direction: "forward",
      steps: 2
    });
    const speed = await runRawReplaySetSpeed({
      ...common,
      speed: 2.5
    });
    const paused = await runRawReplayPlayPause({
      ...common,
      mode: "pause"
    });
    const exited = await runRawReplayExit(common);

    const openedValue = opened.value as {
      action: string;
      after: { active: boolean; playing: boolean };
      warnings: string[];
    };
    const steppedValue = stepped.value as {
      action: string;
      direction: string;
      steps: number;
      after: { position: number };
      warnings: string[];
    };
    const speedValue = speed.value as {
      speed: number;
      after: { speed: number };
    };

    assert.equal(opened.ok, true);
    assert.equal(opened.action, "replay-open");
    assert.equal(openedValue.action, "open");
    assert.equal(openedValue.after.active, true);
    assert.equal(openedValue.after.playing, false);
    assert.match(openedValue.warnings.join(" "), /chart-practice\/review/i);
    assert.equal(played.ok, true);
    assert.equal(
      (played.value as { after: { playing: boolean } }).after.playing,
      true
    );
    assert.equal(stepped.ok, true);
    assert.equal(steppedValue.action, "step");
    assert.equal(steppedValue.direction, "forward");
    assert.equal(steppedValue.steps, 2);
    assert.equal(steppedValue.after.position, 12);
    assert.match(steppedValue.warnings.join(" "), /not a score, ranking/i);
    assert.equal(speed.ok, true);
    assert.equal(speedValue.speed, 2.5);
    assert.equal(speedValue.after.speed, 2.5);
    assert.equal(paused.ok, true);
    assert.equal(
      (paused.value as { after: { playing: boolean } }).after.playing,
      false
    );
    assert.equal(exited.ok, true);
    assert.equal(
      (exited.value as { after: { active: boolean } }).after.active,
      false
    );
  } finally {
    restore();
  }
});

void test("raw replay play/pause defaults to deterministic play mode", async () => {
  const restore = installFakeWidget(fakeChartApi({ withReplay: true }));

  try {
    const result = await runRawReplayPlayPause({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    const value = result.value as {
      action: string;
      after: { playing: boolean };
    };

    assert.equal(result.ok, true);
    assert.equal(result.action, "replay-play-pause");
    assert.equal(value.action, "play");
    assert.equal(value.after.playing, true);
  } finally {
    restore();
  }
});

void test("raw replay controls validate input before opening CDP", async () => {
  let pageClientCalled = false;
  const common = {
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  };
  const invalidStep = await runRawReplayStep({
    ...common,
    direction: "forward",
    steps: 101
  });
  const invalidSpeed = await runRawReplaySetSpeed({
    ...common,
    speed: 0
  });

  assert.equal(invalidStep.ok, false);
  assert.match(invalidStep.error ?? "", /steps/i);
  assert.equal(invalidSpeed.ok, false);
  assert.match(invalidSpeed.error ?? "", /speed/i);
  assert.equal(pageClientCalled, false);
});

void test("raw replay controls report unsupported-control errors without scraping UI", async () => {
  const restore = installFakeWidget(fakeChartApi());

  try {
    const unsupported = await runRawReplayOpen({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(unsupported.ok, false);
    assert.equal(unsupported.action, "replay-open");
    assert.match(unsupported.error ?? "", /replay control API is unsupported/i);
    assert.match(unsupported.error ?? "", /reliable replay controller/i);
    assert.match(
      unsupported.warnings.join(" "),
      /replay control API is unsupported/i
    );
    assert.doesNotMatch(JSON.stringify(unsupported), /broker|order|watchlist/i);
  } finally {
    restore();
  }
});

void test("raw replay detection rejects generic chart play methods without replay namespace", async () => {
  const genericChart = fakeChartApi();
  let genericPlayCalled = false;
  genericChart.play = () => {
    genericPlayCalled = true;
  };
  const restore = installFakeWidget(genericChart);

  try {
    const unsupported = await runRawReplayPlayPause({
      mode: "play",
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(unsupported.ok, false);
    assert.match(unsupported.error ?? "", /replay control API is unsupported/i);
    assert.equal(genericPlayCalled, false);
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
    const rectangleProperties = await runRawDrawingProperties({
      ...common,
      entityId: "shape-3"
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
    const horizontalStyle = (properties.value as { drawing: { style: Record<string, unknown> } })
      .drawing.style;
    assert.equal(horizontalStyle.linecolor, "#00ff00");
    assert.equal(horizontalStyle.linewidth, 1);
    assert.equal(horizontalStyle["linetoolhorzline.linewidth"], 1);
    assert.equal(horizontalStyle["linetoolhorzline.linestyle"], 2);
    assert.equal(rectangleProperties.ok, true);
    const rectangleStyle = (
      rectangleProperties.value as { drawing: { style: Record<string, unknown> } }
    ).drawing.style;
    assert.equal(rectangleStyle.linewidth, 1);
    assert.equal(rectangleStyle["linetoolrectangle.linewidth"], 1);
    assert.equal(rectangleStyle["linetoolrectangle.linestyle"], 2);
    assert.equal(rectangleStyle.transparency, 90);
    assert.match(String(rectangleStyle.backgroundColor), /0\.08/);
    assert.equal(remove.ok, true);
    assert.equal((remove.value as { entityId: string }).entityId, "shape-2");
    assert.equal(clearAll.ok, true);
    assert.equal((clearAll.value as { after: { count: number } }).after.count, 0);
  } finally {
    restore();
  }
});

void test("raw drawing macros create Fib and projection drawings with metadata", async () => {
  const restore = installFakeWidget(
    fakeChartApi({
      withMutators: true,
      withDrawingApi: true
    })
  );

  try {
    const makeClient = () => Promise.resolve(new EvaluatingRawPageClient());
    const common = {
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: makeClient
    };
    const fib = await runRawDrawFibLevels({
      ...common,
      low: {
        time: 1_780_000_000,
        price: 500
      },
      high: {
        time: 1_780_086_400,
        price: 540
      },
      ratios: [0, 0.5, 1, 1.5],
      lock: true
    });
    const projection = await runRawDrawProjection({
      ...common,
      mode: "range-projection",
      base: {
        time: 1_780_100_000,
        price: 520
      },
      range: {
        high: 540,
        low: 500,
        source: "extracted-range",
        label: "daily compression"
      },
      direction: "up",
      multipliers: [1]
    });
    const fibAnchorProperties = await runRawDrawingProperties({
      ...common,
      entityId: "shape-2"
    });
    const fibLevelProperties = await runRawDrawingProperties({
      ...common,
      entityId: "shape-3"
    });

    assert.equal(fib.ok, true);
    assert.equal(fib.action, "draw-fib-levels");
    assert.equal(
      (fib.value as { drawingIds: string[] }).drawingIds.length,
      5
    );
    assert.deepEqual(
      (fib.value as { macro: { levels: { price: number }[] } }).macro.levels.map(
        (level) => level.price
      ),
      [500, 520, 540, 560]
    );
    assert.match(
      (
        fib.value as {
          macro: {
            warnings: string[];
          };
        }
      ).macro.warnings.join(" "),
      /not predictions/i
    );
    assert.equal(projection.ok, true);
    assert.equal(projection.action, "draw-projection");
    assert.equal(
      (
        projection.value as {
          macro: {
            source: string;
            drawingIds: string[];
            levels: { price: number }[];
          };
        }
      ).macro.source,
      "extracted-range"
    );
    assert.deepEqual(
      (
        projection.value as {
          macro: {
            levels: { price: number }[];
          };
        }
      ).macro.levels.map((level) => level.price),
      [540, 500, 580]
    );
    const fibAnchorStyle = (
      fibAnchorProperties.value as { drawing: { style: Record<string, unknown> } }
    ).drawing.style;
    const fibLevelStyle = (
      fibLevelProperties.value as { drawing: { style: Record<string, unknown> } }
    ).drawing.style;
    assert.equal(fibAnchorStyle.linewidth, 1);
    assert.equal(fibAnchorStyle["linetooltrendline.linewidth"], 1);
    assert.equal(fibAnchorStyle["linetooltrendline.linestyle"], 2);
    assert.equal(fibLevelStyle.linewidth, 1);
    assert.equal(fibLevelStyle["linetoolhorzline.linewidth"], 1);
    assert.equal(fibLevelStyle["linetoolhorzline.linestyle"], 2);
  } finally {
    restore();
  }
});

void test("raw native Fib retracement creates one TradingView fib_retracement object", async () => {
  const restore = installFakeWidget(
    fakeChartApi({
      withMutators: true,
      withDrawingApi: true
    })
  );

  try {
    const result = await runRawDrawFibRetracement({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient()),
      low: {
        time: 1_780_000_000,
        price: 500
      },
      high: {
        time: 1_780_086_400,
        price: 540
      },
      ratios: [0, 0.5, 1],
      lock: true
    });
    const properties = await runRawDrawingProperties({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient()),
      entityId: "shape-2"
    });

    assert.equal(result.ok, true);
    assert.equal(result.action, "draw-fib-retracement");
    assert.equal(
      (result.value as { entityId: string }).entityId,
      "shape-2"
    );
    assert.deepEqual(
      (result.value as { drawing: { type: string; points: unknown[] } }).drawing,
      {
        id: "shape-2",
        type: "fib_retracement",
        points: [
          {
            time: 1_780_000_000,
            price: 500
          },
          {
            time: 1_780_086_400,
            price: 540
          }
        ]
      }
    );
    assert.deepEqual(
      (
        result.value as {
          levels: { price: number; ratio: number }[];
        }
      ).levels.map((level) => [level.ratio, level.price]),
      [
        [0, 500],
        [0.5, 520],
        [1, 540]
      ]
    );
    assert.match(
      (result.value as { warnings: string[] }).warnings.join(" "),
      /not predictions/i
    );
    assert.equal(properties.ok, true);
    const fibStyle = (
      properties.value as { drawing: { style: Record<string, unknown> } }
    ).drawing.style;
    assert.equal(fibStyle["linetoolfibretracement.trendline.linewidth"], 1);
    assert.equal(fibStyle["linetoolfibretracement.levelsStyle.linewidth"], 1);
    assert.equal(fibStyle["linetoolfibretracement.transparency"], 92);
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
    const missingNativeFibApi = await runRawDrawFibRetracement({
      low: {
        time: 1_780_000_000,
        price: 500
      },
      high: {
        time: 1_780_086_400,
        price: 540
      },
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
    assert.equal(missingNativeFibApi.ok, false);
    assert.match(missingNativeFibApi.error ?? "", /createMultipointShape/i);
  } finally {
    restore();
  }
});

void test("raw drawing macro validation and missing API failures are explicit", async () => {
  let pageClientCalled = false;
  const invalidFib = await runRawDrawFibLevels({
    high: {
      time: 1_780_000_000,
      price: 100
    },
    low: {
      time: 1_780_086_400,
      price: 100
    },
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });
  const invalidProjection = await runRawDrawProjection({
    mode: "measured-move",
    base: {
      time: 1_780_086_400,
      price: 100
    },
    start: {
      time: 1_780_000_000,
      price: 100
    },
    end: {
      time: 1_780_010_000,
      price: 100
    },
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });

  assert.equal(invalidFib.ok, false);
  assert.match(invalidFib.error ?? "", /greater than low/i);
  assert.equal(invalidProjection.ok, false);
  assert.match(invalidProjection.error ?? "", /different/i);
  assert.equal(pageClientCalled, false);

  const restore = installFakeWidget(fakeChartApi());

  try {
    const missingApi = await runRawDrawFibLevels({
      high: {
        time: 1_780_000_000,
        price: 120
      },
      low: {
        time: 1_780_086_400,
        price: 100
      },
      includeAnchorLine: false,
      ratios: [0.5],
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(missingApi.ok, false);
    assert.match(missingApi.error ?? "", /createShape/i);
    assert.equal(
      (missingApi.value as { before: { count: number } }).before.count,
      0
    );
  } finally {
    restore();
  }
});

void test("raw Pine editor tools open, set, read, compile, save, and shape compact output", async () => {
  const pine = installFakePineEditor({
    source:
      "//@version=6\nindicator(\"Before\")\nplot(close)\n// this line will be truncated",
    markers: [
      {
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 2,
        endColumn: 10,
        severity: 8,
        message: "Undeclared identifier"
      }
    ],
    consoleMessages: [
      "Compiled with 1 error",
      "log.info: source loaded"
    ],
    buttons: ["Update on chart", "Save"]
  });

  try {
    const makeClient = () => Promise.resolve(new EvaluatingRawPageClient());
    const common = {
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: makeClient,
      now: () => new Date("2026-06-02T18:00:00.000Z")
    };
    const open = await runRawPineOpenEditor(common);
    const set = await runRawPineSetSource({
      ...common,
      source: "//@version=6\nindicator(\"After\")\nplot(close)"
    });
    const getSource = await runRawPineGetSource({
      ...common,
      maxSourceChars: 20
    });
    const errors = await runRawPineGetErrors(common);
    const pineConsole = await runRawPineGetConsole(common);
    const compile = await runRawPineCompile({
      ...common,
      settleMs: 0
    });
    const save = await runRawPineSave({
      ...common,
      settleMs: 0
    });

    assert.equal(open.ok, true);
    assert.equal(open.action, "pine-open-editor");
    assert.equal(set.ok, true);
    assert.equal(set.action, "pine-set-source");
    assert.equal(pine.source(), "//@version=6\nindicator(\"After\")\nplot(close)");
    assert.equal((set.value as { linesSet: number }).linesSet, 3);
    assert.equal(getSource.ok, true);
    assert.equal(getSource.action, "pine-get-source");
    assert.equal((getSource.value as { source: string }).source.length, 20);
    assert.equal((getSource.value as { truncated: boolean }).truncated, true);
    assert.match(getSource.warnings.join(" "), /truncated/i);
    assert.equal(errors.ok, true);
    assert.equal((errors.value as { hasErrors: boolean }).hasErrors, true);
    assert.equal((errors.value as { errorCount: number }).errorCount, 1);
    assert.deepEqual(
      (errors.value as { errors: { line: number; severity: string }[] }).errors.map(
        (error) => ({
          line: error.line,
          severity: error.severity
        })
      ),
      [
        {
          line: 2,
          severity: "error"
        }
      ]
    );
    assert.equal(pineConsole.ok, true);
    assert.equal(
      (pineConsole.value as { entries: { message: string }[] }).entries.length,
      2
    );
    assert.equal(compile.ok, true);
    assert.equal((compile.value as { buttonClicked: string }).buttonClicked, "Update on chart");
    assert.equal(save.ok, true);
    assert.equal((save.value as { method: string }).method, "Save");
    assert.deepEqual(pine.clicked, ["Update on chart", "Save"]);
  } finally {
    pine.restore();
  }
});

void test("raw Pine editor validation and missing editor failures are explicit", async () => {
  let pageClientCalled = false;
  const invalidSource = await runRawPineSetSource({
    source: "",
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });
  const invalidGetLimit = await runRawPineGetSource({
    maxSourceChars: 100_001,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });
  const invalidSettle = await runRawPineCompile({
    settleMs: 20_000,
    checkHealth: () => Promise.resolve(healthyResult),
    pageClientFactory: () => {
      pageClientCalled = true;
      return Promise.resolve(new EvaluatingRawPageClient());
    }
  });

  assert.equal(invalidSource.ok, false);
  assert.match(invalidSource.error ?? "", /source is required/i);
  assert.equal(invalidGetLimit.ok, false);
  assert.match(invalidGetLimit.error ?? "", /maxSourceChars/i);
  assert.equal(invalidSettle.ok, false);
  assert.match(invalidSettle.error ?? "", /settleMs/i);
  assert.equal(pageClientCalled, false);

  const globalRecord = globalThis as unknown as {
    monaco?: unknown;
    document?: unknown;
    TradingView?: unknown;
  };
  const previousMonaco = globalRecord.monaco;
  const previousDocument = globalRecord.document;
  const previousTradingView = globalRecord.TradingView;
  globalRecord.monaco = undefined;
  globalRecord.document = undefined;
  globalRecord.TradingView = undefined;

  try {
    const missingEditor = await runRawPineOpenEditor({
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(missingEditor.ok, false);
    assert.match(missingEditor.error ?? "", /Pine Editor|Monaco/i);
    assert.match(missingEditor.warnings.join(" "), /open the Pine Editor/i);
  } finally {
    globalRecord.monaco = previousMonaco;
    globalRecord.document = previousDocument;
    globalRecord.TradingView = previousTradingView;
  }
});

void test("raw Pine compile and save do not blur explicit action boundaries", async () => {
  const saveAndAddOnly = installFakePineEditor({
    buttons: ["Save and add to chart"]
  });

  try {
    const compile = await runRawPineCompile({
      settleMs: 0,
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(compile.ok, false);
    assert.match(compile.error ?? "", /compile|add-to-chart|update/i);
    assert.deepEqual(saveAndAddOnly.clicked, []);
  } finally {
    saveAndAddOnly.restore();
  }

  const noSaveButton = installFakePineEditor({
    buttons: []
  });

  try {
    const save = await runRawPineSave({
      settleMs: 0,
      checkHealth: () => Promise.resolve(healthyResult),
      pageClientFactory: () => Promise.resolve(new EvaluatingRawPageClient())
    });

    assert.equal(save.ok, false);
    assert.match(save.error ?? "", /save button/i);
    assert.deepEqual(noSaveButton.clicked, []);
  } finally {
    noSaveButton.restore();
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
