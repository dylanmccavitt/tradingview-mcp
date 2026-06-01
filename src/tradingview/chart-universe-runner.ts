import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS
} from "./desktop.js";
import {
  chartOneSymbol,
  type ChartOneSymbolOptions,
  type ChartOneSymbolResult
} from "./chart-runner.js";
import {
  DEFAULT_UNIVERSE_CONFIG_PATH,
  loadUniverseConfig,
  resolveUniverseSelection,
  type ResolvedUniverseSymbol,
  type UniverseConfig,
  type UniverseSelectionTier
} from "../universe/config.js";

export interface ChartUniverseSelectionSummary {
  configPath: string;
  groups: string[] | "all";
  tier: UniverseSelectionTier;
}

export interface ChartUniverseSymbolResult {
  symbol: ResolvedUniverseSymbol;
  chart: ChartOneSymbolResult;
}

export interface ChartUniverseResult {
  ok: boolean;
  configPath: string;
  selection: ChartUniverseSelectionSummary;
  symbols: ChartUniverseSymbolResult[];
}

export interface ChartUniverseOptions {
  configPath?: string;
  groupIds?: string[];
  tier?: UniverseSelectionTier;
  host?: string;
  port?: number;
  timeoutMs?: number;
  appPath?: string;
  outputRoot?: string;
  renderTimeoutMs?: number;
  renderSettleMs?: number;
  loadUniverseConfig?: (configPath?: string) => Promise<UniverseConfig>;
  chartOneSymbol?: (
    options: ChartOneSymbolOptions
  ) => Promise<ChartOneSymbolResult>;
}

function chartOptionsForSymbol(
  symbol: ResolvedUniverseSymbol,
  options: ChartUniverseOptions
): ChartOneSymbolOptions {
  const chartOptions: ChartOneSymbolOptions = {
    symbol: symbol.symbol,
    host: options.host ?? DEFAULT_CDP_HOST,
    port: options.port ?? DEFAULT_CDP_PORT,
    timeoutMs: options.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS
  };

  if (options.appPath) {
    chartOptions.appPath = options.appPath;
  }

  if (options.outputRoot) {
    chartOptions.outputRoot = options.outputRoot;
  }

  if (options.renderTimeoutMs) {
    chartOptions.renderTimeoutMs = options.renderTimeoutMs;
  }

  if (options.renderSettleMs) {
    chartOptions.renderSettleMs = options.renderSettleMs;
  }

  return chartOptions;
}

export async function chartUniverse(
  options: ChartUniverseOptions = {}
): Promise<ChartUniverseResult> {
  const configPath = options.configPath ?? DEFAULT_UNIVERSE_CONFIG_PATH;
  const tier = options.tier ?? "core";
  const readUniverseConfig = options.loadUniverseConfig ?? loadUniverseConfig;
  const chartSymbol = options.chartOneSymbol ?? chartOneSymbol;
  const config = await readUniverseConfig(configPath);
  const selectionOptions: Parameters<typeof resolveUniverseSelection>[1] = {
    tier
  };

  if (options.groupIds) {
    selectionOptions.groupIds = options.groupIds;
  }

  const symbols = resolveUniverseSelection(config, selectionOptions);
  const results: ChartUniverseSymbolResult[] = [];

  for (const symbol of symbols) {
    const chart = await chartSymbol(chartOptionsForSymbol(symbol, options));
    results.push({
      symbol,
      chart
    });
  }

  return {
    ok: results.every((item) => item.chart.ok),
    configPath,
    selection: {
      configPath,
      groups: options.groupIds ?? "all",
      tier
    },
    symbols: results
  };
}
