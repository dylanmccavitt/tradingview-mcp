import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFibLevelsMacroPlan,
  buildProjectionMacroPlan,
  invalidFibLevelsMacroMessage,
  invalidProjectionMacroMessage
} from "../src/tradingview/drawing-macros.js";

void test("Fib macro builds retracement and extension levels from explicit high low anchors", () => {
  const plan = buildFibLevelsMacroPlan({
    low: {
      time: 1_780_000_000,
      price: 100
    },
    high: {
      time: 1_780_086_400,
      price: 120
    },
    ratios: [0, 0.5, 1, 1.5],
    labelPrefix: "Review Fib"
  });

  assert.equal(plan.kind, "fib-levels");
  assert.equal(plan.source, "explicit-anchors");
  assert.deepEqual(
    plan.levels.map((level) => ({
      label: level.label,
      price: level.price,
      role: level.role,
      ratio: level.ratio
    })),
    [
      {
        label: "Review Fib 0%",
        price: 100,
        role: "anchor",
        ratio: 0
      },
      {
        label: "Review Fib 50%",
        price: 110,
        role: "retracement",
        ratio: 0.5
      },
      {
        label: "Review Fib 100%",
        price: 120,
        role: "anchor",
        ratio: 1
      },
      {
        label: "Review Fib 150%",
        price: 130,
        role: "extension",
        ratio: 1.5
      }
    ]
  );
  assert.equal(plan.drawings[0]?.shapeType, "trend-line");
  assert.equal(plan.drawings.length, 5);
  assert.match(plan.warnings.join(" "), /not predictions/i);
});

void test("Fib macro can reverse direction when the high anchor precedes the low anchor", () => {
  const plan = buildFibLevelsMacroPlan({
    high: {
      time: 1_780_000_000,
      price: 120
    },
    low: {
      time: 1_780_086_400,
      price: 100
    },
    ratios: [0, 0.5, 1],
    includeAnchorLine: false
  });

  assert.equal(plan.anchors.direction, "high-to-low");
  assert.deepEqual(
    plan.levels.map((level) => level.price),
    [120, 110, 100]
  );
  assert.equal(plan.drawings.length, 3);
});

void test("projection macro builds measured move levels from explicit anchors", () => {
  const plan = buildProjectionMacroPlan({
    mode: "measured-move",
    start: {
      time: 1_780_000_000,
      price: 100
    },
    end: {
      time: 1_780_086_400,
      price: 120
    },
    base: {
      time: 1_780_172_800,
      price: 112
    },
    multipliers: [0, 1, 1.5],
    includeAnchorLine: false
  });

  assert.equal(plan.kind, "projection");
  assert.equal(plan.source, "explicit-anchors");
  assert.deepEqual(
    plan.levels.map((level) => ({
      label: level.label,
      price: level.price,
      multiplier: level.multiplier
    })),
    [
      {
        label: "Measured 0x",
        price: 112,
        multiplier: 0
      },
      {
        label: "Measured 1x",
        price: 132,
        multiplier: 1
      },
      {
        label: "Measured 1.5x",
        price: 142,
        multiplier: 1.5
      }
    ]
  );
  assert.equal(plan.drawings.length, 3);
  assert.doesNotMatch(JSON.stringify(plan.levels), /buy|sell|order/i);
  assert.match(plan.warnings.join(" "), /not predictions, recommendations/i);
});

void test("projection macro records selected extracted range source and bidirectional levels", () => {
  const plan = buildProjectionMacroPlan({
    mode: "range-projection",
    base: {
      time: 1_780_172_800,
      price: 45
    },
    range: {
      high: 50,
      low: 40,
      source: "extracted-range",
      label: "daily compression",
      startTime: 1_780_000_000,
      endTime: 1_780_086_400
    },
    multipliers: [1],
    direction: "both",
    includeRangeBox: true
  });

  assert.equal(plan.source, "extracted-range");
  assert.deepEqual(
    plan.levels.map((level) => ({
      label: level.label,
      price: level.price,
      source: level.source,
      multiplier: level.multiplier
    })),
    [
      {
        label: "Range high",
        price: 50,
        source: "extracted-range",
        multiplier: undefined
      },
      {
        label: "Range low",
        price: 40,
        source: "extracted-range",
        multiplier: undefined
      },
      {
        label: "Range +1x",
        price: 60,
        source: "extracted-range",
        multiplier: 1
      },
      {
        label: "Range -1x",
        price: 30,
        source: "extracted-range",
        multiplier: -1
      }
    ]
  );
  assert.equal(plan.drawings[0]?.shapeType, "rectangle");
  assert.match(plan.warnings.join(" "), /extracted ranges/i);
});

void test("drawing macro validation reports anchor and range problems before CDP", () => {
  assert.match(
    invalidFibLevelsMacroMessage({
      high: {
        time: 1,
        price: 100
      },
      low: {
        time: 2,
        price: 100
      }
    }) ?? "",
    /greater than low/i
  );

  assert.match(
    invalidProjectionMacroMessage({
      mode: "measured-move",
      base: {
        time: 1,
        price: 100
      },
      start: {
        time: 2,
        price: 100
      },
      end: {
        time: 3,
        price: 100
      }
    }) ?? "",
    /different/i
  );

  assert.match(
    invalidProjectionMacroMessage({
      mode: "range-projection",
      base: {
        time: 1,
        price: 100
      },
      range: {
        high: 90,
        low: 100
      }
    }) ?? "",
    /greater than low/i
  );

  assert.match(
    invalidProjectionMacroMessage({
      mode: "range-projection",
      base: {
        time: 1,
        price: 100
      },
      range: {
        high: 110,
        low: 100
      },
      direction: "both",
      multipliers: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75]
    }) ?? "",
    /emits 18 levels/i
  );
});
