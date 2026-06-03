import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { buildChartFacts } from "../src/chart-analysis/chart-facts.js";
import { CHART_ANALYSIS_PROFILE_NAMES } from "../src/domain.js";
import { createServer, type CreateServerOptions } from "../src/server.js";
import {
  MCP_SERVER_INSTRUCTIONS,
  RAW_TRADINGVIEW_MCP_TOOL_NAMES,
  TRADINGVIEW_MCP_TOOL_NAMES
} from "../src/mcp/tradingview-tools.js";
import { RAW_AUTOMATION_ENV } from "../src/tradingview/raw-automation.js";
import type { CurrentChartCaptureResult } from "../src/tradingview/current-chart-capture.js";
import type { ChartOneSymbolResult } from "../src/tradingview/chart-runner.js";
import type { TradingViewHealthResult } from "../src/tradingview/health.js";
import type { UniverseConfig } from "../src/universe/config.js";

async function connectClient(options: CreateServerOptions = {}): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const server = createServer(options);
  const client = new Client({
    name: "tradingview-mcp-test-client",
    version: "0.0.0"
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    }
  };
}

interface TestCallToolResult {
  content?: {
    type: string;
    text?: string;
  }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

function callResult(result: Awaited<ReturnType<Client["callTool"]>>): TestCallToolResult {
  return result as unknown as TestCallToolResult;
}

function contentText(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const item = callResult(result).content?.[0];

  return item?.type === "text" ? (item.text ?? "") : "";
}

interface JsonSchemaProperty {
  enum?: unknown[];
  description?: string;
  minimum?: number;
  maximum?: number;
}

interface JsonSchemaObject {
  properties?: Record<string, JsonSchemaProperty>;
}

const healthyResult: TradingViewHealthResult = {
  ok: true,
  status: "healthy",
  message: "TradingView Desktop CDP is reachable.",
  endpoint: "http://127.0.0.1:9223",
  nextSteps: [],
  checkedAt: "2026-06-01T17:30:00.000Z",
  app: {
    found: true,
    executablePath: "/Applications/TradingView.app/Contents/MacOS/TradingView",
    checkedPaths: ["/Applications/TradingView.app/Contents/MacOS/TradingView"],
    source: "option"
  },
  target: {
    id: "chart-target",
    title: "NVDA Chart",
    type: "page",
    url: "https://www.tradingview.com/chart/abc/?symbol=NASDAQ%3ANVDA",
    webSocketDebuggerUrl: "ws://127.0.0.1:9223/devtools/page/chart-target"
  },
  targetCount: 1
};

const universeConfig: UniverseConfig = {
  version: 1,
  groups: [
    {
      id: "semis",
      label: "Semiconductors",
      tags: ["semis"],
      core: [
        {
          symbol: "NASDAQ:NVDA",
          alias: "NVDA",
          name: "NVIDIA",
          tags: ["gpu"]
        },
        {
          symbol: "NASDAQ:AMD",
          alias: "AMD",
          name: "Advanced Micro Devices",
          tags: ["gpu"]
        }
      ],
      extended: [
        {
          symbol: "NASDAQ:ARM",
          alias: "ARM",
          tags: ["ip"]
        }
      ]
    }
  ]
};

function chartResult(symbol: string): ChartOneSymbolResult {
  return {
    ok: true,
    symbol,
    outputDirectory: `/tmp/${symbol.replace(":", "-")}`,
    endpoint: "http://127.0.0.1:9223",
    results: []
  };
}

function currentCaptureResult(captureId: string): CurrentChartCaptureResult {
  return {
    ok: true,
    schemaVersion: 2,
    captureId,
    capturedAt: "2026-06-01T17:30:00.000Z",
    outputDirectory: `/tmp/${captureId}`,
    screenshotPath: `/tmp/${captureId}/current-chart.png`,
    levelsJsonPath: `/tmp/${captureId}/current-chart-levels.json`,
    endpoint: "http://127.0.0.1:9223",
    screenshotOk: true,
    extractionOk: true,
    levelsJsonOk: true,
    facts: buildChartFacts({
      drawings: {
        levels: [],
        zones: [],
        labels: [],
        tables: []
      },
      counts: {
        levels: 0,
        zones: 0,
        labels: 0,
        tables: 0
      },
      warnings: []
    }),
    warnings: []
  };
}

const macroMetadata = [
  {
    schemaVersion: 1,
    kind: "fib-levels" as const,
    source: "explicit-anchors",
    anchors: {
      direction: "low-to-high"
    },
    levels: [
      {
        label: "Fib 50%",
        price: 520,
        role: "retracement" as const,
        source: "explicit-anchors" as const,
        ratio: 0.5
      }
    ],
    drawingIds: ["shape-1"],
    warnings: ["Review context only."]
  }
];

void test("MCP server advertises only high-level v1 charting tools with guardrails", async () => {
  const { client, close } = await connectClient();

  try {
    assert.equal(client.getInstructions(), MCP_SERVER_INSTRUCTIONS);

    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);

    assert.deepEqual(names, TRADINGVIEW_MCP_TOOL_NAMES);

    for (const tool of listed.tools) {
      assert.match(tool.description ?? "", /no scanner\/ranking behavior/i);
      assert.match(tool.description ?? "", /no broker\/order actions/i);
      assert.doesNotMatch(tool.name, /click|type|evaluate/i);
      assert.doesNotMatch(tool.description ?? "", /raw .*browser/i);
      assert.equal(tool.inputSchema.type, "object");
    }
  } finally {
    await close();
  }
});

void test("MCP server advertises raw tools only when the explicit env gate is enabled", async () => {
  const defaultConnection = await connectClient({
    env: {}
  });

  try {
    const listed = await defaultConnection.client.listTools();
    assert.deepEqual(
      listed.tools.map((tool) => tool.name),
      TRADINGVIEW_MCP_TOOL_NAMES
    );
  } finally {
    await defaultConnection.close();
  }

  const rawConnection = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    }
  });

  try {
    const listed = await rawConnection.client.listTools();
    const names = listed.tools.map((tool) => tool.name);

    assert.deepEqual(names, [
      ...TRADINGVIEW_MCP_TOOL_NAMES,
      ...RAW_TRADINGVIEW_MCP_TOOL_NAMES
    ]);

    for (const rawTool of listed.tools.filter((tool) =>
      RAW_TRADINGVIEW_MCP_TOOL_NAMES.includes(
        tool.name as (typeof RAW_TRADINGVIEW_MCP_TOOL_NAMES)[number]
      )
    )) {
      assert.match(rawTool.description ?? "", /experimental local TradingView/i);
      assert.match(rawTool.description ?? "", /active chart target/i);
      assert.match(rawTool.description ?? "", /no scanner\/ranking behavior/i);
      assert.match(rawTool.description ?? "", /no broker\/order actions/i);
    }
  } finally {
    await rawConnection.close();
  }
});

