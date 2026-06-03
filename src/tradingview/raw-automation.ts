import { fetchCdpJson, formatCdpEndpoint } from "./cdp.js";
import {
  type CdpClient,
  connectCdpClient
} from "./cdp-session.js";
import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS
} from "./desktop.js";
import {
  checkTradingViewHealth,
  type CdpJsonFetcher,
  type CheckTradingViewHealthOptions,
  type TradingViewHealthResult
} from "./health.js";
import {
  buildFibLevelsMacroPlan,
  buildProjectionMacroPlan,
  invalidFibLevelsMacroMessage,
  invalidProjectionMacroMessage,
  type BuildFibLevelsMacroOptions,
  type BuildProjectionMacroOptions
} from "./drawing-macros.js";
import {
  applyDrawingPresetOverrides,
  applyDrawingPresetToMacroPlan,
  type DrawingPresetName
} from "./drawing-presets.js";
import {
  isTradingViewChartTarget,
  normalizeCdpTargets,
  type CdpTarget
} from "./targets.js";

export const RAW_AUTOMATION_ENV = "TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION";
export const DEFAULT_RAW_EVALUATE_MAX_RESULT_BYTES = 4096;
export const RAW_EVALUATE_MAX_EXPRESSION_CHARS = 2000;
export const RAW_TEXT_MAX_CHARS = 1000;
export const RAW_KEY_MAX_CHARS = 64;
export const RAW_SELECTOR_MAX_CHARS = 500;
export const DEFAULT_RAW_FIND_MAX_MATCHES = 10;
export const RAW_FIND_MAX_MATCHES_LIMIT = 25;
export const DEFAULT_RAW_SCROLL_AMOUNT = 600;
export const RAW_SCROLL_MAX_AMOUNT = 3000;
export const DEFAULT_RAW_CHART_CONTROL_MAX_RESULT_BYTES = 8192;
export const DEFAULT_RAW_CHART_DATA_BAR_COUNT = 100;
export const RAW_CHART_DATA_BAR_COUNT_LIMIT = 500;
export const DEFAULT_RAW_STUDY_VALUES_MAX_STUDIES = 10;
export const RAW_STUDY_VALUES_MAX_STUDIES_LIMIT = 50;
export const DEFAULT_RAW_STUDY_VALUES_MAX_VALUES = 10;
export const RAW_STUDY_VALUES_MAX_VALUES_LIMIT = 50;
export const RAW_SYMBOL_MAX_CHARS = 64;
export const RAW_TIMEFRAME_MAX_CHARS = 32;
export const RAW_CHART_TYPE_MAX_CHARS = 64;
export const RAW_INDICATOR_NAME_MAX_CHARS = 120;
export const RAW_ENTITY_ID_MAX_CHARS = 200;
export const RAW_TARGET_ID_MAX_CHARS = 200;
export const RAW_PANE_ID_MAX_CHARS = 120;
export const RAW_LAYOUT_ID_MAX_CHARS = 200;
export const RAW_BATCH_MAX_STEPS = 50;
export const RAW_REPLAY_MAX_STEPS = 100;
export const RAW_REPLAY_MIN_SPEED = 0.1;
export const RAW_REPLAY_MAX_SPEED = 20;
export const RAW_DRAWING_TEXT_MAX_CHARS = 500;
export const RAW_DRAWING_MAX_POINTS = 2;
export const RAW_DRAWING_MAX_OVERRIDES = 40;
export const RAW_PINE_SOURCE_MAX_CHARS = 200_000;
export const DEFAULT_RAW_PINE_GET_SOURCE_MAX_CHARS = 12_000;
export const RAW_PINE_GET_SOURCE_MAX_CHARS_LIMIT = 100_000;
export const DEFAULT_RAW_PINE_COMPILE_SETTLE_MS = 2_500;
export const DEFAULT_RAW_PINE_SAVE_SETTLE_MS = 800;
export const RAW_PINE_ACTION_SETTLE_MS_LIMIT = 10_000;

const RAW_NATIVE_FIB_REVIEW_CONTEXT_WARNING =
  "Native Fib Retracement output is mechanical chart-review context only; it is not a prediction, recommendation, or financial advice.";

const RAW_SELECTOR_CLICK_FORBIDDEN_PATTERNS = [
  /\baccount\b/i,
  /\bsecurity\b/i,
  /\bpassword\b/i,
  /\blog\s*in\b/i,
  /\blog\s*out\b/i,
  /\bbilling\b/i,
  /\bsubscription\b/i,
  /\bbroker\b/i,
  /\border\b/i,
  /\bbuy\b/i,
  /\bsell\b/i,
  /\btrade\b/i,
  /\btrading\s*panel\b/i,
  /\balert\b/i
] as const;

const RAW_SELECTOR_CLICK_BROAD_CSS = new Set([
  "*",
  "html",
  "body",
  "body *",
  "button",
  "a",
  "[role=button]",
  "[role='button']",
  "[role=\"button\"]"
]);

export type RawInputButton = "left" | "middle" | "right";
export type RawElementSelectorStrategy =
  | "text"
  | "aria-label"
  | "data-name"
  | "css";
export type RawSelectorClickMethod = "mouse" | "dom";
export type RawScrollDirection = "up" | "down" | "left" | "right";
export type RawAutomationAction =
  | "evaluate"
  | "click"
  | "keypress"
  | "type-text"
  | "find-element"
  | "selector-click"
  | "selector-hover"
  | "scroll"
  | "chart-state"
  | "chart-data-summary"
  | "quote-snapshot"
  | "study-values"
  | "list-tabs"
  | "focus-tab"
  | "list-panes"
  | "focus-pane"
  | "set-pane-layout"
  | "list-layouts"
  | "switch-layout"
  | "batch-chart"
  | "replay-open"
  | "replay-play-pause"
  | "replay-step"
  | "replay-set-speed"
  | "replay-exit"
  | "set-symbol"
  | "set-timeframe"
  | "set-chart-type"
  | "set-visible-range"
  | "add-indicator"
  | "remove-entity"
  | "draw-shape"
  | "draw-list"
  | "draw-properties"
  | "draw-remove"
  | "draw-clear-all"
  | "draw-fib-retracement"
  | "draw-fib-levels"
  | "draw-projection"
  | "pine-open-editor"
  | "pine-set-source"
  | "pine-get-source"
  | "pine-get-errors"
  | "pine-get-console"
  | "pine-compile"
  | "pine-save";

export interface RawElementSummary {
  index: number;
  tagName: string;
  text?: string;
  ariaLabel?: string;
  dataName?: string;
  role?: string;
  id?: string;
  className?: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
}

export type RawChartTypeValue = string | number;

export type RawPaneLayoutValue =
  | "single"
  | "two-vertical"
  | "two-horizontal"
  | "three-vertical"
  | "four-grid";

export interface RawVisibleRange {
  from: number;
  to: number;
}

export interface RawChartStudySummary {
  id: string;
  name?: string;
}

export interface RawChartState {
  symbol?: string;
  timeframe?: string;
  chartType?: RawChartTypeValue;
  visibleRange?: RawVisibleRange;
  studies: RawChartStudySummary[];
  warnings: string[];
}

export type RawDrawingShapeType =
  | "horizontal-line"
  | "trend-line"
  | "rectangle"
  | "text";

export interface RawDrawingPoint {
  time: number;
  price: number;
}

export type RawDrawingOverrideValue = string | number | boolean | null;

export interface RawDrawingSummary {
  id: string;
  type?: string;
  name?: string;
  points?: RawDrawingPoint[];
  text?: string;
  visible?: boolean;
  locked?: boolean;
  selectable?: boolean;
}

export interface RawTradingViewPageClient {
  evaluate(
    expression: string,
    options?: {
      awaitPromise?: boolean;
      throwOnSideEffect?: boolean;
    }
  ): Promise<unknown>;
  click(options: {
    x: number;
    y: number;
    button: RawInputButton;
  }): Promise<void>;
  keypress(key: string): Promise<void>;
  typeText(text: string): Promise<void>;
  bringToFront(): Promise<void>;
  hover(options: { x: number; y: number }): Promise<void>;
  scroll(options: {
    direction: RawScrollDirection;
    amount: number;
    x: number;
    y: number;
  }): Promise<void>;
  close(): Promise<void>;
}

export interface RawAutomationBaseOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
  appPath?: string;
  checkHealth?: (
    options: CheckTradingViewHealthOptions
  ) => Promise<TradingViewHealthResult>;
  fetchJson?: CdpJsonFetcher;
  pageClientFactory?: (
    target: CdpTarget,
    options: {
      timeoutMs: number;
    }
  ) => Promise<RawTradingViewPageClient>;
  now?: () => Date;
}

export interface RawEvaluateOptions extends RawAutomationBaseOptions {
  expression: string;
  maxResultBytes?: number;
}

export interface RawClickOptions extends RawAutomationBaseOptions {
  x: number;
  y: number;
  button?: RawInputButton;
}

export interface RawKeypressOptions extends RawAutomationBaseOptions {
  key: string;
}

export interface RawTypeTextOptions extends RawAutomationBaseOptions {
  text: string;
}

export interface RawFindElementOptions extends RawAutomationBaseOptions {
  strategy: RawElementSelectorStrategy;
  value: string;
  maxMatches?: number;
}

export interface RawSelectorClickOptions extends RawFindElementOptions {
  matchIndex?: number;
  button?: RawInputButton;
  clickMethod?: RawSelectorClickMethod;
}

export interface RawSelectorHoverOptions extends RawFindElementOptions {
  matchIndex?: number;
}

export interface RawScrollOptions extends RawAutomationBaseOptions {
  direction: RawScrollDirection;
  amount?: number;
  x?: number;
  y?: number;
}

export type RawChartStateOptions = RawAutomationBaseOptions;

export interface RawChartDataSummaryOptions extends RawAutomationBaseOptions {
  barCount?: number;
}

export type RawQuoteSnapshotOptions = RawAutomationBaseOptions;

export interface RawStudyValuesOptions extends RawAutomationBaseOptions {
  maxStudies?: number;
  maxValuesPerStudy?: number;
  studyName?: string;
}

export type RawListTabsOptions = RawAutomationBaseOptions;

export interface RawFocusTabOptions extends RawAutomationBaseOptions {
  targetId: string;
}

export type RawListPanesOptions = RawAutomationBaseOptions;

export interface RawFocusPaneOptions extends RawAutomationBaseOptions {
  paneId: string;
}

export interface RawSetPaneLayoutOptions extends RawAutomationBaseOptions {
  layout: RawPaneLayoutValue;
}

export type RawListLayoutsOptions = RawAutomationBaseOptions;

export interface RawSwitchLayoutOptions extends RawAutomationBaseOptions {
  layoutId: string;
}

export interface RawBatchChartStep {
  symbol?: string;
  timeframe?: string;
}

export interface RawBatchChartOptions extends RawAutomationBaseOptions {
  steps: RawBatchChartStep[];
  stopOnError?: boolean;
}

export type RawReplayPlayPauseMode = "play" | "pause" | "toggle";
export type RawReplayStepDirection = "forward" | "back";

export type RawReplayOpenOptions = RawAutomationBaseOptions;

export interface RawReplayPlayPauseOptions extends RawAutomationBaseOptions {
  mode?: RawReplayPlayPauseMode;
}

export interface RawReplayStepOptions extends RawAutomationBaseOptions {
  direction: RawReplayStepDirection;
  steps?: number;
}

export interface RawReplaySetSpeedOptions extends RawAutomationBaseOptions {
  speed: number;
}

export type RawReplayExitOptions = RawAutomationBaseOptions;

export interface RawSetSymbolOptions extends RawAutomationBaseOptions {
  symbol: string;
}

export interface RawSetTimeframeOptions extends RawAutomationBaseOptions {
  timeframe: string;
}

export interface RawSetChartTypeOptions extends RawAutomationBaseOptions {
  chartType: RawChartTypeValue;
}

export interface RawSetVisibleRangeOptions extends RawAutomationBaseOptions {
  range: RawVisibleRange;
}

export interface RawAddIndicatorOptions extends RawAutomationBaseOptions {
  name: string;
}

export interface RawRemoveEntityOptions extends RawAutomationBaseOptions {
  entityId: string;
}

export interface RawDrawShapeOptions extends RawAutomationBaseOptions {
  shapeType: RawDrawingShapeType;
  points: RawDrawingPoint[];
  text?: string;
  drawingPreset?: DrawingPresetName;
  overrides?: Record<string, RawDrawingOverrideValue>;
  lock?: boolean;
  disableSelection?: boolean;
}

export type RawDrawListOptions = RawAutomationBaseOptions;

export interface RawDrawingPropertiesOptions extends RawAutomationBaseOptions {
  entityId: string;
}

export interface RawDrawRemoveOptions extends RawAutomationBaseOptions {
  entityId: string;
}

export interface RawDrawClearAllOptions extends RawAutomationBaseOptions {
  confirmClearAll: boolean;
}

export interface RawDrawFibRetracementOptions
  extends RawAutomationBaseOptions,
    Pick<
      BuildFibLevelsMacroOptions,
      | "high"
      | "low"
      | "direction"
      | "ratios"
      | "overrides"
      | "lock"
      | "disableSelection"
    > {
  drawingPreset?: DrawingPresetName;
}

export interface RawDrawFibLevelsOptions
  extends RawAutomationBaseOptions,
    BuildFibLevelsMacroOptions {
  drawingPreset?: DrawingPresetName;
}

export interface RawDrawProjectionOptions
  extends RawAutomationBaseOptions,
    BuildProjectionMacroOptions {
  drawingPreset?: DrawingPresetName;
}

export type RawPineOpenEditorOptions = RawAutomationBaseOptions;

export interface RawPineSetSourceOptions extends RawAutomationBaseOptions {
  source: string;
}

export interface RawPineGetSourceOptions extends RawAutomationBaseOptions {
  maxSourceChars?: number;
}

export type RawPineGetErrorsOptions = RawAutomationBaseOptions;

export type RawPineGetConsoleOptions = RawAutomationBaseOptions;

export interface RawPineCompileOptions extends RawAutomationBaseOptions {
  settleMs?: number;
}

export interface RawPineSaveOptions extends RawAutomationBaseOptions {
  settleMs?: number;
}

export interface RawAutomationResult {
  ok: boolean;
  action: RawAutomationAction;
  endpoint: string;
  executedAt: string;
  target?: CdpTarget;
  value?: unknown;
  error?: string;
  warnings: string[];
}

interface RuntimeEvaluateResponse {
  result?: {
    type?: string;
    value?: unknown;
    unserializableValue?: string;
    description?: string;
  };
  exceptionDetails?: {
    text?: string;
    exception?: {
      description?: string;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isRawAutomationEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env[RAW_AUTOMATION_ENV] === "1";
}

function endpointOptions(options: RawAutomationBaseOptions): {
  host: string;
  port: number;
  timeoutMs: number;
} {
  return {
    host: options.host ?? DEFAULT_CDP_HOST,
    port: options.port ?? DEFAULT_CDP_PORT,
    timeoutMs: options.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compactJsonByteLength(value: unknown): number {
  const text = JSON.stringify(value);
  return Buffer.byteLength(text ?? "undefined", "utf8");
}

function failureResult(
  action: RawAutomationAction,
  options: {
    endpoint: string;
    executedAt: string;
    error: string;
    warnings?: string[];
    target?: CdpTarget;
    value?: unknown;
  }
): RawAutomationResult {
  const result: RawAutomationResult = {
    ok: false,
    action,
    endpoint: options.endpoint,
    executedAt: options.executedAt,
    error: options.error,
    warnings: options.warnings ?? []
  };

  if (options.target) {
    result.target = options.target;
  }

  if ("value" in options) {
    result.value = options.value;
  }

  return result;
}

function successResult(
  action: RawAutomationAction,
  options: {
    endpoint: string;
    executedAt: string;
    target: CdpTarget;
    value?: unknown;
    warnings?: string[];
  }
): RawAutomationResult {
  const result: RawAutomationResult = {
    ok: true,
    action,
    endpoint: options.endpoint,
    executedAt: options.executedAt,
    target: options.target,
    warnings: options.warnings ?? []
  };

  if ("value" in options) {
    result.value = options.value;
  }

  return result;
}

function healthOptionsFromRaw(
  options: RawAutomationBaseOptions
): CheckTradingViewHealthOptions {
  const endpoint = endpointOptions(options);
  const healthOptions: CheckTradingViewHealthOptions = {
    host: endpoint.host,
    port: endpoint.port,
    timeoutMs: endpoint.timeoutMs
  };

  if (options.appPath) {
    healthOptions.appPath = options.appPath;
  }

  if (options.fetchJson) {
    healthOptions.fetchJson = options.fetchJson;
  }

  return healthOptions;
}

function invalidExpressionMessage(expression: string): string | null {
  if (expression.trim().length === 0) {
    return "Raw evaluate expression is required.";
  }

  if (expression.length > RAW_EVALUATE_MAX_EXPRESSION_CHARS) {
    return `Raw evaluate expression must be ${RAW_EVALUATE_MAX_EXPRESSION_CHARS} characters or fewer.`;
  }

  return null;
}

function invalidTextMessage(text: string): string | null {
  if (text.length === 0) {
    return "Raw text input is required.";
  }

  if (text.length > RAW_TEXT_MAX_CHARS) {
    return `Raw text input must be ${RAW_TEXT_MAX_CHARS} characters or fewer.`;
  }

  return null;
}

function invalidKeyMessage(key: string): string | null {
  if (key.trim().length === 0) {
    return "Raw keypress key is required.";
  }

  if (key.length > RAW_KEY_MAX_CHARS) {
    return `Raw keypress key must be ${RAW_KEY_MAX_CHARS} characters or fewer.`;
  }

  return null;
}

function invalidCoordinateMessage(x: number, y: number): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
    return "Raw click coordinates must be finite non-negative numbers.";
  }

  return null;
}

function invalidSelectorMessage(options: {
  strategy: RawElementSelectorStrategy;
  value: string;
  maxMatches?: number;
}): string | null {
  if (
    options.strategy !== "text" &&
    options.strategy !== "aria-label" &&
    options.strategy !== "data-name" &&
    options.strategy !== "css"
  ) {
    return "Raw selector strategy must be text, aria-label, data-name, or css.";
  }

  if (options.value.trim().length === 0) {
    return "Raw selector value is required.";
  }

  if (options.value.length > RAW_SELECTOR_MAX_CHARS) {
    return `Raw selector value must be ${RAW_SELECTOR_MAX_CHARS} characters or fewer.`;
  }

  if (
    options.maxMatches !== undefined &&
    (!Number.isInteger(options.maxMatches) ||
      options.maxMatches <= 0 ||
      options.maxMatches > RAW_FIND_MAX_MATCHES_LIMIT)
  ) {
    return `Raw maxMatches must be an integer from 1 to ${RAW_FIND_MAX_MATCHES_LIMIT}.`;
  }

  return null;
}

function invalidMatchIndexMessage(matchIndex: number | undefined): string | null {
  if (
    matchIndex !== undefined &&
    (!Number.isInteger(matchIndex) || matchIndex < 0)
  ) {
    return "Raw selector matchIndex must be a non-negative integer.";
  }

  return null;
}

function invalidScrollMessage(options: RawScrollOptions): string | null {
  if (
    options.direction !== "up" &&
    options.direction !== "down" &&
    options.direction !== "left" &&
    options.direction !== "right"
  ) {
    return "Raw scroll direction must be up, down, left, or right.";
  }

  const amount = options.amount ?? DEFAULT_RAW_SCROLL_AMOUNT;

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > RAW_SCROLL_MAX_AMOUNT
  ) {
    return `Raw scroll amount must be greater than 0 and no more than ${RAW_SCROLL_MAX_AMOUNT}.`;
  }

  const x = options.x ?? 500;
  const y = options.y ?? 500;

  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
    return "Raw scroll coordinates must be finite non-negative numbers.";
  }

