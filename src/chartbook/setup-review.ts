import { basename } from "node:path";

import type { ChartFactLevel, ChartFacts } from "../chart-analysis/chart-facts.js";
import type { ChartAnalysisProfileName } from "../domain.js";
import type {
  ChartbookPlan,
  ChartbookSymbolMetadata,
  ChartbookSymbolPlan,
  ChartbookSymbolResult,
  ChartbookTimeframeResult
} from "./chartbook.js";
import type { QuantScanArtifactPaths } from "./quant-scan-handoff.js";

export const SETUP_REVIEW_FILE = "setup-review.json";
export const SETUP_REVIEW_INDEX_FILE = "setup-review-index.json";
export const SETUP_REVIEW_SCHEMA_VERSION = 1;
export const SETUP_REVIEW_VERDICTS = [
  "validated",
  "invalidated",
  "watch",
  "insufficient_data"
] as const;

export type SetupReviewVerdict = (typeof SETUP_REVIEW_VERDICTS)[number];

export interface SetupReviewReason {
  code: string;
  severity: "info" | "watch" | "failure";
  message: string;
  source:
    | "chart_facts"
    | "levels_json"
    | "chartbook_warning"
    | "chartbook_failure"
    | "profile_context"
    | "source_metadata";
  timeframe?: ChartbookTimeframeResult["timeframe"];
}

export interface SetupReviewTimeframeCoverage {
  id: ChartbookTimeframeResult["timeframe"];
  label: string;
  interval: string;
  screenshot: {
    path: string;
    ok: boolean;
  };
  levelsJson: {
    path: string;
    ok: boolean;
  };
  extraction: {
    ok: boolean;
    warnings: string[];
  };
  facts: {
    chart?: ChartFacts["chart"];
    extracted: ChartFacts["extracted"];
  };
}

export interface SetupReviewSourceMetadata {
  quantScan?: {
    runId?: string;
    candidatePosition?: number;
    setupLane?: string;
    matchingLanes: string[];
    score?: number;
    trigger?: string;
    invalidation?: string;
    warnings: string[];
    sourceArtifactPaths: QuantScanArtifactPaths;
  };
}

export interface ChartbookSetupReviewArtifact {
  schemaVersion: typeof SETUP_REVIEW_SCHEMA_VERSION;
  kind: "chartbook_setup_review";
  symbol: ChartbookSymbolMetadata;
  profile: ChartAnalysisProfileName;
  preset: string;
  capturedAt: string;
  verdict: SetupReviewVerdict;
  reasons: SetupReviewReason[];
  warnings: string[];
  timeframeCoverage: SetupReviewTimeframeCoverage[];
  references: {
    notes: string;
    screenshots: Array<{
      timeframe: ChartbookTimeframeResult["timeframe"];
      path: string;
      ok: boolean;
    }>;
    levelsJson: Array<{
      timeframe: ChartbookTimeframeResult["timeframe"];
      path: string;
      ok: boolean;
    }>;
  };
  source?: SetupReviewSourceMetadata;
}

export interface ChartbookSetupReviewIndexArtifact {
  schemaVersion: typeof SETUP_REVIEW_SCHEMA_VERSION;
  kind: "chartbook_setup_review_index";
  sessionId: string;
  capturedAt: string;
  profile: ChartAnalysisProfileName;
  preset: string;
  verdictCounts: Record<SetupReviewVerdict, number>;
  symbols: Array<{
    symbol: string;
    alias: string;
    verdict: SetupReviewVerdict;
    setupReviewPath: string;
    notesPath: string;
    warningCount: number;
    source?: {
      runId?: string;
      setupLane?: string;
      candidatePosition?: number;
    };
  }>;
}

function symbolMetadataCopy(symbol: ChartbookSymbolMetadata): ChartbookSymbolMetadata {
  const metadata: ChartbookSymbolMetadata = {
    symbol: symbol.symbol,
    alias: symbol.alias,
    tags: [...symbol.tags],
    groups: [...symbol.groups],
    tiers: [...symbol.tiers]
  };

  if (symbol.name) {
    metadata.name = symbol.name;
  }

  return metadata;
}

