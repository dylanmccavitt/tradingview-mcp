import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  DEFAULT_CHARTBOOK_PRESET,
  runChartbook,
  type ChartbookResult,
  type RunChartbookOptions
} from "../chartbook/chartbook.js";
import {
  captureCurrentChart,
  type CaptureCurrentChartOptions,
  type CurrentChartCaptureResult
} from "../tradingview/current-chart-capture.js";
import {
  chartOneSymbol,
  type ChartOneSymbolOptions,
  type ChartOneSymbolResult
} from "../tradingview/chart-runner.js";
import {
  chartUniverse,
  type ChartUniverseOptions
} from "../tradingview/chart-universe-runner.js";
import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS,
  launchTradingViewDesktop,
  type LaunchTradingViewDesktopOptions,
  type TradingViewLaunchResult
} from "../tradingview/desktop.js";
import {
  checkTradingViewHealth,
  type CheckTradingViewHealthOptions,
  type TradingViewHealthResult
} from "../tradingview/health.js";
import {
  DEFAULT_PINE_DRAWING_STUDY_NAME
} from "../tradingview/pine-drawings.js";
import {
  DEFAULT_UNIVERSE_CONFIG_PATH,
  listUniverseGroups,
  loadUniverseConfig,
  resolveUniverseSelection,
  type ResolvedUniverseSymbol,
  type ResolveUniverseSelectionOptions,
  type UniverseConfig,
  type UniverseSelectionTier
} from "../universe/config.js";

export const MCP_SERVER_INSTRUCTIONS =
  "Use this server only for local TradingView Desktop charting workflows. It charts user-selected symbols or configured universe groups, captures screenshots/drawing JSON/chartbooks, and checks CDP status. It does not scan, rank, recommend trades, place orders, call brokers, or bypass TradingView access controls.";

export const TRADINGVIEW_MCP_TOOL_NAMES = [
  "tradingview_connect",
  "tradingview_status",
  "tradingview_list_universe",
  "tradingview_chart_symbol",
  "tradingview_chart_universe",
  "tradingview_capture_current_chart",
  "tradingview_build_chartbook"
] as const;

export type TradingViewMcpToolName =
  (typeof TRADINGVIEW_MCP_TOOL_NAMES)[number];

export interface TradingViewMcpToolHandlers {
  launchTradingViewDesktop: (
    options: LaunchTradingViewDesktopOptions
  ) => Promise<TradingViewLaunchResult>;
  checkTradingViewHealth: (
    options: CheckTradingViewHealthOptions
  ) => Promise<TradingViewHealthResult>;
  loadUniverseConfig: (configPath?: string) => Promise<UniverseConfig>;
  chartOneSymbol: (
    options: ChartOneSymbolOptions
  ) => Promise<ChartOneSymbolResult>;
  captureCurrentChart: (
    options: CaptureCurrentChartOptions
  ) => Promise<CurrentChartCaptureResult>;
  runChartbook: (options: RunChartbookOptions) => Promise<ChartbookResult>;
}

export interface RegisterTradingViewMcpToolsOptions {
  handlers?: Partial<TradingViewMcpToolHandlers>;
}

type ToolResultData = Record<string, unknown>;

const positiveInteger = z.number().int().positive();
const nonEmptyString = z.string().trim().min(1);
const exchangeQualifiedSymbol = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/,
    "Symbol must be exchange-qualified, for example NASDAQ:NVDA."
  );
const universeTier = z.enum(["core", "extended", "all"]);

const endpointShape = {
  host: nonEmptyString.optional(),
  port: positiveInteger.optional(),
  timeoutMs: positiveInteger.optional(),
  appPath: nonEmptyString.optional()
};

const chartOutputShape = {
  outputDir: nonEmptyString.optional(),
  renderTimeoutMs: positiveInteger.optional(),
  renderSettleMs: positiveInteger.optional()
};

const universeSelectionShape = {
  configPath: nonEmptyString.optional(),
  groups: z.array(nonEmptyString).min(1).optional(),
  tier: universeTier.optional()
};

const studyShape = {
  studyName: nonEmptyString.optional(),
  debug: z.boolean().optional()
};

const connectSchema = z.object({
  host: nonEmptyString.optional(),
  port: positiveInteger.optional(),
  appPath: nonEmptyString.optional()
});

const statusSchema = z.object(endpointShape);

const listUniverseSchema = z.object({
  configPath: nonEmptyString.optional()
});

const chartSymbolSchema = z.object({
  ...endpointShape,
  ...chartOutputShape,
  symbol: exchangeQualifiedSymbol
});

const chartUniverseSchema = z.object({
  ...endpointShape,
  ...chartOutputShape,
  ...universeSelectionShape
});

const captureCurrentChartSchema = z.object({
  ...endpointShape,
  ...studyShape,
  outputDir: nonEmptyString.optional(),
  captureId: nonEmptyString.optional()
});