  return null;
}

function invalidSymbolMessage(symbol: string): string | null {
  const trimmed = symbol.trim();

  if (trimmed.length === 0) {
    return "Raw chart symbol is required.";
  }

  if (trimmed.length > RAW_SYMBOL_MAX_CHARS) {
    return `Raw chart symbol must be ${RAW_SYMBOL_MAX_CHARS} characters or fewer.`;
  }

  if (!/^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(trimmed)) {
    return "Raw chart symbol must be exchange-qualified, for example NASDAQ:NVDA.";
  }

  return null;
}

function invalidTimeframeMessage(timeframe: string): string | null {
  const trimmed = timeframe.trim();

  if (trimmed.length === 0) {
    return "Raw chart timeframe is required.";
  }

  if (trimmed.length > RAW_TIMEFRAME_MAX_CHARS) {
    return `Raw chart timeframe must be ${RAW_TIMEFRAME_MAX_CHARS} characters or fewer.`;
  }

  if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
    return "Raw chart timeframe must contain only letters and numbers.";
  }

  return null;
}

function invalidChartTypeMessage(chartType: RawChartTypeValue): string | null {
  if (typeof chartType === "number") {
    return Number.isInteger(chartType) && chartType >= 0 && chartType <= 100
      ? null
      : "Raw chart type number must be an integer from 0 through 100.";
  }

  const trimmed = chartType.trim();

  if (trimmed.length === 0) {
    return "Raw chart type is required.";
  }

  if (trimmed.length > RAW_CHART_TYPE_MAX_CHARS) {
    return `Raw chart type must be ${RAW_CHART_TYPE_MAX_CHARS} characters or fewer.`;
  }

  return null;
}

function invalidRangeMessage(range: RawVisibleRange): string | null {
  if (
    !Number.isFinite(range.from) ||
    !Number.isFinite(range.to) ||
    !Number.isInteger(range.from) ||
    !Number.isInteger(range.to) ||
    range.from < 0 ||
    range.to < 0
  ) {
    return "Raw visible range values must be non-negative Unix timestamp integers.";
  }

  if (range.from >= range.to) {
    return "Raw visible range from must be earlier than to.";
  }

  return null;
}

function invalidBarCountMessage(barCount: number): string | null {
  if (
    !Number.isInteger(barCount) ||
    barCount <= 0 ||
    barCount > RAW_CHART_DATA_BAR_COUNT_LIMIT
  ) {
    return `Raw chart data barCount must be an integer from 1 to ${RAW_CHART_DATA_BAR_COUNT_LIMIT}.`;
  }

  return null;
}

function invalidStudyValuesMessage(options: {
  maxStudies: number;
  maxValuesPerStudy: number;
  studyName?: string;
}): string | null {
  if (
    !Number.isInteger(options.maxStudies) ||
    options.maxStudies <= 0 ||
    options.maxStudies > RAW_STUDY_VALUES_MAX_STUDIES_LIMIT
  ) {
    return `Raw study values maxStudies must be an integer from 1 to ${RAW_STUDY_VALUES_MAX_STUDIES_LIMIT}.`;
  }

  if (
    !Number.isInteger(options.maxValuesPerStudy) ||
    options.maxValuesPerStudy <= 0 ||
    options.maxValuesPerStudy > RAW_STUDY_VALUES_MAX_VALUES_LIMIT
  ) {
    return `Raw study values maxValuesPerStudy must be an integer from 1 to ${RAW_STUDY_VALUES_MAX_VALUES_LIMIT}.`;
  }

  if (
    options.studyName !== undefined &&
    (options.studyName.trim().length === 0 ||
      options.studyName.length > RAW_INDICATOR_NAME_MAX_CHARS)
  ) {
    return `Raw studyName filter must be 1 to ${RAW_INDICATOR_NAME_MAX_CHARS} characters when provided.`;
  }

  return null;
}

function invalidBoundedIdMessage(options: {
  value: string;
  name: string;
  maxChars: number;
}): string | null {
  const trimmed = options.value.trim();

  if (trimmed.length === 0) {
    return `Raw ${options.name} is required.`;
  }

  if (trimmed.length > options.maxChars) {
    return `Raw ${options.name} must be ${options.maxChars} characters or fewer.`;
  }

  return null;
}

function invalidTargetIdMessage(targetId: string): string | null {
  return invalidBoundedIdMessage({
    value: targetId,
    name: "target id",
    maxChars: RAW_TARGET_ID_MAX_CHARS
  });
}

function invalidPaneIdMessage(paneId: string): string | null {
  return invalidBoundedIdMessage({
    value: paneId,
    name: "pane id",
    maxChars: RAW_PANE_ID_MAX_CHARS
  });
}

function invalidLayoutIdMessage(layoutId: string): string | null {
  return invalidBoundedIdMessage({
    value: layoutId,
    name: "layout id",
    maxChars: RAW_LAYOUT_ID_MAX_CHARS
  });
}

function invalidPaneLayoutMessage(layout: RawPaneLayoutValue): string | null {
  if (
    layout !== "single" &&
    layout !== "two-vertical" &&
    layout !== "two-horizontal" &&
    layout !== "three-vertical" &&
    layout !== "four-grid"
  ) {
    return "Raw pane layout must be single, two-vertical, two-horizontal, three-vertical, or four-grid.";
  }

  return null;
}

function invalidBatchChartMessage(
  options: RawBatchChartOptions
): string | null {
  if (!Array.isArray(options.steps) || options.steps.length === 0) {
    return "Raw batch chart steps must include at least one explicit action.";
  }

  if (options.steps.length > RAW_BATCH_MAX_STEPS) {
    return `Raw batch chart steps may include at most ${RAW_BATCH_MAX_STEPS} actions.`;
  }

  for (let index = 0; index < options.steps.length; index += 1) {
    const step = options.steps[index]!;
    const hasSymbol = typeof step.symbol === "string";
    const hasTimeframe = typeof step.timeframe === "string";

    if (!hasSymbol && !hasTimeframe) {
      return `Raw batch chart step ${index + 1} must include a symbol, timeframe, or both.`;
    }

    if (hasSymbol) {
      const invalidSymbol = invalidSymbolMessage(step.symbol!);

      if (invalidSymbol) {
        return `Raw batch chart step ${index + 1}: ${invalidSymbol}`;
      }
    }

    if (hasTimeframe) {
      const invalidTimeframe = invalidTimeframeMessage(step.timeframe!);

      if (invalidTimeframe) {
        return `Raw batch chart step ${index + 1}: ${invalidTimeframe}`;
      }
    }
  }

  return null;
}

function invalidReplayPlayPauseModeMessage(
  mode: RawReplayPlayPauseMode
): string | null {
  if (mode !== "play" && mode !== "pause" && mode !== "toggle") {
    return "Raw replay play/pause mode must be play, pause, or toggle.";
  }

  return null;
}

function invalidReplayStepMessage(options: RawReplayStepOptions): string | null {
  if (options.direction !== "forward" && options.direction !== "back") {
    return "Raw replay step direction must be forward or back.";
  }

  const steps = options.steps ?? 1;

  if (
    !Number.isInteger(steps) ||
    steps <= 0 ||
    steps > RAW_REPLAY_MAX_STEPS
  ) {
    return `Raw replay steps must be an integer from 1 to ${RAW_REPLAY_MAX_STEPS}.`;
  }

  return null;
}

function invalidReplaySpeedMessage(speed: number): string | null {
  if (
    !Number.isFinite(speed) ||
    speed < RAW_REPLAY_MIN_SPEED ||
    speed > RAW_REPLAY_MAX_SPEED
  ) {
    return `Raw replay speed must be a finite number from ${RAW_REPLAY_MIN_SPEED} to ${RAW_REPLAY_MAX_SPEED}.`;
  }

  return null;
}

function invalidIndicatorNameMessage(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return "Raw indicator name is required.";
  }

  if (trimmed.length > RAW_INDICATOR_NAME_MAX_CHARS) {
    return `Raw indicator name must be ${RAW_INDICATOR_NAME_MAX_CHARS} characters or fewer.`;
  }

  return null;
}

function invalidEntityIdMessage(entityId: string): string | null {
  const trimmed = entityId.trim();

  if (trimmed.length === 0) {
    return "Raw entity id is required.";
  }

  if (trimmed.length > RAW_ENTITY_ID_MAX_CHARS) {
    return `Raw entity id must be ${RAW_ENTITY_ID_MAX_CHARS} characters or fewer.`;
  }

  return null;
}

function invalidDrawingPointMessage(point: RawDrawingPoint, index: number): string | null {
  if (
    !Number.isFinite(point.time) ||
    !Number.isInteger(point.time) ||
    point.time < 0
  ) {
    return `Raw drawing point ${index + 1} time must be a non-negative Unix timestamp integer.`;
  }

  if (!Number.isFinite(point.price) || point.price <= 0) {
    return `Raw drawing point ${index + 1} price must be a finite positive number.`;
  }

  return null;
}

function invalidDrawingOverridesMessage(
  overrides: Record<string, RawDrawingOverrideValue> | undefined
): string | null {
  if (!overrides) {
    return null;
  }

  const entries = Object.entries(overrides);

  if (entries.length > RAW_DRAWING_MAX_OVERRIDES) {
    return `Raw drawing overrides may include at most ${RAW_DRAWING_MAX_OVERRIDES} keys.`;
  }

  for (const [key, value] of entries) {
    if (key.trim().length === 0) {
      return "Raw drawing override keys must be non-empty strings.";
    }

    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return "Raw drawing overrides may only contain string, number, boolean, or null values.";
    }
  }

  return null;
}

function invalidDrawShapeMessage(options: RawDrawShapeOptions): string | null {
  if (
    options.shapeType !== "horizontal-line" &&
    options.shapeType !== "trend-line" &&
    options.shapeType !== "rectangle" &&
    options.shapeType !== "text"
  ) {
    return "Raw drawing shapeType must be horizontal-line, trend-line, rectangle, or text.";
  }

  if (
    !Array.isArray(options.points) ||
    options.points.length === 0 ||
    options.points.length > RAW_DRAWING_MAX_POINTS
  ) {
    return `Raw drawing points must include 1 to ${RAW_DRAWING_MAX_POINTS} price/time anchors.`;
  }

  const expectedPoints =
    options.shapeType === "trend-line" || options.shapeType === "rectangle"
      ? 2
      : 1;

  if (options.points.length !== expectedPoints) {
    return `Raw drawing ${options.shapeType} requires exactly ${expectedPoints} price/time anchor${expectedPoints === 1 ? "" : "s"}.`;
  }

  for (let index = 0; index < options.points.length; index += 1) {
    const invalidPoint = invalidDrawingPointMessage(options.points[index]!, index);

    if (invalidPoint) {
      return invalidPoint;
    }
  }

  if (
    options.shapeType === "text" &&
    (!options.text || options.text.trim().length === 0)
  ) {
    return "Raw drawing text shape requires non-empty text.";
  }

  if (
    options.text !== undefined &&
    options.text.length > RAW_DRAWING_TEXT_MAX_CHARS
  ) {
    return `Raw drawing text must be ${RAW_DRAWING_TEXT_MAX_CHARS} characters or fewer.`;
  }

  return invalidDrawingOverridesMessage(options.overrides);
}

function invalidClearAllMessage(confirmClearAll: boolean): string | null {
  return confirmClearAll
    ? null
    : "Raw drawing clear-all requires confirmClearAll=true because it removes all native drawings on the active chart.";
}

function invalidPineSourceMessage(source: string): string | null {
  if (source.length === 0) {
    return "Raw Pine source is required.";
  }

  if (source.length > RAW_PINE_SOURCE_MAX_CHARS) {
    return `Raw Pine source must be ${RAW_PINE_SOURCE_MAX_CHARS} characters or fewer.`;
  }

  return null;
}

function invalidPineGetSourceLimitMessage(maxSourceChars: number): string | null {
  if (
    !Number.isInteger(maxSourceChars) ||
    maxSourceChars <= 0 ||
    maxSourceChars > RAW_PINE_GET_SOURCE_MAX_CHARS_LIMIT
  ) {
    return `Raw Pine source retrieval maxSourceChars must be an integer from 1 to ${RAW_PINE_GET_SOURCE_MAX_CHARS_LIMIT}.`;
  }

  return null;
}

function invalidPineSettleMsMessage(settleMs: number): string | null {
  if (
    !Number.isInteger(settleMs) ||
    settleMs < 0 ||
    settleMs > RAW_PINE_ACTION_SETTLE_MS_LIMIT
  ) {
    return `Raw Pine settleMs must be an integer from 0 to ${RAW_PINE_ACTION_SETTLE_MS_LIMIT}.`;
  }

  return null;
}

function normalizedClickScopeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function forbiddenClickScopeMessage(value: string): string | null {
  for (const pattern of RAW_SELECTOR_CLICK_FORBIDDEN_PATTERNS) {
    if (pattern.test(value)) {
      return "Raw selector click refuses broker/order, alert, account, security, login, billing, or subscription UI targets.";
    }
  }

  return null;
}

function invalidSelectorClickScopeMessage(options: {
  strategy: RawElementSelectorStrategy;
  value: string;
}): string | null {
  const normalizedValue = normalizedClickScopeText(options.value);

  if (
    options.strategy === "css" &&
    RAW_SELECTOR_CLICK_BROAD_CSS.has(normalizedValue)
  ) {
    return "Raw selector click requires a narrow TradingView chart-control selector.";
  }

  return forbiddenClickScopeMessage(options.value);
}

