import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  asToolData,
  endpointOptions,
  endpointShape,
  exchangeQualifiedSymbol,
  nonEmptyString,
  rawGuardrailedDescription,
  textToolResult
} from "./raw-common.js";
import {
  RAW_BATCH_MAX_STEPS,
  RAW_LAYOUT_ID_MAX_CHARS,
  RAW_PANE_ID_MAX_CHARS,
  RAW_TARGET_ID_MAX_CHARS,
  type RawAutomationResult,
  type RawBatchChartOptions,
  type RawFocusPaneOptions,
  type RawFocusTabOptions,
  type RawListLayoutsOptions,
  type RawListPanesOptions,
  type RawListTabsOptions,
  type RawSetPaneLayoutOptions,
  type RawSwitchLayoutOptions
} from "../tradingview/raw-automation.js";

export interface RawWorkspaceMcpToolHandlers {
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
}

const rawListTabsSchema = z.object(endpointShape);

const rawFocusTabSchema = z.object({
  ...endpointShape,
  targetId: nonEmptyString
    .max(RAW_TARGET_ID_MAX_CHARS)
    .describe("CDP target id from tradingview_raw_list_tabs.")
});

const rawListPanesSchema = z.object(endpointShape);

const rawFocusPaneSchema = z.object({
  ...endpointShape,
  paneId: nonEmptyString
    .max(RAW_PANE_ID_MAX_CHARS)
    .describe("Pane id returned by tradingview_raw_list_panes.")
});

const rawSetPaneLayoutSchema = z.object({
  ...endpointShape,
  layout: z
    .enum(["single", "two-vertical", "two-horizontal", "three-vertical", "four-grid"])
    .describe("Common TradingView pane layout to apply when the chart API exposes layout controls.")
});

const rawListLayoutsSchema = z.object(endpointShape);

const rawSwitchLayoutSchema = z.object({
  ...endpointShape,
  layoutId: nonEmptyString
    .max(RAW_LAYOUT_ID_MAX_CHARS)
    .describe("Saved layout id returned by tradingview_raw_list_layouts.")
});

const rawBatchChartStepSchema = z
  .object({
    symbol: exchangeQualifiedSymbol.optional(),
    timeframe: nonEmptyString
      .max(32)
      .regex(/^[A-Za-z0-9]+$/, "Timeframe must contain only letters and numbers.")
      .optional()
  })
  .refine((value) => value.symbol !== undefined || value.timeframe !== undefined, {
    message: "Each batch step must include a symbol, timeframe, or both."
  });

const rawBatchChartSchema = z.object({
  ...endpointShape,
  steps: z
    .array(rawBatchChartStepSchema)
    .min(1)
    .max(RAW_BATCH_MAX_STEPS)
    .describe(
      `Explicit ordered chart actions. No scanning, ranking, or candidate generation; maximum ${RAW_BATCH_MAX_STEPS} steps.`
    ),
  stopOnError: z.boolean().optional()
});

export function registerRawWorkspaceMcpTools(
  server: McpServer,
  handlers: RawWorkspaceMcpToolHandlers
): void {
  server.registerTool(
    "tradingview_raw_list_tabs",
    {
      title: "Raw List TradingView Chart Tabs",
      description: rawGuardrailedDescription(
        "List active local TradingView chart targets exposed by CDP so a user can choose a chart tab explicitly."
      ),
      inputSchema: rawListTabsSchema,
      annotations: {
        title: "Raw List TradingView Chart Tabs",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawListTabsOptions = endpointOptions(args);
      const result = await handlers.runRawListTabs(rawOptions);

      return textToolResult(
        `Raw list tabs: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_focus_tab",
    {
      title: "Raw Focus TradingView Chart Tab",
      description: rawGuardrailedDescription(
        "Bring one selected local TradingView chart target to the front by CDP target id."
      ),
      inputSchema: rawFocusTabSchema,
      annotations: {
        title: "Raw Focus TradingView Chart Tab",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawFocusTabOptions = {
        targetId: args.targetId,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawFocusTab(rawOptions);

      return textToolResult(
        `Raw focus tab: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_list_panes",
    {
      title: "Raw List TradingView Panes",
      description: rawGuardrailedDescription(
        "List chart panes on the active local TradingView chart target when the chart API exposes pane identifiers."
      ),
      inputSchema: rawListPanesSchema,
      annotations: {
        title: "Raw List TradingView Panes",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawListPanesOptions = endpointOptions(args);
      const result = await handlers.runRawListPanes(rawOptions);

      return textToolResult(
        `Raw list panes: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_focus_pane",
    {
      title: "Raw Focus TradingView Pane",
      description: rawGuardrailedDescription(
        "Focus one chart pane by explicit pane id when TradingView exposes pane focus methods."
      ),
      inputSchema: rawFocusPaneSchema,
      annotations: {
        title: "Raw Focus TradingView Pane",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawFocusPaneOptions = {
        paneId: args.paneId,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawFocusPane(rawOptions);

      return textToolResult(
        `Raw focus pane: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_set_pane_layout",
    {
      title: "Raw Set TradingView Pane Layout",
      description: rawGuardrailedDescription(
        "Set a common chart pane layout only when TradingView exposes pane layout controls."
      ),
      inputSchema: rawSetPaneLayoutSchema,
      annotations: {
        title: "Raw Set TradingView Pane Layout",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawSetPaneLayoutOptions = {
        layout: args.layout,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawSetPaneLayout(rawOptions);

      return textToolResult(
        `Raw set pane layout: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_list_layouts",
    {
      title: "Raw List TradingView Layouts",
      description: rawGuardrailedDescription(
        "List saved TradingView layouts only when the active chart/widget API exposes saved layout identifiers."
      ),
      inputSchema: rawListLayoutsSchema,
      annotations: {
        title: "Raw List TradingView Layouts",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawListLayoutsOptions = endpointOptions(args);
      const result = await handlers.runRawListLayouts(rawOptions);

      return textToolResult(
        `Raw list layouts: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_switch_layout",
    {
      title: "Raw Switch TradingView Layout",
      description: rawGuardrailedDescription(
        "Switch to one saved TradingView layout by explicit layout id only when TradingView exposes a layout switch API."
      ),
      inputSchema: rawSwitchLayoutSchema,
      annotations: {
        title: "Raw Switch TradingView Layout",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawSwitchLayoutOptions = {
        layoutId: args.layoutId,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawSwitchLayout(rawOptions);

      return textToolResult(
        `Raw switch layout: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_batch_chart",
    {
      title: "Raw Batch Chart Actions",
      description: rawGuardrailedDescription(
        "Apply bounded explicit symbol/timeframe chart actions in caller-provided order only; never scans, ranks, scores, recommends, alerts, or generates candidates."
      ),
      inputSchema: rawBatchChartSchema,
      annotations: {
        title: "Raw Batch Chart Actions",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const steps = args.steps.map((step) => {
        const nextStep: { symbol?: string; timeframe?: string } = {};

        if (step.symbol !== undefined) {
          nextStep.symbol = step.symbol;
        }

        if (step.timeframe !== undefined) {
          nextStep.timeframe = step.timeframe;
        }

        return nextStep;
      });
      const rawOptions: RawBatchChartOptions = {
        steps,
        stopOnError: args.stopOnError ?? false,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawBatchChart(rawOptions);

      return textToolResult(
        `Raw batch chart: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );
}
