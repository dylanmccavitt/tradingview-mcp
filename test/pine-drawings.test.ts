import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PINE_DRAWING_STUDY_NAME,
  normalizePineDrawingPayload
} from "../src/tradingview/pine-drawings.js";

const overlayFixture = {
  chart: {
    url: "https://www.tradingview.com/chart/abc123/?symbol=NYSE%3ATSM&interval=D",
    title: "TSM / Unnamed",
    symbol: "NYSE:TSM",
    interval: "D"
  },
  studies: [
    {
      name: "EMA",
      plots: [
        {
          title: "EMA 9",
          value: 412.98
        }
      ]
    },
    {
      id: "study-overlay",
      studyName: DEFAULT_PINE_DRAWING_STUDY_NAME,
      shortTitle: "TVMCP Objective Overlay",
      graphics: {
        lines: [
          {
            title: "PDH",
            price: 430.55,
            color: "#2962ff",
            style: "dashed",
            extend: "both",
            width: 1,
            x1: 100,
            x2: 101
          },
          {
            title: "ignored diagonal",
            y1: 410,
            y2: 420
          }
        ],
        boxes: [
          {
            name: "Gap up",
            top: 360.5,
            bottom: 346.25,
            left: 55,
            right: 81,
            borderColor: "#2e7d32",
            backgroundColor: "rgba(46, 125, 50, 0.12)"
          }
        ],
        labels: [
          {
            text: "PDH",
            price: 430.55,
            color: "#2962ff",
            textColor: "#ffffff"
          },
          {
            text: "Gap",
            price: 360.5
          }
        ],
        tables: [
          {
            title: "Debug",
            position: "top_right",
            rows: [
              ["field", "value"],
              ["style", "levels"]
            ]
          }
        ]
      },
      priceScalePlots: [
        {
          title: "PDH price scale",
          value: 430.55,
          color: "#2962ff"
        },
        {
          title: "50D-L price scale",
          value: 313.8,
          color: "#4caf50"
        }
      ]
    }
  ]
};

void test("normalizer targets the configured overlay study and deduplicates levels", () => {
  const result = normalizePineDrawingPayload(overlayFixture);

  assert.equal(result.ok, true);
  assert.equal(result.study?.name, DEFAULT_PINE_DRAWING_STUDY_NAME);
  assert.equal(result.chart?.symbol, "NYSE:TSM");
  assert.equal(result.counts.levels, 2);
  assert.equal(result.counts.zones, 1);
  assert.equal(result.counts.labels, 2);
  assert.equal(result.counts.tables, 1);

  const pdh = result.drawings.levels.find((level) => level.name === "PDH");
  assert.ok(pdh);
  assert.equal(pdh.price, 430.55);
  assert.deepEqual(pdh.sources.sort(), ["line", "plot"]);
  assert.equal(pdh.extend, "both");

  assert.equal(
    result.drawings.levels.some((level) => level.name === "EMA 9"),
    false
  );
  assert.deepEqual(result.drawings.zones[0], {
    name: "Gap up",
    high: 360.5,
    low: 346.25,
    source: "box",
    borderColor: "#2e7d32",
    backgroundColor: "rgba(46, 125, 50, 0.12)",
    startIndex: 55,
    endIndex: 81
  });
  assert.deepEqual(result.drawings.tables[0]?.cells, [
    ["field", "value"],
    ["style", "levels"]
  ]);
});

