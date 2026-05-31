import { mkdir, writeFile } from "node:fs/promises";

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
  buildChartOneSymbolPlan,
  DEFAULT_RENDER_SETTLE_MS,
  DEFAULT_RENDER_TIMEOUT_MS,
  type ChartOneSymbolPlan,
  type ChartTimeframePlan
} from "./chart-plan.js";
import {
  createLiveTradingViewChartPageClient,
  type TradingViewChartPageClient
} from "./chart-page.js";
import type { CdpTarget } from "./targets.js";

interface ChartOneSymbolFileSystem {
  mkdir: (
    path: string,
    options: {
      recursive: true;
    }
  ) => Promise<unknown>;
  writeFile: (path: string, data: Buffer) => Promise<unknown>;
}

export interface ChartOneSymbolOptions {
  symbol: string;
  outputRoot?: string;
  host?: string;
  port?: number;
  timeoutMs?: number;
  appPath?: string;
  renderTimeoutMs?: number;
  renderSettleMs?: number;
  checkHealth?: (
    options: CheckTradingViewHealthOptions
  ) => Promise<TradingViewHealthResult>;
  chartClientFactory?: (
    target: CdpTarget,
    options: {
      timeoutMs: number;
      renderTimeoutMs: number;
      renderSettleMs: number;
    }
  ) => Promise<TradingViewChartPageClient>;
  fileSystem?: {
    mkdir: ChartOneSymbolFileSystem["mkdir"];
    writeFile: ChartOneSymbolFileSystem["writeFile"];
  };
}

export interface ChartTimeframeResult {
  symbol: string;
  timeframe: string;
  interval: string;
  url: string;
  outputPath: string;
  ok: boolean;
  error?: string;
}

export interface ChartOneSymbolResult {
  ok: boolean;
  symbol: string;
  outputDirectory: string;
  endpoint: string;
  target?: CdpTarget;
  results: ChartTimeframeResult[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failAllTimeframes(
  plan: ChartOneSymbolPlan,
  endpoint: string,
  message: string,
  target?: CdpTarget
): ChartOneSymbolResult {
  const result: ChartOneSymbolResult = {
    ok: false,
    symbol: plan.symbol,
    outputDirectory: plan.outputDirectory,
    endpoint,
    results: plan.timeframes.map((timeframe) => ({
      symbol: plan.symbol,
      timeframe: timeframe.id,
      interval: timeframe.interval,
      url: timeframe.url,
      outputPath: timeframe.outputPath,
      ok: false,
      error: message
    }))
  };

  if (target) {
    result.target = target;
  }

  return result;
}

async function captureTimeframe(
  client: TradingViewChartPageClient,
  timeframe: ChartTimeframePlan,
  writeScreenshot: ChartOneSymbolFileSystem["writeFile"]
): Promise<ChartTimeframeResult> {
  try {
    await client.navigate(timeframe.url);
    await client.waitForRender(timeframe);
    const screenshot = await client.captureScreenshot();
    await writeScreenshot(timeframe.outputPath, screenshot);

    return {
      symbol: timeframe.symbol,
      timeframe: timeframe.id,
      interval: timeframe.interval,
      url: timeframe.url,
      outputPath: timeframe.outputPath,
      ok: true
    };
  } catch (error: unknown) {
    return {
      symbol: timeframe.symbol,
      timeframe: timeframe.id,
      interval: timeframe.interval,
      url: timeframe.url,
      outputPath: timeframe.outputPath,
      ok: false,
      error: errorMessage(error)
    };
  }
}

export async function chartOneSymbol(
  options: ChartOneSymbolOptions
): Promise<ChartOneSymbolResult> {
  const endpoint = {
    host: options.host ?? DEFAULT_CDP_HOST,
    port: options.port ?? DEFAULT_CDP_PORT
  };
  const timeoutMs = options.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS;
  const renderTimeoutMs = options.renderTimeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  const renderSettleMs = options.renderSettleMs ?? DEFAULT_RENDER_SETTLE_MS;
  const healthCheck = options.checkHealth ?? checkTradingViewHealth;
  const fileSystem = options.fileSystem ?? {
    mkdir,
    writeFile
  };
  const healthOptions: CheckTradingViewHealthOptions = {
    ...endpoint,
    timeoutMs
  };
  const basePlanOptions: Parameters<typeof buildChartOneSymbolPlan>[0] = {
    symbol: options.symbol
  };

  if (options.outputRoot) {
    basePlanOptions.outputRoot = options.outputRoot;
  }

  let plan = buildChartOneSymbolPlan(basePlanOptions);

  if (options.appPath) {
    healthOptions.appPath = options.appPath;
  }

  const health = await healthCheck(healthOptions);

  if (health.target?.url) {
    plan = buildChartOneSymbolPlan({
      ...basePlanOptions,
      targetUrl: health.target.url
    });
  }

  if (!health.ok || !health.target) {
    return failAllTimeframes(plan, health.endpoint, health.message);
  }

  const webSocketDebuggerUrl = health.target.webSocketDebuggerUrl;

  if (!webSocketDebuggerUrl) {
    return failAllTimeframes(
      plan,
      health.endpoint,
      "TradingView chart target does not expose a page WebSocket debugger URL.",
      health.target
    );
  }

  const makeClient =
    options.chartClientFactory ??
    ((_target, clientOptions) =>
      createLiveTradingViewChartPageClient(webSocketDebuggerUrl, clientOptions));

  await fileSystem.mkdir(plan.outputDirectory, {
    recursive: true
  });

  let client: TradingViewChartPageClient;

  try {
    client = await makeClient(health.target, {
      timeoutMs,
      renderTimeoutMs,
      renderSettleMs
    });
  } catch (error: unknown) {
    return failAllTimeframes(
      plan,
      health.endpoint,
      `Could not connect to TradingView chart target: ${errorMessage(error)}`,
      health.target
    );
  }

  try {
    const results: ChartTimeframeResult[] = [];

    for (const timeframe of plan.timeframes) {
      results.push(
        await captureTimeframe(client, timeframe, fileSystem.writeFile)
      );
    }

    const result: ChartOneSymbolResult = {
      ok: results.every((item) => item.ok),
      symbol: plan.symbol,
      outputDirectory: plan.outputDirectory,
      endpoint: health.endpoint,
      target: health.target,
      results
    };

    return result;
  } finally {
    await client.close();
  }
}
