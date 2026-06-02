import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  buildChartbookPlan,
  renderChartbookIndexHtml,
  renderSymbolNotesMarkdown,
  runChartbook,
  type ChartbookLevelsArtifact,
  type ChartbookSymbolPlan,
  type ChartbookSymbolResult
} from "../src/chartbook/chartbook.js";
import type {
  ChartFactLevel,
  ChartFacts
} from "../src/chart-analysis/chart-facts.js";
import type { ChartAnalysisProfileName } from "../src/domain.js";
import type { TradingViewChartPageClient } from "../src/tradingview/chart-page.js";
import type {
  ChartTimeframeId,
  ChartTimeframePlan
} from "../src/tradingview/chart-plan.js";
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

const macroMetadata = [
  {
    schemaVersion: 1 as const,
    kind: "projection" as const,
    source: "extracted-range",
    anchors: {
      mode: "range-projection"
    },
    levels: [
      {
        label: "Range +1x",
        price: 580,
        role: "projection" as const,
        source: "extracted-range" as const,
        multiplier: 1
      }
    ],
    drawingIds: ["shape-9"],
    warnings: ["Review context only."]
  }
];

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
          url: `https://www.tradingview.com/chart/chartid/?symbol=NASDAQ%3ANVDA&interval=${this.chartClient.lastTimeframe}`,
          currentPrice: 890
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
        url: `https://www.tradingview.com/chart/chartid/?symbol=NASDAQ%3ANVDA&interval=${this.chartClient.lastTimeframe}`,
        currentPrice: 890
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

function testLevel(
  name: string,
  price: number,
  role: ChartFactLevel["role"] = "unknown"
): ChartFactLevel {
  return {
    name,
    price,
    role,
    sources: ["plot"]
  };
}

function testFacts(
  profile: ChartAnalysisProfileName,
  options: {
    referenceLevels?: ChartFactLevel[];
    support?: ChartFactLevel;
    resistance?: ChartFactLevel;
    referencePrice?: number;
    compression?: ChartFacts["compression"];
    avwap?: ChartFacts["avwap"];
    priorDayLevels?: ChartFactLevel[];
    premarketLevels?: ChartFactLevel[];
    openingRangeLevels?: ChartFactLevel[];
    warnings?: string[];
  } = {}
): ChartFacts {
  const nearest: ChartFacts["nearest"] = {};
  const chart: NonNullable<ChartFacts["chart"]> = {
    symbol: "NASDAQ:NVDA",
    interval: "D"
  };

  if (typeof options.referencePrice === "number") {
    nearest.referencePrice = options.referencePrice;
    chart.currentPrice = options.referencePrice;
  }

  if (options.support) {
    nearest.support = options.support;
  }

  if (options.resistance) {
    nearest.resistance = options.resistance;
  }

  return {
    schemaVersion: 1,
    profile,
    chart,
    extracted: {
      levels: options.referenceLevels?.length ?? 0,
      zones: options.compression?.range ? 1 : 0,
      labels: 0,
      tables: 0
    },
    nearest,
    breakout: {
      referenceLevels: options.referenceLevels ?? []
    },
    compression: options.compression ?? {
      state: "unknown"
    },
    avwap: options.avwap ?? {
      present: false
    },
    timing: {
      priorDayLevels: options.priorDayLevels ?? [],
      premarketLevels: options.premarketLevels ?? [],
      openingRangeLevels: options.openingRangeLevels ?? []
    },
    profileFocus: [],
    warnings: options.warnings ?? []
  };
}

