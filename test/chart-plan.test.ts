import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildChartOneSymbolPlan,
  ChartPlanError,
  DEFAULT_CHART_TIMEFRAMES,
  normalizeTradingViewSymbol,
  slugifyTradingViewSymbol
} from "../src/tradingview/chart-plan.js";

void test("chart planning builds the default one-symbol timeframe sequence", () => {
  const plan = buildChartOneSymbolPlan({
    symbol: "nasdaq:nvda",
    outputRoot: "/tmp/tradingview-output",
    targetUrl: "https://www.tradingview.com/chart/abc123/?symbol=NYSE%3AIBM"
  });

  assert.equal(plan.symbol, "NASDAQ:NVDA");
  assert.equal(plan.symbolSlug, "NASDAQ-NVDA");
  assert.equal(
    plan.outputDirectory,
    resolve("/tmp/tradingview-output/NASDAQ-NVDA")
  );
  assert.deepEqual(
    plan.timeframes.map((timeframe) => timeframe.id),
    DEFAULT_CHART_TIMEFRAMES.map((timeframe) => timeframe.id)
  );
  assert.deepEqual(
    plan.timeframes.map((timeframe) => timeframe.interval),
    ["W", "D", "65"]
  );
  assert.deepEqual(
    plan.timeframes.map((timeframe) => timeframe.outputPath),
    [
      "/tmp/tradingview-output/NASDAQ-NVDA/NASDAQ-NVDA-weekly.png",
      "/tmp/tradingview-output/NASDAQ-NVDA/NASDAQ-NVDA-daily.png",
      "/tmp/tradingview-output/NASDAQ-NVDA/NASDAQ-NVDA-65-minute.png"
    ]
  );
  assert.deepEqual(
    plan.timeframes.map((timeframe) => timeframe.url),
    [
      "https://www.tradingview.com/chart/abc123/?symbol=NASDAQ%3ANVDA&interval=W",
      "https://www.tradingview.com/chart/abc123/?symbol=NASDAQ%3ANVDA&interval=D",
      "https://www.tradingview.com/chart/abc123/?symbol=NASDAQ%3ANVDA&interval=65"
    ]
  );
});

void test("symbol normalization requires an exchange-qualified symbol", () => {
  assert.equal(normalizeTradingViewSymbol("nyse:brk.b"), "NYSE:BRK.B");
  assert.equal(slugifyTradingViewSymbol("nyse:brk.b"), "NYSE-BRK-B");
  assert.throws(
    () => normalizeTradingViewSymbol("NVDA"),
    ChartPlanError
  );
  assert.throws(
    () => normalizeTradingViewSymbol("NASDAQ:NVDA:EXTRA"),
    ChartPlanError
  );
});
