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
import { loadQuantScanHandoffInput } from "../chartbook/quant-scan-handoff.js";
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
  DRAWING_MACRO_SCHEMA_VERSION,
  DRAWING_MACRO_MAX_LEVELS,
  type DrawingMacroArtifact,
  type DrawingMacroLevel
} from "../tradingview/drawing-macros.js";
import {
  registerRawChartControlMcpTools,
  registerRawChartDataMcpTools
} from "./raw-chart-tools.js";
import { registerRawDrawingMcpTools } from "./raw-drawing-tools.js";
import { registerRawInputMcpTools } from "./raw-input-tools.js";
import { registerRawPineMcpTools } from "./raw-pine-tools.js";
import { registerRawReplayMcpTools } from "./raw-replay-tools.js";
import { registerRawWorkspaceMcpTools } from "./raw-workspace-tools.js";
import {
  type RawAddIndicatorOptions,
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
  type RawAutomationResult,
  type RawBatchChartOptions,
  type RawChartDataSummaryOptions,
  type RawChartStateOptions,
  type RawClickOptions,
  type RawDrawClearAllOptions,
  type RawDrawFibRetracementOptions,
  type RawDrawFibLevelsOptions,
  type RawDrawListOptions,
  type RawDrawProjectionOptions,
  type RawDrawRemoveOptions,
  type RawDrawShapeOptions,
  type RawDrawingPropertiesOptions,
  type RawFindElementOptions,
  type RawEvaluateOptions,
  type RawFocusPaneOptions,
  type RawFocusTabOptions,
  type RawKeypressOptions,
  type RawListLayoutsOptions,
  type RawListPanesOptions,
  type RawListTabsOptions,
  type RawPineCompileOptions,
  type RawPineGetConsoleOptions,
  type RawPineGetErrorsOptions,
  type RawPineGetSourceOptions,
  type RawPineOpenEditorOptions,
  type RawQuoteSnapshotOptions,
  type RawPineSaveOptions,
  type RawPineSetSourceOptions,
  type RawReplayExitOptions,
  type RawReplayOpenOptions,
  type RawReplayPlayPauseOptions,
  type RawReplaySetSpeedOptions,
  type RawReplayStepOptions,
  type RawRemoveEntityOptions,
  type RawScrollOptions,
  type RawSelectorClickOptions,
  type RawSelectorHoverOptions,
  type RawSetPaneLayoutOptions,
  type RawSetChartTypeOptions,
  type RawSetSymbolOptions,
  type RawSetTimeframeOptions,
  type RawSetVisibleRangeOptions,
  type RawStudyValuesOptions,
  type RawSwitchLayoutOptions,
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
  "tradingview_raw_chart_data_summary",
  "tradingview_raw_quote_snapshot",
  "tradingview_raw_study_values",
  "tradingview_raw_list_tabs",
  "tradingview_raw_focus_tab",
  "tradingview_raw_list_panes",
  "tradingview_raw_focus_pane",
  "tradingview_raw_set_pane_layout",
  "tradingview_raw_list_layouts",
  "tradingview_raw_switch_layout",
  "tradingview_raw_batch_chart",
  "tradingview_raw_replay_open",
  "tradingview_raw_replay_play_pause",
  "tradingview_raw_replay_step",
  "tradingview_raw_replay_set_speed",
  "tradingview_raw_replay_exit",
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
  "tradingview_draw_clear_all",
  "tradingview_draw_fib_retracement",
  "tradingview_draw_fib_levels",
  "tradingview_draw_projection",
  "tradingview_pine_open_editor",
  "tradingview_pine_set_source",
  "tradingview_pine_get_source",
  "tradingview_pine_get_errors",
  "tradingview_pine_get_console",
  "tradingview_pine_compile",
  "tradingview_pine_save"
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
  runRawChartDataSummary: (
    options: RawChartDataSummaryOptions
  ) => Promise<RawAutomationResult>;
  runRawQuoteSnapshot: (
    options: RawQuoteSnapshotOptions
  ) => Promise<RawAutomationResult>;
  runRawStudyValues: (
    options: RawStudyValuesOptions
  ) => Promise<RawAutomationResult>;
  runRawListTabs: (
    options: RawListTabsOptions
  ) => Promise<RawAutomationResult>;
  runRawFocusTab: (
    options: RawFocusTabOptions
  ) => Promise<RawAutomationResult>;
  runRawListPanes: (
    options: RawListPanesOptions
  ) => Promise<RawAutomationResult>;
  runRawFocusPane: (
    options: RawFocusPaneOptions
  ) => Promise<RawAutomationResult>;
  runRawSetPaneLayout: (
    options: RawSetPaneLayoutOptions
  ) => Promise<RawAutomationResult>;
  runRawListLayouts: (
    options: RawListLayoutsOptions
  ) => Promise<RawAutomationResult>;
  runRawSwitchLayout: (
    options: RawSwitchLayoutOptions
  ) => Promise<RawAutomationResult>;
  runRawBatchChart: (
    options: RawBatchChartOptions
  ) => Promise<RawAutomationResult>;
  runRawReplayOpen: (
    options: RawReplayOpenOptions
  ) => Promise<RawAutomationResult>;
  runRawReplayPlayPause: (
    options: RawReplayPlayPauseOptions
  ) => Promise<RawAutomationResult>;
  runRawReplayStep: (
    options: RawReplayStepOptions
  ) => Promise<RawAutomationResult>;
  runRawReplaySetSpeed: (
    options: RawReplaySetSpeedOptions
  ) => Promise<RawAutomationResult>;
  runRawReplayExit: (
    options: RawReplayExitOptions
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
  runRawDrawFibRetracement: (
    options: RawDrawFibRetracementOptions
  ) => Promise<RawAutomationResult>;
  runRawDrawFibLevels: (
    options: RawDrawFibLevelsOptions
  ) => Promise<RawAutomationResult>;
  runRawDrawProjection: (
    options: RawDrawProjectionOptions
  ) => Promise<RawAutomationResult>;
  runRawPineOpenEditor: (
    options: RawPineOpenEditorOptions
  ) => Promise<RawAutomationResult>;
  runRawPineSetSource: (
    options: RawPineSetSourceOptions
  ) => Promise<RawAutomationResult>;
  runRawPineGetSource: (
    options: RawPineGetSourceOptions
  ) => Promise<RawAutomationResult>;
  runRawPineGetErrors: (
    options: RawPineGetErrorsOptions
  ) => Promise<RawAutomationResult>;
  runRawPineGetConsole: (
    options: RawPineGetConsoleOptions
  ) => Promise<RawAutomationResult>;
  runRawPineCompile: (
    options: RawPineCompileOptions
  ) => Promise<RawAutomationResult>;
  runRawPineSave: (
    options: RawPineSaveOptions
  ) => Promise<RawAutomationResult>;
}

export interface RegisterTradingViewMcpToolsOptions {
  handlers?: Partial<TradingViewMcpToolHandlers>;
  env?: NodeJS.ProcessEnv;
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

const macroMetadataSchema = z
  .array(
    z.object({
      schemaVersion: z.literal(DRAWING_MACRO_SCHEMA_VERSION),
      kind: z.enum(["fib-levels", "projection"]),
      source: nonEmptyString.max(80),
      anchors: z.record(z.string(), z.unknown()),
      levels: z
        .array(
          z.object({
            label: nonEmptyString.max(120),
            price: z.number().positive().finite(),
            role: z.enum([
              "anchor",
              "retracement",
              "extension",
              "projection",
              "range-boundary"
            ]),
            source: z.enum(["explicit-anchors", "extracted-range"]),
            ratio: z.number().finite().optional(),
            multiplier: z.number().finite().optional()
          })
        )
        .max(DRAWING_MACRO_MAX_LEVELS * 3),
      drawingIds: z.array(nonEmptyString.max(200)).max(80),
      warnings: z.array(z.string().max(500)).max(20)
    })
  )
  .max(10)
  .optional()
  .describe(
    "Optional metadata returned by gated drawing macro tools; recorded in local artifacts for review context only."
  );

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
  captureId: nonEmptyString.optional(),
  macroMetadata: macroMetadataSchema
});