function elementClickScopeMessage(element: RawElementSummary): string | null {
  return forbiddenClickScopeMessage(
    [
      element.text,
      element.ariaLabel,
      element.dataName,
      element.role,
      element.id,
      element.className
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
  );
}

function normalizeEvaluateResponse(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const response = value as RuntimeEvaluateResponse;

  if (response.exceptionDetails) {
    const description = response.exceptionDetails.exception?.description;
    const text = response.exceptionDetails.text;
    throw new Error(description ?? text ?? "Raw evaluate threw an exception.");
  }

  if (!response.result) {
    return value;
  }

  if ("value" in response.result) {
    return response.result.value;
  }

  if (response.result.unserializableValue) {
    return response.result.unserializableValue;
  }

  return {
    type: response.result.type,
    description: response.result.description
  };
}

function compactChartTarget(target: CdpTarget): {
  id: string;
  title: string;
  url: string;
  hasWebSocketDebuggerUrl: boolean;
} {
  return {
    id: target.id,
    title: target.title,
    url: target.url,
    hasWebSocketDebuggerUrl: typeof target.webSocketDebuggerUrl === "string"
  };
}

async function readRawChartTargets(options: RawAutomationBaseOptions): Promise<{
  endpoint: string;
  targets: CdpTarget[];
}> {
  const endpoint = endpointOptions(options);
  const endpointUrl = formatCdpEndpoint(endpoint);
  const fetchJson = options.fetchJson ?? fetchCdpJson;
  const targetsJson = await fetchJson("/json/list", {
    host: endpoint.host,
    port: endpoint.port,
    timeoutMs: endpoint.timeoutMs
  });
  const targets = normalizeCdpTargets(targetsJson);

  if (!targets) {
    throw new Error("CDP /json/list did not return a target array.");
  }

  return {
    endpoint: endpointUrl,
    targets: targets.filter(isTradingViewChartTarget)
  };
}

export async function runRawListTabs(
  options: RawListTabsOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();

  try {
    const { endpoint: endpointUrl, targets } = await readRawChartTargets(options);

    return {
      ok: true,
      action: "list-tabs",
      endpoint: endpointUrl,
      executedAt,
      value: {
        targetCount: targets.length,
        targets: targets.map(compactChartTarget),
        warnings:
          targets.length === 0
            ? ["No active local TradingView chart targets were exposed by CDP."]
            : []
      },
      warnings: []
    };
  } catch (error: unknown) {
    return failureResult("list-tabs", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: `Could not list TradingView chart targets: ${errorMessage(error)}`
    });
  }
}

export async function runRawFocusTab(
  options: RawFocusTabOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const targetId = options.targetId.trim();
  const invalidTargetId = invalidTargetIdMessage(options.targetId);

  if (invalidTargetId) {
    return failureResult("focus-tab", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidTargetId
    });
  }

  let endpointUrl = formatCdpEndpoint(endpoint);
  let target: CdpTarget | undefined;

  try {
    const targetList = await readRawChartTargets(options);
    endpointUrl = targetList.endpoint;
    target = targetList.targets.find((candidate) => candidate.id === targetId);

    if (!target) {
      return failureResult("focus-tab", {
        endpoint: endpointUrl,
        executedAt,
        error:
          "No active local TradingView chart target matched the requested target id.",
        warnings: targetList.targets.map(
          (candidate) => `Available chart target: ${candidate.id}`
        )
      });
    }

    const webSocketDebuggerUrl = target.webSocketDebuggerUrl;

    if (!webSocketDebuggerUrl) {
      return failureResult("focus-tab", {
        endpoint: endpointUrl,
        executedAt,
        target,
        error:
          "TradingView chart target does not expose a page WebSocket debugger URL."
      });
    }

    const makeClient =
      options.pageClientFactory ??
      ((_target, clientOptions) =>
        createLiveRawTradingViewPageClient(
          webSocketDebuggerUrl,
          clientOptions
        ));
    const client = await makeClient(target, {
      timeoutMs: endpoint.timeoutMs
    });

    try {
      await client.bringToFront();

      return successResult("focus-tab", {
        endpoint: endpointUrl,
        executedAt,
        target,
        value: {
          focused: true,
          target: compactChartTarget(target)
        }
      });
    } finally {
      await client.close();
    }
  } catch (error: unknown) {
    if (target) {
      return failureResult("focus-tab", {
        endpoint: endpointUrl,
        executedAt,
        target,
        error: `Could not focus TradingView chart target: ${errorMessage(error)}`
      });
    }

    return failureResult("focus-tab", {
      endpoint: endpointUrl,
      executedAt,
      error: `Could not focus TradingView chart target: ${errorMessage(error)}`
    });
  }
}

