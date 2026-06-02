import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { CHART_ANALYSIS_PROFILE_NAMES } from "../domain.js";
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
  DEFAULT_RAW_EVALUATE_MAX_RESULT_BYTES,
  DEFAULT_RAW_FIND_MAX_MATCHES,
  DEFAULT_RAW_SCROLL_AMOUNT,
  RAW_DRAWING_MAX_OVERRIDES,
  RAW_DRAWING_TEXT_MAX_CHARS,
  RAW_FIND_MAX_MATCHES_LIMIT,
  RAW_SCROLL_MAX_AMOUNT,
  RAW_SELECTOR_MAX_CHARS,
  type RawAddIndicatorOptions,
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
  type RawAutomationResult,
  type RawChartStateOptions,
  type RawClickOptions,
  type RawDrawClearAllOptions,
  type RawDrawListOptions,
  type RawDrawRemoveOptions,
  type RawDrawShapeOptions,
  type RawDrawingPropertiesOptions,
  type RawFindElementOptions,
  type RawEvaluateOptions,
  type RawKeypressOptions,
  type RawRemoveEntityOptions,
  type RawScrollOptions,
  type RawSelectorClickOptions,
  type RawSelectorHoverOptions,
  type RawSetChartTypeOptions,
  type RawSetSymbolOptions,
  type RawSetTimeframeOptions,
  type RawSetVisibleRangeOptions,
  type RawTypeTextOptions
} from "../tradingview/raw-automation.js";
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
  "Use this server only for local TradingView Desktop charting workflows. It charts user-selected symbols or configured universe groups, captures screenshots/drawing JSON/chartbooks, checks CDP status, and lets profile fields select focus, breakout, squeeze, or momentum review emphasis. Profiles are selected-chart review modes only. This server does not scan, rank, recommend trades, place orders, call brokers, or bypass TradingView access controls.";

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

export const RAW_TRADINGVIEW_MCP_TOOL_NAMES = [
  "tradingview_raw_evaluate",
  "tradingview_raw_click",
  "tradingview_raw_keypress",
  "tradingview_raw_type_text",
  "tradingview_raw_find_element",
  "tradingview_raw_selector_click",
  "tradingview_raw_selector_hover",
  "tradingview_raw_scroll",
  "tradingview_raw_chart_state",
  "tradingview_raw_set_symbol",
  "tradingview_raw_set_timeframe",
  "tradingview_raw_set_chart_type",
  "tradingview_raw_set_visible_range",
  "tradingview_raw_add_indicator",
  "tradingview_raw_remove_entity",
  "tradingview_draw_shape",
  "tradingview_draw_list",
  "tradingview_draw_properties",
  "tradingview_draw_remove",
  "tradingview_draw_clear_all"
] as const;

export type RawTradingViewMcpToolName =
  (typeof RAW_TRADINGVIEW_MCP_TOOL_NAMES)[number];

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
  runRawEvaluate: (options: RawEvaluateOptions) => Promise<RawAutomationResult>;
  runRawClick: (options: RawClickOptions) => Promise<RawAutomationResult>;
  runRawKeypress: (options: RawKeypressOptions) => Promise<RawAutomationResult>;
  runRawTypeText: (options: RawTypeTextOptions) => Promise<RawAutomationResult>;
  runRawFindElement: (
    options: RawFindElementOptions
  ) => Promise<RawAutomationResult>;
  runRawSelectorClick: (
    options: RawSelectorClickOptions
  ) => Promise<RawAutomationResult>;
  runRawSelectorHover: (
    options: RawSelectorHoverOptions
  ) => Promise<RawAutomationResult>;
  runRawScroll: (options: RawScrollOptions) => Promise<RawAutomationResult>;
  runRawChartState: (
    options: RawChartStateOptions
  ) => Promise<RawAutomationResult>;
  runRawSetSymbol: (
    options: RawSetSymbolOptions
  ) => Promise<RawAutomationResult>;
  runRawSetTimeframe: (
    options: RawSetTimeframeOptions
  ) => Promise<RawAutomationResult>;
  runRawSetChartType: (
    options: RawSetChartTypeOptions
  ) => Promise<RawAutomationResult>;
  runRawSetVisibleRange: (
    options: RawSetVisibleRangeOptions
  ) => Promise<RawAutomationResult>;
  runRawAddIndicator: (
    options: RawAddIndicatorOptions
  ) => Promise<RawAutomationResult>;
  runRawRemoveEntity: (
    options: RawRemoveEntityOptions
  ) => Promise<RawAutomationResult>;
  runRawDrawShape: (
    options: RawDrawShapeOptions
  ) => Promise<RawAutomationResult>;
  runRawDrawList: (
    options: RawDrawListOptions
  ) => Promise<RawAutomationResult>;
  runRawDrawingProperties: (
    options: RawDrawingPropertiesOptions
  ) => Promise<RawAutomationResult>;
  runRawDrawRemove: (
    options: RawDrawRemoveOptions
  ) => Promise<RawAutomationResult>;
  runRawDrawClearAll: (
    options: RawDrawClearAllOptions
  ) => Promise<RawAutomationResult>;
}

