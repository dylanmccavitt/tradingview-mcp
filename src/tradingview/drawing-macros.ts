export const DRAWING_MACRO_SCHEMA_VERSION = 1;
export const DRAWING_MACRO_MAX_LEVELS = 16;
export const DRAWING_MACRO_MAX_RATIO = 5;
export const DEFAULT_FIB_RATIOS = [
  0,
  0.236,
  0.382,
  0.5,
  0.618,
  0.786,
  1,
  1.272,
  1.618
] as const;
export const DEFAULT_MEASURED_MOVE_MULTIPLIERS = [
  0,
  0.5,
  1,
  1.618
] as const;
export const DEFAULT_RANGE_PROJECTION_MULTIPLIERS = [1, 1.5, 2] as const;

const REVIEW_CONTEXT_WARNING =
  "Macro levels are mechanical chart-review context only; they are not predictions, recommendations, or financial advice.";

export type DrawingMacroKind = "fib-levels" | "projection";
export type DrawingMacroSource = "explicit-anchors" | "extracted-range";
export type FibMacroDirection = "low-to-high" | "high-to-low";
export type ProjectionMacroMode = "measured-move" | "range-projection";
export type ProjectionDirection = "up" | "down" | "both";
export type DrawingMacroShapeType =
  | "horizontal-line"
  | "trend-line"
  | "rectangle"
  | "text";

export interface DrawingMacroPoint {
  time: number;
  price: number;
  label?: string;
}

export type DrawingMacroOverrideValue = string | number | boolean | null;

export interface DrawingMacroLevel {
  label: string;
  price: number;
  role: "anchor" | "retracement" | "extension" | "projection" | "range-boundary";
  source: DrawingMacroSource;
  ratio?: number;
  multiplier?: number;
}

export interface DrawingMacroDrawingRequest {
  shapeType: DrawingMacroShapeType;
  points: DrawingMacroPoint[];
  role: string;
  label: string;
  text?: string;
  overrides?: Record<string, DrawingMacroOverrideValue>;
  lock?: boolean;
  disableSelection?: boolean;
}

export interface DrawingMacroPlan {
  schemaVersion: typeof DRAWING_MACRO_SCHEMA_VERSION;
  kind: DrawingMacroKind;
  source: DrawingMacroSource;
  anchors: Record<string, unknown>;
  levels: DrawingMacroLevel[];
  drawings: DrawingMacroDrawingRequest[];
  warnings: string[];
}

export interface DrawingMacroArtifact {
  schemaVersion: typeof DRAWING_MACRO_SCHEMA_VERSION;
  kind: DrawingMacroKind;
  source: string;
  anchors: Record<string, unknown>;
  levels: DrawingMacroLevel[];
  drawingIds: string[];
  warnings: string[];
}

export interface BuildFibLevelsMacroOptions {
  high: DrawingMacroPoint;
  low: DrawingMacroPoint;
  direction?: FibMacroDirection;
  ratios?: number[];
  labelPrefix?: string;
  includeAnchorLine?: boolean;
  overrides?: Record<string, DrawingMacroOverrideValue>;
  anchorOverrides?: Record<string, DrawingMacroOverrideValue>;
  lock?: boolean;
  disableSelection?: boolean;
}

export interface DrawingMacroRange {
  high: number;
  low: number;
  source?: string;
  label?: string;
  startTime?: number;
  endTime?: number;
}

export interface BuildProjectionMacroOptions {
  mode: ProjectionMacroMode;
  base: DrawingMacroPoint;
  start?: DrawingMacroPoint;
  end?: DrawingMacroPoint;
  range?: DrawingMacroRange;
  direction?: ProjectionDirection;
  multipliers?: number[];
  labelPrefix?: string;
  includeAnchorLine?: boolean;
  includeRangeBox?: boolean;
  overrides?: Record<string, DrawingMacroOverrideValue>;
  anchorOverrides?: Record<string, DrawingMacroOverrideValue>;
  lock?: boolean;
  disableSelection?: boolean;
}