void test("normalizer can match the installed Pine short title from TradingView legend text", () => {
  const result = normalizePineDrawingPayload({
    studies: [
      {
        legendText: "TVMCP Objective Overlay levels 3 3 0930-1000",
        lines: [
          {
            text: "PWH",
            y1: 427.6,
            y2: 427.6
          }
        ]
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.drawings.levels[0]?.name, "PWH");
  assert.equal(result.drawings.levels[0]?.price, 427.6);
});

void test("normalizer parses live compact overlay legend text as plot levels", () => {
  const result = normalizePineDrawingPayload({
    studies: [
      {
        name: "TVMCP Objective Overlay",
        legendText: "TVMCP Objective Overlay",
        legendFullText:
          "SSuper Micro Computer, Inc.65NASDAQO47.30H47.37L47.20C47.2247.22∅−0.09 (−0.20%)Vol39.35 K+1.13 (+2.44%)47.21Sell0.02147.23Buy4EMA9close46.39∅∅∅EMA21close43.89∅∅∅52WHighs/Lows62.3619.48TVMCP Objective Overlaylevels330930-10000400-0929201000.758048.3444.1748.3435.43∅∅48.3426.8848.3419.4848.3445.16∅∅47.7445.6647.300.00000.00000.0000",
        source: "legend-dom"
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.study?.source, "payload.studies");
  assert.equal(result.counts.levels, 13);
  assert.equal(result.counts.zones, 0);

  const pdh = result.drawings.levels.find((level) => level.name === "PDH");
  assert.ok(pdh);
  assert.equal(pdh.price, 48.34);
  assert.deepEqual(pdh.sources, ["plot"]);

  const pdl = result.drawings.levels.find((level) => level.name === "PDL");
  assert.ok(pdl);
  assert.equal(pdl.price, 44.17);

  const pml = result.drawings.levels.find((level) => level.name === "PML");
  assert.equal(pml, undefined);

  const openingRangeHigh = result.drawings.levels.find(
    (level) => level.name === "OR-H"
  );
  assert.ok(openingRangeHigh);
  assert.equal(openingRangeHigh.price, 47.74);

  const avwap = result.drawings.levels.find((level) => level.name === "AVWAP");
  assert.ok(avwap);
  assert.equal(avwap.price, 47.3);
});

void test("normalizer parses compact overlay legend text with the focus preset", () => {
  const result = normalizePineDrawingPayload({
    studies: [
      {
        name: "TVMCP Objective Overlay",
        legendText: "TVMCP Objective Overlay",
        legendFullText:
          "SSuper Micro Computer, Inc.65NASDAQO47.30H47.37L47.20C47.2247.22∅−0.09 (−0.20%)Vol39.35 K+1.13 (+2.44%)47.21Sell0.02147.23Buy4EMA9close46.39∅∅∅EMA21close43.89∅∅∅52WHighs/Lows62.3619.48TVMCP Objective Overlayfocus330930-10000400-0929201000.758048.3444.1748.3435.43∅∅48.3426.8848.3419.4848.3445.16∅∅47.7445.6647.300.00000.00000.0000",
        source: "legend-dom"
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.counts.levels, 13);

  const priorDayHigh = result.drawings.levels.find(
    (level) => level.name === "PDH"
  );
  assert.ok(priorDayHigh);
  assert.equal(priorDayHigh.price, 48.34);

  const breakoutHigh = result.drawings.levels.find(
    (level) => level.name === "20D-H"
  );
  assert.ok(breakoutHigh);
  assert.equal(breakoutHigh.price, 48.34);

  const openingRangeHigh = result.drawings.levels.find(
    (level) => level.name === "OR-H"
  );
  assert.ok(openingRangeHigh);
  assert.equal(openingRangeHigh.price, 47.74);

  const avwap = result.drawings.levels.find((level) => level.name === "AVWAP");
  assert.ok(avwap);
  assert.equal(avwap.price, 47.3);
});

void test("normalizer keeps comma thousands inside compact legend prices", () => {
  const result = normalizePineDrawingPayload({
    studies: [
      {
        name: "TVMCP Objective Overlay",
        legendText: "TVMCP Objective Overlay",
        legendFullText:
          "AASML Holding N.V.65NASDAQO1,645.90H1,646.46L1,636.64C1,638.98EMA9close1,625.21TVMCP Objective Overlaylevels330930-10000400-0929201000.75801,654.201,604.861,654.201,580.00∅∅1,654.201,366.791,654.201,248.111,654.201,586.00∅∅1,619.701,586.001,638.660.00000.00000.0000"
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.counts.levels, 13);

  const priorDayHigh = result.drawings.levels.find(
    (level) => level.name === "PDH"
  );
  assert.ok(priorDayHigh);
  assert.equal(priorDayHigh.price, 1654.2);

  const priorDayLow = result.drawings.levels.find(
    (level) => level.name === "PDL"
  );
  assert.ok(priorDayLow);
  assert.equal(priorDayLow.price, 1604.86);

  const avwap = result.drawings.levels.find((level) => level.name === "AVWAP");
  assert.ok(avwap);
  assert.equal(avwap.price, 1638.66);
});

void test("normalizer reports a missing configured study without scraping other indicators", () => {
  const result = normalizePineDrawingPayload({
    studies: [
      {
        name: "EMA",
        plots: [
          {
            title: "EMA 9",
            value: 412.98
          }
        ]
      }
    ]
  });

  assert.equal(result.ok, false);
  assert.equal(result.counts.levels, 0);
  assert.match(result.warnings.join(" "), /was not found/i);
});

void test("normalizer accepts Runtime.evaluate wrapper payloads and only includes raw data in debug mode", () => {
  const wrappedPayload = {
    result: {
      value: overlayFixture
    }
  };

  const compact = normalizePineDrawingPayload(wrappedPayload);
  assert.equal("raw" in compact, false);

  const debug = normalizePineDrawingPayload(wrappedPayload, {
    debug: true
  });
  assert.equal(debug.ok, true);
  assert.ok(debug.raw);
  assert.equal(debug.chart?.interval, "D");
});