void test("raw MCP evaluate and input tools call injected handlers when enabled", async () => {
  const calls: string[] = [];
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawEvaluate: (options) => {
        calls.push(`evaluate:${options.expression}:${options.port ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "evaluate",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T14:30:00.000Z",
          value: {
            title: "NVDA Chart"
          },
          warnings: []
        });
      },
      runRawClick: (options) => {
        calls.push(`click:${options.x},${options.y}:${options.button ?? "left"}`);
        return Promise.resolve({
          ok: true,
          action: "click",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawKeypress: (options) => {
        calls.push(`keypress:${options.key}`);
        return Promise.resolve({
          ok: true,
          action: "keypress",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawTypeText: (options) => {
        calls.push(`type-text:${options.text}`);
        return Promise.resolve({
          ok: true,
          action: "type-text",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawFindElement: (options) => {
        calls.push(`find:${options.strategy}:${options.value}`);
        return Promise.resolve({
          ok: true,
          action: "find-element",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T14:30:00.000Z",
          value: {
            count: 1,
            elements: [
              {
                index: 0,
                tagName: "button",
                rect: {
                  x: 10,
                  y: 20,
                  width: 30,
                  height: 20,
                  centerX: 25,
                  centerY: 30
                }
              }
            ]
          },
          warnings: []
        });
      },
      runRawSelectorClick: (options) => {
        calls.push(
          `selector-click:${options.strategy}:${options.value}:${options.matchIndex ?? 0}`
        );
        return Promise.resolve({
          ok: true,
          action: "selector-click",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawSelectorHover: (options) => {
        calls.push(
          `selector-hover:${options.strategy}:${options.value}:${options.matchIndex ?? 0}`
        );
        return Promise.resolve({
          ok: true,
          action: "selector-hover",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawScroll: (options) => {
        calls.push(`scroll:${options.direction}:${options.amount ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "scroll",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      }
    }
  });

  try {
    const evaluate = await client.callTool({
      name: "tradingview_raw_evaluate",
      arguments: {
        expression: "document.title",
        port: 9223
      }
    });
    const click = await client.callTool({
      name: "tradingview_raw_click",
      arguments: {
        x: 120,
        y: 240,
        button: "middle"
      }
    });
    const keypress = await client.callTool({
      name: "tradingview_raw_keypress",
      arguments: {
        key: "Escape"
      }
    });
    const typeText = await client.callTool({
      name: "tradingview_raw_type_text",
      arguments: {
        text: "NASDAQ:NVDA"
      }
    });
    const find = await client.callTool({
      name: "tradingview_raw_find_element",
      arguments: {
        strategy: "text",
        value: "Watchlist"
      }
    });
    const selectorClick = await client.callTool({
      name: "tradingview_raw_selector_click",
      arguments: {
        strategy: "css",
        value: "[data-name=watchlist-button]",
        matchIndex: 0,
        clickMethod: "dom"
      }
    });
    const selectorHover = await client.callTool({
      name: "tradingview_raw_selector_hover",
      arguments: {
        strategy: "aria-label",
        value: "Watchlist",
        matchIndex: 0
      }
    });
    const scroll = await client.callTool({
      name: "tradingview_raw_scroll",
      arguments: {
        direction: "down",
        amount: 400
      }
    });

    assert.equal(callResult(evaluate).isError, undefined);
    assert.equal(callResult(evaluate).structuredContent?.action, "evaluate");
    assert.deepEqual(callResult(evaluate).structuredContent?.value, {
      title: "NVDA Chart"
    });
    assert.equal(callResult(click).isError, undefined);
    assert.equal(callResult(keypress).isError, undefined);
    assert.equal(callResult(typeText).isError, undefined);
    assert.equal(callResult(find).isError, undefined);
    assert.equal(callResult(selectorClick).isError, undefined);
    assert.equal(callResult(selectorHover).isError, undefined);
    assert.equal(callResult(scroll).isError, undefined);
    assert.deepEqual(calls, [
      "evaluate:document.title:9223",
      "click:120,240:middle",
      "keypress:Escape",
      "type-text:NASDAQ:NVDA",
      "find:text:Watchlist",
      "selector-click:css:[data-name=watchlist-button]:0",
      "selector-hover:aria-label:Watchlist:0",
      "scroll:down:400"
    ]);
  } finally {
    await close();
  }
});

