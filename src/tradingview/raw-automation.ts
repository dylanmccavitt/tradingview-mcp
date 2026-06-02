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

export type RawInputButton = "left" | "middle" | "right";
export type RawAutomationAction =
  | "evaluate"
  | "click"
  | "keypress"
  | "type-text";

export interface RawTradingViewPageClient {
  evaluate(
    expression: string,
    options?: {
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

export class LiveRawTradingViewPageClient implements RawTradingViewPageClient {
  constructor(readonly client: CdpClient) {}

  async evaluate(
    expression: string,
    options?: {
      throwOnSideEffect?: boolean;
    }
  ): Promise<unknown> {
    return this.client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: false,
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
