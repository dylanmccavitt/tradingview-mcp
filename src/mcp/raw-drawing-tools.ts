import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  DEFAULT_RANGE_PROJECTION_MULTIPLIERS,
  DRAWING_MACRO_MAX_LEVELS,
  DRAWING_MACRO_MAX_RATIO,
  type DrawingMacroPoint,
  type DrawingMacroRange
} from "../tradingview/drawing-macros.js";
import {
  DEFAULT_DRAWING_PRESET,
  DRAWING_PRESET_NAMES
} from "../tradingview/drawing-presets.js";
import {
  asToolData,
  endpointOptions,
  endpointShape,
  nonEmptyString,
  rawGuardrailedDescription,
  textToolResult
} from "./raw-common.js";
import {
  RAW_DRAWING_MAX_OVERRIDES,
  RAW_DRAWING_TEXT_MAX_CHARS,
  type RawAutomationResult,
  type RawDrawClearAllOptions,
  type RawDrawFibLevelsOptions,
  type RawDrawFibRetracementOptions,
  type RawDrawListOptions,
  type RawDrawProjectionOptions,
  type RawDrawRemoveOptions,
  type RawDrawShapeOptions,
  type RawDrawingPropertiesOptions
} from "../tradingview/raw-automation.js";

export interface RawDrawingMcpToolHandlers {
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
}

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

const rawDrawingPreset = z
  .enum(DRAWING_PRESET_NAMES)
  .optional()
  .describe(
    `Optional visual preset for native drawings. Defaults to ${DEFAULT_DRAWING_PRESET}; presets keep lines at 1px and shaded areas low opacity.`
  );