void test("raw MCP chart control tools call injected handlers when enabled", async () => {
  const calls: string[] = [];
  const chartStateValue = {
    before: {
      symbol: "NASDAQ:NVDA",
      timeframe: "65",
      chartType: "candles",
      visibleRange: {
        from: 1_780_000_000,
        to: 1_780_086_400
      },
      studies: [
        {
          id: "study-1",
          name: "Volume"
        }
      ],
      warnings: []
    },
    after: {
      symbol: "NASDAQ:AMD",
      timeframe: "1D",
      chartType: "line",
      visibleRange: {
        from: 1_780_100_000,
        to: 1_780_200_000
      },
      studies: [],
      warnings: []
    }
  };
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawChartState: (options) => {
        calls.push(`state:${options.port ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "chart-state",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          value: chartStateValue,
          warnings: []
        });
      },
      runRawSetSymbol: (options) => {
        calls.push(`set-symbol:${options.symbol}`);
        return Promise.resolve({
          ok: true,
          action: "set-symbol",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          value: chartStateValue,
          warnings: []
        });
      },
      runRawSetTimeframe: (options) => {
        calls.push(`set-timeframe:${options.timeframe}`);
        return Promise.resolve({
          ok: true,
          action: "set-timeframe",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          value: chartStateValue,
          warnings: []
        });
      },
      runRawSetChartType: (options) => {
        calls.push(`set-chart-type:${options.chartType}`);
        return Promise.resolve({
          ok: true,
          action: "set-chart-type",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          value: chartStateValue,
          warnings: []
        });
      },
      runRawSetVisibleRange: (options) => {
        calls.push(`set-visible-range:${options.range.from}-${options.range.to}`);
        return Promise.resolve({
          ok: true,
          action: "set-visible-range",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          value: chartStateValue,
          warnings: []
        });
      },
      runRawAddIndicator: (options) => {
        calls.push(`add-indicator:${options.name}`);
        return Promise.resolve({
          ok: true,
          action: "add-indicator",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          value: {
            ...chartStateValue,
            entityId: "study-2"
          },
          warnings: []
        });
      },
      runRawRemoveEntity: (options) => {
        calls.push(`remove-entity:${options.entityId}`);
        return Promise.resolve({
          ok: true,
          action: "remove-entity",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          value: chartStateValue,
          warnings: []
        });
      }
    }
  });

  try {
    const state = await client.callTool({
      name: "tradingview_raw_chart_state",
      arguments: {
        port: 9223
      }
    });
    const setSymbol = await client.callTool({
      name: "tradingview_raw_set_symbol",
      arguments: {
        symbol: "NASDAQ:AMD"
      }
    });
    const setTimeframe = await client.callTool({
      name: "tradingview_raw_set_timeframe",
      arguments: {
        timeframe: "1D"
      }
    });
    const setChartType = await client.callTool({
      name: "tradingview_raw_set_chart_type",
      arguments: {
        chartType: "line"
      }
    });
    const setVisibleRange = await client.callTool({
      name: "tradingview_raw_set_visible_range",
      arguments: {
        from: 1_780_100_000,
        to: 1_780_200_000
      }
    });
    const addIndicator = await client.callTool({
      name: "tradingview_raw_add_indicator",
      arguments: {
        name: "Relative Strength Index"
      }
    });
    const removeEntity = await client.callTool({
      name: "tradingview_raw_remove_entity",
      arguments: {
        entityId: "study-2"
      }
    });

    assert.equal(callResult(state).structuredContent?.action, "chart-state");
    assert.equal(callResult(setSymbol).structuredContent?.action, "set-symbol");
    assert.equal(
      callResult(setTimeframe).structuredContent?.action,
      "set-timeframe"
    );
    assert.equal(
      callResult(setChartType).structuredContent?.action,
      "set-chart-type"
    );
    assert.equal(
      callResult(setVisibleRange).structuredContent?.action,
      "set-visible-range"
    );
    assert.equal(
      callResult(addIndicator).structuredContent?.action,
      "add-indicator"
    );
    assert.equal(
      callResult(addIndicator).structuredContent?.value &&
        (
          callResult(addIndicator).structuredContent?.value as {
            entityId?: string;
          }
        ).entityId,
      "study-2"
    );
    assert.equal(
      callResult(removeEntity).structuredContent?.action,
      "remove-entity"
    );
    assert.deepEqual(calls, [
      "state:9223",
      "set-symbol:NASDAQ:AMD",
      "set-timeframe:1D",
      "set-chart-type:line",
      "set-visible-range:1780100000-1780200000",
      "add-indicator:Relative Strength Index",
      "remove-entity:study-2"
    ]);
  } finally {
    await close();
  }
});

void test("raw MCP chart data tools call injected handlers when enabled", async () => {
  const calls: string[] = [];
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawChartDataSummary: (options) => {
        calls.push(`summary:${options.barCount}:${options.port ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "chart-data-summary",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:00:00.000Z",
          value: {
            requestedBarCount: options.barCount,
            barCount: 2,
            high: 531,
            low: 505,
            close: 528,
            warnings: []
          },
          warnings: []
        });
      },
      runRawQuoteSnapshot: (options) => {
        calls.push(`quote:${options.port ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "quote-snapshot",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:00:00.000Z",
          value: {
            symbol: "NASDAQ:NVDA",
            last: 528,
            close: 528,
            open: 520,
            high: 531,
            low: 515,
            volume: 49_000_000,
            timestamp: 1_780_172_800
          },
          warnings: []
        });
      },
      runRawStudyValues: (options) => {
        calls.push(
          `studies:${options.studyName ?? "all"}:${options.maxStudies}:${options.maxValuesPerStudy}`
        );
        return Promise.resolve({
          ok: true,
          action: "study-values",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:00:00.000Z",
          value: {
            studyCount: 1,
            totalVisibleStudies: 1,
            studies: [
              {
                id: "study-1",
                name: "RSI",
                valueCount: 1,
                values: [
                  {
                    label: "RSI",
                    value: 54.2
                  }
                ]
              }
            ],
            warnings: []
          },
          warnings: []
        });
      }
    }
  });

  try {
    const summary = await client.callTool({
      name: "tradingview_raw_chart_data_summary",
      arguments: {
        barCount: 25,
        port: 9223
      }
    });
    const quote = await client.callTool({
      name: "tradingview_raw_quote_snapshot",
      arguments: {
        port: 9223
      }
    });
    const studies = await client.callTool({
      name: "tradingview_raw_study_values",
      arguments: {
        studyName: "RSI",
        maxStudies: 3,
        maxValuesPerStudy: 4
      }
    });

    assert.equal(
      callResult(summary).structuredContent?.action,
      "chart-data-summary"
    );
    assert.equal(
      (
        callResult(summary).structuredContent?.value as {
          barCount?: number;
        }
      ).barCount,
      2
    );
    assert.equal(
      callResult(quote).structuredContent?.action,
      "quote-snapshot"
    );
    assert.equal(
      (
        callResult(quote).structuredContent?.value as {
          symbol?: string;
        }
      ).symbol,
      "NASDAQ:NVDA"
    );
    assert.equal(
      callResult(studies).structuredContent?.action,
      "study-values"
    );
    assert.deepEqual(calls, [
      "summary:25:9223",
      "quote:9223",
      "studies:RSI:3:4"
    ]);
  } finally {
    await close();
  }
});

void test("raw MCP workspace tools call injected handlers when enabled", async () => {
  const calls: string[] = [];
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawListTabs: (options) => {
        calls.push(`tabs:${options.port ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "list-tabs",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          value: {
            targetCount: 1,
            targets: [
              {
                id: "chart-target",
                title: "NVDA Chart",
                url: "https://www.tradingview.com/chart/abc/",
                hasWebSocketDebuggerUrl: true
              }
            ]
          },
          warnings: []
        });
      },
      runRawFocusTab: (options) => {
        calls.push(`focus-tab:${options.targetId}`);
        return Promise.resolve({
          ok: true,
          action: "focus-tab",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          value: {
            focused: true
          },
          warnings: []
        });
      },
      runRawListPanes: () => {
        calls.push("panes");
        return Promise.resolve({
          ok: true,
          action: "list-panes",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          value: {
            count: 2,
            panes: [
              {
                id: "pane-main",
                index: 0
              }
            ]
          },
          warnings: []
        });
      },
      runRawFocusPane: (options) => {
        calls.push(`focus-pane:${options.paneId}`);
        return Promise.resolve({
          ok: true,
          action: "focus-pane",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          value: {
            pane: {
              id: options.paneId
            }
          },
          warnings: []
        });
      },
      runRawSetPaneLayout: (options) => {
        calls.push(`pane-layout:${options.layout}`);
        return Promise.resolve({
          ok: true,
          action: "set-pane-layout",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          value: {
            layout: options.layout
          },
          warnings: []
        });
      },
      runRawListLayouts: () => {
        calls.push("layouts");
        return Promise.resolve({
          ok: true,
          action: "list-layouts",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          value: {
            count: 1,
            layouts: [
              {
                id: "layout-clean"
              }
            ]
          },
          warnings: []
        });
      },
      runRawSwitchLayout: (options) => {
        calls.push(`switch-layout:${options.layoutId}`);
        return Promise.resolve({
          ok: true,
          action: "switch-layout",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          value: {
            layoutId: options.layoutId
          },
          warnings: []
        });
      },
      runRawBatchChart: (options) => {
        calls.push(
          `batch:${options.steps.map((step) => `${step.symbol ?? ""}/${step.timeframe ?? ""}`).join("|")}:${options.stopOnError ?? false}`
        );
        return Promise.resolve({
          ok: true,
          action: "batch-chart",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          value: {
            requestedCount: options.steps.length,
            completedCount: options.steps.length,
            failedCount: 0,
            orderPreserved: true,
            generatedCandidates: false,
            results: []
          },
          warnings: []
        });
      }
    }
  });

  try {
    const tabs = await client.callTool({
      name: "tradingview_raw_list_tabs",
      arguments: {
        port: 9223
      }
    });
    const focusTab = await client.callTool({
      name: "tradingview_raw_focus_tab",
      arguments: {
        targetId: "chart-target"
      }
    });
    const panes = await client.callTool({
      name: "tradingview_raw_list_panes",
      arguments: {}
    });
    const focusPane = await client.callTool({
      name: "tradingview_raw_focus_pane",
      arguments: {
        paneId: "pane-main"
      }
    });
    const paneLayout = await client.callTool({
      name: "tradingview_raw_set_pane_layout",
      arguments: {
        layout: "two-vertical"
      }
    });
    const layouts = await client.callTool({
      name: "tradingview_raw_list_layouts",
      arguments: {}
    });
    const switchLayout = await client.callTool({
      name: "tradingview_raw_switch_layout",
      arguments: {
        layoutId: "layout-clean"
      }
    });
    const batch = await client.callTool({
      name: "tradingview_raw_batch_chart",
      arguments: {
        steps: [
          {
            symbol: "NASDAQ:NVDA",
            timeframe: "65"
          },
          {
            symbol: "NASDAQ:AMD",
            timeframe: "1D"
          }
        ],
        stopOnError: true
      }
    });

    assert.equal(callResult(tabs).structuredContent?.action, "list-tabs");
    assert.equal(callResult(focusTab).structuredContent?.action, "focus-tab");
    assert.equal(callResult(panes).structuredContent?.action, "list-panes");
    assert.equal(callResult(focusPane).structuredContent?.action, "focus-pane");
    assert.equal(
      callResult(paneLayout).structuredContent?.action,
      "set-pane-layout"
    );
    assert.equal(callResult(layouts).structuredContent?.action, "list-layouts");
    assert.equal(
      callResult(switchLayout).structuredContent?.action,
      "switch-layout"
    );
    assert.equal(callResult(batch).structuredContent?.action, "batch-chart");
    assert.deepEqual(calls, [
      "tabs:9223",
      "focus-tab:chart-target",
      "panes",
      "focus-pane:pane-main",
      "pane-layout:two-vertical",
      "layouts",
      "switch-layout:layout-clean",
      "batch:NASDAQ:NVDA/65|NASDAQ:AMD/1D:true"
    ]);
  } finally {
    await close();
  }
});