export interface RegisterTradingViewMcpToolsOptions {
  handlers?: Partial<TradingViewMcpToolHandlers>;
  env?: NodeJS.ProcessEnv;
}

type ToolResultData = Record<string, unknown>;

const positiveInteger = z.number().int().positive();
const nonNegativeNumber = z.number().finite().min(0);
const nonEmptyString = z.string().trim().min(1);
const exchangeQualifiedSymbol = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/,
    "Symbol must be exchange-qualified, for example NASDAQ:NVDA."
  );
const universeTier = z.enum(["core", "extended", "all"]);
const chartAnalysisProfile = z
  .enum(CHART_ANALYSIS_PROFILE_NAMES)
  .describe(
    "Chart review profile: focus, breakout, squeeze, or momentum. Profiles change objective facts and checklist emphasis only; they do not scan, rank, recommend, or trade."
  );

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
  profile: chartAnalysisProfile.optional(),
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

const rawEvaluateSchema = z.object({
  ...endpointShape,
  expression: nonEmptyString
    .max(2000)
    .describe(
      "Bounded JavaScript expression evaluated in the active local TradingView chart target only."
    ),
  maxResultBytes: positiveInteger
    .max(65536)
    .optional()
    .describe("Maximum compact JSON result size. Defaults to 4096 bytes.")
});

const rawInputButton = z.enum(["left", "middle", "right"]);

const rawClickSchema = z.object({
  ...endpointShape,
  x: nonNegativeNumber,
  y: nonNegativeNumber,
  button: rawInputButton.optional()
});

const rawKeypressSchema = z.object({
  ...endpointShape,
  key: nonEmptyString.max(64)
});

const rawTypeTextSchema = z.object({
  ...endpointShape,
  text: z.string().min(1).max(1000)
});

const rawSelectorStrategy = z.enum(["text", "aria-label", "data-name", "css"]);
const rawSelectorShape = {
  ...endpointShape,
  strategy: rawSelectorStrategy.describe(
    "Visible element lookup strategy: text, aria-label, data-name, or CSS selector."
  ),
  value: nonEmptyString.max(RAW_SELECTOR_MAX_CHARS),
  maxMatches: positiveInteger
    .max(RAW_FIND_MAX_MATCHES_LIMIT)
    .optional()
    .describe(`Maximum compact matches to return. Defaults to ${DEFAULT_RAW_FIND_MAX_MATCHES}.`)
};

const rawFindElementSchema = z.object(rawSelectorShape);

const rawSelectorClickSchema = z.object({
  ...rawSelectorShape,
  matchIndex: z.number().int().min(0).optional(),
  button: rawInputButton.optional(),
  clickMethod: z.enum(["mouse", "dom"]).optional()
});

const rawSelectorHoverSchema = z.object({
  ...rawSelectorShape,
  matchIndex: z.number().int().min(0).optional()
});

const rawScrollSchema = z.object({
  ...endpointShape,
  direction: z.enum(["up", "down", "left", "right"]),
  amount: positiveInteger
    .max(RAW_SCROLL_MAX_AMOUNT)
    .optional()
    .describe(`Bounded scroll amount in pixels. Defaults to ${DEFAULT_RAW_SCROLL_AMOUNT}.`),
  x: nonNegativeNumber.optional(),
  y: nonNegativeNumber.optional()
});

const rawChartStateSchema = z.object(endpointShape);

const rawSetSymbolSchema = z.object({
  ...endpointShape,
  symbol: exchangeQualifiedSymbol
});