const RAW_CHART_CONTROL_EVALUATOR = String.raw`
async (command, args) => {
  const MAX_STUDIES = 50;
  const MAX_TEXT = 160;
  const root = globalThis;

  function compactText(value) {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > MAX_TEXT ? trimmed.slice(0, MAX_TEXT) + "..." : trimmed;
  }

  function methodValue(target, names) {
    for (const name of names) {
      if (target && typeof target[name] === "function") {
        try {
          return target[name]();
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  function propertyValue(target, names) {
    for (const name of names) {
      const value = target?.[name];
      if (typeof value !== "undefined" && typeof value !== "function") {
        return value;
      }
    }
    return undefined;
  }

  function normalizeRange(value) {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const from = Number(value.from);
    const to = Number(value.to);
    return Number.isFinite(from) && Number.isFinite(to)
      ? { from: Math.trunc(from), to: Math.trunc(to) }
      : undefined;
  }

  function valueFrom(entity, names) {
    for (const name of names) {
      const candidate = entity?.[name];
      if (typeof candidate === "function") {
        try {
          const value = candidate.call(entity);
          if (typeof value !== "undefined" && value !== null) {
            return value;
          }
        } catch {
          continue;
        }
      } else if (typeof candidate !== "undefined" && candidate !== null) {
        return candidate;
      }
    }
    return undefined;
  }

  function studySummary(entity) {
    const id = compactText(String(valueFrom(entity, ["id", "entityId", "studyId", "paneEntityId"]) ?? ""));
    if (!id) {
      return undefined;
    }
    const nameValue = valueFrom(entity, ["name", "title", "description", "shortName"]);
    const name = compactText(typeof nameValue === "string" ? nameValue : String(nameValue ?? ""));
    return name ? { id, name } : { id };
  }

  function getStudies(chart, warnings) {
    const rawStudies = methodValue(chart, ["getAllStudies", "getStudies"]);
    if (!Array.isArray(rawStudies)) {
      warnings.push("TradingView chart API did not expose visible study identifiers.");
      return [];
    }
    const studies = rawStudies.map(studySummary).filter(Boolean).slice(0, MAX_STUDIES);
    if (rawStudies.length > MAX_STUDIES) {
      warnings.push("Study list truncated to " + MAX_STUDIES + " entries.");
    }
    return studies;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  function compactNumber(value) {
    const number = finiteNumber(value);
    return typeof number === "number" ? Number(number.toFixed(6)) : undefined;
  }

  function primitiveValue(value) {
    if (value === null || typeof value === "undefined") {
      return undefined;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? compactNumber(value) : undefined;
    }
    if (typeof value === "string") {
      const text = compactText(value);
      return text && text !== "∅" && text !== "NaN" ? text : undefined;
    }
    if (typeof value === "boolean") {
      return value;
    }
    return undefined;
  }

  function normalizeBar(value) {
    if (Array.isArray(value)) {
      const time = finiteNumber(value[0]);
      const open = compactNumber(value[1]);
      const high = compactNumber(value[2]);
      const low = compactNumber(value[3]);
      const close = compactNumber(value[4]);
      const volume = compactNumber(value[5]);
      if (
        typeof time === "number" &&
        typeof open === "number" &&
        typeof high === "number" &&
        typeof low === "number" &&
        typeof close === "number"
      ) {
        const bar = {
          timestamp: Math.trunc(time),
          open,
          high,
          low,
          close
        };
        if (typeof volume === "number") {
          bar.volume = volume;
        }
        return bar;
      }
      return undefined;
    }

    if (!value || typeof value !== "object") {
      return undefined;
    }

    const time = finiteNumber(
      value.time ??
        value.timestamp ??
        value.time_t ??
        value.datetime ??
        value.date
    );
    const open = compactNumber(value.open ?? value.o);
    const high = compactNumber(value.high ?? value.h);
    const low = compactNumber(value.low ?? value.l);
    const close = compactNumber(value.close ?? value.c ?? value.last ?? value.value);
    const volume = compactNumber(value.volume ?? value.v);

    if (
      typeof time !== "number" ||
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number"
    ) {
      return undefined;
    }

    const bar = {
      timestamp: Math.trunc(time),
      open,
      high,
      low,
      close
    };
    if (typeof volume === "number") {
      bar.volume = volume;
    }
    return bar;
  }

  function normalizeBarArray(value, limit) {
    const candidates = Array.isArray(value)
      ? value
      : Array.isArray(value?.bars)
        ? value.bars
        : Array.isArray(value?.data)
          ? value.data
          : Array.isArray(value?.rows)
            ? value.rows
            : Array.isArray(value?.series)
              ? value.series
              : undefined;
    if (!Array.isArray(candidates)) {
      return undefined;
    }
    const bars = candidates.map(normalizeBar).filter(Boolean);
    return bars.length > 0
      ? {
          bars: bars.slice(-limit),
          totalAvailable: bars.length
        }
      : undefined;
  }

  function readBarsObject(value, limit) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.lastIndex !== "function" ||
      typeof value.valueAt !== "function"
    ) {
      return undefined;
    }

    const end = Number(value.lastIndex());
    const first = typeof value.firstIndex === "function"
      ? Number(value.firstIndex())
      : 0;
    if (!Number.isFinite(end) || !Number.isFinite(first)) {
      return undefined;
    }

    const start = Math.max(Math.trunc(first), Math.trunc(end) - limit + 1);
    const bars = [];
    for (let index = start; index <= end; index += 1) {
      const bar = normalizeBar(value.valueAt(index));
      if (bar) {
        bars.push(bar);
      }
    }

    if (bars.length === 0) {
      return undefined;
    }

    let totalAvailable = Math.trunc(end - first + 1);
    if (typeof value.size === "function") {
      const size = Number(value.size());
      if (Number.isFinite(size)) {
        totalAvailable = Math.trunc(size);
      }
    }

    return {
      bars,
      totalAvailable
    };
  }

  function rootActiveWidgetValue() {
    try {
      const activeWidget = root.TradingViewApi?._activeChartWidgetWV;
      return typeof activeWidget?.value === "function"
        ? activeWidget.value()
        : undefined;
    } catch {
      return undefined;
    }
  }

  function rootMainSeriesBars() {
    try {
      return rootActiveWidgetValue()?._chartWidget
        ?.model?.()
        ?.mainSeries?.()
        ?.bars?.();
    } catch {
      return undefined;
    }
  }

  async function asyncMethodValue(target, names, args = []) {
    for (const name of names) {
      if (target && typeof target[name] === "function") {
        try {
          const value = await awaitMaybe(target[name](...args));
          if (typeof value !== "undefined" && value !== null) {
            return value;
          }
        } catch {
          continue;
        }
      }
    }
    return undefined;
  }

  async function readBars(chart, limit, warnings) {
    const fixture = root.__TVMCP_CHART_DATA__;
    const fixtureBars = normalizeBarArray(fixture?.bars ?? fixture?.ohlcv, limit);
    if (fixtureBars) {
      return {
        ...fixtureBars,
        source: "fixture"
      };
    }

    const direct = await asyncMethodValue(chart, [
      "exportData",
      "getSeriesData",
      "getVisibleSeriesData",
      "getBars"
    ]);
    const directBars = normalizeBarArray(direct, limit);
    if (directBars) {
      return {
        ...directBars,
        source: "chart-api"
      };
    }

    const chartBars =
      readBarsObject(valueFrom(chart, ["bars", "mainSeriesBars"]), limit) ??
      normalizeBarArray(valueFrom(chart, ["bars", "mainSeriesBars"]), limit);
    if (chartBars) {
      return {
        ...chartBars,
        source: "chart-bars"
      };
    }

    const rootBars = readBarsObject(rootMainSeriesBars(), limit);
    if (rootBars) {
      return {
        ...rootBars,
        source: "tradingview-main-series"
      };
    }

    warnings.push("TradingView chart API did not expose compact OHLCV bars.");
    return undefined;
  }

  function summarizeBars(barData, requestedBarCount, warnings) {
    const bars = barData.bars;
    if (!Array.isArray(bars) || bars.length === 0) {
      return { error: "TradingView chart API did not expose OHLCV bars for summary extraction." };
    }

    const first = bars[0];
    const last = bars[bars.length - 1];
    const highs = bars.map((bar) => bar.high).filter((value) => typeof value === "number");
    const lows = bars.map((bar) => bar.low).filter((value) => typeof value === "number");
    const volumes = bars.map((bar) => bar.volume).filter((value) => typeof value === "number");
    const high = compactNumber(Math.max(...highs));
    const low = compactNumber(Math.min(...lows));
    const range = typeof high === "number" && typeof low === "number"
      ? compactNumber(high - low)
      : undefined;
    const change = compactNumber(last.close - first.open);
    const changePct = first.open !== 0
      ? compactNumber(((last.close - first.open) / first.open) * 100)
      : undefined;
    const volumeSum = volumes.reduce((sum, volume) => sum + volume, 0);
    const summary = {
      requestedBarCount,
      barCount: bars.length,
      totalAvailable: barData.totalAvailable,
      source: barData.source,
      period: {
        from: first.timestamp,
        to: last.timestamp
      },
      open: first.open,
      close: last.close,
      high,
      low,
      range,
      change,
      changePct,
      lastBar: last,
      warnings
    };

    if (volumes.length > 0) {
      summary.volume = {
        total: compactNumber(volumeSum),
        average: compactNumber(volumeSum / volumes.length),
        min: compactNumber(Math.min(...volumes)),
        max: compactNumber(Math.max(...volumes))
      };
    }

    return summary;
  }

  async function chartDataSummary(chart, args) {
    const warnings = [];
    const requestedBarCount = Math.trunc(Number(args.barCount));
    const barData = await readBars(chart, requestedBarCount, warnings);
    if (!barData) {
      return {
        error: "Could not extract compact OHLCV data from the active chart.",
        warnings
      };
    }
    return summarizeBars(barData, requestedBarCount, warnings);
  }

  async function quoteSnapshot(chart) {
    const warnings = [];
    const ext = methodValue(chart, ["symbolExt"]) ?? {};
    const symbol = compactText(
      methodValue(chart, ["symbol"]) ??
        propertyValue(ext, ["symbol", "full_name", "pro_name", "ticker"])
    );
    const quote = {};
    if (symbol) {
      quote.symbol = symbol;
    } else {
      warnings.push("TradingView chart API did not expose the current symbol.");
    }
    const description = compactText(propertyValue(ext, ["description", "name"]));
    const exchange = compactText(propertyValue(ext, ["exchange"]));
    const type = compactText(propertyValue(ext, ["type"]));
    if (description) {
      quote.description = description;
    }
    if (exchange) {
      quote.exchange = exchange;
    }
    if (type) {
      quote.type = type;
    }

    const barData = await readBars(chart, 1, warnings);
    const lastBar = barData?.bars?.[barData.bars.length - 1];
    if (lastBar) {
      quote.timestamp = lastBar.timestamp;
      quote.open = lastBar.open;
      quote.high = lastBar.high;
      quote.low = lastBar.low;
      quote.close = lastBar.close;
      quote.last = lastBar.close;
      if (typeof lastBar.volume === "number") {
        quote.volume = lastBar.volume;
      }
      quote.source = barData.source;
    }

    if (typeof quote.last !== "number" && typeof quote.close !== "number") {
      return {
        error: "TradingView chart API did not expose a current bar or quote price.",
        warnings
      };
    }

    quote.warnings = warnings;
    return quote;
  }

  function studyDisplayName(entity, fallback) {
    const nameValue = valueFrom(entity, [
      "name",
      "title",
      "description",
      "shortName"
    ]);
    const name = compactText(typeof nameValue === "string" ? nameValue : String(nameValue ?? ""));
    return name || fallback;
  }

  function normalizeStudyValueItem(item, index) {
    if (!item || typeof item !== "object") {
      const value = primitiveValue(item);
      return typeof value !== "undefined"
        ? {
            label: "value_" + (index + 1),
            value
          }
        : undefined;
    }

    const label = compactText(
      String(
        item.title ??
          item._title ??
          item.name ??
          item.id ??
          item.label ??
          ("value_" + (index + 1))
      )
    );
    const value = primitiveValue(
      item.value ??
        item._value ??
        item.last ??
        item.close ??
        item.y ??
        item.text
    );
    return label && typeof value !== "undefined"
      ? {
          label,
          value
        }
      : undefined;
  }

  function studyValueEntries(value, maxValues) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .map(normalizeStudyValueItem)
        .filter(Boolean)
        .slice(0, maxValues);
    }

    if (typeof value === "object") {
      const entries = [];
      for (const [key, candidate] of Object.entries(value)) {
        if (entries.length >= maxValues) {
          break;
        }
        const primitive = primitiveValue(candidate);
        if (typeof primitive !== "undefined") {
          entries.push({
            label: compactText(key) ?? key,
            value: primitive
          });
        }
      }
      return entries;
    }

    const primitive = primitiveValue(value);
    return typeof primitive !== "undefined"
      ? [
          {
            label: "value",
            value: primitive
          }
        ]
      : [];
  }

  function readStudyValuesFromEntity(entity, maxValues) {
    const dataWindow = valueFrom(entity, ["dataWindowView"]);
    const dataWindowItems = valueFrom(dataWindow, ["items"]);
    const dataWindowValues = studyValueEntries(dataWindowItems, maxValues);
    if (dataWindowValues.length > 0) {
      return {
        values: dataWindowValues,
        source: "data-window"
      };
    }

    for (const key of [
      "getValues",
      "values",
      "lastValues",
      "plotValues",
      "plots",
      "data"
    ]) {
      const rawValues = valueFrom(entity, [key]);
      const values = studyValueEntries(rawValues, maxValues);
      if (values.length > 0) {
        return {
          values,
          source: key
        };
      }
    }

    return {
      values: [],
      source: "unavailable"
    };
  }

  function studyVisible(entity) {
    const visible = valueFrom(entity, ["isVisible", "visible", "getVisible"]);
    return typeof visible === "boolean" ? visible : undefined;
  }

  function readStudyEntity(chart, entityOrSummary) {
    const id = compactText(
      String(valueFrom(entityOrSummary, ["id", "entityId", "studyId", "paneEntityId"]) ?? "")
    );
    if (id && typeof chart.getStudyById === "function") {
      try {
        return {
          id,
          entity: chart.getStudyById(id) ?? entityOrSummary
        };
      } catch {
        return {
          id,
          entity: entityOrSummary
        };
      }
    }
    return {
      id,
      entity: entityOrSummary
    };
  }

  function readStudyValues(chart, args) {
    const warnings = [];
    const rawStudies = methodValue(chart, ["getAllStudies", "getStudies"]);
    if (!Array.isArray(rawStudies)) {
      const error = "TradingView chart API did not expose visible study identifiers for study-value extraction.";
      return {
        error,
        warnings: [error]
      };
    }

    const studyNameFilter = compactText(String(args.studyName ?? "")).toLowerCase();
    const studies = [];
    let considered = 0;
    for (const rawStudy of rawStudies) {
      const { id, entity } = readStudyEntity(chart, rawStudy);
      const fallbackName = studyDisplayName(rawStudy, id) || "Study";
      const name = studyDisplayName(entity, fallbackName) || fallbackName;
      if (studyNameFilter && !name.toLowerCase().includes(studyNameFilter)) {
        continue;
      }
      const visible = studyVisible(entity);
      if (visible === false) {
        continue;
      }
      considered += 1;
      if (studies.length >= args.maxStudies) {
        continue;
      }
      const valueData = readStudyValuesFromEntity(entity, args.maxValuesPerStudy);
      if (valueData.values.length === 0) {
        continue;
      }
      const study = {
        id: id || name,
        name,
        valueCount: valueData.values.length,
        source: valueData.source,
        values: valueData.values
      };
      if (typeof visible === "boolean") {
        study.visible = visible;
      }
      studies.push(study);
    }

    if (considered > args.maxStudies) {
      warnings.push("Study values truncated to " + args.maxStudies + " visible studies.");
    }
    if (studies.length === 0) {
      warnings.push("No visible study values were exposed by the active chart API.");
    }

    return {
      studyCount: studies.length,
      totalVisibleStudies: considered,
      maxStudies: args.maxStudies,
      maxValuesPerStudy: args.maxValuesPerStudy,
      studies,
      warnings
    };
  }

  function normalizeDrawingPoint(value) {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const time = Number(value.time ?? value.timestamp ?? value.time_t);
    const price = Number(value.price ?? value.value);
    return Number.isFinite(time) && Number.isFinite(price)
      ? { time: Math.trunc(time), price }
      : undefined;
  }

  function normalizeDrawingPoints(value) {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const points = value.map(normalizeDrawingPoint).filter(Boolean);
    return points.length > 0 ? points.slice(0, 4) : undefined;
  }

  function compactPrimitiveRecord(value, maxKeys) {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const result = {};
    let count = 0;
    for (const [key, candidate] of Object.entries(value)) {
      if (count >= maxKeys) {
        break;
      }
      if (
        candidate === null ||
        typeof candidate === "string" ||
        typeof candidate === "number" ||
        typeof candidate === "boolean"
      ) {
        result[key] =
          typeof candidate === "string" ? compactText(candidate) : candidate;
        count += 1;
      } else if (Array.isArray(candidate)) {
        const primitives = candidate
          .filter(
            (item) =>
              item === null ||
              typeof item === "string" ||
              typeof item === "number" ||
              typeof item === "boolean"
          )
          .slice(0, 10);
        if (primitives.length > 0) {
          result[key] = primitives;
          count += 1;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  function shapeEntity(chart, id) {
    if (typeof chart.getShapeById !== "function") {
      return undefined;
    }
    try {
      return chart.getShapeById(id);
    } catch {
      return undefined;
    }
  }

  function drawingSummary(chart, entityOrId) {
    const entity =
      typeof entityOrId === "string" || typeof entityOrId === "number"
        ? shapeEntity(chart, String(entityOrId))
        : entityOrId;
    const id = compactText(
      String(
        valueFrom(entity, ["id", "entityId", "shapeId", "paneEntityId"]) ??
          (typeof entityOrId === "string" || typeof entityOrId === "number"
            ? entityOrId
            : "")
      )
    );
    if (!id) {
      return undefined;
    }
    const summary = { id };
    const typeValue = valueFrom(entity, ["shapeType", "type", "toolname", "toolName", "name"]);
    const nameValue = valueFrom(entity, ["title", "name", "description"]);
    const points = normalizeDrawingPoints(valueFrom(entity, ["getPoints", "points"]));
    const textValue = valueFrom(entity, ["text", "getText"]);
    const visible = valueFrom(entity, ["isVisible", "visible", "getVisible"]);
    const locked = valueFrom(entity, ["isLocked", "locked"]);
    const selectable = valueFrom(entity, ["isSelectable", "selectable"]);
    const type = compactText(typeof typeValue === "string" ? typeValue : String(typeValue ?? ""));
    const name = compactText(typeof nameValue === "string" ? nameValue : String(nameValue ?? ""));
    const text = compactText(typeof textValue === "string" ? textValue : String(textValue ?? ""));
    if (type) {
      summary.type = type;
    }
    if (name && name !== type) {
      summary.name = name;
    }
    if (points) {
      summary.points = points;
    }
    if (text) {
      summary.text = text;
    }
    if (typeof visible === "boolean") {
      summary.visible = visible;
    }
    if (typeof locked === "boolean") {
      summary.locked = locked;
    }
    if (typeof selectable === "boolean") {
      summary.selectable = selectable;
    }
    return summary;
  }

  function drawingProperties(chart, entityId) {
    const entity = shapeEntity(chart, entityId);
    if (!entity) {
      return { error: "TradingView chart API does not expose getShapeById() for native drawing properties, or the drawing id was not found." };
    }
    const summary = drawingSummary(chart, entity);
    if (!summary) {
      return { error: "TradingView drawing properties did not include a usable drawing id." };
    }
    const rawProperties = valueFrom(entity, ["getProperties", "properties", "state"]);
    const rawStyle = valueFrom(entity, ["getStyle", "style", "overrides"]);
    const properties = compactPrimitiveRecord(rawProperties, 40);
    const style = compactPrimitiveRecord(rawStyle, 40);
    const drawing = { ...summary };
    if (properties) {
      drawing.properties = properties;
    }
    if (style) {
      drawing.style = style;
    }
    return { drawing };
  }

  function readDrawings(chart) {
    const warnings = [];
    const rawDrawings = methodValue(chart, [
      "getAllShapes",
      "getAllDrawings",
      "getAllDrawingObjects"
    ]);
    if (!Array.isArray(rawDrawings)) {
      const error = "TradingView chart API did not expose native drawing identifiers through getAllShapes(), getAllDrawings(), or getAllDrawingObjects().";
      return {
        drawings: [],
        count: 0,
        error,
        warnings: [error]
      };
    }
    const drawings = rawDrawings
      .map((drawing) => drawingSummary(chart, drawing))
      .filter(Boolean)
      .slice(0, MAX_STUDIES);
    if (rawDrawings.length > MAX_STUDIES) {
      warnings.push("Drawing list truncated to " + MAX_STUDIES + " entries.");
    }
    if (drawings.length < rawDrawings.length && typeof chart.getShapeById !== "function") {
      warnings.push("TradingView chart API exposed drawing ids but not getShapeById(), so type/name/properties may be unavailable.");
    }
    return {
      drawings,
      count: rawDrawings.length,
      warnings
    };
  }

  function nativeShapeName(shapeType) {
    if (shapeType === "horizontal-line") {
      return "horizontal_line";
    }
    if (shapeType === "trend-line") {
      return "trend_line";
    }
    if (shapeType === "rectangle") {
      return "rectangle";
    }
    if (shapeType === "text") {
      return "text";
    }
    if (shapeType === "fib-retracement") {
      return "fib_retracement";
    }
    return shapeType;
  }

  function drawingCreateOptions(args) {
    const options = {
      shape: nativeShapeName(args.shapeType)
    };
    if (args.text) {
      options.text = args.text;
    }
    if (args.overrides && typeof args.overrides === "object") {
      options.overrides = args.overrides;
    }
    if (typeof args.lock === "boolean") {
      options.lock = args.lock;
    }
    if (typeof args.disableSelection === "boolean") {
      options.disableSelection = args.disableSelection;
    }
    return options;
  }

  async function createNativeDrawing(chart, args) {
    const options = drawingCreateOptions(args);
    let entityId;
    if (args.shapeType === "horizontal-line" || args.shapeType === "text") {
      if (typeof chart.createShape !== "function") {
        return { error: "TradingView chart API does not expose createShape() for single-anchor native drawings." };
      }
      entityId = await awaitMaybe(chart.createShape(args.points[0], options));
    } else {
      if (typeof chart.createMultipointShape !== "function") {
        return { error: "TradingView chart API does not expose createMultipointShape() for multi-anchor native drawings." };
      }
      entityId = await awaitMaybe(chart.createMultipointShape(args.points, options));
    }
    const id =
      typeof entityId === "string" || typeof entityId === "number"
        ? String(entityId)
        : compactText(String(valueFrom(entityId, ["id", "entityId", "shapeId"]) ?? ""));
    if (!id) {
      return { error: "TradingView native drawing API did not return a drawing entity id." };
    }
    return { id };
  }

  function findWidget() {
    const direct = [
      root.tvWidget,
      root.widget,
      root.tradingViewWidget,
      root.TradingViewWidget,
      root.__tvWidget
    ];
    for (const candidate of direct) {
      if (candidate && typeof candidate.activeChart === "function") {
        return candidate;
      }
    }

    const watchedChartValues = [
      root.TradingViewApi?._activeChartWidgetWV,
      root.TradingViewApi?._chartWidgetCollection?.activeChartWidget,
      root.TradingViewApi?._chartWidgetCollection?._activeChartWidgetModel,
      root._exposed_chartWidgetCollection?.activeChartWidget,
      root._exposed_chartWidgetCollection?._activeChartWidgetModel
    ];
    for (const watchedValue of watchedChartValues) {
      if (!watchedValue || typeof watchedValue.value !== "function") {
        continue;
      }

      try {
        const chart = watchedValue.value();
        if (chart && typeof chart === "object") {
          return {
            activeChart: () => chart
          };
        }
      } catch {
        continue;
      }
    }

    return undefined;
  }

  function getChart() {
    const widget = findWidget();
    if (!widget) {
      return { error: "TradingView chart API is not exposed on the active chart target." };
    }
    try {
      const chart = widget.activeChart();
      return chart ? { chart } : { error: "TradingView activeChart() returned no chart." };
    } catch (error) {
      return { error: "TradingView activeChart() failed: " + String(error?.message ?? error) };
    }
  }

  function readState(chart) {
    const warnings = [];
    const state = {
      studies: [],
      warnings
    };
    const symbol = compactText(
      methodValue(chart, ["symbol"]) ??
        propertyValue(methodValue(chart, ["symbolExt"]), ["symbol", "full_name", "pro_name"])
    );
    if (symbol) {
      state.symbol = symbol;
    } else {
      warnings.push("TradingView chart API did not expose the current symbol.");
    }
    const timeframe = compactText(methodValue(chart, ["resolution", "interval"]));
    if (timeframe) {
      state.timeframe = timeframe;
    } else {
      warnings.push("TradingView chart API did not expose the current timeframe.");
    }
    const chartType = methodValue(chart, ["chartType", "getChartType"]);
    if (typeof chartType === "string" || typeof chartType === "number") {
      state.chartType = chartType;
    } else {
      warnings.push("TradingView chart API did not expose the chart type.");
    }
    const visibleRange = normalizeRange(methodValue(chart, ["getVisibleRange", "visibleRange"]));
    if (visibleRange) {
      state.visibleRange = visibleRange;
    } else {
      warnings.push("TradingView chart API did not expose the visible range.");
    }
    state.studies = getStudies(chart, warnings);
    return state;
  }

  function paneIdValue(pane, index) {
    const id = valueFrom(pane, ["id", "paneId", "entityId", "name"]);
    const text = compactText(String(id ?? ""));
    return text || "pane-" + (index + 1);
  }

  function paneSummary(pane, index) {
    const id = paneIdValue(pane, index);
    const title = compactText(
      String(valueFrom(pane, ["title", "name", "description"]) ?? "")
    );
    const height = finiteNumber(valueFrom(pane, ["height", "getHeight"]));
    const summary = { id, index };
    if (title && title !== id) {
      summary.title = title;
    }
    if (typeof height === "number") {
      summary.height = Math.trunc(height);
    }
    return summary;
  }

  function rawPanes(chart) {
    const panes = methodValue(chart, ["getPanes", "panes", "getAllPanes"]);
    return Array.isArray(panes) ? panes : undefined;
  }

  function readPanes(chart) {
    const panes = rawPanes(chart);
    if (!panes) {
      const error = "TradingView chart API did not expose pane identifiers through getPanes(), panes(), or getAllPanes().";
      return {
        panes: [],
        count: 0,
        error,
        warnings: [error]
      };
    }

    return {
      panes: panes.map(paneSummary).slice(0, MAX_STUDIES),
      count: panes.length,
      warnings:
        panes.length > MAX_STUDIES
          ? ["Pane list truncated to " + MAX_STUDIES + " entries."]
          : []
    };
  }

  async function focusPane(chart, paneId) {
    const before = readPanes(chart);
    if (before.error) {
      return { ok: false, before, error: before.error };
    }
    const panes = rawPanes(chart) ?? [];
    const paneIndex = panes.findIndex(
      (pane, index) => paneIdValue(pane, index) === paneId
    );
    const pane = panes[paneIndex];
    if (!pane) {
      return {
        ok: false,
        before,
        error: "No TradingView pane matched the requested pane id."
      };
    }
    if (typeof chart.setActivePane === "function") {
      await awaitMaybe(chart.setActivePane(paneId));
      return { ok: true, before, pane: paneSummary(pane, paneIndex) };
    }
    if (typeof chart.focusPane === "function") {
      await awaitMaybe(chart.focusPane(paneId));
      return { ok: true, before, pane: paneSummary(pane, paneIndex) };
    }
    if (typeof chart.selectPane === "function") {
      await awaitMaybe(chart.selectPane(paneId));
      return { ok: true, before, pane: paneSummary(pane, paneIndex) };
    }
    if (typeof pane.focus === "function") {
      await awaitMaybe(pane.focus());
      return { ok: true, before, pane: paneSummary(pane, paneIndex) };
    }
    if (typeof pane.select === "function") {
      await awaitMaybe(pane.select());
      return { ok: true, before, pane: paneSummary(pane, paneIndex) };
    }
    return {
      ok: false,
      before,
      error: "TradingView chart API exposed panes but not a supported pane focus method."
    };
  }

  function nativePaneLayoutName(layout) {
    if (layout === "single") {
      return "single";
    }
    if (layout === "two-vertical") {
      return "2v";
    }
    if (layout === "two-horizontal") {
      return "2h";
    }
    if (layout === "three-vertical") {
      return "3v";
    }
    if (layout === "four-grid") {
      return "4";
    }
    return layout;
  }

  async function setPaneLayout(chart, layout) {
    const before = readPanes(chart);
    const nativeLayout = nativePaneLayoutName(layout);
    if (typeof chart.setPaneLayout === "function") {
      await awaitMaybe(chart.setPaneLayout(nativeLayout));
      return { ok: true, before, layout };
    }
    if (typeof chart.setLayout === "function") {
      await awaitMaybe(chart.setLayout(nativeLayout));
      return { ok: true, before, layout };
    }
    if (typeof chart.setPanesLayout === "function") {
      await awaitMaybe(chart.setPanesLayout(nativeLayout));
      return { ok: true, before, layout };
    }
    return {
      ok: false,
      before,
      error: "TradingView chart API did not expose setPaneLayout(), setLayout(), or setPanesLayout()."
    };
  }

  function layoutSummary(layout, index) {
    const id = compactText(
      String(valueFrom(layout, ["id", "layoutId", "uid", "name"]) ?? "")
    ) || "layout-" + (index + 1);
    const name = compactText(
      String(valueFrom(layout, ["name", "title", "description"]) ?? "")
    );
    const modifiedAt = compactText(
      String(valueFrom(layout, ["modifiedAt", "updatedAt", "lastModified"]) ?? "")
    );
    const summary = { id, index };
    if (name && name !== id) {
      summary.name = name;
    }
    if (modifiedAt) {
      summary.modifiedAt = modifiedAt;
    }
    return summary;
  }

  function widgetOrChartLayouts(chart) {
    const widget = findWidget();
    const candidates = [
      methodValue(widget, ["getSavedCharts", "getLayouts", "savedCharts"]),
      methodValue(chart, ["getSavedCharts", "getLayouts", "savedLayouts"])
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
      if (Array.isArray(candidate?.items)) {
        return candidate.items;
      }
      if (Array.isArray(candidate?.layouts)) {
        return candidate.layouts;
      }
    }
    return undefined;
  }

  function readLayouts(chart) {
    const layouts = widgetOrChartLayouts(chart);
    if (!layouts) {
      const error = "TradingView did not expose saved layout identifiers through getSavedCharts(), getLayouts(), or savedLayouts().";
      return {
        layouts: [],
        count: 0,
        error,
        warnings: [error]
      };
    }
    return {
      layouts: layouts.map(layoutSummary).slice(0, MAX_STUDIES),
      count: layouts.length,
      warnings:
        layouts.length > MAX_STUDIES
          ? ["Layout list truncated to " + MAX_STUDIES + " entries."]
          : []
    };
  }

  async function switchLayout(chart, layoutId) {
    const before = readLayouts(chart);
    if (before.error) {
      return { ok: false, before, error: before.error };
    }
    const widget = findWidget();
    if (typeof widget?.loadChart === "function") {
      await awaitMaybe(widget.loadChart(layoutId));
      return { ok: true, before, layoutId };
    }
    if (typeof widget?.switchLayout === "function") {
      await awaitMaybe(widget.switchLayout(layoutId));
      return { ok: true, before, layoutId };
    }
    if (typeof chart.loadChart === "function") {
      await awaitMaybe(chart.loadChart(layoutId));
      return { ok: true, before, layoutId };
    }
    if (typeof chart.switchLayout === "function") {
      await awaitMaybe(chart.switchLayout(layoutId));
      return { ok: true, before, layoutId };
    }
    return {
      ok: false,
      before,
      error: "TradingView exposed saved layouts but not a supported layout switch method."
    };
  }

  function replayUnsupportedMessage() {
    return "TradingView replay control API is unsupported on the active chart target: no reliable replay controller or UI control API was exposed.";
  }

  function methodTarget(target, names) {
    for (const name of names) {
      if (target && typeof target[name] === "function") {
        return { target, name };
      }
    }
    return undefined;
  }

  function replayController(chart) {
    const widget = findWidget();
    const direct = root.__TVMCP_REPLAY__;
    if (direct && typeof direct === "object") {
      return { controller: direct, source: "fixture" };
    }

    const candidates = [
      {
        value: valueFrom(chart, ["replay", "replayController", "barReplay", "replayMode"]),
        source: "chart-replay-api",
        allowGenericMethods: true
      },
      {
        value: valueFrom(widget, ["replay", "replayController", "barReplay", "replayMode"]),
        source: "widget-replay-api",
        allowGenericMethods: true
      },
      {
        value: chart,
        source: "chart-api",
        allowGenericMethods: false
      },
      {
        value: widget,
        source: "widget-api",
        allowGenericMethods: false
      }
    ];

    for (const candidateData of candidates) {
      const candidate = candidateData.value;
      if (!candidate || typeof candidate !== "object") {
        continue;
      }
      const explicitReplayMethod = methodTarget(candidate, [
        "openReplayMode",
        "enterReplayMode",
        "startReplayMode",
        "enableReplayMode",
        "setReplaySpeed",
        "getReplaySpeed",
        "isReplayMode",
        "isReplayPlaying",
        "exitReplayMode"
      ]);
      const genericReplayMethod = candidateData.allowGenericMethods
        ? methodTarget(candidate, [
            "play",
            "pause",
            "stepForward",
            "stepBack",
            "setSpeed",
            "exit"
          ])
        : undefined;
      if (explicitReplayMethod || genericReplayMethod) {
        return {
          controller: candidate,
          source: candidateData.source
        };
      }
    }

    return undefined;
  }

  function replayStatus(controllerResult) {
    if (!controllerResult) {
      return {
        supported: false,
        source: "unsupported",
        warnings: [replayUnsupportedMessage()]
      };
    }

    const controller = controllerResult.controller;
    const status = {
      supported: true,
      source: controllerResult.source,
      warnings: []
    };
    const active = valueFrom(controller, [
      "isReplayMode",
      "inReplayMode",
      "isReplayActive",
      "isActive",
      "active",
      "enabled"
    ]);
    const playing = valueFrom(controller, [
      "isPlaying",
      "playing",
      "isReplayPlaying"
    ]);
    const speed = finiteNumber(valueFrom(controller, [
      "getReplaySpeed",
      "getSpeed",
      "speed",
      "replaySpeed",
      "playbackSpeed"
    ]));
    const position = finiteNumber(valueFrom(controller, [
      "getPosition",
      "position",
      "barIndex",
      "currentIndex"
    ]));

    if (typeof active === "boolean") {
      status.active = active;
    }
    if (typeof playing === "boolean") {
      status.playing = playing;
    }
    if (typeof speed === "number") {
      status.speed = compactNumber(speed);
    }
    if (typeof position === "number") {
      status.position = Math.trunc(position);
    }

    return status;
  }

  async function callReplayMethod(controllerResult, names, args = []) {
    if (!controllerResult) {
      return undefined;
    }

    const match = methodTarget(controllerResult.controller, names);
    if (!match) {
      return undefined;
    }

    await awaitMaybe(match.target[match.name](...args));
    return match.name;
  }

  async function replayOpen(chart) {
    const controllerResult = replayController(chart);
    const before = replayStatus(controllerResult);
    const method = await callReplayMethod(controllerResult, [
      "openReplayMode",
      "enterReplayMode",
      "startReplayMode",
      "enableReplayMode",
      "open",
      "enable",
      "start"
    ]);
    if (!method) {
      return { ok: false, before, error: replayUnsupportedMessage(), warnings: before.warnings ?? [] };
    }
    return {
      ok: true,
      value: {
        action: "open",
        method,
        before,
        after: replayStatus(controllerResult),
        warnings: [
          "Replay controls are chart-practice/review controls only; they do not score performance, scan, rank, recommend, alert, trade, or place orders."
        ]
      }
    };
  }

  async function replayPlayPause(chart, mode) {
    const controllerResult = replayController(chart);
    const before = replayStatus(controllerResult);
    let method;
    if (mode === "play") {
      method = await callReplayMethod(controllerResult, ["play", "resume", "startPlayback"]);
    } else if (mode === "pause") {
      method = await callReplayMethod(controllerResult, ["pause", "stopPlayback"]);
    } else {
      method = await callReplayMethod(controllerResult, [
        "togglePlayPause",
        "togglePlayback",
        "toggle"
      ]);
      if (!method && before.playing === true) {
        method = await callReplayMethod(controllerResult, ["pause", "stopPlayback"]);
      } else if (!method && before.playing === false) {
        method = await callReplayMethod(controllerResult, ["play", "resume", "startPlayback"]);
      }
    }
    if (!method) {
      return { ok: false, before, error: replayUnsupportedMessage(), warnings: before.warnings ?? [] };
    }
    return {
      ok: true,
      value: {
        action: mode,
        method,
        before,
        after: replayStatus(controllerResult),
        warnings: [
          "Replay controls are explicit caller-directed chart-practice/review actions only; no unattended replay session is started."
        ]
      }
    };
  }

  async function replayStep(chart, direction, steps) {
    const controllerResult = replayController(chart);
    const before = replayStatus(controllerResult);
    const methodNames = direction === "forward"
      ? ["stepForward", "forward", "next", "nextBar"]
      : ["stepBack", "back", "previous", "previousBar"];
    const methods = [];
    for (let index = 0; index < steps; index += 1) {
      const method = await callReplayMethod(controllerResult, methodNames);
      if (!method) {
        return { ok: false, before, error: replayUnsupportedMessage(), warnings: before.warnings ?? [] };
      }
      methods.push(method);
    }
    return {
      ok: true,
      value: {
        action: "step",
        direction,
        steps,
        methods,
        before,
        after: replayStatus(controllerResult),
        warnings: [
          "Replay step output is compact action/status context only, not a score, ranking, recommendation, alert, or advice."
        ]
      }
    };
  }

  async function replaySetSpeed(chart, speed) {
    const controllerResult = replayController(chart);
    const before = replayStatus(controllerResult);
    const method = await callReplayMethod(controllerResult, [
      "setReplaySpeed",
      "setPlaybackSpeed",
      "setSpeed"
    ], [speed]);
    if (!method) {
      return { ok: false, before, error: replayUnsupportedMessage(), warnings: before.warnings ?? [] };
    }
    return {
      ok: true,
      value: {
        action: "set-speed",
        speed,
        method,
        before,
        after: replayStatus(controllerResult),
        warnings: [
          "Replay speed controls chart-practice playback only; it is not performance scoring or trading advice."
        ]
      }
    };
  }

  async function replayExit(chart) {
    const controllerResult = replayController(chart);
    const before = replayStatus(controllerResult);
    const method = await callReplayMethod(controllerResult, [
      "exitReplayMode",
      "leaveReplayMode",
      "stopReplayMode",
      "closeReplayMode",
      "exit",
      "close",
      "disable"
    ]);
    if (!method) {
      return { ok: false, before, error: replayUnsupportedMessage(), warnings: before.warnings ?? [] };
    }
    return {
      ok: true,
      value: {
        action: "exit",
        method,
        before,
        after: replayStatus(controllerResult),
        warnings: [
          "Replay exit is an explicit chart-practice/review control only; no broker, order, alert, scan, or recommendation workflow is involved."
        ]
      }
    };
  }

  function waitForCallback(invoke) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(undefined);
        }
      }, 1500);
      const done = (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(value);
        }
      };
      try {
        const returned = invoke(done);
        if (returned && typeof returned.then === "function") {
          returned.then(done, (error) => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              reject(error);
            }
          });
        } else if (typeof returned !== "undefined") {
          done(returned);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  async function awaitMaybe(value) {
    if (value && typeof value.then === "function") {
      return await value;
    }
    return value;
  }

  function readBatchState(chart) {
    const symbol = compactText(
      methodValue(chart, ["symbol"]) ??
        propertyValue(methodValue(chart, ["symbolExt"]), ["symbol", "full_name", "pro_name"])
    );
    const timeframe = compactText(methodValue(chart, ["resolution", "interval"]));
    const state = {};
    if (symbol) {
      state.symbol = symbol;
    }
    if (timeframe) {
      state.timeframe = timeframe;
    }
    return state;
  }

  async function applyBatchStep(chart, step) {
    if (step.symbol && step.timeframe && typeof chart.setSymbol === "function") {
      await waitForCallback((done) => chart.setSymbol(step.symbol, step.timeframe, done));
      return;
    }

    if (step.symbol) {
      if (typeof chart.setSymbol !== "function") {
        throw new Error("TradingView chart API does not expose setSymbol().");
      }
      await waitForCallback((done) => chart.setSymbol(step.symbol, done));
    }

    if (step.timeframe) {
      if (typeof chart.setResolution !== "function") {
        throw new Error("TradingView chart API does not expose setResolution().");
      }
      await waitForCallback((done) => chart.setResolution(step.timeframe, done));
    }
  }

  async function batchChart(chart, args) {
    const results = [];
    for (let index = 0; index < args.steps.length; index += 1) {
      const step = args.steps[index];
      const before = readBatchState(chart);
      try {
        await applyBatchStep(chart, step);
        results.push({
          index,
          requested: step,
          ok: true,
          before,
          after: readBatchState(chart)
        });
      } catch (error) {
        results.push({
          index,
          requested: step,
          ok: false,
          before,
          error: String(error?.message ?? error)
        });
        if (args.stopOnError) {
          break;
        }
      }
    }

    const failedCount = results.filter((result) => result.ok !== true).length;
    return {
      requestedCount: args.steps.length,
      completedCount: results.length - failedCount,
      failedCount,
      stopOnError: args.stopOnError === true,
      orderPreserved: true,
      generatedCandidates: false,
      results,
      warnings: [
        "Batch chart actions preserve explicit input order and do not scan, rank, score, recommend, alert, or generate candidates."
      ]
    };
  }

  async function mutate(chart, before) {
    if (command === "state") {
      return { ok: true, before };
    }
    if (command === "chartDataSummary") {
      const data = await chartDataSummary(chart, args);
      if (data.error) {
        return { ok: false, before, error: data.error, warnings: data.warnings ?? [] };
      }
      return { ok: true, value: data };
    }
    if (command === "quoteSnapshot") {
      const quote = await quoteSnapshot(chart);
      if (quote.error) {
        return { ok: false, before, error: quote.error, warnings: quote.warnings ?? [] };
      }
      return { ok: true, value: quote };
    }
    if (command === "studyValues") {
      const values = readStudyValues(chart, args);
      if (values.error) {
        return { ok: false, before, error: values.error, warnings: values.warnings ?? [] };
      }
      return { ok: true, value: values };
    }
    if (command === "listPanes") {
      const panes = readPanes(chart);
      if (panes.error) {
        return { ok: false, before, error: panes.error, warnings: panes.warnings ?? [] };
      }
      return { ok: true, value: panes };
    }
    if (command === "focusPane") {
      return await focusPane(chart, args.paneId);
    }
    if (command === "setPaneLayout") {
      return await setPaneLayout(chart, args.layout);
    }
    if (command === "listLayouts") {
      const layouts = readLayouts(chart);
      if (layouts.error) {
        return { ok: false, before, error: layouts.error, warnings: layouts.warnings ?? [] };
      }
      return { ok: true, value: layouts };
    }
    if (command === "switchLayout") {
      return await switchLayout(chart, args.layoutId);
    }
    if (command === "batchChart") {
      return { ok: true, value: await batchChart(chart, args) };
    }
    if (command === "replayOpen") {
      return await replayOpen(chart);
    }
    if (command === "replayPlayPause") {
      return await replayPlayPause(chart, args.mode);
    }
    if (command === "replayStep") {
      return await replayStep(chart, args.direction, args.steps);
    }
    if (command === "replaySetSpeed") {
      return await replaySetSpeed(chart, args.speed);
    }
    if (command === "replayExit") {
      return await replayExit(chart);
    }
    if (command === "setSymbol") {
      if (typeof chart.setSymbol !== "function") {
        return { ok: false, before, error: "TradingView chart API does not expose setSymbol()." };
      }
      await waitForCallback((done) =>
        before.timeframe
          ? chart.setSymbol(args.symbol, before.timeframe, done)
          : chart.setSymbol(args.symbol, done)
      );
      return { ok: true, before };
    }
    if (command === "setTimeframe") {
      if (typeof chart.setResolution !== "function") {
        return { ok: false, before, error: "TradingView chart API does not expose setResolution()." };
      }
      await waitForCallback((done) => chart.setResolution(args.timeframe, done));
      return { ok: true, before };
    }
    if (command === "setChartType") {
      if (typeof chart.setChartType !== "function") {
        return { ok: false, before, error: "TradingView chart API does not expose setChartType()." };
      }
      await awaitMaybe(chart.setChartType(args.chartType));
      return { ok: true, before };
    }
    if (command === "setVisibleRange") {
      if (typeof chart.setVisibleRange !== "function") {
        return { ok: false, before, error: "TradingView chart API does not expose setVisibleRange()." };
      }
      await awaitMaybe(chart.setVisibleRange(args.range));
      return { ok: true, before };
    }
    if (command === "addIndicator") {
      if (typeof chart.createStudy !== "function") {
        return { ok: false, before, error: "TradingView chart API does not expose createStudy()." };
      }
      const entityId = await awaitMaybe(chart.createStudy(args.name, false, false));
      return { ok: true, before, entityId: typeof entityId === "string" ? entityId : undefined };
    }
    if (command === "removeEntity") {
      if (typeof chart.removeEntity !== "function") {
        return { ok: false, before, error: "TradingView chart API does not expose removeEntity()." };
      }
      await awaitMaybe(chart.removeEntity(args.entityId));
      return { ok: true, before };
    }
    if (command === "drawShape") {
      const drawingBefore = readDrawings(chart);
      const created = await createNativeDrawing(chart, args);
      if (created.error) {
        return { ok: false, before: drawingBefore, after: readDrawings(chart), error: created.error };
      }
      if (!created.id) {
        return { ok: false, before: drawingBefore, after: readDrawings(chart), error: "TradingView native drawing API did not return a drawing entity id." };
      }
      return {
        ok: true,
        before: drawingBefore,
        entityId: created.id,
        drawing: {
          id: created.id,
          type: args.shapeType,
          points: args.points,
          ...(args.text ? { text: args.text } : {})
        }
      };
    }
    if (command === "drawList") {
      const drawings = readDrawings(chart);
      if (drawings.error) {
        return { ok: false, before: drawings, error: drawings.error };
      }
      return { ok: true, value: drawings };
    }
    if (command === "drawProperties") {
      const properties = drawingProperties(chart, args.entityId);
      if (properties.error) {
        return { ok: false, before: readDrawings(chart), error: properties.error };
      }
      return { ok: true, value: properties };
    }
    if (command === "drawRemove") {
      const drawingBefore = readDrawings(chart);
      if (typeof chart.removeEntity !== "function") {
        return { ok: false, before: drawingBefore, error: "TradingView chart API does not expose removeEntity() for native drawing removal." };
      }
      await awaitMaybe(chart.removeEntity(args.entityId));
      return { ok: true, before: drawingBefore, entityId: args.entityId };
    }
    if (command === "drawClearAll") {
      const drawingBefore = readDrawings(chart);
      if (drawingBefore.error) {
        return { ok: false, before: drawingBefore, error: drawingBefore.error };
      }
      if (typeof chart.removeAllShapes === "function") {
        await awaitMaybe(chart.removeAllShapes());
        return { ok: true, before: drawingBefore };
      }
      if (typeof chart.removeEntity === "function" && drawingBefore.drawings.length > 0) {
        for (const drawing of drawingBefore.drawings) {
          await awaitMaybe(chart.removeEntity(drawing.id));
        }
        return { ok: true, before: drawingBefore };
      }
      if (drawingBefore.drawings.length === 0 && drawingBefore.count === 0) {
        return { ok: true, before: drawingBefore };
      }
      return { ok: false, before: drawingBefore, error: "TradingView chart API does not expose removeAllShapes(), or removable drawing ids were unavailable." };
    }
    if (command === "drawFibRetracement") {
      const drawingBefore = readDrawings(chart);
      const created = await createNativeDrawing(chart, {
        shapeType: "fib-retracement",
        points: args.points,
        overrides: args.overrides,
        lock: args.lock,
        disableSelection: args.disableSelection
      });
      if (created.error || !created.id) {
        return {
          ok: false,
          before: drawingBefore,
          after: readDrawings(chart),
          error: created.error ?? "TradingView native Fib Retracement API did not return a drawing entity id."
        };
      }
      return {
        ok: true,
        value: {
          entityId: created.id,
          drawing: {
            id: created.id,
            type: "fib_retracement",
            points: args.points
          },
          anchors: args.anchors,
          levels: args.levels,
          warnings: args.warnings
        }
      };
    }
    if (command === "drawMacro") {
      const drawingBefore = readDrawings(chart);
      const macro = args.macro;
      if (!macro || typeof macro !== "object" || !Array.isArray(macro.drawings)) {
        return { ok: false, before: drawingBefore, error: "TradingView drawing macro request did not include drawable macro instructions." };
      }
      const createdDrawings = [];
      for (const drawing of macro.drawings) {
        const created = await createNativeDrawing(chart, drawing);
        if (created.error || !created.id) {
          const label = compactText(String(drawing?.label ?? drawing?.role ?? "macro drawing"));
          return {
            ok: false,
            before: drawingBefore,
            after: readDrawings(chart),
            error: "TradingView drawing macro failed while creating " + label + ": " + (created.error ?? "TradingView native drawing API did not return a drawing entity id.")
          };
        }
        createdDrawings.push({
          id: created.id,
          role: drawing.role,
          label: drawing.label,
          type: drawing.shapeType,
          points: drawing.points
        });
      }
      const drawingIds = createdDrawings.map((drawing) => drawing.id);
      return {
        ok: true,
        before: drawingBefore,
        drawingIds,
        drawings: createdDrawings,
        macro: {
          schemaVersion: macro.schemaVersion,
          kind: macro.kind,
          source: macro.source,
          anchors: macro.anchors,
          levels: macro.levels,
          drawingIds,
          warnings: Array.isArray(macro.warnings) ? macro.warnings : []
        }
      };
    }
    return { ok: false, before, error: "Unknown chart command: " + command };
  }

  const chartResult = getChart();
  if (chartResult.error) {
    return { ok: false, error: chartResult.error };
  }

  const before = readState(chartResult.chart);
  const mutation = await mutate(chartResult.chart, before);
  if (!mutation.ok) {
    return mutation;
  }
  const after = command === "state" ? before : readState(chartResult.chart);
  if (mutation.value) {
    return { ok: true, value: mutation.value };
  }
  const isDrawingCommand = command.startsWith("draw");
  const value = {
    before: mutation.before ?? before,
    after: isDrawingCommand ? readDrawings(chartResult.chart) : after
  };
  if (mutation.entityId) {
    value.entityId = mutation.entityId;
  }
  if (mutation.drawing) {
    value.drawing = mutation.drawing;
  }
  if (mutation.drawingIds) {
    value.drawingIds = mutation.drawingIds;
  }
  if (mutation.drawings) {
    value.drawings = mutation.drawings;
  }
  if (mutation.pane) {
    value.pane = mutation.pane;
  }
  if (mutation.layout) {
    value.layout = mutation.layout;
  }
  if (mutation.layoutId) {
    value.layoutId = mutation.layoutId;
  }
  if (mutation.macro) {
    value.macro = mutation.macro;
  }
  return { ok: true, value };
}
`;

