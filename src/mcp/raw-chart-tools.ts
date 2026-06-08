import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  asToolData,
  endpointOptions,
  endpointShape,
  exchangeQualifiedSymbol,
  nonEmptyString,
  positiveInteger,
  rawGuardrailedDescription,
  textToolResult
} from "./raw-common.js";
import {
  DEFAULT_RAW_CHART_DATA_BAR_COUNT,
  DEFAULT_RAW_STUDY_VALUES_MAX_STUDIES,
  DEFAULT_RAW_STUDY_VALUES_MAX_VALUES,
  RAW_CHART_DATA_BAR_COUNT_LIMIT,
  RAW_STUDY_VALUES_MAX_STUDIES_LIMIT,
  RAW_STUDY_VALUES_MAX_VALUES_LIMIT,
  type RawAddIndicatorOptions,
  type RawAutomationResult,
  type RawChartDataSummaryOptions,
  type RawChartStateOptions,
  type RawQuoteSnapshotOptions,
  type RawRemoveEntityOptions,
  type RawSetChartTypeOptions,
  type RawSetSymbolOptions,
  type RawSetTimeframeOptions,
  type RawSetVisibleRangeOptions,
  type RawStudyValuesOptions
} from "../tradingview/raw-automation.js";

export interface RawChartMcpToolHandlers {
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
}

const rawChartStateSchema = z.object(endpointShape);

const rawChartDataSummarySchema = z.object({
  ...endpointShape,
  barCount: positiveInteger
    .max(RAW_CHART_DATA_BAR_COUNT_LIMIT)
    .optional()
    .describe(
      `Recent bar count to summarize. Defaults to ${DEFAULT_RAW_CHART_DATA_BAR_COUNT}; maximum is ${RAW_CHART_DATA_BAR_COUNT_LIMIT}.`
    )
});

const rawQuoteSnapshotSchema = z.object(endpointShape);

const rawStudyValuesSchema = z.object({
  ...endpointShape,
  studyName: nonEmptyString
    .max(120)
    .optional()
    .describe("Optional visible study name substring filter."),
  maxStudies: positiveInteger
    .max(RAW_STUDY_VALUES_MAX_STUDIES_LIMIT)
    .optional()
    .describe(
      `Maximum visible studies to return. Defaults to ${DEFAULT_RAW_STUDY_VALUES_MAX_STUDIES}; maximum is ${RAW_STUDY_VALUES_MAX_STUDIES_LIMIT}.`
    ),
  maxValuesPerStudy: positiveInteger
    .max(RAW_STUDY_VALUES_MAX_VALUES_LIMIT)
    .optional()
    .describe(
      `Maximum compact values per study. Defaults to ${DEFAULT_RAW_STUDY_VALUES_MAX_VALUES}; maximum is ${RAW_STUDY_VALUES_MAX_VALUES_LIMIT}.`
    )
});

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

export function registerRawChartDataMcpTools(
  server: McpServer,
  handlers: RawChartMcpToolHandlers
): void {
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
    "tradingview_raw_chart_data_summary",
    {
      title: "Raw Read TradingView Chart Data Summary",
      description: rawGuardrailedDescription(
        "Read compact OHLCV summary stats for a bounded recent bar count when the active chart API exposes bars; output is review context only, not a scan, ranking, alert, or recommendation."
      ),
      inputSchema: rawChartDataSummarySchema,
      annotations: {
        title: "Raw Read TradingView Chart Data Summary",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawChartDataSummaryOptions = {
        barCount: args.barCount ?? DEFAULT_RAW_CHART_DATA_BAR_COUNT,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawChartDataSummary(rawOptions);

      return textToolResult(
        `Raw chart data summary: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_quote_snapshot",
    {
      title: "Raw Read TradingView Quote Snapshot",
      description: rawGuardrailedDescription(
        "Read the active chart symbol and latest exposed OHLCV/current-bar snapshot; output is review context only, not market-data service output, a scan, alert, ranking, or recommendation."
      ),
      inputSchema: rawQuoteSnapshotSchema,
      annotations: {
        title: "Raw Read TradingView Quote Snapshot",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawQuoteSnapshotOptions = endpointOptions(args);
      const result = await handlers.runRawQuoteSnapshot(rawOptions);

      return textToolResult(
        `Raw quote snapshot: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_study_values",
    {
      title: "Raw Read TradingView Study Values",
      description: rawGuardrailedDescription(
        "Read compact visible indicator/study values from the active chart when TradingView exposes them; output is review context only, not a scan, ranking, alert, generated candidate, or recommendation."
      ),
      inputSchema: rawStudyValuesSchema,
      annotations: {
        title: "Raw Read TradingView Study Values",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawStudyValuesOptions = {
        maxStudies: args.maxStudies ?? DEFAULT_RAW_STUDY_VALUES_MAX_STUDIES,
        maxValuesPerStudy:
          args.maxValuesPerStudy ?? DEFAULT_RAW_STUDY_VALUES_MAX_VALUES,
        ...endpointOptions(args)
      };

      if (args.studyName) {
        rawOptions.studyName = args.studyName;
      }

      const result = await handlers.runRawStudyValues(rawOptions);

      return textToolResult(
        `Raw study values: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );
}

export function registerRawChartControlMcpTools(
  server: McpServer,
  handlers: RawChartMcpToolHandlers
): void {
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
}