function pointMessage(point: DrawingMacroPoint | undefined, name: string): string | null {
  if (!point || typeof point !== "object") {
    return `${name} anchor is required.`;
  }

  if (!Number.isInteger(point.time) || point.time < 0) {
    return `${name} anchor time must be a non-negative Unix timestamp integer.`;
  }

  if (!Number.isFinite(point.price) || point.price <= 0) {
    return `${name} anchor price must be a finite positive number.`;
  }

  return null;
}

function ratioMessage(
  values: readonly number[] | undefined,
  defaultValues: readonly number[],
  name: string,
  allowZero: boolean
): string | null {
  const ratios = values ?? defaultValues;

  if (ratios.length < 1 || ratios.length > DRAWING_MACRO_MAX_LEVELS) {
    return `${name} must include 1 to ${DRAWING_MACRO_MAX_LEVELS} values.`;
  }

  for (const value of ratios) {
    if (!Number.isFinite(value)) {
      return `${name} must be finite numbers.`;
    }

    if (allowZero ? value < 0 : value <= 0) {
      return `${name} must be ${allowZero ? "non-negative" : "positive"} numbers.`;
    }

    if (value > DRAWING_MACRO_MAX_RATIO) {
      return `${name} values must be ${DRAWING_MACRO_MAX_RATIO} or lower.`;
    }
  }

  return null;
}

function projectionDirectionCount(direction: ProjectionDirection): number {
  return direction === "both" ? 2 : 1;
}

function rangeProjectionLevelCount(options: {
  direction: ProjectionDirection;
  multipliers: readonly number[];
}): number {
  return 2 + options.multipliers.length * projectionDirectionCount(options.direction);
}

function overrideMessage(
  overrides: Record<string, DrawingMacroOverrideValue> | undefined,
  name: string
): string | null {
  if (!overrides) {
    return null;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!key.trim()) {
      return `${name} override keys must be non-empty strings.`;
    }

    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return `${name} overrides may only contain string, number, boolean, or null values.`;
    }
  }

  return null;
}

export function invalidFibLevelsMacroMessage(
  options: BuildFibLevelsMacroOptions
): string | null {
  const highMessage = pointMessage(options.high, "High");
  if (highMessage) {
    return highMessage;
  }

  const lowMessage = pointMessage(options.low, "Low");
  if (lowMessage) {
    return lowMessage;
  }

  if (options.high.price <= options.low.price) {
    return "Fib macro high anchor price must be greater than low anchor price.";
  }

  if (
    options.direction !== undefined &&
    options.direction !== "low-to-high" &&
    options.direction !== "high-to-low"
  ) {
    return "Fib macro direction must be low-to-high or high-to-low.";
  }

  const ratioError = ratioMessage(
    options.ratios,
    DEFAULT_FIB_RATIOS,
    "Fib ratios",
    true
  );
  if (ratioError) {
    return ratioError;
  }

  return (
    overrideMessage(options.overrides, "Fib level") ??
    overrideMessage(options.anchorOverrides, "Fib anchor")
  );
}

