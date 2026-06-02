import { formatCdpEndpoint } from "./cdp.js";
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
  type CheckTradingViewHealthOptions,
  type TradingViewHealthResult
} from "./health.js";
import {
  isTradingViewChartTarget,
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
export const RAW_SYMBOL_MAX_CHARS = 64;
export const RAW_TIMEFRAME_MAX_CHARS = 32;
export const RAW_CHART_TYPE_MAX_CHARS = 64;
export const RAW_INDICATOR_NAME_MAX_CHARS = 120;
export const RAW_ENTITY_ID_MAX_CHARS = 200;

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
  | "set-symbol"
  | "set-timeframe"
  | "set-chart-type"
  | "set-visible-range"
  | "add-indicator"
  | "remove-entity";

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
  }
): RawAutomationResult {
  const result: RawAutomationResult = {
    ok: true,
    action,
    endpoint: options.endpoint,
    executedAt: options.executedAt,
    target: options.target,
    warnings: []
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

  async function mutate(chart, before) {
    if (command === "state") {
      return { ok: true, before };
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
  const value = { before, after };
  if (mutation.entityId) {
    value.entityId = mutation.entityId;
  }
  return { ok: true, value };
}
`;

function chartControlExpression(
  command: string,
  args: Record<string, unknown>
): string {
  return `(${RAW_CHART_CONTROL_EVALUATOR})(${JSON.stringify(command)}, ${JSON.stringify(args)})`;
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

    if (!payload.ok) {
      return failureResult(action, {
        endpoint: resolved.endpoint,
        executedAt,
        target: resolved.target,
        error: payload.error ?? "TradingView chart control failed.",
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
        error: "Raw chart control result exceeded the compact output limit."
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
      value: payload.value
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