function sourceMetadata(
  symbol: ChartbookSymbolMetadata
): SetupReviewSourceMetadata | undefined {
  if (!symbol.quantScan) {
    return undefined;
  }

  const quantScan: NonNullable<SetupReviewSourceMetadata["quantScan"]> = {
    matchingLanes: [...symbol.quantScan.matchingLanes],
    warnings: [...symbol.quantScan.warnings],
    sourceArtifactPaths: {
      ...symbol.quantScan.sourceArtifactPaths
    }
  };

  if (symbol.quantScan.runId) {
    quantScan.runId = symbol.quantScan.runId;
  }
  if (typeof symbol.quantScan.scanRank === "number") {
    quantScan.candidatePosition = symbol.quantScan.scanRank;
  }
  if (symbol.quantScan.setupLane) {
    quantScan.setupLane = symbol.quantScan.setupLane;
  }
  if (typeof symbol.quantScan.score === "number") {
    quantScan.score = symbol.quantScan.score;
  }
  if (symbol.quantScan.trigger) {
    quantScan.trigger = symbol.quantScan.trigger;
  }
  if (symbol.quantScan.invalidation) {
    quantScan.invalidation = symbol.quantScan.invalidation;
  }

  return {
    quantScan
  };
}

function warningIndicatesInvalidation(warning: string): boolean {
  return /invalidated|failed\s+(breakout|reclaim|setup)|breakdown|not actionable|weak momentum/i.test(
    warning
  );
}

function uniqueWarnings(result: ChartbookSymbolResult): string[] {
  return [
    ...new Set([
      ...result.timeframes.flatMap((timeframe) => timeframe.warnings),
      ...(result.quantScan?.warnings ?? [])
    ])
  ];
}

function usefulFacts(facts: ChartFacts): boolean {
  return (
    facts.extracted.levels > 0 ||
    facts.extracted.zones > 0 ||
    facts.breakout.referenceLevels.length > 0 ||
    typeof facts.nearest.referencePrice === "number" ||
    typeof facts.nearest.support !== "undefined" ||
    typeof facts.nearest.resistance !== "undefined" ||
    Boolean(facts.compression.range) ||
    facts.avwap.present ||
    facts.timing.priorDayLevels.length > 0 ||
    facts.timing.premarketLevels.length > 0 ||
    facts.timing.openingRangeLevels.length > 0
  );
}