const RAW_PINE_EDITOR_EVALUATOR = String.raw`
async (command, args) => {
  const MAX_TEXT = 240;
  const MAX_ERRORS = 50;
  const MAX_CONSOLE_ROWS = 30;
  const root = globalThis;

  function compactText(value, maxText = MAX_TEXT) {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length > maxText ? trimmed.slice(0, maxText) + "..." : trimmed;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function visible(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    const style =
      typeof getComputedStyle === "function"
        ? getComputedStyle(element)
        : { display: "block", visibility: "visible" };
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function editorFromMonacoGlobal() {
    const monacoEditor = root.monaco?.editor;
    if (!monacoEditor || typeof monacoEditor.getEditors !== "function") {
      return undefined;
    }
    try {
      const editors = monacoEditor.getEditors();
      const editor = Array.isArray(editors) ? editors[0] : undefined;
      return editor ? { editor, env: { editor: monacoEditor } } : undefined;
    } catch {
      return undefined;
    }
  }

  function editorFromReactFiber() {
    if (typeof document === "undefined") {
      return undefined;
    }
    const container =
      document.querySelector(".monaco-editor.pine-editor-monaco") ||
      document.querySelector(".pine-editor-monaco") ||
      document.querySelector("[class*=pine-editor] .monaco-editor");
    if (!container) {
      return undefined;
    }
    let element = container;
    let fiberKey;
    for (let index = 0; index < 20 && element; index += 1) {
      fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
      if (fiberKey) {
        break;
      }
      element = element.parentElement;
    }
    if (!fiberKey || !element) {
      return undefined;
    }
    let current = element[fiberKey];
    for (let depth = 0; depth < 20 && current; depth += 1) {
      const env = current.memoizedProps?.value?.monacoEnv;
      if (env?.editor && typeof env.editor.getEditors === "function") {
        const editors = env.editor.getEditors();
        const editor = Array.isArray(editors) ? editors[0] : undefined;
        if (editor) {
          return { editor, env };
        }
      }
      current = current.return;
    }
    return undefined;
  }

  function findMonacoEditor() {
    return editorFromMonacoGlobal() || editorFromReactFiber();
  }

  function clickPineButton() {
    if (typeof document === "undefined") {
      return false;
    }
    const candidates = [
      '[aria-label="Pine"]',
      '[aria-label="Pine Editor"]',
      '[data-name="pine-dialog-button"]',
      '[data-name="pine-editor"]'
    ];
    for (const selector of candidates) {
      const element = document.querySelector(selector);
      if (element && typeof element.click === "function") {
        element.click();
        return true;
      }
    }
    return false;
  }

  async function ensureEditorOpen() {
    if (findMonacoEditor()) {
      return { ready: true, opened: false, method: "already-open", warnings: [] };
    }
    const warnings = [];
    const bottomWidgetBar = root.TradingView?.bottomWidgetBar;
    let method = "none";
    try {
      if (bottomWidgetBar && typeof bottomWidgetBar.activateScriptEditorTab === "function") {
        bottomWidgetBar.activateScriptEditorTab();
        method = "activateScriptEditorTab";
      } else if (bottomWidgetBar && typeof bottomWidgetBar.showWidget === "function") {
        bottomWidgetBar.showWidget("pine-editor");
        method = "showWidget";
      } else if (clickPineButton()) {
        method = "button-click";
      } else {
        warnings.push("TradingView Pine Editor opener was not exposed; open the Pine Editor manually and retry.");
      }
    } catch (error) {
      warnings.push("Pine Editor opener failed: " + String(error?.message ?? error));
    }
    for (let attempt = 0; attempt < 25; attempt += 1) {
      if (findMonacoEditor()) {
        return { ready: true, opened: true, method, warnings };
      }
      await sleep(100);
    }
    return {
      ready: false,
      opened: method !== "none",
      method,
      warnings,
      error: "Could not open or focus the TradingView Pine Editor, or Monaco was not exposed."
    };
  }

  function lineCount(source) {
    return source.length === 0 ? 0 : source.split("\n").length;
  }

  function severityName(value) {
    if (value === 8 || value === "8") {
      return "error";
    }
    if (value === 4 || value === "4") {
      return "warning";
    }
    if (value === 2 || value === "2") {
      return "info";
    }
    if (value === 1 || value === "1") {
      return "hint";
    }
    return typeof value === "string" ? value.toLowerCase() : "unknown";
  }

  function readErrors(editorResult) {
    const model =
      typeof editorResult.editor.getModel === "function"
        ? editorResult.editor.getModel()
        : undefined;
    if (!model) {
      return {
        hasErrors: false,
        errorCount: 0,
        errors: [],
        warnings: ["Pine Editor model was not exposed, so compile markers could not be read."]
      };
    }
    const markerReader =
      editorResult.env?.editor?.getModelMarkers ??
      root.monaco?.editor?.getModelMarkers;
    if (typeof markerReader !== "function") {
      return {
        hasErrors: false,
        errorCount: 0,
        errors: [],
        warnings: ["Monaco model marker reader was not exposed."]
      };
    }
    const markers = markerReader({ resource: model.uri });
    const normalized = (Array.isArray(markers) ? markers : [])
      .map((marker) => ({
        line: Number(marker.startLineNumber ?? marker.line ?? 0),
        column: Number(marker.startColumn ?? marker.column ?? 0),
        endLine: Number(marker.endLineNumber ?? marker.endLine ?? marker.startLineNumber ?? 0),
        endColumn: Number(marker.endColumn ?? marker.startColumn ?? 0),
        severity: severityName(marker.severity),
        message: compactText(String(marker.message ?? ""))
      }))
      .filter((marker) => marker.message)
      .slice(0, MAX_ERRORS);
    const errorCount = normalized.filter((marker) => marker.severity === "error").length;
    return {
      hasErrors: errorCount > 0,
      errorCount,
      markerCount: Array.isArray(markers) ? markers.length : 0,
      truncated: Array.isArray(markers) && markers.length > MAX_ERRORS,
      errors: normalized
    };
  }

  function buttonText(element) {
    return compactText(String(element?.textContent ?? element?.innerText ?? ""));
  }

  function clickCompileButton() {
    if (typeof document === "undefined") {
      return undefined;
    }
    const buttons = Array.from(document.querySelectorAll("button"));
    let fallback;
    for (const button of buttons) {
      if (!visible(button)) {
        continue;
      }
      const text = buttonText(button) ?? "";
      if (!fallback && /^(add to chart|update on chart)$/i.test(text)) {
        fallback = button;
      }
    }
    if (fallback) {
      const text = buttonText(fallback) ?? "Add or update chart";
      fallback.click();
      return text;
    }
    return undefined;
  }

  function clickSaveButtonOrShortcut() {
    if (typeof document === "undefined") {
      return undefined;
    }
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const button of buttons) {
      if (!visible(button)) {
        continue;
      }
      const text = buttonText(button) ?? "";
      const aria = String(button.getAttribute?.("aria-label") ?? "");
      if (/^save$/i.test(text) || /^save$/i.test(aria)) {
        button.click();
        return text || aria;
      }
    }
    return undefined;
  }

  function readConsoleRows() {
    if (typeof document === "undefined") {
      return [];
    }
    const selectors = [
      '[class*="consoleRow"]',
      '[class*="consoleLine"]',
      '[class*="log-"]',
      '[class*="pine"] [class*="message"]',
      '[class*="pine"] [class*="console"]',
      '[class*="layout__area--bottom"] [class*="message"]'
    ];
    const seen = new Set();
    const rows = [];
    for (const selector of selectors) {
      for (const row of Array.from(document.querySelectorAll(selector))) {
        const message = compactText(String(row.textContent ?? ""));
        if (!message || seen.has(message)) {
          continue;
        }
        seen.add(message);
        const className = String(row.className ?? "");
        const type = /error/i.test(className + " " + message)
          ? "error"
          : /warn/i.test(className + " " + message)
            ? "warning"
            : /compil/i.test(message)
              ? "compile"
              : "info";
        rows.push({ type, message });
      }
    }
    return rows;
  }

  const openResult = await ensureEditorOpen();
  if (!openResult.ready) {
    return { ok: false, error: openResult.error, warnings: openResult.warnings };
  }
  if (command === "openEditor") {
    return { ok: true, value: openResult };
  }
  const editorResult = findMonacoEditor();
  if (!editorResult) {
    return { ok: false, error: "TradingView Pine Editor Monaco instance was not exposed." };
  }

  if (command === "setSource") {
    if (typeof editorResult.editor.setValue !== "function") {
      return { ok: false, error: "TradingView Pine Editor does not expose setValue()." };
    }
    editorResult.editor.setValue(args.source);
    return {
      ok: true,
      value: {
        linesSet: lineCount(args.source),
        charCount: args.source.length,
        warnings: openResult.warnings
      }
    };
  }

  if (command === "getSource") {
    if (typeof editorResult.editor.getValue !== "function") {
      return { ok: false, error: "TradingView Pine Editor does not expose getValue()." };
    }
    const source = String(editorResult.editor.getValue() ?? "");
    const maxSourceChars = args.maxSourceChars;
    const truncated = source.length > maxSourceChars;
    const warnings = [...openResult.warnings];
    if (truncated) {
      warnings.push("Pine source was truncated to " + maxSourceChars + " characters; raise maxSourceChars intentionally if more source is required.");
    }
    return {
      ok: true,
      value: {
        source: truncated ? source.slice(0, maxSourceChars) : source,
        charCount: source.length,
        lineCount: lineCount(source),
        truncated,
        maxSourceChars,
        warnings
      },
      warnings
    };
  }

  if (command === "getErrors") {
    const errors = readErrors(editorResult);
    return { ok: true, value: errors, warnings: errors.warnings ?? [] };
  }

  if (command === "getConsole") {
    const rows = readConsoleRows();
    const truncated = rows.length > MAX_CONSOLE_ROWS;
    return {
      ok: true,
      value: {
        entryCount: rows.length,
        truncated,
        entries: rows.slice(0, MAX_CONSOLE_ROWS)
      }
    };
  }

  if (command === "compile") {
    const clicked = clickCompileButton();
    if (!clicked) {
      return {
        ok: false,
        error: "Could not find a visible Pine compile, add-to-chart, or update button."
      };
    }
    await sleep(args.settleMs);
    const errors = readErrors(editorResult);
    return {
      ok: true,
      value: {
        buttonClicked: clicked,
        ...errors
      },
      warnings: errors.warnings ?? []
    };
  }

  if (command === "save") {
    const method = clickSaveButtonOrShortcut();
    if (!method) {
      return { ok: false, error: "Could not find a Pine save button or dispatch the save shortcut." };
    }
    await sleep(args.settleMs);
    return {
      ok: true,
      value: {
        method,
        warnings: openResult.warnings
      },
      warnings: openResult.warnings
    };
  }

  return { ok: false, error: "Unknown Pine editor command: " + command };
}
`;