void test("raw MCP native drawing tools call injected handlers when enabled", async () => {
  const calls: string[] = [];
  const drawValue = {
    entityId: "shape-1",
    drawing: {
      id: "shape-1",
      type: "trend-line",
      points: [
        {
          time: 1_780_000_000,
          price: 510
        },
        {
          time: 1_780_086_400,
          price: 530
        }
      ]
    },
    before: {
      drawings: [],
      count: 0,
      warnings: []
    },
    after: {
      drawings: [
        {
          id: "shape-1",
          type: "trend_line"
        }
      ],
      count: 1,
      warnings: []
    }
  };
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawDrawShape: (options) => {
        calls.push(
          `${options.shapeType}:${options.points.length}:${options.port ?? 0}:${options.drawingPreset ?? "default"}`
        );
        return Promise.resolve({
          ok: true,
          action: "draw-shape",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:30:00.000Z",
          value: drawValue,
          warnings: []
        });
      },
      runRawDrawList: (options) => {
        calls.push(`list:${options.port ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "draw-list",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:30:00.000Z",
          value: drawValue.after,
          warnings: []
        });
      },
      runRawDrawingProperties: (options) => {
        calls.push(`properties:${options.entityId}`);
        return Promise.resolve({
          ok: true,
          action: "draw-properties",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:30:00.000Z",
          value: {
            drawing: {
              id: options.entityId,
              type: "trend_line",
              points: drawValue.drawing.points,
              properties: {
                linewidth: 2
              },
              style: {
                linecolor: "#00ff00"
              },
              visible: true,
              locked: false,
              selectable: true
            }
          },
          warnings: []
        });
      },
      runRawDrawRemove: (options) => {
        calls.push(`remove:${options.entityId}`);
        return Promise.resolve({
          ok: true,
          action: "draw-remove",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:30:00.000Z",
          value: {
            ...drawValue,
            entityId: options.entityId
          },
          warnings: []
        });
      },
      runRawDrawClearAll: (options) => {
        calls.push(`clear:${options.confirmClearAll}`);
        return Promise.resolve({
          ok: true,
          action: "draw-clear-all",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:30:00.000Z",
          value: {
            before: drawValue.after,
            after: {
              drawings: [],
              count: 0,
              warnings: []
            }
          },
          warnings: []
        });
      }
    }
  });

  try {
    const shape = await client.callTool({
      name: "tradingview_draw_shape",
      arguments: {
        shapeType: "trend-line",
        points: drawValue.drawing.points,
        drawingPreset: "clean-thesis",
        port: 9223
      }
    });
    const list = await client.callTool({
      name: "tradingview_draw_list",
      arguments: {
        port: 9223
      }
    });
    const properties = await client.callTool({
      name: "tradingview_draw_properties",
      arguments: {
        entityId: "shape-1"
      }
    });
    const remove = await client.callTool({
      name: "tradingview_draw_remove",
      arguments: {
        entityId: "shape-1"
      }
    });
    const clearAll = await client.callTool({
      name: "tradingview_draw_clear_all",
      arguments: {
        confirmClearAll: true
      }
    });

    assert.equal(callResult(shape).structuredContent?.action, "draw-shape");
    assert.equal(callResult(list).structuredContent?.action, "draw-list");
    assert.equal(
      callResult(properties).structuredContent?.action,
      "draw-properties"
    );
    assert.equal(callResult(remove).structuredContent?.action, "draw-remove");
    assert.equal(
      callResult(clearAll).structuredContent?.action,
      "draw-clear-all"
    );
    assert.deepEqual(calls, [
      "trend-line:2:9223:clean-thesis",
      "list:9223",
      "properties:shape-1",
      "remove:shape-1",
      "clear:true"
    ]);
  } finally {
    await close();
  }
});

void test("raw MCP drawing macro tools call injected handlers when enabled", async () => {
  const calls: string[] = [];
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawDrawFibLevels: (options) => {
        calls.push(
          `fib:${options.low.price}-${options.high.price}:${options.ratios?.join(",") ?? "default"}:${options.drawingPreset ?? "default"}`
        );
        return Promise.resolve({
          ok: true,
          action: "draw-fib-levels",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T17:30:00.000Z",
          value: {
            drawingIds: ["shape-1"],
            macro: macroMetadata[0]
          },
          warnings: []
        });
      },
      runRawDrawFibRetracement: (options) => {
        calls.push(
          `native-fib:${options.low.price}-${options.high.price}:${options.ratios?.join(",") ?? "default"}:${options.drawingPreset ?? "default"}`
        );
        return Promise.resolve({
          ok: true,
          action: "draw-fib-retracement",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T17:30:00.000Z",
          value: {
            entityId: "shape-native-fib",
            drawing: {
              id: "shape-native-fib",
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
            },
            anchors: {
              direction: "low-to-high"
            },
            levels: [
              {
                label: "Fib 50%",
                price: 520,
                role: "retracement",
                source: "explicit-anchors",
                ratio: 0.5
              }
            ],
            warnings: ["Review context only."]
          },
          warnings: []
        });
      },
      runRawDrawProjection: (options) => {
        calls.push(
          `projection:${options.mode}:${options.direction ?? "default"}:${options.drawingPreset ?? "default"}`
        );
        return Promise.resolve({
          ok: true,
          action: "draw-projection",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T17:30:00.000Z",
          value: {
            drawingIds: ["shape-2"],
            macro: {
              ...macroMetadata[0],
              kind: "projection"
            }
          },
          warnings: []
        });
      }
    }
  });

  try {
    const fib = await client.callTool({
      name: "tradingview_draw_fib_levels",
      arguments: {
        low: {
          time: 1_780_000_000,
          price: 500
        },
        high: {
          time: 1_780_086_400,
          price: 540
        },
        ratios: [0, 0.5, 1],
        drawingPreset: "clean-thesis",
        port: 9223
      }
    });
    const projection = await client.callTool({
      name: "tradingview_draw_projection",
      arguments: {
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
        multipliers: [1],
        drawingPreset: "minimal-levels"
      }
    });
    const nativeFib = await client.callTool({
      name: "tradingview_draw_fib_retracement",
      arguments: {
        low: {
          time: 1_780_000_000,
          price: 500
        },
        high: {
          time: 1_780_086_400,
          price: 540
        },
        ratios: [0, 0.5, 1],
        drawingPreset: "risk-map",
        port: 9223
      }
    });

    assert.equal(callResult(fib).structuredContent?.action, "draw-fib-levels");
    assert.equal(
      callResult(projection).structuredContent?.action,
      "draw-projection"
    );
    assert.equal(
      callResult(nativeFib).structuredContent?.action,
      "draw-fib-retracement"
    );
    assert.deepEqual(calls, [
      "fib:500-540:0,0.5,1:clean-thesis",
      "projection:range-projection:up:minimal-levels",
      "native-fib:500-540:0,0.5,1:risk-map"
    ]);
  } finally {
    await close();
  }
});

void test("raw MCP Pine editor tools call injected handlers when enabled", async () => {
  const calls: string[] = [];
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawPineOpenEditor: (options) => {
        calls.push(`open:${options.port ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "pine-open-editor",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          value: {
            ready: true,
            opened: true
          },
          warnings: []
        });
      },
      runRawPineSetSource: (options) => {
        calls.push(`set:${options.source.split("\n").length}`);
        return Promise.resolve({
          ok: true,
          action: "pine-set-source",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          value: {
            linesSet: 2,
            charCount: options.source.length
          },
          warnings: []
        });
      },
      runRawPineGetSource: (options) => {
        calls.push(`source:${options.maxSourceChars ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "pine-get-source",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          value: {
            source: "//@version=6",
            charCount: 12,
            lineCount: 1,
            truncated: false,
            maxSourceChars: options.maxSourceChars
          },
          warnings: []
        });
      },
      runRawPineGetErrors: () => {
        calls.push("errors");
        return Promise.resolve({
          ok: true,
          action: "pine-get-errors",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          value: {
            hasErrors: false,
            errorCount: 0,
            errors: []
          },
          warnings: []
        });
      },
      runRawPineGetConsole: () => {
        calls.push("console");
        return Promise.resolve({
          ok: true,
          action: "pine-get-console",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          value: {
            entryCount: 1,
            entries: [
              {
                type: "compile",
                message: "Compiled"
              }
            ]
          },
          warnings: []
        });
      },
      runRawPineCompile: (options) => {
        calls.push(`compile:${options.settleMs ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "pine-compile",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          value: {
            buttonClicked: "Update on chart",
            hasErrors: false,
            errorCount: 0,
            errors: []
          },
          warnings: []
        });
      },
      runRawPineSave: (options) => {
        calls.push(`save:${options.settleMs ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "pine-save",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          value: {
            method: "Save"
          },
          warnings: []
        });
      }
    }
  });

  try {
    const open = await client.callTool({
      name: "tradingview_pine_open_editor",
      arguments: {
        port: 9223
      }
    });
    const set = await client.callTool({
      name: "tradingview_pine_set_source",
      arguments: {
        source: "//@version=6\nindicator(\"Test\")"
      }
    });
    const getSource = await client.callTool({
      name: "tradingview_pine_get_source",
      arguments: {
        maxSourceChars: 1000
      }
    });
    const errors = await client.callTool({
      name: "tradingview_pine_get_errors",
      arguments: {}
    });
    const pineConsole = await client.callTool({
      name: "tradingview_pine_get_console",
      arguments: {}
    });
    const compile = await client.callTool({
      name: "tradingview_pine_compile",
      arguments: {
        settleMs: 0
      }
    });
    const save = await client.callTool({
      name: "tradingview_pine_save",
      arguments: {
        settleMs: 0
      }
    });

    assert.equal(callResult(open).structuredContent?.action, "pine-open-editor");
    assert.equal(callResult(set).structuredContent?.action, "pine-set-source");
    assert.equal(callResult(getSource).structuredContent?.action, "pine-get-source");
    assert.equal(callResult(errors).structuredContent?.action, "pine-get-errors");
    assert.equal(
      callResult(pineConsole).structuredContent?.action,
      "pine-get-console"
    );
    assert.equal(callResult(compile).structuredContent?.action, "pine-compile");
    assert.equal(callResult(save).structuredContent?.action, "pine-save");
    assert.deepEqual(calls, [
      "open:9223",
      "set:2",
      "source:1000",
      "errors",
      "console",
      "compile:0",
      "save:0"
    ]);
  } finally {
    await close();
  }
});

void test("raw MCP replay tools call injected handlers when enabled", async () => {
  const calls: string[] = [];
  const replayValue = {
    action: "open",
    before: {
      supported: true,
      source: "fixture",
      active: false,
      playing: false,
      speed: 1,
      warnings: []
    },
    after: {
      supported: true,
      source: "fixture",
      active: true,
      playing: false,
      speed: 2,
      warnings: []
    },
    warnings: [
      "Replay controls are chart-practice/review controls only; they do not score performance, scan, rank, recommend, alert, trade, or place orders."
    ]
  };
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawReplayOpen: (options) => {
        calls.push(`open:${options.port ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "replay-open",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T19:30:00.000Z",
          value: replayValue,
          warnings: []
        });
      },
      runRawReplayPlayPause: (options) => {
        calls.push(`play-pause:${options.mode ?? "play"}`);
        return Promise.resolve({
          ok: true,
          action: "replay-play-pause",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T19:30:00.000Z",
          value: {
            ...replayValue,
            action: options.mode ?? "play"
          },
          warnings: []
        });
      },
      runRawReplayStep: (options) => {
        calls.push(`step:${options.direction}:${options.steps ?? 1}`);
        return Promise.resolve({
          ok: true,
          action: "replay-step",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T19:30:00.000Z",
          value: {
            ...replayValue,
            action: "step",
            direction: options.direction,
            steps: options.steps ?? 1
          },
          warnings: []
        });
      },
      runRawReplaySetSpeed: (options) => {
        calls.push(`speed:${options.speed}`);
        return Promise.resolve({
          ok: true,
          action: "replay-set-speed",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T19:30:00.000Z",
          value: {
            ...replayValue,
            action: "set-speed",
            speed: options.speed
          },
          warnings: []
        });
      },
      runRawReplayExit: (options) => {
        calls.push(`exit:${options.timeoutMs ?? 0}`);
        return Promise.resolve({
          ok: true,
          action: "replay-exit",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T19:30:00.000Z",
          value: {
            ...replayValue,
            action: "exit"
          },
          warnings: []
        });
      }
    }
  });

  try {
    const open = await client.callTool({
      name: "tradingview_raw_replay_open",
      arguments: {
        port: 9223
      }
    });
    const playPause = await client.callTool({
      name: "tradingview_raw_replay_play_pause",
      arguments: {}
    });
    const step = await client.callTool({
      name: "tradingview_raw_replay_step",
      arguments: {
        direction: "forward",
        steps: 2
      }
    });
    const speed = await client.callTool({
      name: "tradingview_raw_replay_set_speed",
      arguments: {
        speed: 2
      }
    });
    const exit = await client.callTool({
      name: "tradingview_raw_replay_exit",
      arguments: {
        timeoutMs: 5000
      }
    });

    assert.equal(callResult(open).structuredContent?.action, "replay-open");
    assert.equal(
      callResult(playPause).structuredContent?.action,
      "replay-play-pause"
    );
    assert.equal(callResult(step).structuredContent?.action, "replay-step");
    assert.equal(
      (callResult(step).structuredContent?.value as { steps?: number }).steps,
      2
    );
    assert.equal(
      callResult(speed).structuredContent?.action,
      "replay-set-speed"
    );
    assert.equal(callResult(exit).structuredContent?.action, "replay-exit");
    assert.deepEqual(calls, [
      "open:9223",
      "play-pause:play",
      "step:forward:2",
      "speed:2",
      "exit:5000"
    ]);
  } finally {
    await close();
  }
});