const chartbookSchema = z.object({
  ...endpointShape,
  ...chartOutputShape,
  ...universeSelectionShape,
  ...studyShape,
  outputDir: nonEmptyString.optional(),
  sessionId: nonEmptyString.optional(),
  preset: nonEmptyString.optional()
});

function handlersWithDefaults(
  handlers: Partial<TradingViewMcpToolHandlers> | undefined
): TradingViewMcpToolHandlers {
  return {
    launchTradingViewDesktop:
      handlers?.launchTradingViewDesktop ?? launchTradingViewDesktop,
    checkTradingViewHealth: handlers?.checkTradingViewHealth ?? checkTradingViewHealth,
    loadUniverseConfig: handlers?.loadUniverseConfig ?? loadUniverseConfig,
    chartOneSymbol: handlers?.chartOneSymbol ?? chartOneSymbol,
    captureCurrentChart: handlers?.captureCurrentChart ?? captureCurrentChart,
    runChartbook: handlers?.runChartbook ?? runChartbook
  };
}

function endpointOptions(
  args: {
    host?: string | undefined;
    port?: number | undefined;
    timeoutMs?: number | undefined;
    appPath?: string | undefined;
  }
): {
  host: string;
  port: number;
  timeoutMs: number;
  appPath?: string;
} {
  const options: {
    host: string;
    port: number;
    timeoutMs: number;
    appPath?: string;
  } = {
    host: args.host ?? DEFAULT_CDP_HOST,
    port: args.port ?? DEFAULT_CDP_PORT,
    timeoutMs: args.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS
  };

  if (args.appPath) {
    options.appPath = args.appPath;
  }

  return options;
}

function chartOutputOptions(
  args: {
    outputDir?: string | undefined;
    renderTimeoutMs?: number | undefined;
    renderSettleMs?: number | undefined;
  }
): {
  outputRoot?: string;
  renderTimeoutMs?: number;
  renderSettleMs?: number;
} {
  const options: {
    outputRoot?: string;
    renderTimeoutMs?: number;
    renderSettleMs?: number;
  } = {};

  if (args.outputDir) {
    options.outputRoot = args.outputDir;
  }

  if (args.renderTimeoutMs) {
    options.renderTimeoutMs = args.renderTimeoutMs;
  }

  if (args.renderSettleMs) {
    options.renderSettleMs = args.renderSettleMs;
  }

  return options;
}

function universeSelectionOptions(
  args: {
    groups?: string[] | undefined;
    tier?: UniverseSelectionTier | undefined;
  }
): ResolveUniverseSelectionOptions {
  const options: ResolveUniverseSelectionOptions = {
    tier: args.tier ?? "core"
  };

  if (args.groups) {
    options.groupIds = args.groups;
  }

  return options;
}

function chartbookSelectionSummary(
  configPath: string,
  args: {
    groups?: string[] | undefined;
    tier?: UniverseSelectionTier | undefined;
  }
): {
  configPath: string;
  groups: string[] | "all";
  tier: UniverseSelectionTier;
} {
  return {
    configPath,
    groups: args.groups ?? "all",
    tier: args.tier ?? "core"
  };
}

function textToolResult(summary: string, data: ToolResultData): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: summary
      }
    ],
    structuredContent: data
  };
}

function asToolData(value: unknown): ToolResultData {
  return value && typeof value === "object"
    ? (value as ToolResultData)
    : {
        value
      };
}

function guardrailedDescription(action: string): string {
  return `${action} Charting-only: no scanner/ranking behavior, no financial advice, and no broker/order actions.`;
}

async function resolveUniverse(
  handlers: TradingViewMcpToolHandlers,
  args: {
    configPath?: string | undefined;
    groups?: string[] | undefined;
    tier?: UniverseSelectionTier | undefined;
  }
): Promise<{
  configPath: string;
  config: UniverseConfig;
  symbols: ResolvedUniverseSymbol[];
}> {
  const configPath = args.configPath ?? DEFAULT_UNIVERSE_CONFIG_PATH;
  const config = await handlers.loadUniverseConfig(configPath);
  const symbols = resolveUniverseSelection(
    config,
    universeSelectionOptions(args)
  );

  return {
    configPath,
    config,
    symbols
  };
}