export function invalidProjectionMacroMessage(
  options: BuildProjectionMacroOptions
): string | null {
  if (options.mode !== "measured-move" && options.mode !== "range-projection") {
    return "Projection macro mode must be measured-move or range-projection.";
  }

  const baseMessage = pointMessage(options.base, "Projection base");
  if (baseMessage) {
    return baseMessage;
  }

  if (
    options.direction !== undefined &&
    options.direction !== "up" &&
    options.direction !== "down" &&
    options.direction !== "both"
  ) {
    return "Projection macro direction must be up, down, or both.";
  }

  if (options.mode === "measured-move") {
    const startMessage = pointMessage(options.start, "Measured move start");
    if (startMessage) {
      return startMessage;
    }

    const endMessage = pointMessage(options.end, "Measured move end");
    if (endMessage) {
      return endMessage;
    }

    if (options.start?.price === options.end?.price) {
      return "Measured move start and end prices must be different.";
    }

    const multiplierError = ratioMessage(
      options.multipliers,
      DEFAULT_MEASURED_MOVE_MULTIPLIERS,
      "Measured move multipliers",
      true
    );
    if (multiplierError) {
      return multiplierError;
    }
  } else {
    const range = options.range;
    if (!range) {
      return "Range projection macro requires a selected range.";
    }

    if (!Number.isFinite(range.high) || range.high <= 0) {
      return "Range projection high must be a finite positive number.";
    }

    if (!Number.isFinite(range.low) || range.low <= 0) {
      return "Range projection low must be a finite positive number.";
    }

    if (range.high <= range.low) {
      return "Range projection high must be greater than low.";
    }

    if (
      range.startTime !== undefined &&
      (!Number.isInteger(range.startTime) || range.startTime < 0)
    ) {
      return "Range projection startTime must be a non-negative Unix timestamp integer.";
    }

    if (
      range.endTime !== undefined &&
      (!Number.isInteger(range.endTime) || range.endTime < 0)
    ) {
      return "Range projection endTime must be a non-negative Unix timestamp integer.";
    }

    const multiplierError = ratioMessage(
      options.multipliers,
      DEFAULT_RANGE_PROJECTION_MULTIPLIERS,
      "Range projection multipliers",
      false
    );
    if (multiplierError) {
      return multiplierError;
    }

    const direction = options.direction ?? "both";
    const multipliers = uniqueNumbers(
      options.multipliers ?? DEFAULT_RANGE_PROJECTION_MULTIPLIERS
    );
    const levelCount = rangeProjectionLevelCount({
      direction,
      multipliers
    });
    if (levelCount > DRAWING_MACRO_MAX_LEVELS) {
      const maxMultipliers = Math.floor(
        (DRAWING_MACRO_MAX_LEVELS - 2) / projectionDirectionCount(direction)
      );
      return `Range projection emits ${levelCount} levels; use ${maxMultipliers} multiplier${maxMultipliers === 1 ? "" : "s"} or fewer for direction ${direction}.`;
    }
  }

  return (
    overrideMessage(options.overrides, "Projection level") ??
    overrideMessage(options.anchorOverrides, "Projection anchor")
  );
}

function roundPrice(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function uniqueNumbers(values: readonly number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];

  for (const value of values) {
    const rounded = roundPrice(value);
    if (!seen.has(rounded)) {
      seen.add(rounded);
      result.push(rounded);
    }
  }

  return result;
}

function inferFibDirection(
  options: BuildFibLevelsMacroOptions
): FibMacroDirection {
  if (options.direction) {
    return options.direction;
  }

  return options.low.time <= options.high.time ? "low-to-high" : "high-to-low";
}

function cleanPoint(point: DrawingMacroPoint): DrawingMacroPoint {
  const clean: DrawingMacroPoint = {
    time: Math.trunc(point.time),
    price: point.price
  };

  if (point.label?.trim()) {
    clean.label = point.label.trim();
  }

  return clean;
}