void test("raw MCP replay tool descriptions and schemas keep the chart-practice boundary", async () => {
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    }
  });

  try {
    const listed = await client.listTools();
    const replayTools = listed.tools.filter((tool) =>
      tool.name.startsWith("tradingview_raw_replay_")
    );

    assert.deepEqual(
      replayTools.map((tool) => tool.name),
      [
        "tradingview_raw_replay_open",
        "tradingview_raw_replay_play_pause",
        "tradingview_raw_replay_step",
        "tradingview_raw_replay_set_speed",
        "tradingview_raw_replay_exit"
      ]
    );

    for (const tool of replayTools) {
      const description = tool.description ?? "";
      assert.match(description, /chart-practice\/review|chart-practice|practice\/review/i);
      assert.match(description, /active chart target/i);
      assert.match(description, /no scanner\/ranking behavior/i);
      assert.match(description, /no broker\/order actions/i);
      assert.doesNotMatch(
        description,
        /watchlist read|watchlist write|morning brief|candidate generation/i
      );
    }

    const stepSchema = replayTools.find(
      (tool) => tool.name === "tradingview_raw_replay_step"
    )?.inputSchema as JsonSchemaObject;
    const speedSchema = replayTools.find(
      (tool) => tool.name === "tradingview_raw_replay_set_speed"
    )?.inputSchema as JsonSchemaObject;

    assert.deepEqual(stepSchema.properties?.direction?.enum, [
      "forward",
      "back"
    ]);
    assert.equal(stepSchema.properties?.steps?.maximum, 100);
    assert.equal(speedSchema.properties?.speed?.minimum, 0.1);
    assert.equal(speedSchema.properties?.speed?.maximum, 20);

    const invalid = await client.callTool({
      name: "tradingview_raw_replay_set_speed",
      arguments: {
        speed: 0
      }
    });

    assert.equal(callResult(invalid).isError, true);
    assert.match(contentText(invalid), /speed/i);
  } finally {
    await close();
  }
});

