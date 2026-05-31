#!/usr/bin/env node

import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import {
  chartOneSymbol,
  type ChartOneSymbolOptions,
  type ChartOneSymbolResult
} from "./tradingview/chart-runner.js";
import { ChartPlanError } from "./tradingview/chart-plan.js";
import { formatCdpEndpoint } from "./tradingview/cdp.js";
import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS,
  buildTradingViewLaunchCommand,
  formatShellCommand,
  launchTradingViewDesktop,
  resolveTradingViewApp
} from "./tradingview/desktop.js";
import {
  checkTradingViewHealth,
  type CheckTradingViewHealthOptions,
  type TradingViewHealthResult
} from "./tradingview/health.js";

type Writable = Pick<NodeJS.WritableStream, "write">;

export interface CliStreams {
  stdout: Writable;
  stderr: Writable;
}

interface CommonCliOptions {
  host: string;
  port: number;
  timeoutMs: number;
  appPath?: string;
  json: boolean;
}

const USAGE = `Usage:
  tradingview-mcp-cli health [--host 127.0.0.1] [--port 9222] [--timeout-ms 2500] [--app /Applications/TradingView.app] [--json]
  tradingview-mcp-cli launch [--port 9222] [--app /Applications/TradingView.app]
  tradingview-mcp-cli launch-command [--port 9222] [--app /Applications/TradingView.app]
  tradingview-mcp-cli chart --symbol NASDAQ:NVDA [--output-dir artifacts/tradingview-charts] [--port 9222] [--timeout-ms 2500] [--render-timeout-ms 15000] [--json]

npm scripts:
  npm run tv:health -- --port 9222
  npm run tv:launch -- --port 9222
  npm run tv:launch-command -- --port 9222
  npm run tv:chart -- --symbol NASDAQ:NVDA --port 9222
`;

