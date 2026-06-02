import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  captureCurrentChart,
  type CurrentChartCaptureArtifact
} from "../src/tradingview/current-chart-capture.js";
import { DEFAULT_PINE_DRAWING_STUDY_NAME } from "../src/tradingview/pine-drawings.js";
import type { TradingViewHealthResult } from "../src/tradingview/health.js";
import type { CdpTarget } from "../src/tradingview/targets.js";

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
    kind: "fib-levels" as const,
    source: "explicit-anchors",
    anchors: {
      direction: "low-to-high"
    },
    levels: [
      {
        label: "Fib 50%",
        price: 520,
        role: "retracement" as const,
        source: "explicit-anchors" as const,
        ratio: 0.5
      }
    ],
    drawingIds: ["shape-1"],
    warnings: ["Review context only."]
  }
];

void test("current-chart capture surfaces chart-facts warnings in result output", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "tvmcp-current-chart-"));

  try {
    const result = await captureCurrentChart({
      outputRoot,
      captureId: "manual-review",
      profile: "momentum",
      checkHealth: () => Promise.resolve(healthyResult),
      chartClientFactory: () =>
        Promise.resolve({
          captureScreenshot: () => Promise.resolve(Buffer.from("fake-png")),
          close: () => Promise.resolve()
        }),
      drawingClientFactory: () =>
        Promise.resolve({
          readDrawingPayload: () =>
            Promise.resolve({
              chart: {
                symbol: "NASDAQ:NVDA",
                interval: "65"
              },
              studies: [
                {
                  studyName: DEFAULT_PINE_DRAWING_STUDY_NAME,
                  lines: [
                    {
                      title: "OR-H",
                      price: 142.5
                    }
                  ]
                }
              ]
            }),
          close: () => Promise.resolve()
        }),
      macroMetadata,
      now: () => new Date("2026-06-01T17:30:00.000Z")
    });

    assert.equal(result.ok, true);
    assert.equal(result.macros?.[0]?.drawingIds[0], "shape-1");
    assert.equal(result.facts.profile, "momentum");
    assert.match(
      result.warnings.join(" "),
      /Nearest support\/resistance unavailable/i
    );

    const artifact = JSON.parse(
      await readFile(
        join(outputRoot, "manual-review", "current-chart-levels.json"),
        "utf8"
      )
    ) as CurrentChartCaptureArtifact;

    assert.equal(artifact.profile, "momentum");
    assert.equal(artifact.macros?.[0]?.levels[0]?.label, "Fib 50%");
    assert.equal(artifact.extraction.facts.timing.openingRangeLevels[0]?.name, "OR-H");
  } finally {
    await rm(outputRoot, {
      recursive: true,
      force: true
    });
  }
});