void test("profile-aware MCP tools expose accepted review profile schema", async () => {
  const { client, close } = await connectClient();

  try {
    const listed = await client.listTools();
    const toolsByName = new Map(
      listed.tools.map((tool) => [tool.name, tool])
    );
    const profileToolNames = [
      "tradingview_capture_current_chart",
      "tradingview_build_chartbook"
    ];

    for (const toolName of profileToolNames) {
      const tool = toolsByName.get(toolName);
      assert.ok(tool, `${toolName} should be registered`);
      const schema = tool.inputSchema as JsonSchemaObject;
      const profileProperty = schema.properties?.profile;

      assert.deepEqual(profileProperty?.enum, [
        ...CHART_ANALYSIS_PROFILE_NAMES
      ]);
      assert.match(profileProperty?.description ?? "", /review profile/i);
      assert.match(tool.description ?? "", /profile-aware|selected chart|review chartbook/i);
      assert.match(tool.description ?? "", /no scanner\/ranking behavior/i);
    }

    const chartUniverseSchema = toolsByName.get("tradingview_chart_universe")
      ?.inputSchema as JsonSchemaObject;
    assert.equal(chartUniverseSchema.properties?.profile, undefined);
  } finally {
    await close();
  }
});

void test("status tool returns structured health from the injected checker", async () => {
  let checkedPort = 0;
  const { client, close } = await connectClient({
    handlers: {
      checkTradingViewHealth: (options) => {
        checkedPort = options.port ?? 0;
        return Promise.resolve(healthyResult);
      }
    }
  });

  try {
    const result = await client.callTool({
      name: "tradingview_status",
      arguments: {
        port: 9223
      }
    });

    assert.equal(checkedPort, 9223);
    const typedResult = callResult(result);

    assert.equal(typedResult.isError, undefined);
    assert.match(contentText(result), /CDP is reachable/);
    assert.equal(typedResult.structuredContent?.status, "healthy");
    assert.equal(typedResult.structuredContent?.endpoint, "http://127.0.0.1:9223");
  } finally {
    await close();
  }
});

void test("tool input validation rejects invalid chart requests before handlers run", async () => {
  let chartCalled = false;
  let configLoaded = false;
  let captureCalled = false;
  const { client, close } = await connectClient({
    handlers: {
      chartOneSymbol: () => {
        chartCalled = true;
        return Promise.resolve(chartResult("NASDAQ:NVDA"));
      },
      loadUniverseConfig: () => {
        configLoaded = true;
        return Promise.resolve(universeConfig);
      },
      captureCurrentChart: () => {
        captureCalled = true;
        return Promise.resolve(currentCaptureResult("bad-profile"));
      }
    }
  });

  try {
    const badSymbol = await client.callTool({
      name: "tradingview_chart_symbol",
      arguments: {
        symbol: "NVDA"
      }
    });
    const badTier = await client.callTool({
      name: "tradingview_build_chartbook",
      arguments: {
        tier: "fast"
      }
    });
    const badProfile = await client.callTool({
      name: "tradingview_capture_current_chart",
      arguments: {
        profile: "scanner"
      }
    });

    assert.equal(chartCalled, false);
    assert.equal(configLoaded, false);
    assert.equal(captureCalled, false);
    assert.equal(callResult(badSymbol).isError, true);
    assert.match(contentText(badSymbol), /Input validation error/i);
    assert.equal(callResult(badTier).isError, true);
    assert.match(contentText(badTier), /Input validation error/i);
    assert.equal(callResult(badProfile).isError, true);
    assert.match(contentText(badProfile), /Input validation error/i);
  } finally {
    await close();
  }
});

void test("raw chart-control validation rejects invalid MCP requests before handlers run", async () => {
  let called = false;
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawSetSymbol: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "set-symbol",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          warnings: []
        });
      },
      runRawSetVisibleRange: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "set-visible-range",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T15:30:00.000Z",
          warnings: []
        });
      }
    }
  });

  try {
    const badSymbol = await client.callTool({
      name: "tradingview_raw_set_symbol",
      arguments: {
        symbol: "NVDA"
      }
    });
    const badRange = await client.callTool({
      name: "tradingview_raw_set_visible_range",
      arguments: {
        from: 20,
        to: 10
      }
    });

    assert.equal(called, false);
    assert.equal(callResult(badSymbol).isError, true);
    assert.match(contentText(badSymbol), /Input validation error/i);
    assert.equal(callResult(badRange).isError, true);
    assert.match(contentText(badRange), /Input validation error/i);
  } finally {
    await close();
  }
});

void test("raw workspace validation rejects invalid MCP requests before handlers run", async () => {
  let called = false;
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawFocusTab: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "focus-tab",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          warnings: []
        });
      },
      runRawSetPaneLayout: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "set-pane-layout",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          warnings: []
        });
      },
      runRawBatchChart: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "batch-chart",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:15:00.000Z",
          warnings: []
        });
      }
    }
  });

  try {
    const badTarget = await client.callTool({
      name: "tradingview_raw_focus_tab",
      arguments: {
        targetId: ""
      }
    });
    const badPaneLayout = await client.callTool({
      name: "tradingview_raw_set_pane_layout",
      arguments: {
        layout: "scanner-grid"
      }
    });
    const badBatchSymbol = await client.callTool({
      name: "tradingview_raw_batch_chart",
      arguments: {
        steps: [
          {
            symbol: "NVDA"
          }
        ]
      }
    });
    const badBatchEmptyStep = await client.callTool({
      name: "tradingview_raw_batch_chart",
      arguments: {
        steps: [{}]
      }
    });

    assert.equal(called, false);
    assert.equal(callResult(badTarget).isError, true);
    assert.match(contentText(badTarget), /Input validation error/i);
    assert.equal(callResult(badPaneLayout).isError, true);
    assert.match(contentText(badPaneLayout), /Input validation error/i);
    assert.equal(callResult(badBatchSymbol).isError, true);
    assert.match(contentText(badBatchSymbol), /Input validation error/i);
    assert.equal(callResult(badBatchEmptyStep).isError, true);
    assert.match(contentText(badBatchEmptyStep), /Input validation error/i);
  } finally {
    await close();
  }
});