function chartControlExpression(
  command: string,
  args: Record<string, unknown>
): string {
  return `(${RAW_CHART_CONTROL_EVALUATOR})(${JSON.stringify(command)}, ${JSON.stringify(args)})`;
}

function pineEditorExpression(
  command: string,
  args: Record<string, unknown>
): string {
  return `(${RAW_PINE_EDITOR_EVALUATOR})(${JSON.stringify(command)}, ${JSON.stringify(args)})`;
}

function isChartControlPayload(
  value: unknown
): value is {
  ok: boolean;
  value?: unknown;
  before?: unknown;
  error?: string;
} {
  return isRecord(value) && typeof value.ok === "boolean";
}

function boundedMaxMatches(maxMatches: number | undefined): number {
  return Math.min(
    Math.max(maxMatches ?? DEFAULT_RAW_FIND_MAX_MATCHES, 1),
    RAW_FIND_MAX_MATCHES_LIMIT
  );
}

function elementFindExpression(options: {
  strategy: RawElementSelectorStrategy;
  value: string;
  maxMatches?: number;
}): string {
  return `(() => {
  const strategy = ${JSON.stringify(options.strategy)};
  const value = ${JSON.stringify(options.value)};
  const maxMatches = ${boundedMaxMatches(options.maxMatches)};
  const normalize = (text) => String(text || "").replace(/\\s+/g, " ").trim();
  const needle = normalize(value).toLowerCase();
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const summary = (element, index) => {
    const rect = element.getBoundingClientRect();
    const text = normalize(element.innerText || element.textContent || "").slice(0, 160);
    const ariaLabel = element.getAttribute("aria-label") || undefined;
    const dataName = element.getAttribute("data-name") || undefined;
    const role = element.getAttribute("role") || undefined;
    const id = element.id || undefined;
    const className = typeof element.className === "string" ? normalize(element.className).slice(0, 120) : undefined;
    return {
      index,
      tagName: element.tagName.toLowerCase(),
      ...(text ? { text } : {}),
      ...(ariaLabel ? { ariaLabel } : {}),
      ...(dataName ? { dataName } : {}),
      ...(role ? { role } : {}),
      ...(id ? { id } : {}),
      ...(className ? { className } : {}),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        centerX: Math.round(rect.x + rect.width / 2),
        centerY: Math.round(rect.y + rect.height / 2)
      }
    };
  };
  let candidates = [];
  try {
    if (strategy === "css") {
      candidates = Array.from(document.querySelectorAll(value));
    } else {
      candidates = Array.from(document.querySelectorAll("body *")).filter((element) => {
        if (strategy === "text") {
          return normalize(element.innerText || element.textContent || "").toLowerCase().includes(needle);
        }
        const attribute = element.getAttribute(strategy);
        return attribute ? normalize(attribute).toLowerCase().includes(needle) : false;
      });
    }
  } catch (error) {
    return { error: "Invalid CSS selector: " + (error && error.message ? error.message : String(error)) };
  }
  const matches = candidates.filter(visible);
  return {
    query: { strategy, value },
    count: matches.length,
    truncated: matches.length > maxMatches,
    elements: matches.slice(0, maxMatches).map(summary)
  };
})()`;
}