const rawSetTimeframeSchema = z.object({
  ...endpointShape,
  timeframe: nonEmptyString
    .max(32)
    .regex(/^[A-Za-z0-9]+$/, "Timeframe must contain only letters and numbers.")
});

const rawSetChartTypeSchema = z.object({
  ...endpointShape,
  chartType: z.union([
    nonEmptyString.max(64),
    z.number().int().min(0).max(100)
  ])
});

const rawSetVisibleRangeSchema = z.object({
  ...endpointShape,
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative()
}).refine((value) => value.from < value.to, {
  message: "Visible range from must be earlier than to.",
  path: ["to"]
});

const rawAddIndicatorSchema = z.object({
  ...endpointShape,
  name: nonEmptyString.max(120)
});

const rawRemoveEntitySchema = z.object({
  ...endpointShape,
  entityId: nonEmptyString.max(200)
});

const rawDrawingPoint = z.object({
  time: z
    .number()
    .int()
    .nonnegative()
    .describe("Unix timestamp anchor for the drawing point."),
  price: z
    .number()
    .positive()
    .finite()
    .describe("Price anchor for the drawing point.")
});

const rawDrawingOverrides = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .refine(
    (value) => Object.keys(value).length <= RAW_DRAWING_MAX_OVERRIDES,
    `Drawing overrides may include at most ${RAW_DRAWING_MAX_OVERRIDES} keys.`
  );

