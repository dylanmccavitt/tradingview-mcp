import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { buildChartFacts } from "../src/chart-analysis/chart-facts.js";
import { CHART_ANALYSIS_PROFILE_NAMES } from "../src/domain.js";
import { createServer, type CreateServerOptions } from "../src/server.js";
import {
  MCP_SERVER_INSTRUCTIONS,
  TRADINGVIEW_MCP_TOOL_NAMES
} from "../src/mcp/tradingview-tools.js";
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