function formatPrice(value: number): string {
  return value
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function levelName(level: ChartFactLevel | undefined): string {
  return level ? `${level.name} ${formatPrice(level.price)}` : "unavailable";
}

function timeframeById(
  result: ChartbookSymbolResult,
  id: ChartbookTimeframeResult["timeframe"]
): ChartbookTimeframeResult | undefined {
  return result.timeframes.find((timeframe) => timeframe.timeframe === id);
}

function addProfileReasons(
  reasons: SetupReviewReason[],
  result: ChartbookSymbolResult,
  profile: ChartAnalysisProfileName
): void {
  const daily = timeframeById(result, "daily");
  const weekly = timeframeById(result, "weekly");
  const intraday = timeframeById(result, "65-minute");

  if (profile === "breakout") {
    const levels = daily?.facts.breakout.referenceLevels ?? [];
    if (levels.length === 0) {
      reasons.push({
        code: "breakout_references_missing",
        severity: "watch",
        source: "profile_context",
        timeframe: "daily",
        message: "Daily breakout reference levels were not extracted."
      });
      return;
    }

    reasons.push({
      code: "breakout_references_available",
      severity: "info",
      source: "profile_context",
      timeframe: "daily",
      message: `Daily breakout references available: ${levels.map(levelName).join(", ")}.`
    });

    const referencePrice = daily?.facts.nearest.referencePrice;
    const resistance = daily?.facts.nearest.resistance;
    if (typeof referencePrice === "number" && resistance) {
      const distancePct = ((resistance.price - referencePrice) / resistance.price) * 100;
      if (distancePct > 4) {
        reasons.push({
          code: "breakout_reference_below_resistance",
          severity: "watch",
          source: "chart_facts",
          timeframe: "daily",
          message: `Reference price ${formatPrice(referencePrice)} remains ${distancePct.toFixed(1).replace(/\.0$/, "")}% below ${levelName(resistance)}.`
        });
      }
    }
    return;
  }

  if (profile === "squeeze") {
    const rangeFacts =
      [daily, weekly, intraday].find((timeframe) => timeframe?.facts.compression.range)
        ?.facts ?? daily?.facts;

    if (rangeFacts?.compression.range) {
      reasons.push({
        code: "compression_range_available",
        severity: "info",
        source: "profile_context",
        message: `Compression range extracted: ${formatPrice(rangeFacts.compression.range.low)} to ${formatPrice(rangeFacts.compression.range.high)}.`
      });
    } else {
      reasons.push({
        code: "compression_range_missing",
        severity: "watch",
        source: "profile_context",
        message: "Compression range was not extracted from the visible chart facts."
      });
    }
    return;
  }

  if (profile === "momentum") {
    const facts = daily?.facts ?? intraday?.facts ?? weekly?.facts;
    const hasLevelContext =
      Boolean(facts?.nearest.support) ||
      Boolean(facts?.nearest.resistance) ||
      Boolean(facts?.breakout.referenceLevels.length);
    const hasAvwap = facts?.avwap.present ?? false;

    if (hasLevelContext && hasAvwap) {
      reasons.push({
        code: "momentum_context_available",
        severity: "info",
        source: "profile_context",
        message: "Momentum review context includes extracted level context and AVWAP."
      });
    } else {
      reasons.push({
        code: "momentum_context_limited",
        severity: "watch",
        source: "profile_context",
        message: "Momentum review context is limited by missing level context or AVWAP."
      });
    }
    return;
  }

  if ([weekly, daily, intraday].some((timeframe) => timeframe && usefulFacts(timeframe.facts))) {
    reasons.push({
      code: "cross_timeframe_context_available",
      severity: "info",
      source: "profile_context",
      message: "Cross-timeframe chart facts are available for manual review."
    });
  } else {
    reasons.push({
      code: "cross_timeframe_context_missing",
      severity: "watch",
      source: "profile_context",
      message: "Cross-timeframe chart facts are limited."
    });
  }
}

function buildReasons(
  result: ChartbookSymbolResult,
  profile: ChartAnalysisProfileName
): SetupReviewReason[] {
  const reasons: SetupReviewReason[] = [];

  for (const timeframe of result.timeframes) {
    if (!timeframe.ok) {
      reasons.push({
        code: "timeframe_failure",
        severity: "failure",
        source: "chartbook_failure",
        timeframe: timeframe.timeframe,
        message: `${timeframe.label} chartbook capture did not complete: ${timeframe.error ?? "Unknown failure"}.`
      });
    }

    for (const warning of timeframe.warnings) {
      reasons.push({
        code: "timeframe_warning",
        severity: "watch",
        source: "chartbook_warning",
        timeframe: timeframe.timeframe,
        message: warning
      });
    }
  }

  for (const warning of result.quantScan?.warnings ?? []) {
    reasons.push({
      code: warningIndicatesInvalidation(warning)
        ? "source_warning_invalidated"
        : "source_warning",
      severity: warningIndicatesInvalidation(warning) ? "failure" : "watch",
      source: "source_metadata",
      message: warning
    });
  }

  addProfileReasons(reasons, result, profile);

  if (result.timeframes.every((timeframe) => !usefulFacts(timeframe.facts))) {
    reasons.push({
      code: "insufficient_visible_data",
      severity: "failure",
      source: "levels_json",
      message: "Visible chart facts did not include enough extracted objective data."
    });
  }

  return reasons;
}

function verdictFromReasons(
  result: ChartbookSymbolResult,
  reasons: readonly SetupReviewReason[]
): SetupReviewVerdict {
  const daily = timeframeById(result, "daily");
  const insufficient =
    result.timeframes.length === 0 ||
    result.timeframes.every((timeframe) => !timeframe.screenshotOk) ||
    !daily?.ok ||
    reasons.some((reason) => reason.code === "insufficient_visible_data");

  if (insufficient) {
    return "insufficient_data";
  }

  if (
    reasons.some(
      (reason) =>
        reason.severity === "failure" &&
        reason.code !== "timeframe_failure" &&
        reason.code !== "insufficient_visible_data"
    )
  ) {
    return "invalidated";
  }

  if (reasons.some((reason) => reason.severity === "watch")) {
    return "watch";
  }

  return "validated";
}

function coverageForTimeframe(
  timeframe: ChartbookTimeframeResult
): SetupReviewTimeframeCoverage {
  const coverage: SetupReviewTimeframeCoverage = {
    id: timeframe.timeframe,
    label: timeframe.label,
    interval: timeframe.interval,
    screenshot: {
      path: basename(timeframe.screenshotPath),
      ok: timeframe.screenshotOk
    },
    levelsJson: {
      path: basename(timeframe.levelsJsonPath),
      ok: timeframe.levelsJsonOk
    },
    extraction: {
      ok: timeframe.extractionOk,
      warnings: [...timeframe.warnings]
    },
    facts: {
      extracted: {
        ...timeframe.facts.extracted
      }
    }
  };

  if (timeframe.facts.chart) {
    coverage.facts.chart = {
      ...timeframe.facts.chart
    };
  }

  return coverage;
}

export function buildSetupReviewArtifact(
  symbol: ChartbookSymbolPlan,
  result: ChartbookSymbolResult,
  plan: Pick<ChartbookPlan, "capturedAt" | "preset" | "profile">
): ChartbookSetupReviewArtifact {
  const reasons = buildReasons(result, plan.profile);
  const artifact: ChartbookSetupReviewArtifact = {
    schemaVersion: SETUP_REVIEW_SCHEMA_VERSION,
    kind: "chartbook_setup_review",
    symbol: symbolMetadataCopy(symbol),
    profile: plan.profile,
    preset: plan.preset,
    capturedAt: plan.capturedAt,
    verdict: verdictFromReasons(result, reasons),
    reasons,
    warnings: uniqueWarnings(result),
    timeframeCoverage: result.timeframes.map(coverageForTimeframe),
    references: {
      notes: basename(symbol.notesPath),
      screenshots: result.timeframes.map((timeframe) => ({
        timeframe: timeframe.timeframe,
        path: basename(timeframe.screenshotPath),
        ok: timeframe.screenshotOk
      })),
      levelsJson: result.timeframes.map((timeframe) => ({
        timeframe: timeframe.timeframe,
        path: basename(timeframe.levelsJsonPath),
        ok: timeframe.levelsJsonOk
      }))
    }
  };

  const source = sourceMetadata(symbol);
  if (source) {
    artifact.source = source;
  }

  return artifact;
}

export function emptyVerdictCounts(): Record<SetupReviewVerdict, number> {
  return {
    validated: 0,
    invalidated: 0,
    watch: 0,
    insufficient_data: 0
  };
}

export function setupReviewVerdictCounts(
  symbols: readonly ChartbookSymbolResult[]
): Record<SetupReviewVerdict, number> {
  const counts = emptyVerdictCounts();

  for (const symbol of symbols) {
    counts[symbol.setupReview?.verdict ?? "insufficient_data"] += 1;
  }

  return counts;
}

export function relativeSetupReviewPath(symbol: ChartbookSymbolResult): string {
  return `${symbol.symbolSlug}/${SETUP_REVIEW_FILE}`;
}

export function buildSetupReviewIndexArtifact(
  plan: Pick<ChartbookPlan, "sessionId" | "capturedAt" | "profile" | "preset">,
  symbols: readonly ChartbookSymbolResult[]
): ChartbookSetupReviewIndexArtifact {
  return {
    schemaVersion: SETUP_REVIEW_SCHEMA_VERSION,
    kind: "chartbook_setup_review_index",
    sessionId: plan.sessionId,
    capturedAt: plan.capturedAt,
    profile: plan.profile,
    preset: plan.preset,
    verdictCounts: setupReviewVerdictCounts(symbols),
    symbols: symbols.map((symbol) => {
      const entry: ChartbookSetupReviewIndexArtifact["symbols"][number] = {
        symbol: symbol.symbol,
        alias: symbol.alias,
        verdict: symbol.setupReview?.verdict ?? "insufficient_data",
        setupReviewPath: relativeSetupReviewPath(symbol),
        notesPath: `${symbol.symbolSlug}/notes.md`,
        warningCount: uniqueWarnings(symbol).length
      };

      if (symbol.quantScan) {
        const source: NonNullable<typeof entry.source> = {};
        if (symbol.quantScan.runId) {
          source.runId = symbol.quantScan.runId;
        }
        if (symbol.quantScan.setupLane) {
          source.setupLane = symbol.quantScan.setupLane;
        }
        if (typeof symbol.quantScan.scanRank === "number") {
          source.candidatePosition = symbol.quantScan.scanRank;
        }
        entry.source = source;
      }

      return entry;
    })
  };
}