const rawDrawShapeSchema = z
  .object({
    ...endpointShape,
    shapeType: z
      .enum(["horizontal-line", "trend-line", "rectangle", "text"])
      .describe("Supported native TradingView drawing shape."),
    points: z.array(rawDrawingPoint).min(1).max(2),
    text: nonEmptyString.max(RAW_DRAWING_TEXT_MAX_CHARS).optional(),
    drawingPreset: rawDrawingPreset,
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

const rawMacroPoint = rawDrawingPoint.extend({
  label: nonEmptyString.max(120).optional()
});

const rawMacroRatios = z
  .array(z.number().finite().min(0).max(DRAWING_MACRO_MAX_RATIO))
  .min(1)
  .max(DRAWING_MACRO_MAX_LEVELS)
  .optional();

const rawDrawFibLevelsSchema = z
  .object({
    ...endpointShape,
    high: rawMacroPoint.describe("Explicit high price/time anchor."),
    low: rawMacroPoint.describe("Explicit low price/time anchor."),
    direction: z.enum(["low-to-high", "high-to-low"]).optional(),
    ratios: rawMacroRatios.describe(
      "Optional Fib-style ratios. Defaults include retracement and extension levels."
    ),
    labelPrefix: nonEmptyString.max(80).optional(),
    includeAnchorLine: z.boolean().optional(),
    drawingPreset: rawDrawingPreset,
    overrides: rawDrawingOverrides.optional(),
    anchorOverrides: rawDrawingOverrides.optional(),
    lock: z.boolean().optional(),
    disableSelection: z.boolean().optional()
  })
  .refine((value) => value.high.price > value.low.price, {
    message: "High anchor price must be greater than low anchor price.",
    path: ["high", "price"]
  });

const rawDrawFibRetracementSchema = z
  .object({
    ...endpointShape,
    high: rawMacroPoint.describe("Explicit high price/time anchor."),
    low: rawMacroPoint.describe("Explicit low price/time anchor."),
    direction: z.enum(["low-to-high", "high-to-low"]).optional(),
    ratios: rawMacroRatios.describe(
      "Optional Fib ratios to echo in compact review metadata. Defaults match the line-based Fib fallback."
    ),
    drawingPreset: rawDrawingPreset,
    overrides: rawDrawingOverrides.optional(),
    lock: z.boolean().optional(),
    disableSelection: z.boolean().optional()
  })
  .refine((value) => value.high.price > value.low.price, {
    message: "High anchor price must be greater than low anchor price.",
    path: ["high", "price"]
  });

const rawDrawProjectionSchema = z
  .object({
    ...endpointShape,
    mode: z.enum(["measured-move", "range-projection"]),
    base: rawMacroPoint.describe(
      "Projection base price/time anchor. For range projections, the time anchors the horizontal projection drawings."
    ),
    start: rawMacroPoint.optional(),
    end: rawMacroPoint.optional(),
    range: z
      .object({
        high: z.number().positive().finite(),
        low: z.number().positive().finite(),
        source: nonEmptyString.max(80).optional(),
        label: nonEmptyString.max(120).optional(),
        startTime: z.number().int().nonnegative().optional(),
        endTime: z.number().int().nonnegative().optional()
      })
      .optional(),
    direction: z.enum(["up", "down", "both"]).optional(),
    multipliers: z
      .array(z.number().finite().min(0).max(DRAWING_MACRO_MAX_RATIO))
      .min(1)
      .max(DRAWING_MACRO_MAX_LEVELS)
      .optional(),
    labelPrefix: nonEmptyString.max(80).optional(),
    includeAnchorLine: z.boolean().optional(),
    includeRangeBox: z.boolean().optional(),
    drawingPreset: rawDrawingPreset,
    overrides: rawDrawingOverrides.optional(),
    anchorOverrides: rawDrawingOverrides.optional(),
    lock: z.boolean().optional(),
    disableSelection: z.boolean().optional()
  })
  .superRefine((value, context) => {
    if (value.mode === "measured-move") {
      if (!value.start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Measured move projections require start.",
          path: ["start"]
        });
      }

      if (!value.end) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Measured move projections require end.",
          path: ["end"]
        });
      }

      if (value.start && value.end && value.start.price === value.end.price) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Measured move start and end prices must be different.",
          path: ["end", "price"]
        });
      }
      return;
    }

    if (!value.range) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Range projections require range.",
        path: ["range"]
      });
      return;
    }

    if (value.range.high <= value.range.low) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Range high must be greater than range low.",
        path: ["range", "high"]
      });
    }

    if (value.multipliers) {
      const invalidMultiplier = value.multipliers.find(
        (multiplier) => multiplier <= 0
      );
      if (invalidMultiplier !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Range projection multipliers must be positive.",
          path: ["multipliers"]
        });
      }
    }

    const direction = value.direction ?? "both";
    const directionCount = direction === "both" ? 2 : 1;
    const uniqueMultipliers = [
      ...new Set(value.multipliers ?? DEFAULT_RANGE_PROJECTION_MULTIPLIERS)
    ];
    const emittedLevels = 2 + uniqueMultipliers.length * directionCount;
    if (emittedLevels > DRAWING_MACRO_MAX_LEVELS) {
      const maxMultipliers = Math.floor(
        (DRAWING_MACRO_MAX_LEVELS - 2) / directionCount
      );
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Range projection emits ${emittedLevels} levels; use ${maxMultipliers} multiplier${maxMultipliers === 1 ? "" : "s"} or fewer for direction ${direction}.`,
        path: ["multipliers"]
      });
    }
  });

type MacroPointArg = z.infer<typeof rawMacroPoint>;
type MacroRangeArg = NonNullable<
  z.infer<typeof rawDrawProjectionSchema>["range"]
>;

function macroPointFromArgs(point: MacroPointArg): DrawingMacroPoint {
  const result: DrawingMacroPoint = {
    time: point.time,
    price: point.price
  };

  if (point.label) {
    result.label = point.label;
  }

  return result;
}

function macroRangeFromArgs(range: MacroRangeArg): DrawingMacroRange {
  const result: DrawingMacroRange = {
    high: range.high,
    low: range.low
  };

  if (range.source) {
    result.source = range.source;
  }

  if (range.label) {
    result.label = range.label;
  }

  if (range.startTime !== undefined) {
    result.startTime = range.startTime;
  }

  if (range.endTime !== undefined) {
    result.endTime = range.endTime;
  }

  return result;
}

export function registerRawDrawingMcpTools(
  server: McpServer,
  handlers: RawDrawingMcpToolHandlers
): void {
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

      if (args.drawingPreset) {
        rawOptions.drawingPreset = args.drawingPreset;
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

  server.registerTool(
    "tradingview_draw_fib_retracement",
    {
      title: "Draw Native Fib Retracement",
      description: rawGuardrailedDescription(
        "Create one native TradingView fib_retracement drawing object from explicit low/high price-time anchors when createMultipointShape is exposed."
      ),
      inputSchema: rawDrawFibRetracementSchema,
      annotations: {
        title: "Draw Native Fib Retracement",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawDrawFibRetracementOptions = {
        high: macroPointFromArgs(args.high),
        low: macroPointFromArgs(args.low),
        ...endpointOptions(args)
      };

      if (args.direction) {
        rawOptions.direction = args.direction;
      }

      if (args.ratios) {
        rawOptions.ratios = args.ratios;
      }

      if (args.drawingPreset) {
        rawOptions.drawingPreset = args.drawingPreset;
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

      const result = await handlers.runRawDrawFibRetracement(rawOptions);

      return textToolResult(
        `Draw native Fib Retracement: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_draw_fib_levels",
    {
      title: "Draw Fib Levels",
      description: rawGuardrailedDescription(
        "Create Fib-style retracement and extension review levels from explicit high/low price-time anchors using native TradingView drawings."
      ),
      inputSchema: rawDrawFibLevelsSchema,
      annotations: {
        title: "Draw Fib Levels",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawDrawFibLevelsOptions = {
        high: macroPointFromArgs(args.high),
        low: macroPointFromArgs(args.low),
        ...endpointOptions(args)
      };

      if (args.direction) {
        rawOptions.direction = args.direction;
      }

      if (args.ratios) {
        rawOptions.ratios = args.ratios;
      }

      if (args.labelPrefix) {
        rawOptions.labelPrefix = args.labelPrefix;
      }

      if (typeof args.includeAnchorLine === "boolean") {
        rawOptions.includeAnchorLine = args.includeAnchorLine;
      }

      if (args.drawingPreset) {
        rawOptions.drawingPreset = args.drawingPreset;
      }

      if (args.overrides) {
        rawOptions.overrides = args.overrides;
      }

      if (args.anchorOverrides) {
        rawOptions.anchorOverrides = args.anchorOverrides;
      }

      if (typeof args.lock === "boolean") {
        rawOptions.lock = args.lock;
      }

      if (typeof args.disableSelection === "boolean") {
        rawOptions.disableSelection = args.disableSelection;
      }

      const result = await handlers.runRawDrawFibLevels(rawOptions);

      return textToolResult(
        `Draw Fib levels: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_draw_projection",
    {
      title: "Draw Projection Levels",
      description: rawGuardrailedDescription(
        "Create measured-move or range-projection review levels from explicit anchors or a caller-selected extracted range using native TradingView drawings."
      ),
      inputSchema: rawDrawProjectionSchema,
      annotations: {
        title: "Draw Projection Levels",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawDrawProjectionOptions = {
        mode: args.mode,
        base: macroPointFromArgs(args.base),
        ...endpointOptions(args)
      };

      if (args.start) {
        rawOptions.start = macroPointFromArgs(args.start);
      }

      if (args.end) {
        rawOptions.end = macroPointFromArgs(args.end);
      }

      if (args.range) {
        rawOptions.range = macroRangeFromArgs(args.range);
      }

      if (args.direction) {
        rawOptions.direction = args.direction;
      }

      if (args.multipliers) {
        rawOptions.multipliers = args.multipliers;
      }

      if (args.labelPrefix) {
        rawOptions.labelPrefix = args.labelPrefix;
      }

      if (typeof args.includeAnchorLine === "boolean") {
        rawOptions.includeAnchorLine = args.includeAnchorLine;
      }

      if (typeof args.includeRangeBox === "boolean") {
        rawOptions.includeRangeBox = args.includeRangeBox;
      }

      if (args.drawingPreset) {
        rawOptions.drawingPreset = args.drawingPreset;
      }

      if (args.overrides) {
        rawOptions.overrides = args.overrides;
      }

      if (args.anchorOverrides) {
        rawOptions.anchorOverrides = args.anchorOverrides;
      }

      if (typeof args.lock === "boolean") {
        rawOptions.lock = args.lock;
      }

      if (typeof args.disableSelection === "boolean") {
        rawOptions.disableSelection = args.disableSelection;
      }

      const result = await handlers.runRawDrawProjection(rawOptions);

      return textToolResult(
        `Draw projection levels: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );
}
