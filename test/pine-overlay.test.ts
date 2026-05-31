import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const overlayPath = resolve(process.cwd(), "pine/objective-drawing-overlay.pine");
const docsPath = resolve(process.cwd(), "docs/pine/objective-drawing-overlay.md");
const overlaySource = readFileSync(overlayPath, "utf8");
const overlayDocs = readFileSync(docsPath, "utf8");
const requiredStudyName = "TVMCP Objective Drawing Overlay";

void test("Pine overlay declares the required visible study name and presets", () => {
  assert.match(
    overlaySource,
    /indicator\("TVMCP Objective Drawing Overlay"/
  );
  assert.match(overlaySource, /options=\["clean", "levels", "full-debug"\]/);
  assert.match(overlaySource, /stylePreset == "clean"/);
  assert.match(overlaySource, /stylePreset == "levels"/);
  assert.match(overlaySource, /stylePreset == "full-debug"/);
});

void test("Pine overlay contains all required objective drawing sections", () => {
  const requiredFragments = [
    "Prior day/week/month levels.",
    "20D/50D breakout levels.",
    "Confirmed swing highs/lows.",
    "Gap zones.",
    "ATR compression/range boxes.",
    "Opening range/premarket levels on intraday charts.",
    "Anchored VWAP from a major gap or confirmed pivot.",
    "request.security(syminfo.tickerid, \"D\"",
    "request.security(syminfo.tickerid, \"W\"",
    "request.security(syminfo.tickerid, \"M\"",
    "timeframe.isweekly",
    "timeframe.isdaily",
    "timeframe.multiplier == 65",
    "box.new",
    "line.new",
    "label.new"
  ];

  for (const fragment of requiredFragments) {
    assert.ok(
      overlaySource.includes(fragment),
      `Expected Pine source to contain ${fragment}`
    );
  }
});

void test("Pine overlay avoids subjective patterns, scanner terms, and trade actions", () => {
  const forbidden = [
    /bull\s*flag/i,
    /cup[-\s]+and[-\s]+handle/i,
    /head[-\s]+and[-\s]+shoulders/i,
    /bias\s+(long|short)/i,
    /buy\b/i,
    /sell\b/i,
    /scanner/i,
    /ranking/i,
    /order\s+placement/i,
    /robinhood/i,
    /alpaca/i
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(overlaySource, pattern);
  }
});

void test("manual install docs pin the visual inspection boundary", () => {
  assert.match(overlayDocs, new RegExp(requiredStudyName));
  assert.match(overlayDocs, /Manual Install/);
  assert.match(overlayDocs, /Style preset/);
  assert.match(overlayDocs, /weekly, daily, and 65-minute/i);
  assert.match(overlayDocs, /Static repo tests only verify/i);
  assert.match(overlayDocs, /Do not mark live visual validation complete/i);
});