function parsePositiveInteger(value: string | undefined, label: string): number {
  if (!value) {
    throw new Error(`${label} is required.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function getStringOption(
  values: Record<string, string | boolean | string[] | undefined>,
  key: string
): string | undefined {
  const value = values[key];
  return typeof value === "string" ? value : undefined;
}

function getBooleanOption(
  values: Record<string, string | boolean | string[] | undefined>,
  key: string
): boolean {
  return values[key] === true;
}

function parseCommonOptions(
  values: Record<string, string | boolean | string[] | undefined>
): CommonCliOptions {
  const appPath = getStringOption(values, "app");
  const common: CommonCliOptions = {
    host: getStringOption(values, "host") ?? DEFAULT_CDP_HOST,
    port: parsePositiveInteger(
      getStringOption(values, "port") ?? String(DEFAULT_CDP_PORT),
      "--port"
    ),
    timeoutMs: parsePositiveInteger(
      getStringOption(values, "timeout-ms") ?? String(DEFAULT_CDP_TIMEOUT_MS),
      "--timeout-ms"
    ),
    json: getBooleanOption(values, "json")
  };

  if (appPath) {
    common.appPath = appPath;
  }

  return common;
}

function healthOptionsFromCli(
  options: CommonCliOptions
): CheckTradingViewHealthOptions {
  const healthOptions: CheckTradingViewHealthOptions = {
    host: options.host,
    port: options.port,
    timeoutMs: options.timeoutMs
  };

  if (options.appPath) {
    healthOptions.appPath = options.appPath;
  }

  return healthOptions;
}

function chartOptionsFromCli(
  values: Record<string, string | boolean | string[] | undefined>,
  common: CommonCliOptions,
  symbolFromPosition?: string
): ChartOneSymbolOptions {
  const symbol = getStringOption(values, "symbol") ?? symbolFromPosition;

  if (!symbol) {
    throw new Error("--symbol is required for chart.");
  }

  const chartOptions: ChartOneSymbolOptions = {
    symbol,
    host: common.host,
    port: common.port,
    timeoutMs: common.timeoutMs
  };

  if (common.appPath) {
    chartOptions.appPath = common.appPath;
  }

  const outputRoot = getStringOption(values, "output-dir");
  if (outputRoot) {
    chartOptions.outputRoot = outputRoot;
  }

  const renderTimeoutMs = getStringOption(values, "render-timeout-ms");
  if (renderTimeoutMs) {
    chartOptions.renderTimeoutMs = parsePositiveInteger(
      renderTimeoutMs,
      "--render-timeout-ms"
    );
  }

  const renderSettleMs = getStringOption(values, "render-settle-ms");
  if (renderSettleMs) {
    chartOptions.renderSettleMs = parsePositiveInteger(
      renderSettleMs,
      "--render-settle-ms"
    );
  }

  return chartOptions;
}

function formatHealthResult(result: TradingViewHealthResult): string {
  const lines = [
    `Status: ${result.status}`,
    `OK: ${result.ok ? "yes" : "no"}`,
    `Endpoint: ${result.endpoint}`,
    `Message: ${result.message}`
  ];

  if (result.browser) {
    lines.push(
      `Browser: ${result.browser.browser} (CDP ${result.browser.protocolVersion})`
    );
  }

  if (result.target) {
    lines.push(`Chart target: ${result.target.title} <${result.target.url}>`);
  }

  if (typeof result.targetCount === "number" && !result.target) {
    lines.push(`Targets seen: ${result.targetCount}`);
  }

  if (result.nextSteps.length > 0) {
    lines.push("Next steps:");
    for (const step of result.nextSteps) {
      lines.push(`- ${step}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function writeJson(stream: Writable, value: unknown): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function formatChartResult(result: ChartOneSymbolResult): string {
  const lines = [
    `Status: ${result.ok ? "success" : "failed"}`,
    `Symbol: ${result.symbol}`,
    `Endpoint: ${result.endpoint}`,
    `Output directory: ${result.outputDirectory}`
  ];

  if (result.target) {
    lines.push(`Chart target: ${result.target.title} <${result.target.url}>`);
  }

  lines.push("Timeframes:");

  for (const item of result.results) {
    if (item.ok) {
      lines.push(`- ${item.timeframe} (${item.interval}): OK ${item.outputPath}`);
    } else {
      lines.push(
        `- ${item.timeframe} (${item.interval}): FAILED ${item.error ?? "Unknown error"}`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function runCli(
  argv = process.argv.slice(2),
  streams: CliStreams = {
    stdout: process.stdout,
    stderr: process.stderr
  }
): Promise<number> {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        app: {
          type: "string"
        },
        help: {
          type: "boolean",
          short: "h"
        },
        host: {
          type: "string"
        },
        json: {
          type: "boolean"
        },
        "output-dir": {
          type: "string"
        },
        port: {
          type: "string",
          short: "p"
        },
        "render-settle-ms": {
          type: "string"
        },
        "render-timeout-ms": {
          type: "string"
        },
        symbol: {
          type: "string",
          short: "s"
        },
        "timeout-ms": {
          type: "string"
        }
      }
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    streams.stderr.write(`${detail}\n\n${USAGE}`);
    return 2;
  }

  if (parsed.values.help === true) {
    streams.stdout.write(USAGE);
    return 0;
  }

  const command = parsed.positionals[0];

  if (!command) {
    streams.stdout.write(USAGE);
    return 0;
  }

  let options: CommonCliOptions;

  try {
    options = parseCommonOptions(parsed.values);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    streams.stderr.write(`${detail}\n\n${USAGE}`);
    return 2;
  }

  if (command === "health") {
    const result = await checkTradingViewHealth(healthOptionsFromCli(options));

    if (options.json) {
      writeJson(streams.stdout, result);
    } else {
      streams.stdout.write(formatHealthResult(result));
    }

    return result.ok ? 0 : 1;
  }

  if (command === "chart") {
    let chartOptions: ChartOneSymbolOptions;

    try {
      chartOptions = chartOptionsFromCli(
        parsed.values,
        options,
        parsed.positionals[1]
      );
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      streams.stderr.write(`${detail}\n\n${USAGE}`);
      return 2;
    }

    let result: ChartOneSymbolResult;

    try {
      result = await chartOneSymbol(chartOptions);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      streams.stderr.write(`${detail}\n`);
      return error instanceof ChartPlanError ? 2 : 1;
    }

    if (options.json) {
      writeJson(streams.stdout, result);
    } else {
      streams.stdout.write(formatChartResult(result));
    }

    return result.ok ? 0 : 1;
  }

  if (command === "launch") {
    const launchOptions = {
      host: options.host,
      port: options.port
    };

    const result = await launchTradingViewDesktop(
      options.appPath
        ? {
            ...launchOptions,
            appPath: options.appPath
          }
        : launchOptions
    );

    if (options.json) {
      writeJson(streams.stdout, result);
    } else {
      streams.stdout.write(`${result.message}\n`);
      if (result.command) {
        streams.stdout.write(`Command: ${formatShellCommand(result.command)}\n`);
      }
      for (const step of result.nextSteps) {
        streams.stdout.write(`- ${step}\n`);
      }
    }

    return result.ok ? 0 : 1;
  }

  if (command === "launch-command") {
    const app = await resolveTradingViewApp(
      options.appPath
        ? {
            appPath: options.appPath
          }
        : {}
    );

    if (!app.found || !app.executablePath) {
      streams.stderr.write(
        "TradingView Desktop was not found. Install TradingView.app in /Applications or pass --app /path/to/TradingView.app.\n"
      );
      return 1;
    }

    const launchCommand = buildTradingViewLaunchCommand(
      app.executablePath,
      options.port
    );
    streams.stdout.write(`${formatShellCommand(launchCommand)}\n`);
    streams.stdout.write(
      `CDP endpoint after launch: ${formatCdpEndpoint(options)}\n`
    );
    return 0;
  }

  streams.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