const chartbookSchema = z.object({
  ...endpointShape,
  ...chartOutputShape,
  ...universeSelectionShape,
  ...studyShape,
  outputDir: nonEmptyString.optional(),
  sessionId: nonEmptyString.optional(),
  preset: nonEmptyString.optional(),
  quantScanHandoffPath: nonEmptyString
    .optional()
    .describe(
      "Optional Quant Scan setup-scan handoff path: run directory, scan.json, or chartbook.universe.local.json. Charts explicit candidates in handoff order only."
    ),
  macroMetadata: macroMetadataSchema
});

type MacroMetadataArg = NonNullable<z.infer<typeof macroMetadataSchema>>[number];

function macroLevelFromArgs(level: MacroMetadataArg["levels"][number]): DrawingMacroLevel {
  const result: DrawingMacroLevel = {
    label: level.label,
    price: level.price,
    role: level.role,
    source: level.source
  };

  if (level.ratio !== undefined) {
    result.ratio = level.ratio;
  }

  if (level.multiplier !== undefined) {
    result.multiplier = level.multiplier;
  }

  return result;
}

function macroMetadataFromArgs(
  metadata: z.infer<typeof macroMetadataSchema>
): DrawingMacroArtifact[] | undefined {
  return metadata?.map((macro) => ({
    schemaVersion: macro.schemaVersion,
    kind: macro.kind,
    source: macro.source,
    anchors: macro.anchors,
    levels: macro.levels.map(macroLevelFromArgs),
    drawingIds: [...macro.drawingIds],
    warnings: [...macro.warnings]
  }));
}

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
    runRawChartDataSummary:
      handlers?.runRawChartDataSummary ?? runRawChartDataSummary,
    runRawQuoteSnapshot:
      handlers?.runRawQuoteSnapshot ?? runRawQuoteSnapshot,
    runRawStudyValues:
      handlers?.runRawStudyValues ?? runRawStudyValues,
    runRawListTabs: handlers?.runRawListTabs ?? runRawListTabs,
    runRawFocusTab: handlers?.runRawFocusTab ?? runRawFocusTab,
    runRawListPanes: handlers?.runRawListPanes ?? runRawListPanes,
    runRawFocusPane: handlers?.runRawFocusPane ?? runRawFocusPane,
    runRawSetPaneLayout:
      handlers?.runRawSetPaneLayout ?? runRawSetPaneLayout,
    runRawListLayouts: handlers?.runRawListLayouts ?? runRawListLayouts,
    runRawSwitchLayout:
      handlers?.runRawSwitchLayout ?? runRawSwitchLayout,
    runRawBatchChart: handlers?.runRawBatchChart ?? runRawBatchChart,
    runRawReplayOpen:
      handlers?.runRawReplayOpen ?? runRawReplayOpen,
    runRawReplayPlayPause:
      handlers?.runRawReplayPlayPause ?? runRawReplayPlayPause,
    runRawReplayStep:
      handlers?.runRawReplayStep ?? runRawReplayStep,
    runRawReplaySetSpeed:
      handlers?.runRawReplaySetSpeed ?? runRawReplaySetSpeed,
    runRawReplayExit:
      handlers?.runRawReplayExit ?? runRawReplayExit,
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
    runRawDrawClearAll: handlers?.runRawDrawClearAll ?? runRawDrawClearAll,
    runRawDrawFibRetracement:
      handlers?.runRawDrawFibRetracement ?? runRawDrawFibRetracement,
    runRawDrawFibLevels:
      handlers?.runRawDrawFibLevels ?? runRawDrawFibLevels,
    runRawDrawProjection:
      handlers?.runRawDrawProjection ?? runRawDrawProjection,
    runRawPineOpenEditor:
      handlers?.runRawPineOpenEditor ?? runRawPineOpenEditor,
    runRawPineSetSource:
      handlers?.runRawPineSetSource ?? runRawPineSetSource,
    runRawPineGetSource:
      handlers?.runRawPineGetSource ?? runRawPineGetSource,
    runRawPineGetErrors:
      handlers?.runRawPineGetErrors ?? runRawPineGetErrors,
    runRawPineGetConsole:
      handlers?.runRawPineGetConsole ?? runRawPineGetConsole,
    runRawPineCompile:
      handlers?.runRawPineCompile ?? runRawPineCompile,
    runRawPineSave:
      handlers?.runRawPineSave ?? runRawPineSave
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

      const macroMetadata = macroMetadataFromArgs(args.macroMetadata);
      if (macroMetadata) {
        captureOptions.macroMetadata = macroMetadata;
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
      const handoff = args.quantScanHandoffPath
        ? await loadQuantScanHandoffInput(args.quantScanHandoffPath)
        : undefined;
      const universe = handoff ? undefined : await resolveUniverse(handlers, args);
      const chartbookOptions: RunChartbookOptions = {
        symbols: handoff?.symbols ?? universe?.symbols ?? [],
        ...endpointOptions(args),
        ...chartOutputOptions(args),
        preset: args.preset ?? DEFAULT_CHARTBOOK_PRESET,
        selection:
          handoff?.selection ??
          chartbookSelectionSummary(
            universe?.configPath ?? DEFAULT_UNIVERSE_CONFIG_PATH,
            args
          ),
        studyName: args.studyName ?? DEFAULT_PINE_DRAWING_STUDY_NAME,
        debug: args.debug ?? false
      };

      if (args.profile) {
        chartbookOptions.profile = args.profile;
      } else if (handoff?.profile) {
        chartbookOptions.profile = handoff.profile;
      }

      if (args.sessionId) {
        chartbookOptions.sessionId = args.sessionId;
      }

      const macroMetadata = macroMetadataFromArgs(args.macroMetadata);
      if (macroMetadata) {
        chartbookOptions.macroMetadata = macroMetadata;
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

  registerRawInputMcpTools(server, handlers);
  registerRawChartDataMcpTools(server, handlers);
  registerRawWorkspaceMcpTools(server, handlers);
  registerRawReplayMcpTools(server, handlers);
  registerRawChartControlMcpTools(server, handlers);
  registerRawDrawingMcpTools(server, handlers);
  registerRawPineMcpTools(server, handlers);
}
