import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  buildChartbookPlan,
  runChartbook,
  type ChartbookLevelsArtifact
} from "../src/chartbook/chartbook.js";
import type { TradingViewChartPageClient } from "../src/tradingview/chart-page.js";
import type { ChartTimeframePlan } from "../src/tradingview/chart-plan.js";
import type { TradingViewPineDrawingPageClient } from "../src/tradingview/pine-drawing-page.js";
import { DEFAULT_PINE_DRAWING_STUDY_NAME } from "../src/tradingview/pine-drawings.js";
import type { TradingViewHealthResult } from "../src/tradingview/health.js";
import type { CdpTarget } from "../src/tradingview/targets.js";
import type { ResolvedUniverseSymbol } from "../src/universe/config.js";

const nvdaSymbol: ResolvedUniverseSymbol = {
  symbol: "NASDAQ:NVDA",
  alias: "NVDA",
  name: "NVIDIA",
  tags: ["semis", "gpu"],
  groups: ["semis"],
  tiers: ["core"]
};

const chartTarget: CdpTarget = {
  id: "chart-target",
  title: "NVDA Chart",
  type: "page",
  url: "https://www.tradingview.com/chart/chartid/?symbol=NASDAQ%3ANVDA",
  webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/chart-target"
};

const healthyResult: TradingViewHealthResult = {
  ok: true,
  status: "healthy",
  message: "healthy",
  endpoint: "http://127.0.0.1:9222",
  nextSteps: [],
  checkedAt: "2026-06-01T17:30:00.000Z",
  app: {
    found: true,
    executablePath: "/Applications/TradingView.app/Contents/MacOS/TradingView",
    checkedPaths: ["/Applications/TradingView.app/Contents/MacOS/TradingView"],
    source: "option"
  },
  target: chartTarget,
  targetCount: 1
};

class FakeChartPageClient implements TradingViewChartPageClient {
  readonly navigatedUrls: string[] = [];
  readonly waitedTimeframes: string[] = [];
  lastTimeframe = "";
  closed = false;

  constructor(readonly failTimeframes = new Set<string>()) {}

  navigate(url: string): Promise<void> {
    this.navigatedUrls.push(url);
    return Promise.resolve();
  }

  waitForRender(plan: ChartTimeframePlan): Promise<void> {
    this.lastTimeframe = plan.id;
    this.waitedTimeframes.push(plan.id);

    if (this.failTimeframes.has(plan.id)) {
      return Promise.reject(new Error(`render failed for ${plan.id}`));
    }

    return Promise.resolve();
  }

