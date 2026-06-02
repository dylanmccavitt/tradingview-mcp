import assert from "node:assert/strict";
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
        calls.push(`${options.shapeType}:${options.points.length}:${options.port ?? 0}`);
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
      "trend-line:2:9223",
      "list:9223",
      "properties:shape-1",
      "remove:shape-1",
      "clear:true"
    ]);
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

    assert.equal(called, false);
    assert.equal(callResult(badShape).isError, true);
    assert.match(contentText(badShape), /Input validation error/i);
    assert.equal(callResult(unconfirmedClear).isError, true);
    assert.match(contentText(unconfirmedClear), /Input validation error/i);
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
  const { client, close } = await connectClient({
    handlers: {
      captureCurrentChart: (options) => {
        requestedCaptureId = options.captureId ?? "";
        requestedOutputRoot = options.outputRoot ?? "";
        requestedProfile = options.profile ?? "";
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
        port: 9223
      }
    });
    const typedResult = callResult(result);

    assert.equal(typedResult.isError, undefined);
    assert.equal(requestedCaptureId, "manual-review");
    assert.equal(requestedOutputRoot, "/tmp/current-chart");
    assert.equal(requestedProfile, "momentum");
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
  const { client, close } = await connectClient({
    handlers: {
      loadUniverseConfig: () => Promise.resolve(universeConfig),
      runChartbook: (options) => {
        requestedProfile = options.profile ?? "";
        requestedSymbols = options.symbols.map((symbol) => symbol.symbol);
        requestedSelection = options.selection;
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
    assert.equal(typedResult.structuredContent?.profile, "squeeze");
    assert.doesNotMatch(
      JSON.stringify(typedResult.structuredContent),
      /"score"|"rank"|"ranking"/i
    );
  } finally {
    await close();
  }
});
