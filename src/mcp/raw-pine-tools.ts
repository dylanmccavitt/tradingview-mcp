import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS
} from "../tradingview/desktop.js";
import {
  DEFAULT_RAW_PINE_COMPILE_SETTLE_MS,
  DEFAULT_RAW_PINE_GET_SOURCE_MAX_CHARS,
  DEFAULT_RAW_PINE_SAVE_SETTLE_MS,
  RAW_AUTOMATION_ENV,
  RAW_PINE_ACTION_SETTLE_MS_LIMIT,
  RAW_PINE_GET_SOURCE_MAX_CHARS_LIMIT,
  RAW_PINE_SOURCE_MAX_CHARS,
  type RawAutomationResult,
  type RawPineCompileOptions,
  type RawPineGetConsoleOptions,
  type RawPineGetErrorsOptions,
  type RawPineGetSourceOptions,
  type RawPineOpenEditorOptions,
  type RawPineSaveOptions,
  type RawPineSetSourceOptions
} from "../tradingview/raw-automation.js";

type ToolResultData = Record<string, unknown>;

export interface RawPineMcpToolHandlers {
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

const positiveInteger = z.number().int().positive();
const nonEmptyString = z.string().trim().min(1);

const endpointShape = {
  host: nonEmptyString.optional(),
  port: positiveInteger.optional(),
  timeoutMs: positiveInteger.optional(),
  appPath: nonEmptyString.optional()
};

const rawPineOpenEditorSchema = z.object(endpointShape);

const rawPineSetSourceSchema = z.object({
  ...endpointShape,
  source: z
    .string()
    .min(1)
    .max(RAW_PINE_SOURCE_MAX_CHARS)
    .describe(
      "Pine Script source to set in the active local TradingView Pine Editor. This does not compile or save."
    )
});

const rawPineGetSourceSchema = z.object({
  ...endpointShape,
  maxSourceChars: positiveInteger
    .max(RAW_PINE_GET_SOURCE_MAX_CHARS_LIMIT)
    .optional()
    .describe(
      `Maximum source characters to return. Defaults to ${DEFAULT_RAW_PINE_GET_SOURCE_MAX_CHARS}; large scripts are truncated with a warning.`
    )
});

const rawPineGetErrorsSchema = z.object(endpointShape);
const rawPineGetConsoleSchema = z.object(endpointShape);

const rawPineCompileSchema = z.object({
  ...endpointShape,
  settleMs: z
    .number()
    .int()
    .min(0)
    .max(RAW_PINE_ACTION_SETTLE_MS_LIMIT)
    .optional()
    .describe(
      `Milliseconds to wait after clicking compile/add/update before reading markers. Defaults to ${DEFAULT_RAW_PINE_COMPILE_SETTLE_MS}.`
    )
});

const rawPineSaveSchema = z.object({
  ...endpointShape,
  settleMs: z
    .number()
    .int()
    .min(0)
    .max(RAW_PINE_ACTION_SETTLE_MS_LIMIT)
    .optional()
    .describe(
      `Milliseconds to wait after the explicit save action. Defaults to ${DEFAULT_RAW_PINE_SAVE_SETTLE_MS}.`
    )
});

function endpointOptions(args: {
  host?: string | undefined;
  port?: number | undefined;
  timeoutMs?: number | undefined;
  appPath?: string | undefined;
}): {
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

function rawGuardrailedDescription(action: string): string {
  return `${action} Experimental local TradingView raw control for the active chart target only. Requires ${RAW_AUTOMATION_ENV}=1. Charting-only: no scanner/ranking behavior, no financial advice, no broker/order actions, no unattended candidates, and no TradingView account/security automation.`;
}

export function registerRawPineMcpTools(
  server: McpServer,
  handlers: RawPineMcpToolHandlers
): void {
  server.registerTool(
    "tradingview_pine_open_editor",
    {
      title: "Open TradingView Pine Editor",
      description: rawGuardrailedDescription(
        "Open or focus the Pine Editor panel in the active local TradingView chart target."
      ),
      inputSchema: rawPineOpenEditorSchema,
      annotations: {
        title: "Open TradingView Pine Editor",
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawPineOpenEditorOptions = endpointOptions(args);
      const result = await handlers.runRawPineOpenEditor(rawOptions);

      return textToolResult(
        `Open Pine Editor: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_pine_set_source",
    {
      title: "Set TradingView Pine Source",
      description: rawGuardrailedDescription(
        "Set bounded Pine source in the active Pine Editor only; this does not compile, save, or add the script to the chart."
      ),
      inputSchema: rawPineSetSourceSchema,
      annotations: {
        title: "Set TradingView Pine Source",
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawPineSetSourceOptions = {
        source: args.source,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawPineSetSource(rawOptions);

      return textToolResult(
        `Set Pine source: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_pine_get_source",
    {
      title: "Get TradingView Pine Source",
      description: rawGuardrailedDescription(
        "Read the current Pine Editor source with bounded output; large scripts are truncated unless maxSourceChars is raised intentionally."
      ),
      inputSchema: rawPineGetSourceSchema,
      annotations: {
        title: "Get TradingView Pine Source",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawPineGetSourceOptions = {
        maxSourceChars:
          args.maxSourceChars ?? DEFAULT_RAW_PINE_GET_SOURCE_MAX_CHARS,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawPineGetSource(rawOptions);

      return textToolResult(
        `Get Pine source: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_pine_get_errors",
    {
      title: "Get TradingView Pine Errors",
      description: rawGuardrailedDescription(
        "Read compact Monaco compile markers from the active Pine Editor without compiling or saving."
      ),
      inputSchema: rawPineGetErrorsSchema,
      annotations: {
        title: "Get TradingView Pine Errors",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawPineGetErrorsOptions = endpointOptions(args);
      const result = await handlers.runRawPineGetErrors(rawOptions);

      return textToolResult(
        `Get Pine errors: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_pine_get_console",
    {
      title: "Get TradingView Pine Console",
      description: rawGuardrailedDescription(
        "Read compact Pine console or output rows from the active Pine Editor without compiling or saving."
      ),
      inputSchema: rawPineGetConsoleSchema,
      annotations: {
        title: "Get TradingView Pine Console",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawPineGetConsoleOptions = endpointOptions(args);
      const result = await handlers.runRawPineGetConsole(rawOptions);

      return textToolResult(
        `Get Pine console: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_pine_compile",
    {
      title: "Compile TradingView Pine Source",
      description: rawGuardrailedDescription(
        "Explicitly click the Pine Editor compile/add/update control, wait briefly, and return compact compile markers."
      ),
      inputSchema: rawPineCompileSchema,
      annotations: {
        title: "Compile TradingView Pine Source",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawPineCompileOptions = {
        settleMs: args.settleMs ?? DEFAULT_RAW_PINE_COMPILE_SETTLE_MS,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawPineCompile(rawOptions);

      return textToolResult(
        `Compile Pine source: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_pine_save",
    {
      title: "Save TradingView Pine Source",
      description: rawGuardrailedDescription(
        "Explicitly save the current Pine Editor source; this is separate from setting source and compiling."
      ),
      inputSchema: rawPineSaveSchema,
      annotations: {
        title: "Save TradingView Pine Source",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawPineSaveOptions = {
        settleMs: args.settleMs ?? DEFAULT_RAW_PINE_SAVE_SETTLE_MS,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawPineSave(rawOptions);

      return textToolResult(
        `Save Pine source: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );
}