function domClickExpression(options: {
  strategy: RawElementSelectorStrategy;
  value: string;
  matchIndex: number;
}): string {
  return `(() => {
  const strategy = ${JSON.stringify(options.strategy)};
  const value = ${JSON.stringify(options.value)};
  const matchIndex = ${options.matchIndex};
  const normalize = (text) => String(text || "").replace(/\\s+/g, " ").trim();
  const needle = normalize(value).toLowerCase();
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  let candidates = [];
  try {
    if (strategy === "css") {
      candidates = Array.from(document.querySelectorAll(value));
    } else {
      candidates = Array.from(document.querySelectorAll("body *")).filter((element) => {
        if (strategy === "text") {
          return normalize(element.innerText || element.textContent || "").toLowerCase().includes(needle);
        }
        const attribute = element.getAttribute(strategy);
        return attribute ? normalize(attribute).toLowerCase().includes(needle) : false;
      });
    }
  } catch (error) {
    return { ok: false, error: "Invalid CSS selector: " + (error && error.message ? error.message : String(error)) };
  }
  const element = candidates.filter(visible)[matchIndex];
  if (!element) {
    return { ok: false, error: "Selected element was not found for DOM click." };
  }
  element.click();
  return { ok: true };
})()`;
}

function parseFindPayload(value: unknown): {
  query: { strategy: RawElementSelectorStrategy; value: string };
  count: number;
  truncated: boolean;
  elements: RawElementSummary[];
  error?: string;
} {
  const normalized = normalizeEvaluateResponse(value);

  if (!isRecord(normalized)) {
    throw new Error("Raw element discovery returned an invalid response.");
  }

  if (typeof normalized.error === "string") {
    throw new Error(normalized.error);
  }

  const count = normalized.count;
  const elements = normalized.elements;
  const query = normalized.query;

  if (
    !Number.isInteger(count) ||
    !Array.isArray(elements) ||
    !isRecord(query) ||
    typeof query.strategy !== "string" ||
    typeof query.value !== "string"
  ) {
    throw new Error("Raw element discovery returned an invalid response.");
  }

  return {
    query: {
      strategy: query.strategy as RawElementSelectorStrategy,
      value: query.value
    },
    count: count as number,
    truncated: normalized.truncated === true,
    elements: elements as RawElementSummary[]
  };
}

function resolveSingleElement(options: {
  payload: {
    count: number;
    truncated: boolean;
    elements: RawElementSummary[];
  };
  matchIndex?: number;
}): RawElementSummary | string {
  if (options.payload.count === 0) {
    return "Raw selector did not match any visible TradingView UI element.";
  }

  if (options.matchIndex === undefined && options.payload.count > 1) {
    return `Raw selector matched ${options.payload.count} visible elements. Pass matchIndex to choose one.`;
  }

  const index = options.matchIndex ?? 0;
  const element = options.payload.elements[index];

  if (!element) {
    return `Raw selector matchIndex ${index} is outside the compact match set.`;
  }

  return element;
}

async function resolveRawClient(
  action: RawAutomationAction,
  options: RawAutomationBaseOptions,
  executedAt: string
): Promise<
  | {
      ok: true;
      endpoint: string;
      target: CdpTarget;
      client: RawTradingViewPageClient;
    }
  | {
      ok: false;
      result: RawAutomationResult;
    }
> {
  const endpoint = endpointOptions(options);
  const endpointUrl = formatCdpEndpoint(endpoint);
  const healthCheck = options.checkHealth ?? checkTradingViewHealth;
  const health = await healthCheck(healthOptionsFromRaw(options));

  if (!health.ok || !health.target) {
    return {
      ok: false,
      result: failureResult(action, {
        endpoint: health.endpoint,
        executedAt,
        error: health.message,
        warnings: health.nextSteps
      })
    };
  }

  if (!isTradingViewChartTarget(health.target)) {
    return {
      ok: false,
      result: failureResult(action, {
        endpoint: health.endpoint,
        executedAt,
        target: health.target,
        error:
          "Raw automation is restricted to the active local TradingView chart target."
      })
    };
  }

  const webSocketDebuggerUrl = health.target.webSocketDebuggerUrl;

  if (!webSocketDebuggerUrl) {
    return {
      ok: false,
      result: failureResult(action, {
        endpoint: health.endpoint,
        executedAt,
        target: health.target,
        error:
          "TradingView chart target does not expose a page WebSocket debugger URL."
      })
    };
  }

  const makeClient =
    options.pageClientFactory ??
    ((_target, clientOptions) =>
      createLiveRawTradingViewPageClient(webSocketDebuggerUrl, clientOptions));

  try {
    const client = await makeClient(health.target, {
      timeoutMs: endpoint.timeoutMs
    });

    return {
      ok: true,
      endpoint: health.endpoint || endpointUrl,
      target: health.target,
      client
    };
  } catch (error: unknown) {
    return {
      ok: false,
      result: failureResult(action, {
        endpoint: health.endpoint,
        executedAt,
        target: health.target,
        error: `Could not connect to TradingView chart target: ${errorMessage(error)}`
      })
    };
  }
}

async function verifyRawTargetStillChart(
  action: RawAutomationAction,
  options: RawAutomationBaseOptions,
  fallback: {
    endpoint: string;
    executedAt: string;
    target: CdpTarget;
  }
): Promise<RawAutomationResult | null> {
  const healthCheck = options.checkHealth ?? checkTradingViewHealth;
  const health = await healthCheck(healthOptionsFromRaw(options));

  if (health.ok && health.target && isTradingViewChartTarget(health.target)) {
    return null;
  }

  return failureResult(action, {
    endpoint: health.endpoint || fallback.endpoint,
    executedAt: fallback.executedAt,
    target: health.target ?? fallback.target,
    error:
      "Raw automation did not finish on an active local TradingView chart target.",
    warnings: health.nextSteps
  });
}

