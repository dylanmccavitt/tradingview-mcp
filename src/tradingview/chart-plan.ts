import { join, resolve } from "node:path";

export const DEFAULT_CHART_OUTPUT_ROOT = "artifacts/tradingview-charts";
export const DEFAULT_RENDER_TIMEOUT_MS = 15_000;
export const DEFAULT_RENDER_SETTLE_MS = 750;

export type ChartTimeframeId = "weekly" | "daily" | "65-minute";

export interface ChartTimeframeDefinition {
  id: ChartTimeframeId;
  label: string;
  interval: string;
}

export interface ChartTimeframePlan extends ChartTimeframeDefinition {
  symbol: string;
  url: string;
  outputPath: string;
}

export interface ChartOneSymbolPlan {
  symbol: string;
  symbolSlug: string;
  outputDirectory: string;
  timeframes: ChartTimeframePlan[];
}

export interface BuildChartOneSymbolPlanOptions {
  symbol: string;
  outputRoot?: string;
  targetUrl?: string;
}

export class ChartPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChartPlanError";
  }
}

export const DEFAULT_CHART_TIMEFRAMES = [
  {
    id: "weekly",
    label: "Weekly",
    interval: "W"
  },
  {
    id: "daily",
    label: "Daily",
    interval: "D"
  },
  {
    id: "65-minute",
    label: "65-minute",
    interval: "65"
  }
] as const satisfies readonly ChartTimeframeDefinition[];

export function normalizeTradingViewSymbol(symbol: string): string {
  const trimmed = symbol.trim();
  const parts = trimmed.split(":");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ChartPlanError(
      "Symbol must be exchange-qualified, for example NASDAQ:NVDA."
    );
  }

  const exchange = parts[0].toUpperCase();
  const ticker = parts[1].toUpperCase();
  const validPart = /^[A-Z0-9_.-]+$/;

  if (!validPart.test(exchange) || !validPart.test(ticker)) {
    throw new ChartPlanError(
      "Symbol can contain only letters, numbers, dot, underscore, or hyphen on each side of the exchange separator."
    );
  }

  return `${exchange}:${ticker}`;
}

export function slugifyTradingViewSymbol(symbol: string): string {
  return normalizeTradingViewSymbol(symbol)
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTradingViewChartUrl(
  targetUrl: string | undefined,
  symbol: string,
  interval: string
): string {
  const url = new URL(targetUrl ?? "https://www.tradingview.com/chart/");

  if (!url.pathname.startsWith("/chart")) {
    url.pathname = "/chart/";
  }

  url.search = "";
  url.searchParams.set("symbol", normalizeTradingViewSymbol(symbol));
  url.searchParams.set("interval", interval);
  url.hash = "";

  return url.toString();
}

export function buildChartOneSymbolPlan(
  options: BuildChartOneSymbolPlanOptions
): ChartOneSymbolPlan {
  const symbol = normalizeTradingViewSymbol(options.symbol);
  const symbolSlug = slugifyTradingViewSymbol(symbol);
  const outputDirectory = resolve(
    options.outputRoot ?? DEFAULT_CHART_OUTPUT_ROOT,
    symbolSlug
  );

  return {
    symbol,
    symbolSlug,
    outputDirectory,
    timeframes: DEFAULT_CHART_TIMEFRAMES.map((timeframe) => ({
      ...timeframe,
      symbol,
      url: buildTradingViewChartUrl(options.targetUrl, symbol, timeframe.interval),
      outputPath: join(outputDirectory, `${symbolSlug}-${timeframe.id}.png`)
    }))
  };
}