function cleanPrefix(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}x`;
}

function lineOptions(
  options: Pick<
    BuildFibLevelsMacroOptions | BuildProjectionMacroOptions,
    "overrides" | "lock" | "disableSelection"
  >
): Pick<
  DrawingMacroDrawingRequest,
  "overrides" | "lock" | "disableSelection"
> {
  const result: Pick<
    DrawingMacroDrawingRequest,
    "overrides" | "lock" | "disableSelection"
  > = {};

  if (options.overrides) {
    result.overrides = options.overrides;
  }

  if (typeof options.lock === "boolean") {
    result.lock = options.lock;
  }

  if (typeof options.disableSelection === "boolean") {
    result.disableSelection = options.disableSelection;
  }

  return result;
}

function anchorLineOptions(
  options: Pick<
    BuildFibLevelsMacroOptions | BuildProjectionMacroOptions,
    "anchorOverrides" | "lock" | "disableSelection"
  >
): Pick<
  DrawingMacroDrawingRequest,
  "overrides" | "lock" | "disableSelection"
> {
  const result: Pick<
    DrawingMacroDrawingRequest,
    "overrides" | "lock" | "disableSelection"
  > = {};

  if (options.anchorOverrides) {
    result.overrides = options.anchorOverrides;
  }

  if (typeof options.lock === "boolean") {
    result.lock = options.lock;
  }

  if (typeof options.disableSelection === "boolean") {
    result.disableSelection = options.disableSelection;
  }

  return result;
}

function horizontalLineDrawing(
  level: DrawingMacroLevel,
  time: number,
  options: Pick<
    BuildFibLevelsMacroOptions | BuildProjectionMacroOptions,
    "overrides" | "lock" | "disableSelection"
  >
): DrawingMacroDrawingRequest {
  return {
    shapeType: "horizontal-line",
    points: [
      {
        time,
        price: level.price
      }
    ],
    role: level.role,
    label: level.label,
    ...lineOptions(options)
  };
}

function sourceFromRange(
  range: DrawingMacroRange | undefined
): DrawingMacroSource {
  return range?.source === "extracted-range"
    ? "extracted-range"
    : "explicit-anchors";
}

export function buildFibLevelsMacroPlan(
  options: BuildFibLevelsMacroOptions
): DrawingMacroPlan {
  const invalid = invalidFibLevelsMacroMessage(options);
  if (invalid) {
    throw new Error(invalid);
  }

  const high = cleanPoint(options.high);
  const low = cleanPoint(options.low);
  const direction = inferFibDirection(options);
  const start = direction === "low-to-high" ? low : high;
  const end = direction === "low-to-high" ? high : low;
  const delta = end.price - start.price;
  const lineTime = Math.max(start.time, end.time);
  const prefix = cleanPrefix(options.labelPrefix, "Fib");
  const ratios = uniqueNumbers(options.ratios ?? DEFAULT_FIB_RATIOS);
  const levels = ratios.map((ratio): DrawingMacroLevel => {
    const role =
      ratio === 0 || ratio === 1
        ? "anchor"
        : ratio > 1
          ? "extension"
          : "retracement";

    return {
      label: `${prefix} ${formatPercent(ratio)}`,
      price: roundPrice(start.price + delta * ratio),
      role,
      source: "explicit-anchors",
      ratio
    };
  });
  const drawings = levels.map((level) =>
    horizontalLineDrawing(level, lineTime, options)
  );

  if (options.includeAnchorLine ?? true) {
    drawings.unshift({
      shapeType: "trend-line",
      points: [start, end],
      role: "anchor-line",
      label: `${prefix} anchor`,
      ...anchorLineOptions(options)
    });
  }

  return {
    schemaVersion: DRAWING_MACRO_SCHEMA_VERSION,
    kind: "fib-levels",
    source: "explicit-anchors",
    anchors: {
      high,
      low,
      direction,
      start,
      end
    },
    levels,
    drawings,
    warnings: [REVIEW_CONTEXT_WARNING]
  };
}

function buildMeasuredMovePlan(
  options: BuildProjectionMacroOptions
): DrawingMacroPlan {
  const start = cleanPoint(options.start as DrawingMacroPoint);
  const end = cleanPoint(options.end as DrawingMacroPoint);
  const base = cleanPoint(options.base);
  const delta = end.price - start.price;
  const lineTime = base.time;
  const prefix = cleanPrefix(options.labelPrefix, "Measured");
  const multipliers = uniqueNumbers(
    options.multipliers ?? DEFAULT_MEASURED_MOVE_MULTIPLIERS
  );
  const levels = multipliers.map((multiplier): DrawingMacroLevel => ({
    label: `${prefix} ${formatMultiplier(multiplier)}`,
    price: roundPrice(base.price + delta * multiplier),
    role: multiplier === 0 ? "anchor" : "projection",
    source: "explicit-anchors",
    multiplier
  }));
  const drawings = levels.map((level) =>
    horizontalLineDrawing(level, lineTime, options)
  );

  if (options.includeAnchorLine ?? true) {
    drawings.unshift({
      shapeType: "trend-line",
      points: [start, end],
      role: "measured-move",
      label: `${prefix} source move`,
      ...anchorLineOptions(options)
    });
  }

  return {
    schemaVersion: DRAWING_MACRO_SCHEMA_VERSION,
    kind: "projection",
    source: "explicit-anchors",
    anchors: {
      mode: "measured-move",
      start,
      end,
      base,
      priceDelta: roundPrice(delta),
      timeDelta: end.time - start.time
    },
    levels,
    drawings,
    warnings: [REVIEW_CONTEXT_WARNING]
  };
}

function rangeSourceLabel(range: DrawingMacroRange): string {
  return range.label?.trim() || String(range.source ?? "selected range");
}

function buildRangeProjectionPlan(
  options: BuildProjectionMacroOptions
): DrawingMacroPlan {
  const range = options.range as DrawingMacroRange;
  const base = cleanPoint(options.base);
  const source = sourceFromRange(range);
  const direction = options.direction ?? "both";
  const high = roundPrice(range.high);
  const low = roundPrice(range.low);
  const height = high - low;
  const prefix = cleanPrefix(options.labelPrefix, "Range");
  const multipliers = uniqueNumbers(
    options.multipliers ?? DEFAULT_RANGE_PROJECTION_MULTIPLIERS
  );
  const levels: DrawingMacroLevel[] = [
    {
      label: `${prefix} high`,
      price: high,
      role: "range-boundary",
      source
    },
    {
      label: `${prefix} low`,
      price: low,
      role: "range-boundary",
      source
    }
  ];

  for (const multiplier of multipliers) {
    if (direction === "up" || direction === "both") {
      levels.push({
        label: `${prefix} +${formatMultiplier(multiplier)}`,
        price: roundPrice(high + height * multiplier),
        role: "projection",
        source,
        multiplier
      });
    }

    if (direction === "down" || direction === "both") {
      levels.push({
        label: `${prefix} -${formatMultiplier(multiplier)}`,
        price: roundPrice(low - height * multiplier),
        role: "projection",
        source,
        multiplier: -multiplier
      });
    }
  }

  const drawings = levels.map((level) =>
    horizontalLineDrawing(level, base.time, options)
  );

  if (
    (options.includeRangeBox ?? false) &&
    typeof range.startTime === "number" &&
    typeof range.endTime === "number"
  ) {
    drawings.unshift({
      shapeType: "rectangle",
      points: [
        {
          time: Math.trunc(range.startTime),
          price: high
        },
        {
          time: Math.trunc(range.endTime),
          price: low
        }
      ],
      role: "range-box",
      label: `${prefix} source range`,
      ...anchorLineOptions(options)
    });
  }

  const warnings = [REVIEW_CONTEXT_WARNING];
  if (source === "extracted-range") {
    warnings.push(
      "Selected extracted ranges depend on earlier objective overlay extraction; review the source artifact warnings before relying on the macro context."
    );
  }

  return {
    schemaVersion: DRAWING_MACRO_SCHEMA_VERSION,
    kind: "projection",
    source,
    anchors: {
      mode: "range-projection",
      range: {
        high,
        low,
        height: roundPrice(height),
        label: rangeSourceLabel(range),
        source: range.source ?? "explicit-anchors",
        ...(range.startTime !== undefined
          ? {
              startTime: Math.trunc(range.startTime)
            }
          : {}),
        ...(range.endTime !== undefined
          ? {
              endTime: Math.trunc(range.endTime)
            }
          : {})
      },
      base,
      direction
    },
    levels,
    drawings,
    warnings
  };
}

export function buildProjectionMacroPlan(
  options: BuildProjectionMacroOptions
): DrawingMacroPlan {
  const invalid = invalidProjectionMacroMessage(options);
  if (invalid) {
    throw new Error(invalid);
  }

  return options.mode === "measured-move"
    ? buildMeasuredMovePlan(options)
    : buildRangeProjectionPlan(options);
}

export function macroArtifactFromPlan(
  plan: DrawingMacroPlan,
  drawingIds: readonly string[],
  warnings: readonly string[] = []
): DrawingMacroArtifact {
  return {
    schemaVersion: DRAWING_MACRO_SCHEMA_VERSION,
    kind: plan.kind,
    source: plan.source,
    anchors: plan.anchors,
    levels: plan.levels,
    drawingIds: [...drawingIds],
    warnings: [...new Set([...plan.warnings, ...warnings])]
  };
}