export async function runRawEvaluate(
  options: RawEvaluateOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const invalidExpression = invalidExpressionMessage(options.expression);

  if (invalidExpression) {
    return failureResult("evaluate", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidExpression
    });
  }

  const resolved = await resolveRawClient("evaluate", options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    const rawValue = await resolved.client.evaluate(options.expression, {
      throwOnSideEffect: true
    });
    const value = normalizeEvaluateResponse(rawValue);
    const maxResultBytes =
      options.maxResultBytes ?? DEFAULT_RAW_EVALUATE_MAX_RESULT_BYTES;

    if (compactJsonByteLength(value) > maxResultBytes) {
      return failureResult("evaluate", {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error:
          "Raw evaluate result exceeded the compact output limit. Return a smaller structured value or raise maxResultBytes intentionally."
      });
    }

    const targetFailure = await verifyRawTargetStillChart("evaluate", options, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });

    if (targetFailure) {
      return targetFailure;
    }

    return successResult("evaluate", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      value
    });
  } catch (error: unknown) {
    return failureResult("evaluate", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

export async function runRawClick(
  options: RawClickOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const invalidCoordinates = invalidCoordinateMessage(options.x, options.y);

  if (invalidCoordinates) {
    return failureResult("click", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidCoordinates
    });
  }

  const resolved = await resolveRawClient("click", options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    await resolved.client.click({
      x: options.x,
      y: options.y,
      button: options.button ?? "left"
    });

    const targetFailure = await verifyRawTargetStillChart("click", options, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });

    if (targetFailure) {
      return targetFailure;
    }

    return successResult("click", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });
  } catch (error: unknown) {
    return failureResult("click", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

export async function runRawKeypress(
  options: RawKeypressOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const invalidKey = invalidKeyMessage(options.key);

  if (invalidKey) {
    return failureResult("keypress", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidKey
    });
  }

  const resolved = await resolveRawClient("keypress", options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    await resolved.client.keypress(options.key);

    const targetFailure = await verifyRawTargetStillChart("keypress", options, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });

    if (targetFailure) {
      return targetFailure;
    }

    return successResult("keypress", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });
  } catch (error: unknown) {
    return failureResult("keypress", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

export async function runRawTypeText(
  options: RawTypeTextOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const invalidText = invalidTextMessage(options.text);

  if (invalidText) {
    return failureResult("type-text", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidText
    });
  }

  const resolved = await resolveRawClient("type-text", options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    await resolved.client.typeText(options.text);

    const targetFailure = await verifyRawTargetStillChart("type-text", options, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });

    if (targetFailure) {
      return targetFailure;
    }

    return successResult("type-text", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });
  } catch (error: unknown) {
    return failureResult("type-text", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

export async function runRawFindElement(
  options: RawFindElementOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const invalidSelector = invalidSelectorMessage(options);

  if (invalidSelector) {
    return failureResult("find-element", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidSelector
    });
  }

  const resolved = await resolveRawClient("find-element", options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    const payload = parseFindPayload(
      await resolved.client.evaluate(elementFindExpression(options))
    );

    return successResult("find-element", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      value: payload
    });
  } catch (error: unknown) {
    return failureResult("find-element", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

export async function runRawSelectorClick(
  options: RawSelectorClickOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const invalidSelector = invalidSelectorMessage(options);
  const invalidMatchIndex = invalidMatchIndexMessage(options.matchIndex);
  const invalidClickScope = invalidSelectorClickScopeMessage(options);

  if (invalidSelector || invalidMatchIndex || invalidClickScope) {
    return failureResult("selector-click", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error:
        invalidSelector ??
        invalidMatchIndex ??
        invalidClickScope ??
        "Invalid raw selector."
    });
  }

  const resolved = await resolveRawClient("selector-click", options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    const payload = parseFindPayload(
      await resolved.client.evaluate(
        elementFindExpression({
          ...options,
          maxMatches: Math.max(
            boundedMaxMatches(options.maxMatches),
            (options.matchIndex ?? 0) + 1
          )
        })
      )
    );
    const singleElementOptions: {
      payload: {
        count: number;
        truncated: boolean;
        elements: RawElementSummary[];
      };
      matchIndex?: number;
    } = { payload };

    if (options.matchIndex !== undefined) {
      singleElementOptions.matchIndex = options.matchIndex;
    }

    const element = resolveSingleElement(singleElementOptions);

    if (typeof element === "string") {
      return failureResult("selector-click", {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: element
      });
    }

    const elementScopeError = elementClickScopeMessage(element);

    if (elementScopeError) {
      return failureResult("selector-click", {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: elementScopeError
      });
    }

    const clickMethod = options.clickMethod ?? "mouse";

    if (clickMethod === "dom") {
      const clickResult = normalizeEvaluateResponse(
        await resolved.client.evaluate(
          domClickExpression({
            strategy: options.strategy,
            value: options.value,
            matchIndex: options.matchIndex ?? 0
          }),
          {
            throwOnSideEffect: false
          }
        )
      );

      if (
        !isRecord(clickResult) ||
        clickResult.ok !== true
      ) {
        throw new Error(
          isRecord(clickResult) && typeof clickResult.error === "string"
            ? clickResult.error
            : "Raw DOM click failed."
        );
      }
    } else {
      await resolved.client.click({
        x: element.rect.centerX,
        y: element.rect.centerY,
        button: options.button ?? "left"
      });
    }

    return successResult("selector-click", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      value: {
        query: payload.query,
        method: clickMethod,
        element
      }
    });
  } catch (error: unknown) {
    return failureResult("selector-click", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

export async function runRawSelectorHover(
  options: RawSelectorHoverOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const invalidSelector = invalidSelectorMessage(options);
  const invalidMatchIndex = invalidMatchIndexMessage(options.matchIndex);

  if (invalidSelector || invalidMatchIndex) {
    return failureResult("selector-hover", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidSelector ?? invalidMatchIndex ?? "Invalid raw selector."
    });
  }

  const resolved = await resolveRawClient("selector-hover", options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    const payload = parseFindPayload(
      await resolved.client.evaluate(
        elementFindExpression({
          ...options,
          maxMatches: Math.max(
            boundedMaxMatches(options.maxMatches),
            (options.matchIndex ?? 0) + 1
          )
        })
      )
    );
    const singleElementOptions: {
      payload: {
        count: number;
        truncated: boolean;
        elements: RawElementSummary[];
      };
      matchIndex?: number;
    } = { payload };

    if (options.matchIndex !== undefined) {
      singleElementOptions.matchIndex = options.matchIndex;
    }

    const element = resolveSingleElement(singleElementOptions);

    if (typeof element === "string") {
      return failureResult("selector-hover", {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: element
      });
    }

    await resolved.client.hover({
      x: element.rect.centerX,
      y: element.rect.centerY
    });

    return successResult("selector-hover", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      value: {
        query: payload.query,
        element
      }
    });
  } catch (error: unknown) {
    return failureResult("selector-hover", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

export async function runRawScroll(
  options: RawScrollOptions
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();
  const invalidScroll = invalidScrollMessage(options);

  if (invalidScroll) {
    return failureResult("scroll", {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidScroll
    });
  }

  const resolved = await resolveRawClient("scroll", options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  const scrollOptions = {
    direction: options.direction,
    amount: options.amount ?? DEFAULT_RAW_SCROLL_AMOUNT,
    x: options.x ?? 500,
    y: options.y ?? 500
  };

  try {
    await resolved.client.scroll(scrollOptions);

    return successResult("scroll", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      value: scrollOptions
    });
  } catch (error: unknown) {
    return failureResult("scroll", {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

async function runRawChartControl(
  action: RawAutomationAction,
  command: string,
  args: Record<string, unknown>,
  options: RawAutomationBaseOptions,
  invalidMessage?: string | null
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();

  if (invalidMessage) {
    return failureResult(action, {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidMessage
    });
  }

  const resolved = await resolveRawClient(action, options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    const rawValue = await resolved.client.evaluate(
      chartControlExpression(command, args),
      {
        awaitPromise: true,
        throwOnSideEffect: false
      }
    );
    const payload = normalizeEvaluateResponse(rawValue);

    if (!isChartControlPayload(payload)) {
      return failureResult(action, {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: "TradingView chart control returned an unexpected response shape."
      });
    }

    const payloadRecord = payload as Record<string, unknown>;
    const payloadWarnings = Array.isArray(payloadRecord.warnings)
      ? payloadRecord.warnings.filter((warning: unknown): warning is string =>
          typeof warning === "string"
        )
      : [];

    if (!payload.ok) {
      return failureResult(action, {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: payload.error ?? "TradingView chart control failed.",
        warnings: payloadWarnings,
        value: "before" in payload ? { before: payload.before } : undefined
      });
    }

    if (
      compactJsonByteLength(payload.value) >
      DEFAULT_RAW_CHART_CONTROL_MAX_RESULT_BYTES
    ) {
      return failureResult(action, {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: "Raw chart control result exceeded the compact output limit.",
        warnings: payloadWarnings
      });
    }

    const targetFailure = await verifyRawTargetStillChart(action, options, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });

    if (targetFailure) {
      return targetFailure;
    }

    return successResult(action, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      value: payload.value,
      warnings: payloadWarnings
    });
  } catch (error: unknown) {
    return failureResult(action, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

async function runRawPineEditorControl(
  action: RawAutomationAction,
  command: string,
  args: Record<string, unknown>,
  options: RawAutomationBaseOptions,
  invalidMessage?: string | null,
  maxResultBytes = DEFAULT_RAW_CHART_CONTROL_MAX_RESULT_BYTES
): Promise<RawAutomationResult> {
  const endpoint = endpointOptions(options);
  const executedAt = (options.now ?? (() => new Date()))().toISOString();

  if (invalidMessage) {
    return failureResult(action, {
      endpoint: formatCdpEndpoint(endpoint),
      executedAt,
      error: invalidMessage
    });
  }

  const resolved = await resolveRawClient(action, options, executedAt);

  if (!resolved.ok) {
    return resolved.result;
  }

  try {
    const rawValue = await resolved.client.evaluate(
      pineEditorExpression(command, args),
      {
        awaitPromise: true,
        throwOnSideEffect: false
      }
    );
    const payload = normalizeEvaluateResponse(rawValue);

    if (!isChartControlPayload(payload)) {
      return failureResult(action, {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: "TradingView Pine editor command returned an unexpected response shape."
      });
    }

    const payloadRecord = payload as Record<string, unknown>;
    const payloadWarnings = Array.isArray(payloadRecord.warnings)
      ? payloadRecord.warnings.filter((warning: unknown): warning is string =>
          typeof warning === "string"
        )
      : [];

    if (!payload.ok) {
      return failureResult(action, {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: payload.error ?? "TradingView Pine editor command failed.",
        warnings: payloadWarnings,
        value: "before" in payload ? { before: payload.before } : undefined
      });
    }

    if (compactJsonByteLength(payload.value) > maxResultBytes) {
      return failureResult(action, {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: "Raw Pine editor result exceeded the compact output limit.",
        warnings: payloadWarnings
      });
    }

    const targetFailure = await verifyRawTargetStillChart(action, options, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target
    });

    if (targetFailure) {
      return targetFailure;
    }

    return successResult(action, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      value: payload.value,
      warnings: payloadWarnings
    });
  } catch (error: unknown) {
    return failureResult(action, {
      endpoint: resolved.endpoint,
      executedAt,
      target: resolved.target,
      error: errorMessage(error)
    });
  } finally {
    await resolved.client.close();
  }
}

export function runRawChartState(
  options: RawChartStateOptions
): Promise<RawAutomationResult> {
  return runRawChartControl("chart-state", "state", {}, options);
}

export function runRawChartDataSummary(
  options: RawChartDataSummaryOptions
): Promise<RawAutomationResult> {
  const barCount = options.barCount ?? DEFAULT_RAW_CHART_DATA_BAR_COUNT;

  return runRawChartControl(
    "chart-data-summary",
    "chartDataSummary",
    {
      barCount
    },
    options,
    invalidBarCountMessage(barCount)
  );
}

export function runRawQuoteSnapshot(
  options: RawQuoteSnapshotOptions
): Promise<RawAutomationResult> {
  return runRawChartControl("quote-snapshot", "quoteSnapshot", {}, options);
}

export function runRawStudyValues(
  options: RawStudyValuesOptions
): Promise<RawAutomationResult> {
  const args: {
    maxStudies: number;
    maxValuesPerStudy: number;
    studyName?: string;
  } = {
    maxStudies:
      options.maxStudies ?? DEFAULT_RAW_STUDY_VALUES_MAX_STUDIES,
    maxValuesPerStudy:
      options.maxValuesPerStudy ?? DEFAULT_RAW_STUDY_VALUES_MAX_VALUES
  };

  if (options.studyName !== undefined) {
    args.studyName = options.studyName.trim();
  }

  return runRawChartControl(
    "study-values",
    "studyValues",
    args,
    options,
    invalidStudyValuesMessage(args)
  );
}

export function runRawListPanes(
  options: RawListPanesOptions
): Promise<RawAutomationResult> {
  return runRawChartControl("list-panes", "listPanes", {}, options);
}

export function runRawFocusPane(
  options: RawFocusPaneOptions
): Promise<RawAutomationResult> {
  const paneId = options.paneId.trim();

  return runRawChartControl(
    "focus-pane",
    "focusPane",
    { paneId },
    options,
    invalidPaneIdMessage(options.paneId)
  );
}

export function runRawSetPaneLayout(
  options: RawSetPaneLayoutOptions
): Promise<RawAutomationResult> {
  return runRawChartControl(
    "set-pane-layout",
    "setPaneLayout",
    { layout: options.layout },
    options,
    invalidPaneLayoutMessage(options.layout)
  );
}

export function runRawListLayouts(
  options: RawListLayoutsOptions
): Promise<RawAutomationResult> {
  return runRawChartControl("list-layouts", "listLayouts", {}, options);
}

export function runRawSwitchLayout(
  options: RawSwitchLayoutOptions
): Promise<RawAutomationResult> {
  const layoutId = options.layoutId.trim();

  return runRawChartControl(
    "switch-layout",
    "switchLayout",
    { layoutId },
    options,
    invalidLayoutIdMessage(options.layoutId)
  );
}

export function runRawBatchChart(
  options: RawBatchChartOptions
): Promise<RawAutomationResult> {
  const steps = options.steps.map((step) => {
    const nextStep: RawBatchChartStep = {};

    if (step.symbol !== undefined) {
      nextStep.symbol = step.symbol.trim();
    }

    if (step.timeframe !== undefined) {
      nextStep.timeframe = step.timeframe.trim();
    }

    return nextStep;
  });

  return runRawChartControl(
    "batch-chart",
    "batchChart",
    {
      steps,
      stopOnError: options.stopOnError === true
    },
    options,
    invalidBatchChartMessage(options)
  );
}

export function runRawReplayOpen(
  options: RawReplayOpenOptions
): Promise<RawAutomationResult> {
  return runRawChartControl("replay-open", "replayOpen", {}, options);
}

export function runRawReplayPlayPause(
  options: RawReplayPlayPauseOptions
): Promise<RawAutomationResult> {
  const mode = options.mode ?? "play";

  return runRawChartControl(
    "replay-play-pause",
    "replayPlayPause",
    { mode },
    options,
    invalidReplayPlayPauseModeMessage(mode)
  );
}

export function runRawReplayStep(
  options: RawReplayStepOptions
): Promise<RawAutomationResult> {
  const steps = options.steps ?? 1;

  return runRawChartControl(
    "replay-step",
    "replayStep",
    {
      direction: options.direction,
      steps
    },
    options,
    invalidReplayStepMessage(options)
  );
}

export function runRawReplaySetSpeed(
  options: RawReplaySetSpeedOptions
): Promise<RawAutomationResult> {
  return runRawChartControl(
    "replay-set-speed",
    "replaySetSpeed",
    { speed: options.speed },
    options,
    invalidReplaySpeedMessage(options.speed)
  );
}

export function runRawReplayExit(
  options: RawReplayExitOptions
): Promise<RawAutomationResult> {
  return runRawChartControl("replay-exit", "replayExit", {}, options);
}

export function runRawSetSymbol(
  options: RawSetSymbolOptions
): Promise<RawAutomationResult> {
  const symbol = options.symbol.trim();

  return runRawChartControl(
    "set-symbol",
    "setSymbol",
    { symbol },
    options,
    invalidSymbolMessage(options.symbol)
  );
}

export function runRawSetTimeframe(
  options: RawSetTimeframeOptions
): Promise<RawAutomationResult> {
  const timeframe = options.timeframe.trim();

  return runRawChartControl(
    "set-timeframe",
    "setTimeframe",
    { timeframe },
    options,
    invalidTimeframeMessage(options.timeframe)
  );
}

export function runRawSetChartType(
  options: RawSetChartTypeOptions
): Promise<RawAutomationResult> {
  const chartType =
    typeof options.chartType === "string"
      ? options.chartType.trim()
      : options.chartType;

  return runRawChartControl(
    "set-chart-type",
    "setChartType",
    { chartType },
    options,
    invalidChartTypeMessage(options.chartType)
  );
}

export function runRawSetVisibleRange(
  options: RawSetVisibleRangeOptions
): Promise<RawAutomationResult> {
  return runRawChartControl(
    "set-visible-range",
    "setVisibleRange",
    {
      range: {
        from: options.range.from,
        to: options.range.to
      }
    },
    options,
    invalidRangeMessage(options.range)
  );
}

export function runRawAddIndicator(
  options: RawAddIndicatorOptions
): Promise<RawAutomationResult> {
  const name = options.name.trim();

  return runRawChartControl(
    "add-indicator",
    "addIndicator",
    { name },
    options,
    invalidIndicatorNameMessage(options.name)
  );
}

export function runRawRemoveEntity(
  options: RawRemoveEntityOptions
): Promise<RawAutomationResult> {
  const entityId = options.entityId.trim();

  return runRawChartControl(
    "remove-entity",
    "removeEntity",
    { entityId },
    options,
    invalidEntityIdMessage(options.entityId)
  );
}

export function runRawDrawShape(
  options: RawDrawShapeOptions
): Promise<RawAutomationResult> {
  const args: {
    shapeType: RawDrawingShapeType;
    points: RawDrawingPoint[];
    text?: string;
    overrides?: Record<string, RawDrawingOverrideValue>;
    lock?: boolean;
    disableSelection?: boolean;
  } = {
    shapeType: options.shapeType,
    points: options.points.map((point) => ({
      time: Math.trunc(point.time),
      price: point.price
    }))
  };

  if (options.text !== undefined) {
    args.text = options.text.trim();
  }

  args.overrides = applyDrawingPresetOverrides(options.shapeType, {
    preset: options.drawingPreset,
    overrides: options.overrides
  });

  if (typeof options.lock === "boolean") {
    args.lock = options.lock;
  }

  if (typeof options.disableSelection === "boolean") {
    args.disableSelection = options.disableSelection;
  }

  return runRawChartControl(
    "draw-shape",
    "drawShape",
    args,
    options,
    invalidDrawShapeMessage(options)
  );
}

export function runRawDrawList(
  options: RawDrawListOptions
): Promise<RawAutomationResult> {
  return runRawChartControl("draw-list", "drawList", {}, options);
}

export function runRawDrawingProperties(
  options: RawDrawingPropertiesOptions
): Promise<RawAutomationResult> {
  const entityId = options.entityId.trim();

  return runRawChartControl(
    "draw-properties",
    "drawProperties",
    { entityId },
    options,
    invalidEntityIdMessage(options.entityId)
  );
}

export function runRawDrawRemove(
  options: RawDrawRemoveOptions
): Promise<RawAutomationResult> {
  const entityId = options.entityId.trim();

  return runRawChartControl(
    "draw-remove",
    "drawRemove",
    { entityId },
    options,
    invalidEntityIdMessage(options.entityId)
  );
}

export function runRawDrawClearAll(
  options: RawDrawClearAllOptions
): Promise<RawAutomationResult> {
  return runRawChartControl(
    "draw-clear-all",
    "drawClearAll",
    {
      confirmClearAll: options.confirmClearAll
    },
    options,
    invalidClearAllMessage(options.confirmClearAll)
  );
}

export function runRawDrawFibRetracement(
  options: RawDrawFibRetracementOptions
): Promise<RawAutomationResult> {
  const invalidMessage = invalidFibLevelsMacroMessage(options);
  const macro = invalidMessage ? undefined : buildFibLevelsMacroPlan(options);
  const anchors = macro?.anchors as
    | {
        start?: RawDrawingPoint;
        end?: RawDrawingPoint;
      }
    | undefined;
  const points = [anchors?.start, anchors?.end].filter(
    (point): point is RawDrawingPoint =>
      point !== undefined &&
      Number.isInteger(point.time) &&
      Number.isFinite(point.price)
  );
  const args: {
    points: RawDrawingPoint[];
    anchors?: Record<string, unknown>;
    levels?: unknown[];
    warnings: string[];
    overrides?: Record<string, RawDrawingOverrideValue>;
    lock?: boolean;
    disableSelection?: boolean;
  } = {
    points,
    warnings: [
      ...new Set([
        RAW_NATIVE_FIB_REVIEW_CONTEXT_WARNING,
        ...(macro?.warnings ?? [])
      ])
    ]
  };

  if (macro?.anchors) {
    args.anchors = macro.anchors;
  }

  if (macro?.levels) {
    args.levels = macro.levels;
  }

  args.overrides = applyDrawingPresetOverrides("fib-retracement", {
    preset: options.drawingPreset,
    overrides: options.overrides
  });

  if (typeof options.lock === "boolean") {
    args.lock = options.lock;
  }

  if (typeof options.disableSelection === "boolean") {
    args.disableSelection = options.disableSelection;
  }

  return runRawChartControl(
    "draw-fib-retracement",
    "drawFibRetracement",
    args,
    options,
    invalidMessage
  );
}

export function runRawDrawFibLevels(
  options: RawDrawFibLevelsOptions
): Promise<RawAutomationResult> {
  const invalidMessage = invalidFibLevelsMacroMessage(options);
  const macro = invalidMessage
    ? undefined
    : applyDrawingPresetToMacroPlan(
        buildFibLevelsMacroPlan(options),
        options.drawingPreset
      );

  return runRawChartControl(
    "draw-fib-levels",
    "drawMacro",
    {
      macro
    },
    options,
    invalidMessage
  );
}

export function runRawDrawProjection(
  options: RawDrawProjectionOptions
): Promise<RawAutomationResult> {
  const invalidMessage = invalidProjectionMacroMessage(options);
  const macro = invalidMessage
    ? undefined
    : applyDrawingPresetToMacroPlan(
        buildProjectionMacroPlan(options),
        options.drawingPreset
      );

  return runRawChartControl(
    "draw-projection",
    "drawMacro",
    {
      macro
    },
    options,
    invalidMessage
  );
}

export function runRawPineOpenEditor(
  options: RawPineOpenEditorOptions
): Promise<RawAutomationResult> {
  return runRawPineEditorControl(
    "pine-open-editor",
    "openEditor",
    {},
    options
  );
}

export function runRawPineSetSource(
  options: RawPineSetSourceOptions
): Promise<RawAutomationResult> {
  return runRawPineEditorControl(
    "pine-set-source",
    "setSource",
    {
      source: options.source
    },
    options,
    invalidPineSourceMessage(options.source)
  );
}

export function runRawPineGetSource(
  options: RawPineGetSourceOptions
): Promise<RawAutomationResult> {
  const maxSourceChars =
    options.maxSourceChars ?? DEFAULT_RAW_PINE_GET_SOURCE_MAX_CHARS;

  return runRawPineEditorControl(
    "pine-get-source",
    "getSource",
    {
      maxSourceChars
    },
    options,
    invalidPineGetSourceLimitMessage(maxSourceChars),
    Math.max(
      DEFAULT_RAW_CHART_CONTROL_MAX_RESULT_BYTES,
      maxSourceChars + 2_048
    )
  );
}

export function runRawPineGetErrors(
  options: RawPineGetErrorsOptions
): Promise<RawAutomationResult> {
  return runRawPineEditorControl(
    "pine-get-errors",
    "getErrors",
    {},
    options
  );
}

export function runRawPineGetConsole(
  options: RawPineGetConsoleOptions
): Promise<RawAutomationResult> {
  return runRawPineEditorControl(
    "pine-get-console",
    "getConsole",
    {},
    options
  );
}

export function runRawPineCompile(
  options: RawPineCompileOptions
): Promise<RawAutomationResult> {
  const settleMs = options.settleMs ?? DEFAULT_RAW_PINE_COMPILE_SETTLE_MS;

  return runRawPineEditorControl(
    "pine-compile",
    "compile",
    {
      settleMs
    },
    options,
    invalidPineSettleMsMessage(settleMs)
  );
}

export function runRawPineSave(
  options: RawPineSaveOptions
): Promise<RawAutomationResult> {
  const settleMs = options.settleMs ?? DEFAULT_RAW_PINE_SAVE_SETTLE_MS;

  return runRawPineEditorControl(
    "pine-save",
    "save",
    {
      settleMs
    },
    options,
    invalidPineSettleMsMessage(settleMs)
  );
}

export class LiveRawTradingViewPageClient implements RawTradingViewPageClient {
  constructor(readonly client: CdpClient) {}

  async evaluate(
    expression: string,
    options?: {
      awaitPromise?: boolean;
      throwOnSideEffect?: boolean;
    }
  ): Promise<unknown> {
    return this.client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: options?.awaitPromise ?? false,
      userGesture: false,
      throwOnSideEffect: options?.throwOnSideEffect ?? true
    });
  }

  async click(options: {
    x: number;
    y: number;
    button: RawInputButton;
  }): Promise<void> {
    const buttonMask = {
      left: 1,
      middle: 4,
      right: 2
    }[options.button];
    const params = {
      x: options.x,
      y: options.y,
      button: options.button,
      buttons: buttonMask,
      clickCount: 1
    };

    await this.client.send("Input.dispatchMouseEvent", {
      ...params,
      type: "mousePressed"
    });
    await this.client.send("Input.dispatchMouseEvent", {
      ...params,
      type: "mouseReleased",
      buttons: 0
    });
  }

  async keypress(key: string): Promise<void> {
    const text = key.length === 1 ? key : undefined;
    const baseParams: Record<string, unknown> = {
      key
    };

    if (text) {
      baseParams.text = text;
    }

    await this.client.send("Input.dispatchKeyEvent", {
      ...baseParams,
      type: "keyDown"
    });
    await this.client.send("Input.dispatchKeyEvent", {
      ...baseParams,
      type: "keyUp"
    });
  }

  async typeText(text: string): Promise<void> {
    await this.client.send("Input.insertText", {
      text
    });
  }

  async bringToFront(): Promise<void> {
    await this.client.send("Page.bringToFront", {});
  }

  async hover(options: { x: number; y: number }): Promise<void> {
    await this.client.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: options.x,
      y: options.y,
      button: "none",
      buttons: 0
    });
  }

  async scroll(options: {
    direction: RawScrollDirection;
    amount: number;
    x: number;
    y: number;
  }): Promise<void> {
    const delta = {
      up: { deltaX: 0, deltaY: -options.amount },
      down: { deltaX: 0, deltaY: options.amount },
      left: { deltaX: -options.amount, deltaY: 0 },
      right: { deltaX: options.amount, deltaY: 0 }
    }[options.direction];

    await this.client.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: options.x,
      y: options.y,
      button: "none",
      buttons: 0,
      ...delta
    });
  }

  close(): Promise<void> {
    return this.client.close();
  }
}

export async function createLiveRawTradingViewPageClient(
  webSocketDebuggerUrl: string,
  options: {
    timeoutMs: number;
  }
): Promise<RawTradingViewPageClient> {
  const client = await connectCdpClient(webSocketDebuggerUrl, options);
  return new LiveRawTradingViewPageClient(client);
}