void test("raw native drawing validation rejects invalid MCP requests before handlers run", async () => {
  let called = false;
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawDrawShape: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "draw-shape",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:30:00.000Z",
          warnings: []
        });
      },
      runRawDrawClearAll: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "draw-clear-all",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T16:30:00.000Z",
          warnings: []
        });
      }
    }
  });

  try {
    const badShape = await client.callTool({
      name: "tradingview_draw_shape",
      arguments: {
        shapeType: "rectangle",
        points: [
          {
            time: 1_780_000_000,
            price: 510
          }
        ]
      }
    });
    const unconfirmedClear = await client.callTool({
      name: "tradingview_draw_clear_all",
      arguments: {
        confirmClearAll: false
      }
    });
    const badPreset = await client.callTool({
      name: "tradingview_draw_shape",
      arguments: {
        shapeType: "horizontal-line",
        drawingPreset: "loud-default",
        points: [
          {
            time: 1_780_000_000,
            price: 510
          }
        ]
      }
    });

    assert.equal(called, false);
    assert.equal(callResult(badShape).isError, true);
    assert.match(contentText(badShape), /Input validation error/i);
    assert.equal(callResult(unconfirmedClear).isError, true);
    assert.match(contentText(unconfirmedClear), /Input validation error/i);
    assert.equal(callResult(badPreset).isError, true);
    assert.match(contentText(badPreset), /Input validation error/i);
  } finally {
    await close();
  }
});

void test("raw drawing macro validation rejects invalid MCP requests before handlers run", async () => {
  let called = false;
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawDrawFibLevels: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "draw-fib-levels",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T17:30:00.000Z",
          warnings: []
        });
      },
      runRawDrawFibRetracement: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "draw-fib-retracement",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T17:30:00.000Z",
          warnings: []
        });
      },
      runRawDrawProjection: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "draw-projection",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T17:30:00.000Z",
          warnings: []
        });
      }
    }
  });

  try {
    const badFib = await client.callTool({
      name: "tradingview_draw_fib_levels",
      arguments: {
        low: {
          time: 1_780_000_000,
          price: 540
        },
        high: {
          time: 1_780_086_400,
          price: 500
        }
      }
    });
    const badProjection = await client.callTool({
      name: "tradingview_draw_projection",
      arguments: {
        mode: "measured-move",
        base: {
          time: 1_780_086_400,
          price: 520
        },
        end: {
          time: 1_780_100_000,
          price: 540
        }
      }
    });
    const badNativeFib = await client.callTool({
      name: "tradingview_draw_fib_retracement",
      arguments: {
        low: {
          time: 1_780_000_000,
          price: 540
        },
        high: {
          time: 1_780_086_400,
          price: 500
        }
      }
    });
    const tooManyRangeLevels = await client.callTool({
      name: "tradingview_draw_projection",
      arguments: {
        mode: "range-projection",
        base: {
          time: 1_780_086_400,
          price: 520
        },
        range: {
          high: 540,
          low: 500
        },
        direction: "both",
        multipliers: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75]
      }
    });

    assert.equal(called, false);
    assert.equal(callResult(badFib).isError, true);
    assert.match(contentText(badFib), /Input validation error/i);
    assert.equal(callResult(badNativeFib).isError, true);
    assert.match(contentText(badNativeFib), /Input validation error/i);
    assert.equal(callResult(badProjection).isError, true);
    assert.match(contentText(badProjection), /Input validation error/i);
    assert.equal(callResult(tooManyRangeLevels).isError, true);
    assert.match(contentText(tooManyRangeLevels), /emits 18 levels/i);
  } finally {
    await close();
  }
});

void test("raw Pine editor validation rejects invalid MCP requests before handlers run", async () => {
  let called = false;
  const { client, close } = await connectClient({
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawPineSetSource: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "pine-set-source",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          warnings: []
        });
      },
      runRawPineGetSource: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "pine-get-source",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          warnings: []
        });
      },
      runRawPineCompile: () => {
        called = true;
        return Promise.resolve({
          ok: true,
          action: "pine-compile",
          endpoint: "http://127.0.0.1:9223",
          executedAt: "2026-06-02T18:30:00.000Z",
          warnings: []
        });
      }
    }
  });

  try {
    const emptySource = await client.callTool({
      name: "tradingview_pine_set_source",
      arguments: {
        source: ""
      }
    });
    const tooMuchSource = await client.callTool({
      name: "tradingview_pine_get_source",
      arguments: {
        maxSourceChars: 100_001
      }
    });
    const badSettle = await client.callTool({
      name: "tradingview_pine_compile",
      arguments: {
        settleMs: 20_000
      }
    });

    assert.equal(called, false);
    assert.equal(callResult(emptySource).isError, true);
    assert.match(contentText(emptySource), /Input validation error/i);
    assert.equal(callResult(tooMuchSource).isError, true);
    assert.match(contentText(tooMuchSource), /Input validation error/i);
    assert.equal(callResult(badSettle).isError, true);
    assert.match(contentText(badSettle), /Input validation error/i);
  } finally {
    await close();
  }
});

void test("universe charting resolves local config order without ranking", async () => {
  const chartedSymbols: string[] = [];
  const { client, close } = await connectClient({
    handlers: {
      loadUniverseConfig: (configPath) => {
        assert.equal(configPath, "/tmp/universe.json");
        return Promise.resolve(universeConfig);
      },
      chartOneSymbol: (options) => {
        chartedSymbols.push(options.symbol);
        return Promise.resolve(chartResult(options.symbol));
      }
    }
  });

  try {
    const result = await client.callTool({
      name: "tradingview_chart_universe",
      arguments: {
        configPath: "/tmp/universe.json",
        groups: ["semis"],
        tier: "core",
        port: 9223
      }
    });

    const typedResult = callResult(result);

    assert.equal(typedResult.isError, undefined);
    assert.deepEqual(chartedSymbols, ["NASDAQ:NVDA", "NASDAQ:AMD"]);
    assert.equal(typedResult.structuredContent?.ok, true);
    assert.deepEqual(typedResult.structuredContent?.selection, {
      configPath: "/tmp/universe.json",
      groups: ["semis"],
      tier: "core"
    });
  } finally {
    await close();
  }
});

void test("current-chart capture tool uses the injected capture workflow", async () => {
  let requestedCaptureId = "";
  let requestedOutputRoot = "";
  let requestedProfile = "";
  let requestedMacroCount = 0;
  const { client, close } = await connectClient({
    handlers: {
      captureCurrentChart: (options) => {
        requestedCaptureId = options.captureId ?? "";
        requestedOutputRoot = options.outputRoot ?? "";
        requestedProfile = options.profile ?? "";
        requestedMacroCount = options.macroMetadata?.length ?? 0;
        return Promise.resolve(currentCaptureResult(requestedCaptureId));
      }
    }
  });

  try {
    const result = await client.callTool({
      name: "tradingview_capture_current_chart",
      arguments: {
        captureId: "manual-review",
        outputDir: "/tmp/current-chart",
        profile: "momentum",
        macroMetadata,
        port: 9223
      }
    });
    const typedResult = callResult(result);

    assert.equal(typedResult.isError, undefined);
    assert.equal(requestedCaptureId, "manual-review");
    assert.equal(requestedOutputRoot, "/tmp/current-chart");
    assert.equal(requestedProfile, "momentum");
    assert.equal(requestedMacroCount, 1);
    assert.equal(typedResult.structuredContent?.ok, true);
    assert.equal(typedResult.structuredContent?.screenshotOk, true);
  } finally {
    await close();
  }
});