export function registerTradingViewMcpTools(
  server: McpServer,
  options: RegisterTradingViewMcpToolsOptions = {}
): void {
  const handlers = handlersWithDefaults(options.handlers);

  server.registerTool(
    "tradingview_connect",
    {
      title: "Connect TradingView Desktop",
      description: guardrailedDescription(
        "Launch TradingView Desktop locally with the configured CDP port, then return connection next steps."
      ),
      inputSchema: connectSchema,
      annotations: {
        title: "Connect TradingView Desktop",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const endpoint = endpointOptions(args);
      const launchOptions: LaunchTradingViewDesktopOptions = {
        host: endpoint.host,
        port: endpoint.port
      };

      if (endpoint.appPath) {
        launchOptions.appPath = endpoint.appPath;
      }

      const result = await handlers.launchTradingViewDesktop(launchOptions);
      return textToolResult(result.message, asToolData(result));
    }
  );

  server.registerTool(
    "tradingview_status",
    {
      title: "Check TradingView Status",
      description: guardrailedDescription(
        "Check the local TradingView Desktop CDP endpoint and active chart target."
      ),
      inputSchema: statusSchema,
      annotations: {
        title: "Check TradingView Status",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const result = await handlers.checkTradingViewHealth(endpointOptions(args));
      return textToolResult(result.message, asToolData(result));
    }
  );

  server.registerTool(
    "tradingview_list_universe",
    {
      title: "List Local Universe",
      description: guardrailedDescription(
        "List configured local universe groups and counts without reading TradingView watchlists."
      ),
      inputSchema: listUniverseSchema,
      annotations: {
        title: "List Local Universe",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (args) => {
      const configPath = args.configPath ?? DEFAULT_UNIVERSE_CONFIG_PATH;
      const config = await handlers.loadUniverseConfig(configPath);
      const groups = listUniverseGroups(config);

      return textToolResult(`Loaded ${groups.length} universe groups.`, {
        configPath,
        groups
      });
    }
  );

  server.registerTool(
    "tradingview_chart_symbol",
    {
      title: "Chart One Symbol",
      description: guardrailedDescription(
        "Chart one exchange-qualified symbol across the v1 weekly, daily, and 65-minute review timeframes."
      ),
      inputSchema: chartSymbolSchema,
      annotations: {
        title: "Chart One Symbol",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const chartOptions: ChartOneSymbolOptions = {
        symbol: args.symbol,
        ...endpointOptions(args),
        ...chartOutputOptions(args)
      };
      const result = await handlers.chartOneSymbol(chartOptions);

      return textToolResult(
        `Charted ${result.symbol}: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_chart_universe",
    {
      title: "Chart Universe Group",
      description: guardrailedDescription(
        "Chart configured universe symbols in local config order without scoring or ranking them."
      ),
      inputSchema: chartUniverseSchema,
      annotations: {
        title: "Chart Universe Group",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const chartUniverseOptions: ChartUniverseOptions = {
        ...endpointOptions(args),
        ...chartOutputOptions(args),
        loadUniverseConfig: handlers.loadUniverseConfig,
        chartOneSymbol: handlers.chartOneSymbol
      };

      if (args.configPath) {
        chartUniverseOptions.configPath = args.configPath;
      }

      if (args.groups) {
        chartUniverseOptions.groupIds = args.groups;
      }

      if (args.tier) {
        chartUniverseOptions.tier = args.tier;
      }

      const result = await chartUniverse(chartUniverseOptions);

      return textToolResult(
        `Charted ${result.symbols.length} configured symbols: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_capture_current_chart",
    {
      title: "Capture Current Chart",
      description: guardrailedDescription(
        "Capture the currently visible TradingView chart screenshot and objective overlay drawing JSON."
      ),
      inputSchema: captureCurrentChartSchema,
      annotations: {
        title: "Capture Current Chart",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const captureOptions: CaptureCurrentChartOptions = {
        ...endpointOptions(args),
        studyName: args.studyName ?? DEFAULT_PINE_DRAWING_STUDY_NAME,
        debug: args.debug ?? false
      };

      if (args.outputDir) {
        captureOptions.outputRoot = args.outputDir;
      }

      if (args.captureId) {
        captureOptions.captureId = args.captureId;
      }

      const result = await handlers.captureCurrentChart(captureOptions);

      return textToolResult(
        `Captured current chart: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_build_chartbook",
    {
      title: "Build Chartbook",
      description: guardrailedDescription(
        "Build a local chartbook for configured universe symbols with screenshots, notes, and drawing JSON."
      ),
      inputSchema: chartbookSchema,
      annotations: {
        title: "Build Chartbook",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const { configPath, symbols } = await resolveUniverse(handlers, args);
      const chartbookOptions: RunChartbookOptions = {
        symbols,
        ...endpointOptions(args),
        ...chartOutputOptions(args),
        preset: args.preset ?? DEFAULT_CHARTBOOK_PRESET,
        selection: chartbookSelectionSummary(configPath, args),
        studyName: args.studyName ?? DEFAULT_PINE_DRAWING_STUDY_NAME,
        debug: args.debug ?? false
      };

      if (args.sessionId) {
        chartbookOptions.sessionId = args.sessionId;
      }

      const result = await handlers.runChartbook(chartbookOptions);

      return textToolResult(
        `Built chartbook ${result.sessionId}: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );
}