function resultFromPlan(
  symbol: ChartbookSymbolPlan,
  factsByTimeframe: Partial<Record<ChartTimeframeId, ChartFacts>>,
  warningsByTimeframe: Partial<Record<ChartTimeframeId, string[]>> = {}
): ChartbookSymbolResult {
  const result: ChartbookSymbolResult = {
    symbol: symbol.symbol,
    alias: symbol.alias,
    tags: [...symbol.tags],
    groups: [...symbol.groups],
    tiers: [...symbol.tiers],
    ok: true,
    symbolSlug: symbol.symbolSlug,
    directory: symbol.directory,
    notesPath: symbol.notesPath,
    timeframes: symbol.timeframes.map((timeframe) => ({
      symbol: symbol.symbol,
      timeframe: timeframe.id,
      label: timeframe.label,
      interval: timeframe.interval,
      url: timeframe.url,
      screenshotPath: timeframe.screenshotPath,
      levelsJsonPath: timeframe.levelsJsonPath,
      ok: true,
      screenshotOk: true,
      extractionOk: true,
      levelsJsonOk: true,
      facts: factsByTimeframe[timeframe.id] ?? testFacts("focus"),
      warnings: warningsByTimeframe[timeframe.id] ?? []
    }))
  };

  if (symbol.name) {
    result.name = symbol.name;
  }

  return result;
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
  assert.equal(plan.indexHtmlPath, resolve("/tmp/chartbooks/June-1-chartbook/index.html"));
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
      profile: "breakout",
      checkHealth: () => Promise.resolve(healthyResult),
      chartClientFactory: () => Promise.resolve(fakeChartClient),
      drawingClientFactory: () => Promise.resolve(fakeDrawingClient),
      macroMetadata,
      now: () => new Date("2026-06-01T17:30:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(result.macros?.[0]?.drawingIds[0], "shape-9");
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
    assert.equal(weekly.profile, "breakout");
    assert.equal(weekly.macros?.[0]?.levels[0]?.label, "Range +1x");
    assert.equal(weekly.paths.screenshot, "NASDAQ-NVDA-weekly.png");
    assert.equal(weekly.extraction.drawings.levels[0]?.name, "weekly-level");
    assert.equal(weekly.extraction.facts.profile, "breakout");
    assert.equal(weekly.extraction.facts.nearest.resistance?.name, "weekly-level");
    assert.match(result.symbols[0]?.timeframes[0]?.warnings.join(" ") ?? "", /AVWAP value was not available/i);
    assert.equal(daily.ok, false);
    assert.match(daily.screenshot.error ?? "", /render failed for daily/);
    assert.match(daily.extraction.error ?? "", /Skipped drawing extraction/);
    assert.equal(intraday.ok, true);
    assert.equal(intraday.extraction.drawings.levels[0]?.name, "65-minute-level");

    const notes = await readFile(join(symbolDirectory, "notes.md"), "utf8");
    assert.match(notes, /# NVDA - NVIDIA/);
    assert.match(notes, /- Tags: semis, gpu/);
    assert.match(notes, /- Preset: `levels`/);
    assert.match(notes, /- Profile: `breakout`/);
    assert.match(notes, /AVWAP value was not available/);
    assert.match(notes, /!\[Weekly screenshot\]\(\.\/NASDAQ-NVDA-weekly\.png\)/);
    assert.match(notes, /## Breakout Review Checklist/);
    assert.match(notes, /### Volume \/ Confirmation/);
    assert.match(notes, /### Invalidation Notes/);
    assert.match(notes, /## Manual Notes/);
    assert.match(notes, /### Cross-Timeframe/);

    const index = await readFile(join(outputRoot, "session-a", "index.md"), "utf8");
    assert.match(index, /# TradingView Chartbook session-a/);
    assert.match(index, /- Profile: `breakout`/);
    assert.match(index, /\[NVDA\]\(\.\/NASDAQ-NVDA\/notes\.md\)/);
    assert.match(index, /not a scanner, ranking, recommendation, broker action, or order workflow/);

    const dashboard = await readFile(
      join(outputRoot, "session-a", "index.html"),
      "utf8"
    );
    assert.match(dashboard, /<title>TradingView Chartbook session-a<\/title>/);
    assert.match(dashboard, /Profile<\/strong>breakout/);
    assert.match(dashboard, /Codex Analysis/);
    assert.match(dashboard, /Objective Read/);
    assert.match(dashboard, /Breakout Review/);
    assert.match(dashboard, /Weekly Context/);
    assert.match(dashboard, /Daily Setup/);
    assert.match(dashboard, /65-Minute Timing/);
    assert.match(dashboard, /NASDAQ-NVDA\/NASDAQ-NVDA-weekly\.png/);
    assert.match(dashboard, /NASDAQ-NVDA\/NASDAQ-NVDA-weekly-levels\.json/);
    assert.match(dashboard, /NASDAQ-NVDA\/notes\.md/);
    assert.match(dashboard, /Manual Review/);
    assert.match(dashboard, /data-persist-key="NASDAQ-NVDA:breakout:notes"/);
    assert.match(dashboard, /not a scanner, ranking, recommendation, broker action, alert, or order workflow/);
  } finally {
    await rm(outputRoot, {
      recursive: true,
      force: true
    });
  }
});

void test("chartbook HTML dashboard renders breakout facts in scannable sections", () => {
  const plan = buildChartbookPlan({
    symbols: [nvdaSymbol],
    outputRoot: "/tmp/chartbooks",
    sessionId: "breakout-dashboard",
    capturedAt: new Date("2026-06-01T17:30:00.000Z"),
    preset: "focus",
    profile: "breakout",
    selection: {
      configPath: "/tmp/universe.json",
      groups: ["semis"],
      tier: "core"
    }
  });
  const symbol = plan.symbols[0] as ChartbookSymbolPlan;
  const result = resultFromPlan(
    symbol,
    {
      weekly: testFacts("breakout", {
        referencePrice: 142,
        referenceLevels: [
          testLevel("PWH", 147, "prior-week"),
          testLevel("20D-H", 145, "breakout")
        ],
        support: testLevel("PWL", 134, "prior-week"),
        resistance: testLevel("PWH", 147, "prior-week")
      }),
      daily: testFacts("breakout", {
        referencePrice: 142,
        referenceLevels: [
          testLevel("50D-H", 151, "breakout"),
          testLevel("20D-H", 145, "breakout")
        ],
        support: testLevel("AVWAP", 140.2, "avwap"),
        resistance: testLevel("20D-H", 145, "breakout")
      }),
      "65-minute": testFacts("breakout", {
        priorDayLevels: [
          testLevel("PDH", 143, "prior-day"),
          testLevel("PDL", 138, "prior-day")
        ],
        openingRangeLevels: [
          testLevel("OR-H", 142.5, "timing"),
          testLevel("OR-L", 139.5, "timing")
        ]
      })
    },
    {
      daily: ["Legend-only extraction fallback was used."]
    }
  );

  const dashboard = renderChartbookIndexHtml(plan, {
    ok: true,
    endpoint: "http://127.0.0.1:9222",
    symbols: [result]
  });

  assert.match(dashboard, /Local TradingView Chartbook/);
  assert.match(dashboard, /Groups<\/strong>semis/);
  assert.match(dashboard, /Preset<\/strong>focus/);
  assert.match(dashboard, /Codex Analysis/);
  assert.match(dashboard, /Daily breakout references:/);
  assert.match(dashboard, /50D-H 151; reference 142 is below by 6%/);
  assert.match(dashboard, /65-minute timing levels: opening range OR-H 142.5, OR-L 139.5; prior day PDH 143, PDL 138/);
  assert.match(dashboard, /Review context only; no ranking, recommendation, alert, broker, or order action/);
  assert.match(dashboard, /Breakout Review/);
  assert.match(dashboard, /<strong>PWH<\/strong><span>147<\/span>/);
  assert.match(dashboard, /<strong>50D-H<\/strong><span>151<\/span>/);
  assert.match(dashboard, /<strong>OR-H<\/strong><span>142.5<\/span>/);
  assert.match(dashboard, /Legend-only extraction fallback was used/);
  assert.match(dashboard, /NASDAQ-NVDA\/NASDAQ-NVDA-daily\.png/);
  assert.match(dashboard, /NASDAQ-NVDA\/NASDAQ-NVDA-daily-levels\.json/);
  assert.match(dashboard, /localStorage/);
  assert.doesNotMatch(dashboard, /broker action to take|order workflow to place|recommendation to buy/i);
});

void test("breakout notes render profile-aware review checklist and extraction warnings", () => {
  const plan = buildChartbookPlan({
    symbols: [nvdaSymbol],
    outputRoot: "/tmp/chartbooks",
    sessionId: "breakout-notes",
    capturedAt: new Date("2026-06-01T17:30:00.000Z"),
    preset: "focus",
    profile: "breakout"
  });
  const symbol = plan.symbols[0] as ChartbookSymbolPlan;
  const result = resultFromPlan(
    symbol,
    {
      weekly: testFacts("breakout", {
        referencePrice: 142,
        referenceLevels: [
          testLevel("PWH", 147, "prior-week"),
          testLevel("20D-H", 145, "breakout")
        ],
        support: testLevel("PDL", 138, "prior-day"),
        resistance: testLevel("PDH", 143, "prior-day")
      }),
      daily: testFacts("breakout", {
        referencePrice: 142,
        referenceLevels: [
          testLevel("50D-H", 151, "breakout"),
          testLevel("20D-H", 145, "breakout")
        ],
        support: testLevel("AVWAP", 140.2, "avwap"),
        resistance: testLevel("PDH", 143, "prior-day"),
        avwap: {
          present: true,
          value: 140.2
        }
      }),
      "65-minute": testFacts("breakout", {
        priorDayLevels: [
          testLevel("PDH", 143, "prior-day"),
          testLevel("PDL", 138, "prior-day")
        ],
        openingRangeLevels: [
          testLevel("OR-H", 142.5, "timing"),
          testLevel("OR-L", 139.5, "timing")
        ],
        premarketLevels: [testLevel("PMKT-H", 141.8, "timing")]
      })
    },
    {
      daily: [
        "Legend-only extraction fallback was used for study 'TVMCP Objective Drawing Overlay'; extracted facts may omit drawing boxes, labels, and tables."
      ]
    }
  );

  const notes = renderSymbolNotesMarkdown(symbol, result, plan);

  assert.match(notes, /## Breakout Review Checklist/);
  assert.match(notes, /### Weekly Context/);
  assert.match(notes, /- Reference levels: PWH 147, 20D-H 145/);
  assert.match(notes, /### Daily Setup/);
  assert.match(notes, /- Breakout levels: 50D-H 151, 20D-H 145/);
  assert.match(notes, /### 65-Minute Timing/);
  assert.match(notes, /- Opening range levels: OR-H 142.5, OR-L 139.5/);
  assert.match(notes, /### Key Extracted Levels/);
  assert.match(notes, /### Volume \/ Confirmation/);
  assert.match(notes, /### Invalidation Notes/);
  assert.match(notes, /## Extraction Warnings/);
  assert.match(notes, /Legend-only extraction fallback was used/);
  assert.doesNotMatch(notes, /broker|order|recommendation/i);
});

void test("squeeze notes render compression range and risk review sections", () => {
  const plan = buildChartbookPlan({
    symbols: [nvdaSymbol],
    outputRoot: "/tmp/chartbooks",
    sessionId: "squeeze-notes",
    capturedAt: new Date("2026-06-01T17:30:00.000Z"),
    profile: "squeeze"
  });
  const symbol = plan.symbols[0] as ChartbookSymbolPlan;
  const result = resultFromPlan(symbol, {
    daily: testFacts("squeeze", {
      referencePrice: 142,
      support: testLevel("20D-L", 136, "breakout"),
      resistance: testLevel("20D-H", 146, "breakout"),
      compression: {
        state: "active",
        range: {
          high: 146,
          low: 136,
          source: "zone"
        }
      }
    })
  });

  const notes = renderSymbolNotesMarkdown(symbol, result, plan);

  assert.match(notes, /## Squeeze Review Checklist/);
  assert.match(notes, /### Compression Context/);
  assert.match(notes, /Daily compression: active; range high 146, range low 136/);
  assert.match(notes, /### Range High \/ Low/);
  assert.match(notes, /### Expansion Watch Level/);
  assert.match(notes, /Level for human review: range high 146/);
  assert.match(notes, /### Risk Notes/);
  assert.doesNotMatch(notes, /buy|sell|broker|order|recommendation/i);
});

void test("squeeze notes use a non-daily compression range when daily has none", () => {
  const plan = buildChartbookPlan({
    symbols: [nvdaSymbol],
    outputRoot: "/tmp/chartbooks",
    sessionId: "squeeze-weekly-range-notes",
    capturedAt: new Date("2026-06-01T17:30:00.000Z"),
    profile: "squeeze"
  });
  const symbol = plan.symbols[0] as ChartbookSymbolPlan;
  const result = resultFromPlan(symbol, {
    weekly: testFacts("squeeze", {
      compression: {
        state: "active",
        range: {
          high: 151,
          low: 137,
          source: "zone"
        }
      }
    }),
    daily: testFacts("squeeze", {
      compression: {
        state: "unknown"
      }
    })
  });

  const notes = renderSymbolNotesMarkdown(symbol, result, plan);

  assert.match(notes, /Daily compression: unknown/);
  assert.match(notes, /Review range: active; range high 151, range low 137/);
  assert.match(notes, /Level for human review: range high 151/);
});

void test("momentum notes render level position, AVWAP, and retest sections", () => {
  const plan = buildChartbookPlan({
    symbols: [nvdaSymbol],
    outputRoot: "/tmp/chartbooks",
    sessionId: "momentum-notes",
    capturedAt: new Date("2026-06-01T17:30:00.000Z"),
    profile: "momentum"
  });
  const symbol = plan.symbols[0] as ChartbookSymbolPlan;
  const result = resultFromPlan(symbol, {
    weekly: testFacts("momentum", {
      referencePrice: 142,
      support: testLevel("PWH", 137, "prior-week"),
      resistance: testLevel("50D-H", 151, "breakout")
    }),
    daily: testFacts("momentum", {
      referencePrice: 142,
      referenceLevels: [
        testLevel("20D-H", 145, "breakout"),
        testLevel("PDH", 143, "prior-day")
      ],
      support: testLevel("AVWAP", 140.2, "avwap"),
      resistance: testLevel("PDH", 143, "prior-day"),
      avwap: {
        present: true,
        value: 140.2
      }
    })
  });

  const notes = renderSymbolNotesMarkdown(symbol, result, plan);

  assert.match(notes, /## Momentum Review Checklist/);
  assert.match(notes, /### Trend Context/);
  assert.match(notes, /Daily level context: reference 142; support AVWAP 140.2; resistance PDH 143/);
  assert.match(notes, /### Relative Position To Extracted Levels/);
  assert.match(notes, /Daily: 20D-H 145, PDH 143, AVWAP 140.2/);
  assert.match(notes, /### AVWAP Context/);
  assert.match(notes, /Daily AVWAP: 140.2/);
  assert.match(notes, /### Continuation \/ Retest Notes/);
  assert.doesNotMatch(notes, /buy|sell|broker|order|recommendation/i);
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