void test("chartbook tool passes profile and ordered symbols without rank fields", async () => {
  let requestedProfile = "";
  let requestedSymbols: string[] = [];
  let requestedSelection: unknown;
  let requestedMacroCount = 0;
  const { client, close } = await connectClient({
    handlers: {
      loadUniverseConfig: () => Promise.resolve(universeConfig),
      runChartbook: (options) => {
        requestedProfile = options.profile ?? "";
        requestedSymbols = options.symbols.map((symbol) => symbol.symbol);
        requestedSelection = options.selection;
        requestedMacroCount = options.macroMetadata?.length ?? 0;
        return Promise.resolve({
          ok: true,
          schemaVersion: 2,
          sessionId: options.sessionId ?? "session-a",
          capturedAt: "2026-06-01T17:30:00.000Z",
          preset: options.preset ?? "levels",
          profile: options.profile ?? "focus",
          sessionDirectory: "/tmp/chartbook/session-a",
          indexPath: "/tmp/chartbook/session-a/index.md",
          indexHtmlPath: "/tmp/chartbook/session-a/index.html",
          endpoint: "http://127.0.0.1:9223",
          ...(options.selection
            ? {
                selection: options.selection
              }
            : {}),
          symbols: options.symbols.map((symbol) => {
            const symbolSlug = symbol.symbol.replace(":", "-");
            const result = {
              symbol: symbol.symbol,
              alias: symbol.alias,
              tags: [...symbol.tags],
              groups: [...symbol.groups],
              tiers: [...symbol.tiers],
              ok: true,
              symbolSlug,
              directory: `/tmp/chartbook/session-a/${symbolSlug}`,
              notesPath: `/tmp/chartbook/session-a/${symbolSlug}/notes.md`,
              timeframes: []
            };

            return symbol.name
              ? {
                  ...result,
                  name: symbol.name
                }
              : result;
          })
        });
      }
    }
  });

  try {
    const result = await client.callTool({
      name: "tradingview_build_chartbook",
      arguments: {
        groups: ["semis"],
        profile: "squeeze",
        macroMetadata,
        port: 9223
      }
    });
    const typedResult = callResult(result);

    assert.equal(typedResult.isError, undefined);
    assert.equal(requestedProfile, "squeeze");
    assert.deepEqual(requestedSymbols, ["NASDAQ:NVDA", "NASDAQ:AMD"]);
    assert.deepEqual(requestedSelection, {
      configPath: "config/universe.sample.json",
      groups: ["semis"],
      tier: "core"
    });
    assert.equal(requestedMacroCount, 1);
    assert.equal(typedResult.structuredContent?.profile, "squeeze");
    assert.doesNotMatch(
      JSON.stringify(typedResult.structuredContent),
      /"score"|"rank"|"ranking"/i
    );
  } finally {
    await close();
  }
});

void test("chartbook tool accepts Quant Scan handoff path and preserves explicit order", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "tvmcp-mcp-quant-scan-"));
  let requestedProfile = "";
  let requestedSymbols: string[] = [];
  let requestedRanks: Array<number | undefined> = [];
  let requestedSelection: unknown;

  await writeFile(
    join(runDir, "chartbook.universe.local.json"),
    `${JSON.stringify({
      version: 1,
      groups: [
        {
          id: "scan-candidates",
          label: "Quant Scan Candidates",
          tags: ["quant-scan"],
          core: [
            {
              symbol: "NASDAQ:AMD",
              alias: "AMD",
              tags: ["squeeze"]
            },
            {
              symbol: "NASDAQ:NVDA",
              alias: "NVDA",
              tags: ["momentum"]
            }
          ],
          extended: [
            {
              symbol: "NASDAQ:AMD",
              alias: "AMD",
              tags: ["squeeze"]
            },
            {
              symbol: "NASDAQ:NVDA",
              alias: "NVDA",
              tags: ["momentum"]
            }
          ]
        }
      ]
    })}\n`
  );
  await writeFile(
    join(runDir, "scan.json"),
    `${JSON.stringify({
      metadata: {
        run_id: "setup-scan-mcp",
        artifact_paths: {
          chartbook_universe_local_json: join(
            runDir,
            "chartbook.universe.local.json"
          )
        }
      },
      chartbook: {
        status: "ready",
        group_id: "scan-candidates",
        tier: "core",
        profile: "squeeze",
        selected_symbols: ["NASDAQ:AMD", "NASDAQ:NVDA"]
      },
      selected_candidates: [
        {
          tradingview_metadata: {
            symbol: "NASDAQ:AMD",
            alias: "AMD"
          },
          matching_lanes: ["squeeze"],
          primary_lane: "squeeze",
          trigger: "AMD trigger",
          invalidation: "AMD invalidation",
          warnings: [],
          score_breakdown: {
            primary_score: 88
          }
        },
        {
          tradingview_metadata: {
            symbol: "NASDAQ:NVDA",
            alias: "NVDA"
          },
          matching_lanes: ["momentum"],
          primary_lane: "momentum",
          trigger: "NVDA trigger",
          invalidation: "NVDA invalidation",
          warnings: [],
          score_breakdown: {
            primary_score: 91
          }
        }
      ]
    })}\n`
  );

  const { client, close } = await connectClient({
    handlers: {
      loadUniverseConfig: () => {
        throw new Error("local universe config should not load");
      },
      runChartbook: (options) => {
        requestedProfile = options.profile ?? "";
        requestedSymbols = options.symbols.map((symbol) => symbol.symbol);
        requestedRanks = options.symbols.map(
          (symbol) => symbol.quantScan?.scanRank
        );
        requestedSelection = options.selection;
        return Promise.resolve({
          ok: true,
          schemaVersion: 2,
          sessionId: options.sessionId ?? "setup-scan-mcp",
          capturedAt: "2026-06-01T17:30:00.000Z",
          preset: options.preset ?? "levels",
          profile: options.profile ?? "focus",
          sessionDirectory: "/tmp/chartbook/setup-scan-mcp",
          indexPath: "/tmp/chartbook/setup-scan-mcp/index.md",
          indexHtmlPath: "/tmp/chartbook/setup-scan-mcp/index.html",
          endpoint: "http://127.0.0.1:9223",
          ...(options.selection
            ? {
                selection: options.selection
              }
            : {}),
          symbols: []
        });
      }
    }
  });

  try {
    const result = await client.callTool({
      name: "tradingview_build_chartbook",
      arguments: {
        quantScanHandoffPath: join(runDir, "scan.json"),
        port: 9223
      }
    });
    const typedResult = callResult(result);

    assert.equal(typedResult.isError, undefined);
    assert.equal(requestedProfile, "squeeze");
    assert.deepEqual(requestedSymbols, ["NASDAQ:AMD", "NASDAQ:NVDA"]);
    assert.deepEqual(requestedRanks, [1, 2]);
    assert.deepEqual(requestedSelection, {
      configPath: join(runDir, "chartbook.universe.local.json"),
      groups: ["scan-candidates"],
      tier: "core"
    });
  } finally {
    await close();
    await rm(runDir, {
      recursive: true,
      force: true
    });
  }
});
