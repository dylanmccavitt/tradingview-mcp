import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChartFacts,
  parseChartAnalysisProfile
} from "../src/chart-analysis/chart-facts.js";
import type { PineDrawingExtractionData } from "../src/tradingview/pine-drawings.js";

const baseExtraction: PineDrawingExtractionData = {
  ok: true,
  studyName: "TVMCP Objective Drawing Overlay",
  chart: {
    symbol: "NASDAQ:NVDA",
    interval: "D",
    currentPrice: 142
  },
  drawings: {
    levels: [
      {
        name: "20D-H",
        price: 145,
        sources: ["plot"]
      },
      {
        name: "50D-H",
        price: 151,
        sources: ["plot"]
      },
      {
        name: "PWH",
        price: 147,
        sources: ["line"]
      },
      {
        name: "PDH",
        price: 143,
        sources: ["line"]
      },
      {
        name: "PDL",
        price: 138,
        sources: ["line"]
      },
      {
        name: "OR-H",
        price: 142.5,
        sources: ["plot"]
      },
      {
        name: "OR-L",
        price: 139.5,
        sources: ["plot"]
      },
      {
        name: "AVWAP",
        price: 140.2,
        sources: ["plot"]
      }
    ],
    zones: [
      {
        name: "ATR compression range",
        high: 146,
        low: 136,
        source: "box",
        borderColor: "#fdd835"
      }
    ],
    labels: [],
    tables: [
      {
        source: "table",
        cells: [
          ["Range", "Active"],
          ["AVWAP", "140.20"]
        ]
      }
    ]
  },
  counts: {
    levels: 8,
    zones: 1,
    labels: 0,
    tables: 1
  },
  warnings: []
};

void test("breakout chart facts expose objective breakout references without scoring", () => {
  const facts = buildChartFacts(baseExtraction, "breakout");

  assert.equal(facts.profile, "breakout");
  assert.equal(facts.chart?.currentPrice, 142);
  assert.equal(facts.nearest.support?.name, "AVWAP");
  assert.equal(facts.nearest.resistance?.name, "OR-H");
  assert.deepEqual(
    facts.breakout.referenceLevels.map((level) => level.name),
    ["50D-H", "PWH", "20D-H", "PDH", "PDL"]
  );
  assert.equal(facts.avwap.present, true);
  assert.equal(facts.avwap.value, 140.2);
  assert.doesNotMatch(JSON.stringify(facts), /score|rank|buy|sell|order/i);
});

void test("squeeze chart facts report compression state from extracted range boxes", () => {
  const facts = buildChartFacts(baseExtraction, "squeeze");

  assert.equal(facts.profile, "squeeze");
  assert.equal(facts.compression.state, "active");
  assert.deepEqual(facts.compression.range, {
    high: 146,
    low: 136,
    source: "zone"
  });
  assert.ok(facts.profileFocus.includes("compression"));
});

void test("momentum chart facts include timing levels and unavailable warnings", () => {
  const extraction: PineDrawingExtractionData = {
    ...baseExtraction,
    chart: {
      symbol: "NASDAQ:NVDA",
      interval: "65"
    },
    drawings: {
      ...baseExtraction.drawings,
      zones: [],
      tables: []
    },
    counts: {
      ...baseExtraction.counts,
      zones: 0,
      tables: 0
    }
  };
  const facts = buildChartFacts(extraction, "momentum");

  assert.equal(facts.profile, "momentum");
  assert.equal(facts.nearest.referencePrice, undefined);
  assert.deepEqual(
    facts.timing.openingRangeLevels.map((level) => level.name),
    ["OR-H", "OR-L"]
  );
  assert.match(
    facts.warnings.join(" "),
    /Nearest support\/resistance unavailable/i
  );
  assert.match(facts.warnings.join(" "), /Compression state is unknown/i);
});

void test("chart-analysis profile parser rejects unsupported profile names", () => {
  assert.equal(parseChartAnalysisProfile(undefined), "focus");
  assert.equal(parseChartAnalysisProfile("breakout"), "breakout");
  assert.throws(
    () => parseChartAnalysisProfile("scanner"),
    /must be one of/i
  );
});
