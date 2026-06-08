import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  asToolData,
  endpointOptions,
  endpointShape,
  nonEmptyString,
  nonNegativeNumber,
  positiveInteger,
  rawGuardrailedDescription,
  textToolResult
} from "./raw-common.js";
import {
  DEFAULT_RAW_EVALUATE_MAX_RESULT_BYTES,
  DEFAULT_RAW_FIND_MAX_MATCHES,
  DEFAULT_RAW_SCROLL_AMOUNT,
  RAW_FIND_MAX_MATCHES_LIMIT,
  RAW_SCROLL_MAX_AMOUNT,
  RAW_SELECTOR_MAX_CHARS,
  type RawAutomationResult,
  type RawClickOptions,
  type RawEvaluateOptions,
  type RawFindElementOptions,
  type RawKeypressOptions,
  type RawScrollOptions,
  type RawSelectorClickOptions,
  type RawSelectorHoverOptions,
  type RawTypeTextOptions
} from "../tradingview/raw-automation.js";

export interface RawInputMcpToolHandlers {
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
}

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

export function registerRawInputMcpTools(
  server: McpServer,
  handlers: RawInputMcpToolHandlers
): void {
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
}