const rawDrawShapeSchema = z
  .object({
    ...endpointShape,
    shapeType: z
      .enum(["horizontal-line", "trend-line", "rectangle", "text"])
      .describe("Supported native TradingView drawing shape."),
    points: z.array(rawDrawingPoint).min(1).max(2),
    text: nonEmptyString.max(RAW_DRAWING_TEXT_MAX_CHARS).optional(),
    overrides: rawDrawingOverrides.optional(),
    lock: z.boolean().optional(),
    disableSelection: z.boolean().optional()
  })
  .superRefine((value, context) => {
    const expectedPoints =
      value.shapeType === "trend-line" || value.shapeType === "rectangle"
        ? 2
        : 1;

    if (value.points.length !== expectedPoints) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.shapeType} requires exactly ${expectedPoints} point${expectedPoints === 1 ? "" : "s"}.`,
        path: ["points"]
      });
    }

    if (value.shapeType === "text" && !value.text) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Text drawings require text.",
        path: ["text"]
      });
    }
  });

const rawDrawListSchema = z.object(endpointShape);

const rawDrawingPropertiesSchema = z.object({
  ...endpointShape,
  entityId: nonEmptyString.max(200)
});

const rawDrawRemoveSchema = z.object({
  ...endpointShape,
  entityId: nonEmptyString.max(200)
});

const rawDrawClearAllSchema = z.object({
  ...endpointShape,
  confirmClearAll: z
    .literal(true)
    .describe(
      "Must be true. This explicit confirmation is required because the tool removes every native drawing from the active chart."
    )
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
    runChartbook: handlers?.runChartbook ?? runChartbook,
    runRawEvaluate: handlers?.runRawEvaluate ?? runRawEvaluate,
    runRawClick: handlers?.runRawClick ?? runRawClick,
    runRawKeypress: handlers?.runRawKeypress ?? runRawKeypress,
    runRawTypeText: handlers?.runRawTypeText ?? runRawTypeText,
    runRawFindElement: handlers?.runRawFindElement ?? runRawFindElement,
    runRawSelectorClick: handlers?.runRawSelectorClick ?? runRawSelectorClick,
    runRawSelectorHover: handlers?.runRawSelectorHover ?? runRawSelectorHover,
    runRawScroll: handlers?.runRawScroll ?? runRawScroll,
    runRawChartState: handlers?.runRawChartState ?? runRawChartState,
    runRawSetSymbol: handlers?.runRawSetSymbol ?? runRawSetSymbol,
    runRawSetTimeframe: handlers?.runRawSetTimeframe ?? runRawSetTimeframe,
    runRawSetChartType: handlers?.runRawSetChartType ?? runRawSetChartType,
    runRawSetVisibleRange:
      handlers?.runRawSetVisibleRange ?? runRawSetVisibleRange,
    runRawAddIndicator: handlers?.runRawAddIndicator ?? runRawAddIndicator,
    runRawRemoveEntity: handlers?.runRawRemoveEntity ?? runRawRemoveEntity,
    runRawDrawShape: handlers?.runRawDrawShape ?? runRawDrawShape,
    runRawDrawList: handlers?.runRawDrawList ?? runRawDrawList,
    runRawDrawingProperties:
      handlers?.runRawDrawingProperties ?? runRawDrawingProperties,
    runRawDrawRemove: handlers?.runRawDrawRemove ?? runRawDrawRemove,
    runRawDrawClearAll: handlers?.runRawDrawClearAll ?? runRawDrawClearAll
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

function rawGuardrailedDescription(action: string): string {
  return `${action} Experimental local TradingView raw control for the active chart target only. Requires ${RAW_AUTOMATION_ENV}=1. Charting-only: no scanner/ranking behavior, no financial advice, no broker/order actions, no unattended candidates, and no TradingView account/security automation.`;
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
        "Smoke-chart configured universe symbols in local config order without scoring or ranking them; use chartbook for profile-aware review artifacts."
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
        "Capture the currently visible selected chart as a profile-aware review artifact with a screenshot and objective overlay drawing JSON."
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

      if (args.profile) {
        captureOptions.profile = args.profile;
      }

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
        "Build a local profile-aware review chartbook for configured universe symbols in resolved order with screenshots, notes, and drawing JSON."
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

      if (args.profile) {
        chartbookOptions.profile = args.profile;
      }

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

  if (!isRawAutomationEnabled(options.env)) {
    return;
  }

  server.registerTool(
    "tradingview_raw_evaluate",
    {
      title: "Raw Evaluate TradingView Chart",
      description: rawGuardrailedDescription(
        "Evaluate one bounded JavaScript expression and return compact structured output."
      ),
      inputSchema: rawEvaluateSchema,
      annotations: {
        title: "Raw Evaluate TradingView Chart",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawEvaluateOptions = {
        expression: args.expression,
        maxResultBytes:
          args.maxResultBytes ?? DEFAULT_RAW_EVALUATE_MAX_RESULT_BYTES,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawEvaluate(rawOptions);

      return textToolResult(
        `Raw evaluate: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_click",
    {
      title: "Raw Click TradingView Chart",
      description: rawGuardrailedDescription(
        "Dispatch a coordinate mouse click against the active local TradingView chart target."
      ),
      inputSchema: rawClickSchema,
      annotations: {
        title: "Raw Click TradingView Chart",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawClickOptions = {
        x: args.x,
        y: args.y,
        button: args.button ?? "left",
        ...endpointOptions(args)
      };
      const result = await handlers.runRawClick(rawOptions);

      return textToolResult(
        `Raw click: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_keypress",
    {
      title: "Raw Keypress TradingView Chart",
      description: rawGuardrailedDescription(
        "Dispatch one keyboard keypress against the active local TradingView chart target."
      ),
      inputSchema: rawKeypressSchema,
      annotations: {
        title: "Raw Keypress TradingView Chart",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawKeypressOptions = {
        key: args.key,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawKeypress(rawOptions);

      return textToolResult(
        `Raw keypress: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_type_text",
    {
      title: "Raw Type Text TradingView Chart",
      description: rawGuardrailedDescription(
        "Insert bounded text against the active local TradingView chart target."
      ),
      inputSchema: rawTypeTextSchema,
      annotations: {
        title: "Raw Type Text TradingView Chart",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawTypeTextOptions = {
        text: args.text,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawTypeText(rawOptions);

      return textToolResult(
        `Raw type text: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_find_element",
    {
      title: "Raw Find TradingView UI Element",
      description: rawGuardrailedDescription(
        "Find visible TradingView UI elements by text, aria-label, data-name, or CSS selector and return compact positions."
      ),
      inputSchema: rawFindElementSchema,
      annotations: {
        title: "Raw Find TradingView UI Element",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawFindElementOptions = {
        strategy: args.strategy,
        value: args.value,
        maxMatches: args.maxMatches ?? DEFAULT_RAW_FIND_MAX_MATCHES,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawFindElement(rawOptions);

      return textToolResult(
        `Raw find element: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_selector_click",
    {
      title: "Raw Selector Click TradingView Chart",
      description: rawGuardrailedDescription(
        "Click one visible TradingView UI element selected by text, aria-label, data-name, or CSS selector."
      ),
      inputSchema: rawSelectorClickSchema,
      annotations: {
        title: "Raw Selector Click TradingView Chart",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawSelectorClickOptions = {
        strategy: args.strategy,
        value: args.value,
        maxMatches: args.maxMatches ?? DEFAULT_RAW_FIND_MAX_MATCHES,
        button: args.button ?? "left",
        clickMethod: args.clickMethod ?? "mouse",
        ...endpointOptions(args)
      };

      if (args.matchIndex !== undefined) {
        rawOptions.matchIndex = args.matchIndex;
      }

      const result = await handlers.runRawSelectorClick(rawOptions);

      return textToolResult(
        `Raw selector click: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_selector_hover",
    {
      title: "Raw Selector Hover TradingView Chart",
      description: rawGuardrailedDescription(
        "Hover one visible TradingView UI element selected by text, aria-label, data-name, or CSS selector."
      ),
      inputSchema: rawSelectorHoverSchema,
      annotations: {
        title: "Raw Selector Hover TradingView Chart",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawSelectorHoverOptions = {
        strategy: args.strategy,
        value: args.value,
        maxMatches: args.maxMatches ?? DEFAULT_RAW_FIND_MAX_MATCHES,
        ...endpointOptions(args)
      };

      if (args.matchIndex !== undefined) {
        rawOptions.matchIndex = args.matchIndex;
      }

      const result = await handlers.runRawSelectorHover(rawOptions);

      return textToolResult(
        `Raw selector hover: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_scroll",
    {
      title: "Raw Scroll TradingView Chart",
      description: rawGuardrailedDescription(
        "Dispatch a bounded directional wheel scroll against the active local TradingView chart target."
      ),
      inputSchema: rawScrollSchema,
      annotations: {
        title: "Raw Scroll TradingView Chart",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawScrollOptions = {
        direction: args.direction,
        amount: args.amount ?? DEFAULT_RAW_SCROLL_AMOUNT,
        ...endpointOptions(args)
      };

      if (args.x !== undefined) {
        rawOptions.x = args.x;
      }

      if (args.y !== undefined) {
        rawOptions.y = args.y;
      }

      const result = await handlers.runRawScroll(rawOptions);

      return textToolResult(
        `Raw scroll: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_chart_state",
    {
      title: "Raw Read TradingView Chart State",
      description: rawGuardrailedDescription(
        "Read current symbol, timeframe, chart type, visible range, and visible studies when the chart API exposes them."
      ),
      inputSchema: rawChartStateSchema,
      annotations: {
        title: "Raw Read TradingView Chart State",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawChartStateOptions = endpointOptions(args);
      const result = await handlers.runRawChartState(rawOptions);

      return textToolResult(
        `Raw chart state: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_set_symbol",
    {
      title: "Raw Set TradingView Symbol",
      description: rawGuardrailedDescription(
        "Set the active chart to one exchange-qualified symbol and return before/after chart state."
      ),
      inputSchema: rawSetSymbolSchema,
      annotations: {
        title: "Raw Set TradingView Symbol",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawSetSymbolOptions = {
        symbol: args.symbol,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawSetSymbol(rawOptions);

      return textToolResult(
        `Raw set symbol: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_set_timeframe",
    {
      title: "Raw Set TradingView Timeframe",
      description: rawGuardrailedDescription(
        "Set the active chart timeframe/resolution and return before/after chart state."
      ),
      inputSchema: rawSetTimeframeSchema,
      annotations: {
        title: "Raw Set TradingView Timeframe",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawSetTimeframeOptions = {
        timeframe: args.timeframe,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawSetTimeframe(rawOptions);

      return textToolResult(
        `Raw set timeframe: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_set_chart_type",
    {
      title: "Raw Set TradingView Chart Type",
      description: rawGuardrailedDescription(
        "Set the active chart type when the chart API exposes setChartType and return before/after chart state."
      ),
      inputSchema: rawSetChartTypeSchema,
      annotations: {
        title: "Raw Set TradingView Chart Type",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawSetChartTypeOptions = {
        chartType: args.chartType,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawSetChartType(rawOptions);

      return textToolResult(
        `Raw set chart type: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_set_visible_range",
    {
      title: "Raw Set TradingView Visible Range",
      description: rawGuardrailedDescription(
        "Set the active chart visible Unix-time range and return before/after chart state."
      ),
      inputSchema: rawSetVisibleRangeSchema,
      annotations: {
        title: "Raw Set TradingView Visible Range",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawSetVisibleRangeOptions = {
        range: {
          from: args.from,
          to: args.to
        },
        ...endpointOptions(args)
      };
      const result = await handlers.runRawSetVisibleRange(rawOptions);

      return textToolResult(
        `Raw set visible range: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_add_indicator",
    {
      title: "Raw Add TradingView Indicator",
      description: rawGuardrailedDescription(
        "Add one named indicator through createStudy when exposed and return before/after chart state."
      ),
      inputSchema: rawAddIndicatorSchema,
      annotations: {
        title: "Raw Add TradingView Indicator",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawAddIndicatorOptions = {
        name: args.name,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawAddIndicator(rawOptions);

      return textToolResult(
        `Raw add indicator: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_remove_entity",
    {
      title: "Raw Remove TradingView Entity",
      description: rawGuardrailedDescription(
        "Remove one visible chart entity by id through removeEntity when exposed and return before/after chart state."
      ),
      inputSchema: rawRemoveEntitySchema,
      annotations: {
        title: "Raw Remove TradingView Entity",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawRemoveEntityOptions = {
        entityId: args.entityId,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawRemoveEntity(rawOptions);

      return textToolResult(
        `Raw remove entity: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_draw_shape",
    {
      title: "Draw Native TradingView Shape",
      description: rawGuardrailedDescription(
        "Create one supported native TradingView drawing shape from explicit price/time anchors when createShape or createMultipointShape is exposed."
      ),
      inputSchema: rawDrawShapeSchema,
      annotations: {
        title: "Draw Native TradingView Shape",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawDrawShapeOptions = {
        shapeType: args.shapeType,
        points: args.points,
        ...endpointOptions(args)
      };

      if (args.text) {
        rawOptions.text = args.text;
      }

      if (args.overrides) {
        rawOptions.overrides = args.overrides;
      }

      if (typeof args.lock === "boolean") {
        rawOptions.lock = args.lock;
      }

      if (typeof args.disableSelection === "boolean") {
        rawOptions.disableSelection = args.disableSelection;
      }

      const result = await handlers.runRawDrawShape(rawOptions);

      return textToolResult(
        `Draw native shape: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_draw_list",
    {
      title: "List Native TradingView Drawings",
      description: rawGuardrailedDescription(
        "List native TradingView drawing ids, names, and types when getAllShapes or an equivalent chart API is exposed."
      ),
      inputSchema: rawDrawListSchema,
      annotations: {
        title: "List Native TradingView Drawings",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawDrawListOptions = endpointOptions(args);
      const result = await handlers.runRawDrawList(rawOptions);

      return textToolResult(
        `List native drawings: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_draw_properties",
    {
      title: "Inspect Native TradingView Drawing",
      description: rawGuardrailedDescription(
        "Read one native drawing id's points, style/properties, visibility, lock, and selectability when getShapeById is exposed."
      ),
      inputSchema: rawDrawingPropertiesSchema,
      annotations: {
        title: "Inspect Native TradingView Drawing",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawDrawingPropertiesOptions = {
        entityId: args.entityId,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawDrawingProperties(rawOptions);

      return textToolResult(
        `Inspect native drawing: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_draw_remove",
    {
      title: "Remove Native TradingView Drawing",
      description: rawGuardrailedDescription(
        "Remove one native TradingView drawing by id through removeEntity when exposed."
      ),
      inputSchema: rawDrawRemoveSchema,
      annotations: {
        title: "Remove Native TradingView Drawing",
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawDrawRemoveOptions = {
        entityId: args.entityId,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawDrawRemove(rawOptions);

      return textToolResult(
        `Remove native drawing: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_draw_clear_all",
    {
      title: "Clear All Native TradingView Drawings",
      description: rawGuardrailedDescription(
        "Destructive: remove every native drawing on the active chart only when confirmClearAll is true; never call this unless the user explicitly asks to clear all drawings."
      ),
      inputSchema: rawDrawClearAllSchema,
      annotations: {
        title: "Clear All Native TradingView Drawings",
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawDrawClearAllOptions = {
        confirmClearAll: args.confirmClearAll,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawDrawClearAll(rawOptions);

      return textToolResult(
        `Clear all native drawings: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );
}
