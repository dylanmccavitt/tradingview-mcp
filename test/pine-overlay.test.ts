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
  assert.match(overlaySource, /input\.string\("focus", "Style preset"/);
  assert.match(overlaySource, /options=\["focus", "clean", "levels", "full-debug"\]/);
  assert.match(overlaySource, /stylePreset == "focus"/);
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

void test("Pine overlay avoids tuple reassignment syntax", () => {
  assert.doesNotMatch(
    overlaySource,
    /\[[^\]\n]+\]\s*:=/,
    "Pine tuple returns should be declared with =, then persistent vars reassigned one by one."
  );
});

void test("Pine overlay avoids dynamic plot linewidths", () => {
  assert.doesNotMatch(
    overlaySource,
    /plot\([^\n]*linewidth\s*=\s*[^,\n]*\?/,
    "Pine plot linewidth must be a fixed/input int, not a timeframe-conditional expression."
  );
});

void test("Pine overlay publishes level prices to the price scale", () => {
  assert.match(
    overlaySource,
    /title="PDH price scale"[^\n]*trackprice=true[^\n]*display=display\.price_scale/
  );
  assert.match(
    overlaySource,
    /title="OR-H price scale"[^\n]*trackprice=true[^\n]*display=display\.price_scale/
  );
  assert.match(overlayDocs, /price markers on the right price axis/i);
});

void test("Pine overlay extends horizontal reference levels across the chart", () => {
  assert.match(overlaySource, /line\.new\(bar_index - 1, price, bar_index, price, extend=extend\.both/);
  assert.match(overlaySource, /line\.set_extend\(nextLine, extend\.both\)/);
  assert.match(overlayDocs, /Horizontal level lines extend across the chart/i);
});

void test("Pine overlay restrains unsupported intraday timeframes", () => {
  assert.match(overlaySource, /isSupportedReviewChart = isWeeklyChart or isDailyChart or is65MinuteChart/);
  assert.match(overlaySource, /isUnsupportedIntradayChart = isIntradayChart and not is65MinuteChart/);
  assert.match(overlaySource, /showAnchoredVwap = isSupportedReviewChart or isFullDebug/);
  assert.match(overlayDocs, /Other intraday timeframes, such as 5-minute charts/i);
});

void test("Pine overlay focus preset reduces visible chart objects by timeframe", () => {
  assert.match(
    overlaySource,
    /showLevelText = \(not isFocus and not isClean and not isUnsupportedIntradayChart\) or isFullDebug/
  );
  assert.match(
    overlaySource,
    /showPriorMonthLevels = isFullDebug or \(isFocus \? isWeeklyChart : \(isWeeklyChart or isDailyChart\)\)/
  );
  assert.match(
    overlaySource,
    /showPriorWeekLevels = isFullDebug or \(isFocus \? isDailyChart : \(isWeeklyChart or isDailyChart or is65MinuteChart\)\)/
  );
  assert.match(
    overlaySource,
    /showPriorDayLevels = isFullDebug or \(isFocus \? is65MinuteChart : \(not isClean and \(isDailyChart or is65MinuteChart\)\)\)/
  );
  assert.match(
    overlaySource,
    /show20DayHighLevel = isFullDebug or \(isFocus \? isDailyChart : \(showBreakoutLevels and not isWeeklyChart\)\)/
  );
  assert.match(
    overlaySource,
    /show50DayLowLevel = isFullDebug or \(isFocus \? isWeeklyChart : showBreakoutLevels\)/
  );
  assert.match(
    overlaySource,
    /showOpeningRangeLevels = isFullDebug or \(isFocus \? is65MinuteChart : showIntradayLevels\)/
  );
  assert.match(overlaySource, /table\.new\(position\.top_right, 2, 4/);
  assert.match(overlayDocs, /`focus`: default quieter review mode/i);
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
  assert.match(overlayDocs, /switch between `focus`, `clean`, `levels`, and `full-debug`/);
  assert.match(overlayDocs, /weekly, daily, and 65-minute/i);
  assert.match(overlayDocs, /Static repo tests only verify/i);
  assert.match(overlayDocs, /Do not mark live visual validation complete/i);
});