  captureScreenshot(): Promise<Buffer> {
    return Promise.resolve(Buffer.from(`fake-png-${this.lastTimeframe}`));
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

class FakePineDrawingPageClient implements TradingViewPineDrawingPageClient {
  closed = false;
  readCount = 0;

  constructor(
    readonly chartClient: FakeChartPageClient,
    readonly emptyReadsBeforeData = 0
  ) {}

  readDrawingPayload(): Promise<unknown> {
    this.readCount += 1;

    if (this.readCount <= this.emptyReadsBeforeData) {
      return Promise.resolve({
        chart: {
          url: `https://www.tradingview.com/chart/chartid/?symbol=NASDAQ%3ANVDA&interval=${this.chartClient.lastTimeframe}`
        },
        studies: [
          {
            studyName: DEFAULT_PINE_DRAWING_STUDY_NAME,
            legendText: DEFAULT_PINE_DRAWING_STUDY_NAME
          }
        ]
      });
    }

    return Promise.resolve({
      chart: {
        url: `https://www.tradingview.com/chart/chartid/?symbol=NASDAQ%3ANVDA&interval=${this.chartClient.lastTimeframe}`
      },
      studies: [
        {
          studyName: DEFAULT_PINE_DRAWING_STUDY_NAME,
          lines: [
            {
              title: `${this.chartClient.lastTimeframe}-level`,
              price: 900
            }
          ]
        }
      ]
    });
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

function parseLevelsArtifact(json: string): ChartbookLevelsArtifact {
  const parsed: unknown = JSON.parse(json) as unknown;
  return parsed as ChartbookLevelsArtifact;
}

void test("chartbook planning builds deterministic session and symbol artifact paths", () => {
  const plan = buildChartbookPlan({
    symbols: [nvdaSymbol],
    outputRoot: "/tmp/chartbooks",
    sessionId: "June 1 chartbook",
    capturedAt: new Date("2026-06-01T17:30:00.000Z"),
    preset: "levels",
    selection: {
      configPath: "/tmp/universe.json",
      groups: ["semis"],
      tier: "core"
    },
    targetUrl: "https://www.tradingview.com/chart/abc123/?symbol=NYSE%3AIBM"
  });

  assert.equal(plan.sessionId, "June-1-chartbook");
  assert.equal(plan.capturedAt, "2026-06-01T17:30:00.000Z");
  assert.equal(plan.sessionDirectory, resolve("/tmp/chartbooks/June-1-chartbook"));
  assert.equal(plan.indexPath, resolve("/tmp/chartbooks/June-1-chartbook/index.md"));
  assert.equal(plan.symbols[0]?.directory, resolve("/tmp/chartbooks/June-1-chartbook/NASDAQ-NVDA"));
  assert.deepEqual(
    plan.symbols[0]?.timeframes.map((timeframe) => timeframe.screenshotPath),
    [
      "/tmp/chartbooks/June-1-chartbook/NASDAQ-NVDA/NASDAQ-NVDA-weekly.png",
      "/tmp/chartbooks/June-1-chartbook/NASDAQ-NVDA/NASDAQ-NVDA-daily.png",
      "/tmp/chartbooks/June-1-chartbook/NASDAQ-NVDA/NASDAQ-NVDA-65-minute.png"
    ]
  );
  assert.deepEqual(
    plan.symbols[0]?.timeframes.map((timeframe) => timeframe.levelsJsonPath),
    [
      "/tmp/chartbooks/June-1-chartbook/NASDAQ-NVDA/NASDAQ-NVDA-weekly-levels.json",
      "/tmp/chartbooks/June-1-chartbook/NASDAQ-NVDA/NASDAQ-NVDA-daily-levels.json",
      "/tmp/chartbooks/June-1-chartbook/NASDAQ-NVDA/NASDAQ-NVDA-65-minute-levels.json"
    ]
  );
  assert.deepEqual(
    plan.symbols[0]?.timeframes.map((timeframe) => timeframe.url),
    [
      "https://www.tradingview.com/chart/abc123/?symbol=NASDAQ%3ANVDA&interval=W",
      "https://www.tradingview.com/chart/abc123/?symbol=NASDAQ%3ANVDA&interval=D",
      "https://www.tradingview.com/chart/abc123/?symbol=NASDAQ%3ANVDA&interval=65"
    ]
  );
});

void test("chartbook run writes screenshots, levels JSON, notes, index, and partial failures", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "tvmcp-chartbook-"));
  const fakeChartClient = new FakeChartPageClient(new Set(["daily"]));
  const fakeDrawingClient = new FakePineDrawingPageClient(fakeChartClient);

  try {
    const result = await runChartbook({
      symbols: [nvdaSymbol],
      outputRoot,
      sessionId: "session-a",
      preset: "levels",
      selection: {
        configPath: "/tmp/universe.json",
        groups: ["semis"],
        tier: "core"
      },
      checkHealth: () => Promise.resolve(healthyResult),
      chartClientFactory: () => Promise.resolve(fakeChartClient),
      drawingClientFactory: () => Promise.resolve(fakeDrawingClient),
      now: () => new Date("2026-06-01T17:30:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(fakeChartClient.closed, true);
    assert.equal(fakeDrawingClient.closed, true);
    assert.deepEqual(
      result.symbols[0]?.timeframes.map((timeframe) => [
        timeframe.timeframe,
        timeframe.ok
      ]),
      [
        ["weekly", true],
        ["daily", false],
        ["65-minute", true]
      ]
    );

    const symbolDirectory = join(outputRoot, "session-a", "NASDAQ-NVDA");
    await access(join(symbolDirectory, "NASDAQ-NVDA-weekly.png"));
    await access(join(symbolDirectory, "NASDAQ-NVDA-65-minute.png"));
    await assert.rejects(access(join(symbolDirectory, "NASDAQ-NVDA-daily.png")));

    const weekly = parseLevelsArtifact(
      await readFile(
        join(symbolDirectory, "NASDAQ-NVDA-weekly-levels.json"),
        "utf8"
      )
    );
    const daily = parseLevelsArtifact(
      await readFile(
        join(symbolDirectory, "NASDAQ-NVDA-daily-levels.json"),
        "utf8"
      )
    );
    const intraday = parseLevelsArtifact(
      await readFile(
        join(symbolDirectory, "NASDAQ-NVDA-65-minute-levels.json"),
        "utf8"
      )
    );

    assert.equal(weekly.ok, true);
    assert.equal(weekly.symbol.symbol, "NASDAQ:NVDA");
    assert.equal(weekly.timeframe.id, "weekly");
    assert.equal(weekly.paths.screenshot, "NASDAQ-NVDA-weekly.png");
    assert.equal(weekly.extraction.drawings.levels[0]?.name, "weekly-level");
    assert.equal(daily.ok, false);
    assert.match(daily.screenshot.error ?? "", /render failed for daily/);
    assert.match(daily.extraction.error ?? "", /Skipped drawing extraction/);
    assert.equal(intraday.ok, true);
    assert.equal(intraday.extraction.drawings.levels[0]?.name, "65-minute-level");

    const notes = await readFile(join(symbolDirectory, "notes.md"), "utf8");
    assert.match(notes, /# NVDA - NVIDIA/);
    assert.match(notes, /- Tags: semis, gpu/);
    assert.match(notes, /- Preset: `levels`/);
    assert.match(notes, /!\[Weekly screenshot\]\(\.\/NASDAQ-NVDA-weekly\.png\)/);
    assert.match(notes, /## Codex Notes/);
    assert.match(notes, /### Cross-Timeframe/);

    const index = await readFile(join(outputRoot, "session-a", "index.md"), "utf8");
    assert.match(index, /# TradingView Chartbook session-a/);
    assert.match(index, /\[NVDA\]\(\.\/NASDAQ-NVDA\/notes\.md\)/);
    assert.match(index, /not a scanner, ranking, recommendation, broker action, or order workflow/);
  } finally {
    await rm(outputRoot, {
      recursive: true,
      force: true
    });
  }
});

void test("chartbook retries drawing extraction until the overlay payload has levels", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "tvmcp-chartbook-"));
  const fakeChartClient = new FakeChartPageClient();
  const fakeDrawingClient = new FakePineDrawingPageClient(fakeChartClient, 1);

  try {
    const result = await runChartbook({
      symbols: [nvdaSymbol],
      outputRoot,
      sessionId: "session-retry",
      preset: "levels",
      selection: {
        configPath: "/tmp/universe.json",
        groups: ["semis"],
        tier: "core"
      },
      checkHealth: () => Promise.resolve(healthyResult),
      chartClientFactory: () => Promise.resolve(fakeChartClient),
      drawingClientFactory: () => Promise.resolve(fakeDrawingClient),
      drawingRetryAttempts: 2,
      drawingRetryDelayMs: 0,
      now: () => new Date("2026-06-01T17:30:00.000Z")
    });

    assert.equal(result.ok, true);
    assert.equal(fakeDrawingClient.readCount, 4);

    const weekly = parseLevelsArtifact(
      await readFile(
        join(
          outputRoot,
          "session-retry",
          "NASDAQ-NVDA",
          "NASDAQ-NVDA-weekly-levels.json"
        ),
        "utf8"
      )
    );

    assert.equal(weekly.ok, true);
    assert.equal(weekly.extraction.drawings.levels[0]?.name, "weekly-level");
  } finally {
    await rm(outputRoot, {
      recursive: true,
      force: true
    });
  }
});
