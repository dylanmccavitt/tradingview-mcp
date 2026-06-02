import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  DEFAULT_CHART_ANALYSIS_PROFILE,
  buildChartFacts,
  type ChartFactLevel,
  type ChartFacts
} from "../chart-analysis/chart-facts.js";
import type { ChartAnalysisProfileName } from "../domain.js";
import {
  buildTradingViewChartUrl,
  DEFAULT_CHART_TIMEFRAMES,
  DEFAULT_RENDER_SETTLE_MS,
  DEFAULT_RENDER_TIMEOUT_MS,
  normalizeTradingViewSymbol,
  slugifyTradingViewSymbol,
  type ChartTimeframeId,
  type ChartTimeframePlan
} from "../tradingview/chart-plan.js";
import {
  createLiveTradingViewChartPageClient,
  type TradingViewChartPageClient
} from "../tradingview/chart-page.js";
import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS
} from "../tradingview/desktop.js";
import {
  checkTradingViewHealth,
  type CheckTradingViewHealthOptions,
  type TradingViewHealthResult
} from "../tradingview/health.js";
import {
  createLiveTradingViewPineDrawingPageClient,
  type TradingViewPineDrawingPageClient
} from "../tradingview/pine-drawing-page.js";
import {
  DEFAULT_PINE_DRAWING_STUDY_NAME,
  normalizePineDrawingPayload,
  type PineDrawingChartContext,
  type PineDrawingCounts,
  type PineDrawingExtractionData,
  type PineDrawingLabel,
  type PineDrawingLevel,
  type PineDrawingStudySummary,
  type PineDrawingTable,
  type PineDrawingZone
} from "../tradingview/pine-drawings.js";
import type { DrawingMacroArtifact } from "../tradingview/drawing-macros.js";
import type { CdpTarget } from "../tradingview/targets.js";
import type {
  ResolvedUniverseSymbol,
  UniverseSelectionTier,
  UniverseTier
} from "../universe/config.js";

export const DEFAULT_CHARTBOOK_OUTPUT_ROOT =
  "artifacts/tradingview-chartbooks";
export const DEFAULT_CHARTBOOK_PRESET = "levels";
export const DEFAULT_CHARTBOOK_DRAWING_RETRY_ATTEMPTS = 8;
export const DEFAULT_CHARTBOOK_DRAWING_RETRY_DELAY_MS = 500;
export const CHARTBOOK_SCHEMA_VERSION = 2;

interface ChartbookFileSystem {
  mkdir: (
    path: string,
    options: {
      recursive: true;
    }
  ) => Promise<unknown>;
  writeFile: (path: string, data: string | Buffer) => Promise<unknown>;
}

export interface ChartbookSelectionSummary {
  configPath?: string;
  groups: string[] | "all";
  tier: UniverseSelectionTier;
}

export interface ChartbookSymbolMetadata {
  symbol: string;
  alias: string;
  tags: string[];
  groups: string[];
  tiers: UniverseTier[];
  name?: string;
}

export interface ChartbookTimeframeArtifactPlan {
  id: ChartTimeframeId;
  label: string;
  interval: string;
  url: string;
  screenshotPath: string;
  levelsJsonPath: string;
  screenshotFile: string;
  levelsJsonFile: string;
}

export interface ChartbookSymbolPlan extends ChartbookSymbolMetadata {
  symbolSlug: string;
  directory: string;
  notesPath: string;
  timeframes: ChartbookTimeframeArtifactPlan[];
}

export interface ChartbookPlan {
  schemaVersion: typeof CHARTBOOK_SCHEMA_VERSION;
  sessionId: string;
  capturedAt: string;
  outputRoot: string;
  sessionDirectory: string;
  indexPath: string;
  indexHtmlPath: string;
  preset: string;
  profile: ChartAnalysisProfileName;
  selection?: ChartbookSelectionSummary;
  macros?: DrawingMacroArtifact[];
  symbols: ChartbookSymbolPlan[];
}

export interface BuildChartbookPlanOptions {
  symbols: ResolvedUniverseSymbol[];
  outputRoot?: string;
  sessionId?: string;
  capturedAt?: Date;
  preset?: string;
  profile?: ChartAnalysisProfileName;
  selection?: ChartbookSelectionSummary;
  macroMetadata?: DrawingMacroArtifact[];
  targetUrl?: string;
}

export interface ChartbookExtractionArtifact {
  ok: boolean;
  studyName: string;
  extractedAt: string;
  facts: ChartFacts;
  drawings: {
    levels: PineDrawingLevel[];
    zones: PineDrawingZone[];
    labels: PineDrawingLabel[];
    tables: PineDrawingTable[];
  };
  counts: PineDrawingCounts;
  warnings: string[];
  endpoint?: string;
  chart?: PineDrawingChartContext;
  study?: PineDrawingStudySummary;
  error?: string;
}

export interface ChartbookLevelsArtifact {
  schemaVersion: typeof CHARTBOOK_SCHEMA_VERSION;
  ok: boolean;
  symbol: ChartbookSymbolMetadata;
  timeframe: {
    id: ChartTimeframeId;
    label: string;
    interval: string;
    url: string;
  };
  preset: string;
  profile: ChartAnalysisProfileName;
  capturedAt: string;
  paths: {
    screenshot: string;
    levelsJson: string;
  };
  screenshot: {
    ok: boolean;
    error?: string;
  };
  extraction: ChartbookExtractionArtifact;
  macros?: DrawingMacroArtifact[];
}

export interface ChartbookTimeframeResult {
  symbol: string;
  timeframe: ChartTimeframeId;
  label: string;
  interval: string;
  url: string;
  screenshotPath: string;
  levelsJsonPath: string;
  ok: boolean;
  screenshotOk: boolean;
  extractionOk: boolean;
  levelsJsonOk: boolean;
  facts: ChartFacts;
  warnings: string[];
  error?: string;
}

export interface ChartbookSymbolResult extends ChartbookSymbolMetadata {
  ok: boolean;
  symbolSlug: string;
  directory: string;
  notesPath: string;
  timeframes: ChartbookTimeframeResult[];
}

export interface ChartbookResult {
  ok: boolean;
  schemaVersion: typeof CHARTBOOK_SCHEMA_VERSION;
  sessionId: string;
  capturedAt: string;
  preset: string;
  profile: ChartAnalysisProfileName;
  sessionDirectory: string;
  indexPath: string;
  indexHtmlPath: string;
  endpoint: string;
  selection?: ChartbookSelectionSummary;
  target?: CdpTarget;
  macros?: DrawingMacroArtifact[];
  symbols: ChartbookSymbolResult[];
  error?: string;
}

export interface RunChartbookOptions {
  symbols: ResolvedUniverseSymbol[];
  outputRoot?: string;
  sessionId?: string;
  preset?: string;
  profile?: ChartAnalysisProfileName;
  selection?: ChartbookSelectionSummary;
  studyName?: string;
  host?: string;
  port?: number;
  timeoutMs?: number;
  appPath?: string;
  renderTimeoutMs?: number;
  renderSettleMs?: number;
  drawingRetryAttempts?: number;
  drawingRetryDelayMs?: number;
  debug?: boolean;
  macroMetadata?: DrawingMacroArtifact[];
  now?: () => Date;
  checkHealth?: (
    options: CheckTradingViewHealthOptions
  ) => Promise<TradingViewHealthResult>;
  chartClientFactory?: (
    target: CdpTarget,
    options: {
      timeoutMs: number;
      renderTimeoutMs: number;
      renderSettleMs: number;
    }
  ) => Promise<TradingViewChartPageClient>;
  drawingClientFactory?: (
    target: CdpTarget,
    options: {
      timeoutMs: number;
    }
  ) => Promise<TradingViewPineDrawingPageClient>;
  fileSystem?: ChartbookFileSystem;
}

export class ChartbookPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChartbookPlanError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatSessionDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function slugifyChartbookSessionId(value: string): string {
  const slug = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug || slug === "." || slug === "..") {
    throw new ChartbookPlanError(
      "Chartbook session id must contain at least one letter or number."
    );
  }

  return slug;
}

function selectionCopy(
  selection: ChartbookSelectionSummary | undefined
): ChartbookSelectionSummary | undefined {
  if (!selection) {
    return undefined;
  }

  const copied: ChartbookSelectionSummary = {
    groups:
      selection.groups === "all" ? "all" : selection.groups.map((group) => group),
    tier: selection.tier
  };

  if (selection.configPath) {
    copied.configPath = selection.configPath;
  }

  return copied;
}

function macroMetadataCopy(
  macroMetadata: readonly DrawingMacroArtifact[] | undefined
): DrawingMacroArtifact[] | undefined {
  return macroMetadata && macroMetadata.length > 0
    ? macroMetadata.map((macro) => ({
        ...macro,
        anchors: {
          ...macro.anchors
        },
        levels: macro.levels.map((level) => ({
          ...level
        })),
        drawingIds: [...macro.drawingIds],
        warnings: [...macro.warnings]
      }))
    : undefined;
}

function symbolMetadata(symbol: ResolvedUniverseSymbol): ChartbookSymbolMetadata {
  const metadata: ChartbookSymbolMetadata = {
    symbol: normalizeTradingViewSymbol(symbol.symbol),
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

export function buildChartbookPlan(
  options: BuildChartbookPlanOptions
): ChartbookPlan {
  const capturedAt = options.capturedAt ?? new Date();
  const sessionId = slugifyChartbookSessionId(
    options.sessionId ?? formatSessionDate(capturedAt)
  );
  const outputRoot = resolve(
    options.outputRoot ?? DEFAULT_CHARTBOOK_OUTPUT_ROOT
  );
  const sessionDirectory = join(outputRoot, sessionId);
  const preset = options.preset?.trim() || DEFAULT_CHARTBOOK_PRESET;
  const profile = options.profile ?? DEFAULT_CHART_ANALYSIS_PROFILE;
  const symbols = options.symbols.map((symbol) => {
    const metadata = symbolMetadata(symbol);
    const symbolSlug = slugifyTradingViewSymbol(metadata.symbol);
    const directory = join(sessionDirectory, symbolSlug);
    const notesPath = join(directory, "notes.md");
    const timeframes = DEFAULT_CHART_TIMEFRAMES.map((timeframe) => {
      const screenshotFile = `${symbolSlug}-${timeframe.id}.png`;
      const levelsJsonFile = `${symbolSlug}-${timeframe.id}-levels.json`;

      return {
        id: timeframe.id,
        label: timeframe.label,
        interval: timeframe.interval,
        url: buildTradingViewChartUrl(
          options.targetUrl,
          metadata.symbol,
          timeframe.interval
        ),
        screenshotPath: join(directory, screenshotFile),
        levelsJsonPath: join(directory, levelsJsonFile),
        screenshotFile,
        levelsJsonFile
      };
    });

    return {
      ...metadata,
      symbolSlug,
      directory,
      notesPath,
      timeframes
    };
  });

  const plan: ChartbookPlan = {
    schemaVersion: CHARTBOOK_SCHEMA_VERSION,
    sessionId,
    capturedAt: capturedAt.toISOString(),
    outputRoot,
    sessionDirectory,
    indexPath: join(sessionDirectory, "index.md"),
    indexHtmlPath: join(sessionDirectory, "index.html"),
    preset,
    profile,
    symbols
  };

  const selection = selectionCopy(options.selection);
  if (selection) {
    plan.selection = selection;
  }

  const macros = macroMetadataCopy(options.macroMetadata);
  if (macros) {
    plan.macros = macros;
  }

  return plan;
}

function emptyDrawings(): Pick<
  PineDrawingExtractionData,
  "drawings" | "counts" | "warnings"
> {
  return {
    drawings: {
      levels: [],
      zones: [],
      labels: [],
      tables: []
    },
    counts: {
      levels: 0,
      zones: 0,
      labels: 0,
      tables: 0
    },
    warnings: []
  };
}

function skippedExtraction(
  studyName: string,
  extractedAt: string,
  message: string,
  profile: ChartAnalysisProfileName,
  endpoint?: string
): ChartbookExtractionArtifact {
  const empty = emptyDrawings();
  const extraction: ChartbookExtractionArtifact = {
    ok: false,
    studyName,
    extractedAt,
    facts: buildChartFacts(empty, profile),
    drawings: empty.drawings,
    counts: empty.counts,
    warnings: empty.warnings,
    error: message
  };

  if (endpoint) {
    extraction.endpoint = endpoint;
  }

  return extraction;
}

function extractionArtifactFromData(
  data: PineDrawingExtractionData,
  extractedAt: string,
  endpoint: string | undefined,
  error: string | undefined,
  profile: ChartAnalysisProfileName
): ChartbookExtractionArtifact {
  const extraction: ChartbookExtractionArtifact = {
    ok: data.ok,
    studyName: data.studyName,
    extractedAt,
    facts: buildChartFacts(data, profile),
    drawings: data.drawings,
    counts: data.counts,
    warnings: [...data.warnings]
  };

  if (endpoint) {
    extraction.endpoint = endpoint;
  }

  if (data.chart) {
    extraction.chart = data.chart;
  }

  if (data.study) {
    extraction.study = data.study;
  }

  if (error) {
    extraction.error = error;
  }

  return extraction;
}

function combinedExtractionWarnings(
  extraction: ChartbookExtractionArtifact
): string[] {
  return [...new Set([...extraction.warnings, ...extraction.facts.warnings])];
}

function buildLevelsArtifact(
  symbol: ChartbookSymbolPlan,
  timeframe: ChartbookTimeframeArtifactPlan,
  plan: Pick<ChartbookPlan, "capturedAt" | "preset" | "profile" | "macros">,
  screenshotOk: boolean,
  screenshotError: string | undefined,
  extraction: ChartbookExtractionArtifact
): ChartbookLevelsArtifact {
  const screenshot = screenshotOk
    ? {
        ok: true
      }
    : {
        ok: false,
        error: screenshotError ?? "Screenshot was not captured."
      };

  const symbolData: ChartbookSymbolMetadata = {
    symbol: symbol.symbol,
    alias: symbol.alias,
    tags: [...symbol.tags],
    groups: [...symbol.groups],
    tiers: [...symbol.tiers]
  };

  if (symbol.name) {
    symbolData.name = symbol.name;
  }

  const artifact: ChartbookLevelsArtifact = {
    schemaVersion: CHARTBOOK_SCHEMA_VERSION,
    ok: screenshot.ok && extraction.ok,
    symbol: symbolData,
    timeframe: {
      id: timeframe.id,
      label: timeframe.label,
      interval: timeframe.interval,
      url: timeframe.url
    },
    preset: plan.preset,
    profile: plan.profile,
    capturedAt: plan.capturedAt,
    paths: {
      screenshot: timeframe.screenshotFile,
      levelsJson: timeframe.levelsJsonFile
    },
    screenshot,
    extraction
  };

  const macros = macroMetadataCopy(plan.macros);
  if (macros) {
    artifact.macros = macros;
  }

  return artifact;
}

function markdownList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function htmlEscape(value: string | number | boolean | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayName(symbol: ChartbookSymbolMetadata): string {
  return symbol.name ? `${symbol.alias} - ${symbol.name}` : symbol.alias;
}

function formatPrice(value: number): string {
  return value
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function formatLevel(level: ChartFactLevel | undefined): string {
  return level ? `${level.name} ${formatPrice(level.price)}` : "unavailable";
}

function uniqueLevels(
  levels: Array<ChartFactLevel | undefined>
): ChartFactLevel[] {
  const seen = new Set<string>();
  const unique: ChartFactLevel[] = [];

  for (const level of levels) {
    if (!level) {
      continue;
    }

    const key = `${level.name}:${level.price}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(level);
  }

  return unique;
}

function formatLevelList(
  levels: readonly ChartFactLevel[],
  emptyText = "none extracted"
): string {
  return levels.length > 0 ? levels.map(formatLevel).join(", ") : emptyText;
}

function timeframeById(
  result: ChartbookSymbolResult,
  id: ChartTimeframeId
): ChartbookTimeframeResult | undefined {
  return result.timeframes.find((timeframe) => timeframe.timeframe === id);
}

function timeframeFacts(
  result: ChartbookSymbolResult,
  id: ChartTimeframeId
): ChartFacts | undefined {
  return timeframeById(result, id)?.facts;
}

function formatNearest(facts: ChartFacts | undefined): string {
  if (!facts) {
    return "unavailable";
  }

  const parts: string[] = [];

  if (typeof facts.nearest.referencePrice === "number") {
    parts.push(`reference ${formatPrice(facts.nearest.referencePrice)}`);
  }

  if (facts.nearest.support) {
    parts.push(`support ${formatLevel(facts.nearest.support)}`);
  }

  if (facts.nearest.resistance) {
    parts.push(`resistance ${formatLevel(facts.nearest.resistance)}`);
  }

  return parts.length > 0 ? parts.join("; ") : "unavailable";
}

function formatAvwap(facts: ChartFacts | undefined): string {
  return facts?.avwap.present && typeof facts.avwap.value === "number"
    ? formatPrice(facts.avwap.value)
    : "unavailable";
}

function formatCompression(facts: ChartFacts | undefined): string {
  if (!facts) {
    return "unavailable";
  }

  if (facts.compression.range) {
    return `${facts.compression.state}; range high ${formatPrice(
      facts.compression.range.high
    )}, range low ${formatPrice(facts.compression.range.low)} (${facts.compression.range.source})`;
  }

  return facts.compression.state;
}

function keyLevels(facts: ChartFacts | undefined): ChartFactLevel[] {
  if (!facts) {
    return [];
  }

  return uniqueLevels([
    ...facts.breakout.referenceLevels,
    facts.nearest.resistance,
    facts.nearest.support,
    ...facts.timing.priorDayLevels,
    ...facts.timing.premarketLevels,
    ...facts.timing.openingRangeLevels,
    facts.avwap.present && typeof facts.avwap.value === "number"
      ? {
          name: "AVWAP",
          price: facts.avwap.value,
          role: "avwap",
          sources: []
        }
      : undefined
  ]);
}

function formatTimeframeLevels(
  label: string,
  facts: ChartFacts | undefined
): string {
  return `${label}: ${formatLevelList(keyLevels(facts), "no extracted levels")}`;
}

function expansionWatchLevel(facts: ChartFacts | undefined): string {
  if (!facts) {
    return "unavailable";
  }

  if (facts.compression.range) {
    return `range high ${formatPrice(facts.compression.range.high)}`;
  }

  return formatLevel(facts.nearest.resistance);
}

function factsWithCompressionRange(
  facts: Array<ChartFacts | undefined>
): ChartFacts | undefined {
  return (
    facts.find((candidate) => candidate?.compression.range) ??
    facts.find((candidate) => candidate)
  );
}

function warningsSection(result: ChartbookSymbolResult): string[] {
  const warningLines = result.timeframes
    .filter((timeframe) => timeframe.warnings.length > 0)
    .map(
      (timeframe) => `- ${timeframe.label}: ${timeframe.warnings.join("; ")}`
    );

  return warningLines.length > 0
    ? ["", "## Extraction Warnings", "", ...warningLines]
    : [];
}

function relativeArtifactPath(symbol: ChartbookSymbolResult, path: string): string {
  return `${symbol.symbolSlug}/${basename(path)}`;
}

function renderHtmlBadge(label: string, value: string, tone = "neutral"): string {
  return `<span class="badge badge-${htmlEscape(tone)}"><span>${htmlEscape(label)}</span>${htmlEscape(value)}</span>`;
}

function renderHtmlLevelList(
  levels: readonly ChartFactLevel[] | undefined,
  emptyText = "none extracted"
): string {
  if (!levels || levels.length === 0) {
    return `<span class="muted">${htmlEscape(emptyText)}</span>`;
  }

  return `<div class="level-list">${levels
    .map(
      (level) =>
        `<span class="level level-${htmlEscape(level.role)}"><strong>${htmlEscape(level.name)}</strong><span>${htmlEscape(formatPrice(level.price))}</span></span>`
    )
    .join("")}</div>`;
}

function renderHtmlNearest(facts: ChartFacts | undefined): string {
  if (!facts) {
    return `<span class="muted">unavailable</span>`;
  }

  const items: string[] = [];

  if (typeof facts.nearest.referencePrice === "number") {
    items.push(
      `<span><strong>Reference</strong>${htmlEscape(formatPrice(facts.nearest.referencePrice))}</span>`
    );
  }

  if (facts.nearest.support) {
    items.push(
      `<span><strong>Support</strong>${htmlEscape(formatLevel(facts.nearest.support))}</span>`
    );
  }

  if (facts.nearest.resistance) {
    items.push(
      `<span><strong>Resistance</strong>${htmlEscape(formatLevel(facts.nearest.resistance))}</span>`
    );
  }

  return items.length > 0
    ? `<div class="nearest-list">${items.join("")}</div>`
    : `<span class="muted">unavailable</span>`;
}

function renderHtmlWarnings(result: ChartbookSymbolResult): string {
  const warningLines = result.timeframes
    .filter((timeframe) => timeframe.warnings.length > 0)
    .map(
      (timeframe) =>
        `<li><strong>${htmlEscape(timeframe.label)}:</strong> ${htmlEscape(timeframe.warnings.join("; "))}</li>`
    );

  if (warningLines.length === 0) {
    return "";
  }

  return `<section class="warning-block"><h3>Extraction Warnings</h3><ul>${warningLines.join("")}</ul></section>`;
}

function uniqueWarnings(result: ChartbookSymbolResult): string[] {
  return [
    ...new Set(
      result.timeframes.flatMap((timeframe) => timeframe.warnings)
    )
  ];
}

function firstReferencePrice(
  facts: Array<ChartFacts | undefined>
): number | undefined {
  return facts.find(
    (candidate) => typeof candidate?.nearest.referencePrice === "number"
  )?.nearest.referencePrice;
}

function compareReferenceToLevel(
  facts: ChartFacts | undefined,
  level: ChartFactLevel
): string {
  const referencePrice = facts?.nearest.referencePrice;

  if (typeof referencePrice !== "number") {
    return `${formatLevel(level)}; current chart price was unavailable in extraction.`;
  }

  const distance = referencePrice - level.price;
  const tolerance = Math.max(0.01, Math.abs(level.price) * 0.001);

  if (Math.abs(distance) <= tolerance) {
    return `${formatLevel(level)}; reference ${formatPrice(referencePrice)} is near this level.`;
  }

  const percent = Math.abs((distance / level.price) * 100)
    .toFixed(1)
    .replace(/\.0$/, "");
  const direction = distance > 0 ? "above" : "below";

  return `${formatLevel(level)}; reference ${formatPrice(referencePrice)} is ${direction} by ${percent}%.`;
}

function describeComparedLevels(
  facts: ChartFacts | undefined,
  levels: readonly ChartFactLevel[]
): string {
  if (levels.length === 0) {
    return "No extracted levels for this section.";
  }

  if (typeof facts?.nearest.referencePrice !== "number") {
    return formatLevelList(levels);
  }

  return levels.map((level) => compareReferenceToLevel(facts, level)).join(" ");
}

function describeAvwapContext(
  factsByLabel: Array<[string, ChartFacts | undefined]>
): string | undefined {
  const available = factsByLabel
    .filter(([, facts]) => facts?.avwap.present && typeof facts.avwap.value === "number")
    .map(([label, facts]) => `${label} ${formatPrice(facts?.avwap.value as number)}`);

  return available.length > 0
    ? `Anchored VWAP values exposed: ${available.join(", ")}.`
    : undefined;
}

function codexAnalysisObservations(
  result: ChartbookSymbolResult,
  profile: ChartAnalysisProfileName
): string[] {
  const weekly = timeframeFacts(result, "weekly");
  const daily = timeframeFacts(result, "daily");
  const intraday = timeframeFacts(result, "65-minute");
  const observations: string[] = [];

  if (profile === "breakout") {
    observations.push(
      `Daily breakout references: ${describeComparedLevels(daily, daily?.breakout.referenceLevels ?? [])}`
    );
    observations.push(
      `Weekly context references: ${describeComparedLevels(weekly, weekly?.breakout.referenceLevels ?? [])}`
    );

    if (
      intraday?.timing.openingRangeLevels.length ||
      intraday?.timing.priorDayLevels.length
    ) {
      observations.push(
        `65-minute timing levels: opening range ${formatLevelList(intraday.timing.openingRangeLevels)}; prior day ${formatLevelList(intraday.timing.priorDayLevels)}.`
      );
    } else {
      observations.push(
        "65-minute timing levels were not extracted; review the screenshot and levels JSON before relying on timing context."
      );
    }
  } else {
    observations.push(
      `Cross-timeframe nearest context: weekly ${formatNearest(weekly)}; daily ${formatNearest(daily)}; 65-minute ${formatNearest(intraday)}.`
    );
    observations.push(
      `Key extracted levels: weekly ${formatLevelList(keyLevels(weekly), "none")}; daily ${formatLevelList(keyLevels(daily), "none")}; 65-minute ${formatLevelList(keyLevels(intraday), "none")}.`
    );
  }

  const referencePrice = firstReferencePrice([daily, intraday, weekly]);
  if (typeof referencePrice === "number") {
    observations.push(
      `Reference chart price exposed by TradingView extraction: ${formatPrice(referencePrice)}.`
    );
  } else {
    observations.push(
      "TradingView extraction did not expose a current chart price; level comparisons are limited."
    );
  }

  const avwap = describeAvwapContext([
    ["weekly", weekly],
    ["daily", daily],
    ["65-minute", intraday]
  ]);
  if (avwap) {
    observations.push(avwap);
  }

  if (daily?.compression.state && daily.compression.state !== "unknown") {
    observations.push(`Daily compression context: ${formatCompression(daily)}.`);
  }

  const warnings = uniqueWarnings(result);
  observations.push(
    warnings.length > 0
      ? `Extraction warnings to review: ${warnings.join(" ")}`
      : "No extraction warnings were recorded for this symbol."
  );

  return observations;
}

function codexAnalysisChecks(profile: ChartAnalysisProfileName): string[] {
  if (profile === "breakout") {
    return [
      "Start with the daily screenshot and confirm price behavior around the extracted 20D-H, 50D-H, and prior-week levels.",
      "Use the 65-minute screenshot only as timing context after the daily breakout context is understood.",
      "Check whether opening-range and prior-day levels are acting as support/resistance in the screenshot.",
      "Open the linked levels JSON when warnings mention legend fallback or missing drawing fields."
    ];
  }

  if (profile === "squeeze") {
    return [
      "Confirm whether the extracted compression range is visible and useful on the daily screenshot.",
      "Compare range high/low against nearest extracted support and resistance.",
      "Open the levels JSON if range state is unknown or warnings are present."
    ];
  }

  if (profile === "momentum") {
    return [
      "Review whether price is respecting extracted continuation levels across daily and 65-minute charts.",
      "Check anchored VWAP context when available.",
      "Use warnings to decide whether the screenshot needs manual inspection before relying on extracted facts."
    ];
  }

  return [
    "Review weekly context first, then daily, then 65-minute timing.",
    "Use extracted levels as objective references, not as recommendations.",
    "Open the levels JSON when warnings or missing fields limit the dashboard summary."
  ];
}

function renderHtmlList(items: readonly string[]): string {
  return `<ul>${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
}

function renderCodexAnalysisHtml(
  result: ChartbookSymbolResult,
  profile: ChartAnalysisProfileName
): string {
  return `<section class="codex-analysis" aria-labelledby="${htmlEscape(result.symbolSlug)}-codex-analysis">
    <h3 id="${htmlEscape(result.symbolSlug)}-codex-analysis">Codex Analysis</h3>
    <p class="muted">Generated from extracted objective overlay facts and chartbook warnings. Review context only; no ranking, recommendation, alert, broker, or order action.</p>
    <div class="review-grid compact">
      <article>
        <h4>Objective Read</h4>
        ${renderHtmlList(codexAnalysisObservations(result, profile))}
      </article>
      <article>
        <h4>Review Checks</h4>
        ${renderHtmlList(codexAnalysisChecks(profile))}
      </article>
    </div>
  </section>`;
}

function renderHtmlReviewFieldset(
  symbol: ChartbookSymbolResult,
  profile: ChartAnalysisProfileName
): string {
  const keyPrefix = `${symbol.symbolSlug}:${profile}`;

  return `<section class="manual-review" aria-labelledby="${htmlEscape(symbol.symbolSlug)}-manual-review">
    <h3 id="${htmlEscape(symbol.symbolSlug)}-manual-review">Manual Review</h3>
    <div class="check-grid">
      <label><input type="checkbox" data-persist-key="${htmlEscape(keyPrefix)}:weekly-context"> Weekly context checked</label>
      <label><input type="checkbox" data-persist-key="${htmlEscape(keyPrefix)}:daily-setup"> Daily setup checked</label>
      <label><input type="checkbox" data-persist-key="${htmlEscape(keyPrefix)}:65m-timing"> 65-minute timing checked</label>
      <label><input type="checkbox" data-persist-key="${htmlEscape(keyPrefix)}:warnings"> Warnings reviewed</label>
    </div>
    <label class="notes-input">Review notes
      <textarea data-persist-key="${htmlEscape(keyPrefix)}:notes" rows="4" placeholder="Add local notes for this chartbook session"></textarea>
    </label>
  </section>`;
}

function renderBreakoutReviewHtml(result: ChartbookSymbolResult): string {
  const weekly = timeframeFacts(result, "weekly");
  const daily = timeframeFacts(result, "daily");
  const intraday = timeframeFacts(result, "65-minute");

  return `<section class="review-panel review-breakout" aria-labelledby="${htmlEscape(result.symbolSlug)}-breakout">
    <h3 id="${htmlEscape(result.symbolSlug)}-breakout">Breakout Review</h3>
    <div class="review-grid">
      <article>
        <h4>Weekly Context</h4>
        <p class="label">Reference levels</p>
        ${renderHtmlLevelList(weekly?.breakout.referenceLevels)}
        <p class="label">Nearest context</p>
        ${renderHtmlNearest(weekly)}
      </article>
      <article>
        <h4>Daily Setup</h4>
        <p class="label">Breakout levels</p>
        ${renderHtmlLevelList(daily?.breakout.referenceLevels)}
        <p class="label">Nearest context</p>
        ${renderHtmlNearest(daily)}
      </article>
      <article>
        <h4>65-Minute Timing</h4>
        <p class="label">Prior day</p>
        ${renderHtmlLevelList(intraday?.timing.priorDayLevels)}
        <p class="label">Opening range</p>
        ${renderHtmlLevelList(intraday?.timing.openingRangeLevels)}
        <p class="label">Premarket</p>
        ${renderHtmlLevelList(intraday?.timing.premarketLevels)}
      </article>
    </div>
    <div class="review-grid compact">
      <article>
        <h4>Key Extracted Levels</h4>
        <p><strong>Weekly:</strong> ${htmlEscape(formatLevelList(keyLevels(weekly), "no extracted levels"))}</p>
        <p><strong>Daily:</strong> ${htmlEscape(formatLevelList(keyLevels(daily), "no extracted levels"))}</p>
        <p><strong>65-minute:</strong> ${htmlEscape(formatLevelList(keyLevels(intraday), "no extracted levels"))}</p>
      </article>
      <article>
        <h4>Confirmation Fields</h4>
        <ul class="plain-list">
          <li>Volume behavior: review visible volume or overlay context if present.</li>
          <li>Confirmation: record whether chart behavior confirms extracted levels.</li>
          <li>Invalidation: note which level or condition weakens the setup.</li>
        </ul>
      </article>
    </div>
  </section>`;
}

function renderGenericReviewHtml(
  profile: ChartAnalysisProfileName,
  result: ChartbookSymbolResult
): string {
  const weekly = timeframeFacts(result, "weekly");
  const daily = timeframeFacts(result, "daily");
  const intraday = timeframeFacts(result, "65-minute");

  return `<section class="review-panel" aria-labelledby="${htmlEscape(result.symbolSlug)}-${htmlEscape(profile)}">
    <h3 id="${htmlEscape(result.symbolSlug)}-${htmlEscape(profile)}">${htmlEscape(profile)} Review</h3>
    <div class="review-grid compact">
      <article>
        <h4>Nearest Context</h4>
        <p><strong>Weekly:</strong> ${htmlEscape(formatNearest(weekly))}</p>
        <p><strong>Daily:</strong> ${htmlEscape(formatNearest(daily))}</p>
        <p><strong>65-minute:</strong> ${htmlEscape(formatNearest(intraday))}</p>
      </article>
      <article>
        <h4>Key Extracted Levels</h4>
        <p><strong>Weekly:</strong> ${htmlEscape(formatLevelList(keyLevels(weekly), "no extracted levels"))}</p>
        <p><strong>Daily:</strong> ${htmlEscape(formatLevelList(keyLevels(daily), "no extracted levels"))}</p>
        <p><strong>65-minute:</strong> ${htmlEscape(formatLevelList(keyLevels(intraday), "no extracted levels"))}</p>
      </article>
    </div>
  </section>`;
}

function renderProfileReviewHtml(
  profile: ChartAnalysisProfileName,
  result: ChartbookSymbolResult
): string {
  return profile === "breakout"
    ? renderBreakoutReviewHtml(result)
    : renderGenericReviewHtml(profile, result);
}

function renderTimeframeScreenshotHtml(
  symbol: ChartbookSymbolResult,
  timeframe: ChartbookTimeframeResult
): string {
  const screenshotPath = relativeArtifactPath(symbol, timeframe.screenshotPath);
  const levelsPath = relativeArtifactPath(symbol, timeframe.levelsJsonPath);
  const statusTone = timeframe.ok ? "ok" : "error";

  return `<article class="timeframe-panel">
    <header>
      <h3>${htmlEscape(timeframe.label)}</h3>
      ${renderHtmlBadge("Status", timeframe.ok ? "OK" : "FAILED", statusTone)}
    </header>
    <a href="${htmlEscape(screenshotPath)}">
      <img src="${htmlEscape(screenshotPath)}" alt="${htmlEscape(`${symbol.alias} ${timeframe.label} TradingView screenshot`)}" loading="lazy">
    </a>
    <div class="artifact-links">
      <a href="${htmlEscape(levelsPath)}">levels JSON</a>
      <a href="${htmlEscape(timeframe.url)}">TradingView URL</a>
    </div>
    ${
      timeframe.error
        ? `<p class="error-text">${htmlEscape(timeframe.error)}</p>`
        : ""
    }
  </article>`;
}

function renderSymbolDashboardHtml(
  symbol: ChartbookSymbolResult,
  profile: ChartAnalysisProfileName
): string {
  const failures = symbol.timeframes.filter((timeframe) => !timeframe.ok);
  const statusTone = failures.length === 0 ? "ok" : "error";
  const tags = [...symbol.tags, ...symbol.groups].filter(
    (value, index, values) => values.indexOf(value) === index
  );

  return `<section class="symbol-section" id="${htmlEscape(symbol.symbolSlug)}">
    <header class="symbol-header">
      <div>
        <p class="eyebrow">${htmlEscape(symbol.symbol)}</p>
        <h2>${htmlEscape(displayName(symbol))}</h2>
      </div>
      <div class="symbol-actions">
        ${renderHtmlBadge("Status", failures.length === 0 ? "OK" : `${failures.length} issue${failures.length === 1 ? "" : "s"}`, statusTone)}
        <a class="button-link" href="${htmlEscape(`${symbol.symbolSlug}/notes.md`)}">notes.md</a>
      </div>
    </header>
    <div class="tag-row">${tags.map((tag) => `<span>${htmlEscape(tag)}</span>`).join("")}</div>
    ${renderHtmlWarnings(symbol)}
    ${renderCodexAnalysisHtml(symbol, profile)}
    ${renderProfileReviewHtml(profile, symbol)}
    <section class="screenshots-grid" aria-label="${htmlEscape(`${symbol.alias} screenshots`)}">
      ${symbol.timeframes.map((timeframe) => renderTimeframeScreenshotHtml(symbol, timeframe)).join("")}
    </section>
    ${renderHtmlReviewFieldset(symbol, profile)}
  </section>`;
}

function renderBreakoutReviewTemplate(
  result: ChartbookSymbolResult
): string[] {
  const weekly = timeframeFacts(result, "weekly");
  const daily = timeframeFacts(result, "daily");
  const intraday = timeframeFacts(result, "65-minute");

  return [
    "",
    "## Breakout Review Checklist",
    "",
    "### Weekly Context",
    "",
    `- Reference levels: ${formatLevelList(weekly?.breakout.referenceLevels ?? [])}`,
    `- Nearest level context: ${formatNearest(weekly)}`,
    "- Human review notes:",
    "",
    "### Daily Setup",
    "",
    `- Breakout levels: ${formatLevelList(daily?.breakout.referenceLevels ?? [])}`,
    `- Nearest level context: ${formatNearest(daily)}`,
    "- Setup quality notes:",
    "",
    "### 65-Minute Timing",
    "",
    `- Prior day levels: ${formatLevelList(intraday?.timing.priorDayLevels ?? [])}`,
    `- Opening range levels: ${formatLevelList(intraday?.timing.openingRangeLevels ?? [])}`,
    `- Premarket levels: ${formatLevelList(intraday?.timing.premarketLevels ?? [])}`,
    "- Timing notes:",
    "",
    "### Key Extracted Levels",
    "",
    `- ${formatTimeframeLevels("Weekly", weekly)}`,
    `- ${formatTimeframeLevels("Daily", daily)}`,
    `- ${formatTimeframeLevels("65-minute", intraday)}`,
    "",
    "### Volume / Confirmation",
    "",
    "- Volume behavior: [ ] Review visible volume or overlay context if present in the screenshot.",
    "- Confirmation notes: [ ] Record whether chart behavior confirms the extracted levels.",
    "",
    "### Invalidation Notes",
    "",
    "- Invalidation context: [ ] Note which level or chart condition would make the reviewed setup no longer relevant."
  ];
}

function renderSqueezeReviewTemplate(result: ChartbookSymbolResult): string[] {
  const weekly = timeframeFacts(result, "weekly");
  const daily = timeframeFacts(result, "daily");
  const intraday = timeframeFacts(result, "65-minute");
  const rangeFacts = factsWithCompressionRange([daily, weekly, intraday]);

  return [
    "",
    "## Squeeze Review Checklist",
    "",
    "### Compression Context",
    "",
    `- Weekly compression: ${formatCompression(weekly)}`,
    `- Daily compression: ${formatCompression(daily)}`,
    `- 65-minute compression: ${formatCompression(intraday)}`,
    "- Compression notes:",
    "",
    "### Range High / Low",
    "",
    `- Review range: ${formatCompression(rangeFacts)}`,
    `- Nearest level context: ${formatNearest(rangeFacts)}`,
    "",
    "### Expansion Watch Level",
    "",
    `- Level for human review: ${expansionWatchLevel(rangeFacts)}`,
    "- Expansion notes:",
    "",
    "### Risk Notes",
    "",
    "- Range failure notes: [ ] Note what would weaken the compression context.",
    "- Chart risk notes: [ ] Record gap, volatility, or level-cluster concerns visible on the chart."
  ];
}

function renderMomentumReviewTemplate(result: ChartbookSymbolResult): string[] {
  const weekly = timeframeFacts(result, "weekly");
  const daily = timeframeFacts(result, "daily");
  const intraday = timeframeFacts(result, "65-minute");

  return [
    "",
    "## Momentum Review Checklist",
    "",
    "### Trend Context",
    "",
    `- Weekly level context: ${formatNearest(weekly)}`,
    `- Daily level context: ${formatNearest(daily)}`,
    "- Trend notes:",
    "",
    "### Relative Position To Extracted Levels",
    "",
    `- ${formatTimeframeLevels("Weekly", weekly)}`,
    `- ${formatTimeframeLevels("Daily", daily)}`,
    `- ${formatTimeframeLevels("65-minute", intraday)}`,
    "",
    "### AVWAP Context",
    "",
    `- Weekly AVWAP: ${formatAvwap(weekly)}`,
    `- Daily AVWAP: ${formatAvwap(daily)}`,
    `- 65-minute AVWAP: ${formatAvwap(intraday)}`,
    "",
    "### Continuation / Retest Notes",
    "",
    "- Continuation context: [ ] Note whether price is respecting relevant extracted levels.",
    "- Retest context: [ ] Note levels that price is retesting or rejecting."
  ];
}

function renderFocusReviewTemplate(result: ChartbookSymbolResult): string[] {
  const weekly = timeframeFacts(result, "weekly");
  const daily = timeframeFacts(result, "daily");
  const intraday = timeframeFacts(result, "65-minute");

  return [
    "",
    "## Focus Review Checklist",
    "",
    "### Cross-Timeframe Context",
    "",
    `- Weekly: ${formatNearest(weekly)}`,
    `- Daily: ${formatNearest(daily)}`,
    `- 65-minute: ${formatNearest(intraday)}`,
    "",
    "### Key Extracted Levels",
    "",
    `- ${formatTimeframeLevels("Weekly", weekly)}`,
    `- ${formatTimeframeLevels("Daily", daily)}`,
    `- ${formatTimeframeLevels("65-minute", intraday)}`,
    "",
    "### Review Notes",
    "",
    "- Context notes:",
    "- Follow-up chart questions:"
  ];
}

function renderProfileReviewTemplate(
  profile: ChartAnalysisProfileName,
  result: ChartbookSymbolResult
): string[] {
  if (profile === "breakout") {
    return renderBreakoutReviewTemplate(result);
  }

  if (profile === "squeeze") {
    return renderSqueezeReviewTemplate(result);
  }

  if (profile === "momentum") {
    return renderMomentumReviewTemplate(result);
  }

  return renderFocusReviewTemplate(result);
}

export function renderSymbolNotesMarkdown(
  symbol: ChartbookSymbolPlan,
  result: ChartbookSymbolResult,
  plan: Pick<ChartbookPlan, "capturedAt" | "preset" | "profile">
): string {
  const lines = [
    `# ${displayName(symbol)}`,
    "",
    `- Symbol: \`${symbol.symbol}\``,
    `- Alias: \`${symbol.alias}\``
  ];

  if (symbol.name) {
    lines.push(`- Name: ${symbol.name}`);
  }

  lines.push(
    `- Tags: ${markdownList(symbol.tags)}`,
    `- Groups: ${markdownList(symbol.groups)}`,
    `- Tiers: ${markdownList(symbol.tiers)}`,
    `- Preset: \`${plan.preset}\``,
    `- Profile: \`${plan.profile}\``,
    `- Captured at: \`${plan.capturedAt}\``,
    "",
    "## Screenshots"
  );

  for (const timeframe of result.timeframes) {
    lines.push(
      "",
      `### ${timeframe.label}`,
      "",
      `![${timeframe.label} screenshot](./${basename(timeframe.screenshotPath)})`,
      "",
      `- Levels JSON: [${basename(timeframe.levelsJsonPath)}](./${basename(timeframe.levelsJsonPath)})`,
      `- Status: ${timeframe.ok ? "OK" : "FAILED"}`
    );

    if (timeframe.error) {
      lines.push(`- Failure: ${timeframe.error}`);
    }

    if (timeframe.warnings.length > 0) {
      lines.push(`- Warnings: ${timeframe.warnings.join("; ")}`);
    }
  }

  lines.push(
    ...warningsSection(result),
    ...renderProfileReviewTemplate(plan.profile, result),
    "",
    "## Manual Notes",
    "",
    "### Weekly",
    "",
    "### Daily",
    "",
    "### 65-Minute",
    "",
    "### Cross-Timeframe",
    ""
  );

  return `${lines.join("\n")}\n`;
}

export function renderChartbookIndexMarkdown(
  plan: ChartbookPlan,
  result: Pick<ChartbookResult, "ok" | "symbols" | "error">
): string {
  const lines = [
    `# TradingView Chartbook ${plan.sessionId}`,
    "",
    `- Status: ${result.ok ? "OK" : "FAILED"}`,
    `- Captured at: \`${plan.capturedAt}\``,
    `- Preset: \`${plan.preset}\``,
    `- Profile: \`${plan.profile}\``,
    `- Symbols: ${result.symbols.length}`
  ];

  if (plan.selection) {
    lines.push(
      `- Selection groups: ${Array.isArray(plan.selection.groups) ? plan.selection.groups.join(", ") : plan.selection.groups}`,
      `- Selection tier: ${plan.selection.tier}`
    );

    if (plan.selection.configPath) {
      lines.push(`- Config: \`${plan.selection.configPath}\``);
    }
  }

  if (result.error) {
    lines.push(`- Run error: ${result.error}`);
  }

  lines.push("", "## Symbols");

  for (const symbol of result.symbols) {
    const failures = symbol.timeframes.filter((timeframe) => !timeframe.ok);
    const status = failures.length === 0 ? "OK" : `FAILED ${failures.length}`;

    lines.push(
      `- [${symbol.alias}](./${symbol.symbolSlug}/notes.md) - \`${symbol.symbol}\` - ${status}`
    );
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This chartbook is a local review/prep artifact. It is not a scanner, ranking, recommendation, broker action, or order workflow.",
    ""
  );

  return `${lines.join("\n")}`;
}

function renderSelectionHtml(selection: ChartbookSelectionSummary | undefined): string {
  if (!selection) {
    return "";
  }

  const groups = Array.isArray(selection.groups)
    ? selection.groups.join(", ")
    : selection.groups;
  const config = selection.configPath
    ? `<span><strong>Config</strong>${htmlEscape(selection.configPath)}</span>`
    : "";

  return `<div class="meta-grid">
    <span><strong>Groups</strong>${htmlEscape(groups)}</span>
    <span><strong>Tier</strong>${htmlEscape(selection.tier)}</span>
    ${config}
  </div>`;
}

function renderDashboardStyles(): string {
  return `<style>
    :root {
      color-scheme: dark;
      --bg: #111315;
      --panel: #191d20;
      --panel-2: #20262a;
      --text: #eef2f3;
      --muted: #9da8ad;
      --line: #343d42;
      --ok: #44c28a;
      --warn: #d6a841;
      --error: #ed6a5e;
      --accent: #39b7c7;
      --accent-2: #d8c36a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    a { color: var(--accent); }
    .page-header {
      padding: 28px clamp(18px, 4vw, 48px) 20px;
      border-bottom: 1px solid var(--line);
      background: #15191b;
    }
    .eyebrow {
      margin: 0 0 6px;
      color: var(--accent-2);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0;
      font-weight: 700;
    }
    h1, h2, h3, h4, p { margin-top: 0; }
    h1 { margin-bottom: 14px; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: 0; }
    h2 { margin-bottom: 4px; font-size: clamp(1.35rem, 3vw, 2rem); letter-spacing: 0; }
    h3 { margin-bottom: 12px; font-size: 1.05rem; letter-spacing: 0; }
    h4 { margin-bottom: 10px; font-size: 0.95rem; color: var(--accent-2); letter-spacing: 0; }
    main { padding: 24px clamp(18px, 4vw, 48px) 48px; }
    .meta-grid, .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .meta-grid span, .summary-grid span {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      color: var(--muted);
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .meta-grid strong, .summary-grid strong { color: var(--text); font-size: 0.78rem; text-transform: uppercase; }
    .boundary {
      margin-top: 16px;
      max-width: 980px;
      color: var(--muted);
    }
    .symbol-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 22px;
    }
    .button-link, .symbol-nav a {
      display: inline-flex;
      min-height: 36px;
      align-items: center;
      justify-content: center;
      padding: 7px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel-2);
      color: var(--text);
      text-decoration: none;
      font-weight: 700;
    }
    .symbol-section {
      margin-top: 22px;
      padding-top: 22px;
      border-top: 1px solid var(--line);
    }
    .symbol-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
    }
    .symbol-actions, .tag-row, .artifact-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .tag-row { margin-bottom: 14px; }
    .tag-row span {
      padding: 4px 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      font-size: 0.82rem;
    }
    .badge {
      display: inline-flex;
      min-height: 30px;
      align-items: center;
      gap: 8px;
      padding: 5px 9px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel-2);
      color: var(--text);
      font-weight: 700;
      white-space: nowrap;
    }
    .badge span { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; }
    .badge-ok { border-color: rgba(68, 194, 138, 0.5); }
    .badge-error { border-color: rgba(237, 106, 94, 0.6); }
    .warning-block, .review-panel, .manual-review {
      margin: 14px 0;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }
    .warning-block { border-color: rgba(214, 168, 65, 0.6); }
    .review-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .review-grid.compact { margin-top: 12px; }
    .review-grid article, .timeframe-panel {
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel-2);
      min-width: 0;
    }
    .label {
      margin: 12px 0 6px;
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      font-weight: 700;
    }
    .level-list, .nearest-list {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }
    .level, .nearest-list span {
      display: inline-flex;
      align-items: baseline;
      gap: 7px;
      padding: 6px 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #121618;
    }
    .level-breakout { border-color: rgba(57, 183, 199, 0.65); }
    .level-timing { border-color: rgba(216, 195, 106, 0.6); }
    .level-avwap { border-color: rgba(68, 194, 138, 0.55); }
    .nearest-list strong { color: var(--muted); margin-right: 2px; }
    .muted { color: var(--muted); }
    .plain-list { padding-left: 18px; color: var(--muted); }
    .screenshots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .timeframe-panel header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .timeframe-panel img {
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: contain;
      display: block;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #080a0b;
    }
    .artifact-links { margin-top: 10px; }
    .error-text { margin-top: 10px; color: var(--error); overflow-wrap: anywhere; }
    .check-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .check-grid label {
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--muted);
    }
    .notes-input {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--muted);
      font-weight: 700;
    }
    textarea {
      width: 100%;
      resize: vertical;
      min-height: 96px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #0d1012;
      color: var(--text);
      font: inherit;
    }
    @media (max-width: 720px) {
      .symbol-header { flex-direction: column; }
      .symbol-actions { width: 100%; }
    }
  </style>`;
}

function renderDashboardPersistenceScript(sessionId: string): string {
  return `<script>
    (function () {
      var prefix = "tvmcp-chartbook:${htmlEscape(sessionId)}:";
      document.querySelectorAll("[data-persist-key]").forEach(function (element) {
        var key = prefix + element.getAttribute("data-persist-key");
        var saved = window.localStorage.getItem(key);
        if (saved !== null) {
          if (element instanceof HTMLInputElement && element.type === "checkbox") {
            element.checked = saved === "true";
          } else if (element instanceof HTMLTextAreaElement) {
            element.value = saved;
          }
        }
        var eventName = element instanceof HTMLInputElement && element.type === "checkbox" ? "change" : "input";
        element.addEventListener(eventName, function () {
          if (element instanceof HTMLInputElement && element.type === "checkbox") {
            window.localStorage.setItem(key, String(element.checked));
          } else if (element instanceof HTMLTextAreaElement) {
            window.localStorage.setItem(key, element.value);
          }
        });
      });
    }());
  </script>`;
}

export function renderChartbookIndexHtml(
  plan: ChartbookPlan,
  result: Pick<ChartbookResult, "ok" | "symbols" | "error" | "endpoint">
): string {
  const title = `TradingView Chartbook ${plan.sessionId}`;
  const symbolLinks = result.symbols
    .map(
      (symbol) =>
        `<a href="#${htmlEscape(symbol.symbolSlug)}">${htmlEscape(symbol.alias)}</a>`
    )
    .join("");
  const symbolSections = result.symbols
    .map((symbol) => renderSymbolDashboardHtml(symbol, plan.profile))
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  ${renderDashboardStyles()}
</head>
<body>
  <header class="page-header">
    <p class="eyebrow">Local TradingView Chartbook</p>
    <h1>${htmlEscape(title)}</h1>
    <div class="summary-grid">
      <span><strong>Status</strong>${htmlEscape(result.ok ? "OK" : "FAILED")}</span>
      <span><strong>Profile</strong>${htmlEscape(plan.profile)}</span>
      <span><strong>Preset</strong>${htmlEscape(plan.preset)}</span>
      <span><strong>Symbols</strong>${htmlEscape(result.symbols.length)}</span>
      <span><strong>Captured</strong>${htmlEscape(plan.capturedAt)}</span>
      <span><strong>Endpoint</strong>${htmlEscape(result.endpoint)}</span>
    </div>
    ${renderSelectionHtml(plan.selection)}
    ${
      result.error
        ? `<p class="error-text"><strong>Run error:</strong> ${htmlEscape(result.error)}</p>`
        : ""
    }
    <p class="boundary">This dashboard is a local review/prep artifact for Codex and human review. It is not a scanner, ranking, recommendation, broker action, alert, or order workflow.</p>
  </header>
  <main>
    <nav class="symbol-nav" aria-label="Symbols">${symbolLinks}</nav>
    ${symbolSections}
  </main>
  ${renderDashboardPersistenceScript(plan.sessionId)}
</body>
</html>
`;
}

async function writeJsonArtifact(
  fileSystem: ChartbookFileSystem,
  path: string,
  artifact: ChartbookLevelsArtifact
): Promise<void> {
  await fileSystem.writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`);
}

async function readDrawingExtractionWithRetry(options: {
  drawingClient: TradingViewPineDrawingPageClient;
  studyName: string;
  debug: boolean;
  profile: ChartAnalysisProfileName;
  capturedAt: string;
  endpoint: string | undefined;
  retryAttempts: number;
  retryDelayMs: number;
}): Promise<ChartbookExtractionArtifact> {
  let lastError: string | undefined;
  let lastExtraction: ChartbookExtractionArtifact | undefined;

  for (let attempt = 1; attempt <= options.retryAttempts; attempt += 1) {
    try {
      const payload = await options.drawingClient.readDrawingPayload({
        studyName: options.studyName,
        debug: options.debug
      });
      const normalized = normalizePineDrawingPayload(payload, {
        studyName: options.studyName,
        debug: options.debug
      });
      lastExtraction = extractionArtifactFromData(
        normalized,
        options.capturedAt,
        options.endpoint,
        undefined,
        options.profile
      );

      if (lastExtraction.ok || attempt === options.retryAttempts) {
        return lastExtraction;
      }
    } catch (error: unknown) {
      lastError = errorMessage(error);

      if (attempt === options.retryAttempts) {
        return skippedExtraction(
          options.studyName,
          options.capturedAt,
          lastError,
          options.profile,
          options.endpoint
        );
      }
    }

    if (options.retryDelayMs > 0) {
      await sleep(options.retryDelayMs);
    }
  }

  return (
    lastExtraction ??
    skippedExtraction(
      options.studyName,
      options.capturedAt,
      lastError ?? "TradingView drawing extraction did not return a payload.",
      options.profile,
      options.endpoint
    )
  );
}

async function captureTimeframe(
  options: {
    chartClient: TradingViewChartPageClient | undefined;
    drawingClient: TradingViewPineDrawingPageClient | undefined;
    drawingSetupError: string | undefined;
    endpoint: string | undefined;
    fileSystem: ChartbookFileSystem;
    plan: Pick<ChartbookPlan, "capturedAt" | "preset" | "profile" | "macros">;
    setupError: string | undefined;
    studyName: string;
    debug: boolean;
    drawingRetryAttempts: number;
    drawingRetryDelayMs: number;
    symbol: ChartbookSymbolPlan;
    target: CdpTarget | undefined;
    timeframe: ChartbookTimeframeArtifactPlan;
  }
): Promise<ChartbookTimeframeResult> {
  let screenshotOk = false;
  let screenshotError: string | undefined;

  if (!options.chartClient) {
    screenshotError =
      options.setupError ?? "TradingView chart client is unavailable.";
  } else {
    try {
      const plan: ChartTimeframePlan = {
        symbol: options.symbol.symbol,
        id: options.timeframe.id,
        label: options.timeframe.label,
        interval: options.timeframe.interval,
        url: options.timeframe.url,
        outputPath: options.timeframe.screenshotPath
      };

      await options.chartClient.navigate(options.timeframe.url);
      await options.chartClient.waitForRender(plan);
      const screenshot = await options.chartClient.captureScreenshot();
      await options.fileSystem.writeFile(options.timeframe.screenshotPath, screenshot);
      screenshotOk = true;
    } catch (error: unknown) {
      screenshotError = errorMessage(error);
    }
  }

  let extraction: ChartbookExtractionArtifact;

  if (!screenshotOk) {
    extraction = skippedExtraction(
      options.studyName,
      options.plan.capturedAt,
      "Skipped drawing extraction because screenshot capture failed.",
      options.plan.profile,
      options.endpoint
    );
  } else if (!options.drawingClient) {
    extraction = skippedExtraction(
      options.studyName,
      options.plan.capturedAt,
      options.drawingSetupError ??
        "TradingView drawing extraction client is unavailable.",
      options.plan.profile,
      options.endpoint
    );
  } else {
    extraction = await readDrawingExtractionWithRetry({
      drawingClient: options.drawingClient,
      studyName: options.studyName,
      debug: options.debug,
      profile: options.plan.profile,
      capturedAt: options.plan.capturedAt,
      endpoint: options.endpoint,
      retryAttempts: options.drawingRetryAttempts,
      retryDelayMs: options.drawingRetryDelayMs
    });
  }

  if (options.target && !extraction.chart?.url) {
    extraction.chart = {
      url: options.target.url,
      title: options.target.title
    };
  }

  const artifact = buildLevelsArtifact(
    options.symbol,
    options.timeframe,
    options.plan,
    screenshotOk,
    screenshotError,
    extraction
  );
  let levelsJsonOk = false;
  const warnings = combinedExtractionWarnings(extraction);
  const errors: string[] = [];

  if (screenshotError) {
    errors.push(screenshotError);
  }

  if (extraction.error) {
    errors.push(extraction.error);
  }

  try {
    await writeJsonArtifact(
      options.fileSystem,
      options.timeframe.levelsJsonPath,
      artifact
    );
    levelsJsonOk = true;
  } catch (error: unknown) {
    errors.push(`Could not write levels JSON: ${errorMessage(error)}`);
  }

  return {
    symbol: options.symbol.symbol,
    timeframe: options.timeframe.id,
    label: options.timeframe.label,
    interval: options.timeframe.interval,
    url: options.timeframe.url,
    screenshotPath: options.timeframe.screenshotPath,
    levelsJsonPath: options.timeframe.levelsJsonPath,
    ok: screenshotOk && extraction.ok && levelsJsonOk,
    screenshotOk,
    extractionOk: extraction.ok,
    levelsJsonOk,
    facts: extraction.facts,
    warnings,
    ...(errors.length > 0 ? { error: errors.join("; ") } : {})
  };
}

async function writeFailedSymbolArtifacts(
  options: {
    fileSystem: ChartbookFileSystem;
    plan: ChartbookPlan;
    symbol: ChartbookSymbolPlan;
    setupError: string;
    studyName: string;
    endpoint: string | undefined;
  }
): Promise<ChartbookSymbolResult> {
  await options.fileSystem.mkdir(options.symbol.directory, {
    recursive: true
  });

  const timeframes: ChartbookTimeframeResult[] = [];

  for (const timeframe of options.symbol.timeframes) {
    timeframes.push(
      await captureTimeframe({
        chartClient: undefined,
        drawingClient: undefined,
        drawingSetupError: undefined,
        endpoint: options.endpoint,
        fileSystem: options.fileSystem,
        plan: options.plan,
        setupError: options.setupError,
        studyName: options.studyName,
        debug: false,
        drawingRetryAttempts: 1,
        drawingRetryDelayMs: 0,
        symbol: options.symbol,
        target: undefined,
        timeframe
      })
    );
  }

  const symbolResult = buildSymbolResult(options.symbol, timeframes);
  await options.fileSystem.writeFile(
    options.symbol.notesPath,
    renderSymbolNotesMarkdown(options.symbol, symbolResult, options.plan)
  );
  return symbolResult;
}

function buildSymbolResult(
  symbol: ChartbookSymbolPlan,
  timeframes: ChartbookTimeframeResult[]
): ChartbookSymbolResult {
  const result: ChartbookSymbolResult = {
    symbol: symbol.symbol,
    alias: symbol.alias,
    tags: [...symbol.tags],
    groups: [...symbol.groups],
    tiers: [...symbol.tiers],
    ok: timeframes.every((timeframe) => timeframe.ok),
    symbolSlug: symbol.symbolSlug,
    directory: symbol.directory,
    notesPath: symbol.notesPath,
    timeframes
  };

  if (symbol.name) {
    result.name = symbol.name;
  }

  return result;
}

export async function runChartbook(
  options: RunChartbookOptions
): Promise<ChartbookResult> {
  const capturedAt = (options.now ?? (() => new Date()))();
  const endpoint = {
    host: options.host ?? DEFAULT_CDP_HOST,
    port: options.port ?? DEFAULT_CDP_PORT
  };
  const timeoutMs = options.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS;
  const renderTimeoutMs = options.renderTimeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  const renderSettleMs = options.renderSettleMs ?? DEFAULT_RENDER_SETTLE_MS;
  const drawingRetryAttempts = Math.max(
    1,
    Math.trunc(
      options.drawingRetryAttempts ?? DEFAULT_CHARTBOOK_DRAWING_RETRY_ATTEMPTS
    )
  );
  const drawingRetryDelayMs = Math.max(
    0,
    Math.trunc(
      options.drawingRetryDelayMs ?? DEFAULT_CHARTBOOK_DRAWING_RETRY_DELAY_MS
    )
  );
  const fileSystem = options.fileSystem ?? {
    mkdir,
    writeFile
  };
  const studyName = options.studyName ?? DEFAULT_PINE_DRAWING_STUDY_NAME;
  const profile = options.profile ?? DEFAULT_CHART_ANALYSIS_PROFILE;
  const debug = options.debug ?? false;
  const planOptions: BuildChartbookPlanOptions = {
    symbols: options.symbols,
    capturedAt,
    profile
  };

  if (options.macroMetadata) {
    planOptions.macroMetadata = options.macroMetadata;
  }

  if (options.preset) {
    planOptions.preset = options.preset;
  }

  if (options.outputRoot) {
    planOptions.outputRoot = options.outputRoot;
  }

  if (options.sessionId) {
    planOptions.sessionId = options.sessionId;
  }

  if (options.selection) {
    planOptions.selection = options.selection;
  }

  let plan = buildChartbookPlan(planOptions);
  await fileSystem.mkdir(plan.sessionDirectory, {
    recursive: true
  });

  const healthOptions: CheckTradingViewHealthOptions = {
    ...endpoint,
    timeoutMs
  };

  if (options.appPath) {
    healthOptions.appPath = options.appPath;
  }

  const healthCheck = options.checkHealth ?? checkTradingViewHealth;
  let health: TradingViewHealthResult | undefined;
  let setupError: string | undefined;

  try {
    health = await healthCheck(healthOptions);
  } catch (error: unknown) {
    setupError = `TradingView health check failed: ${errorMessage(error)}`;
  }

  if (health?.target?.url) {
    plan = buildChartbookPlan({
      ...planOptions,
      targetUrl: health.target.url
    });
    await fileSystem.mkdir(plan.sessionDirectory, {
      recursive: true
    });
  }

  if (health && (!health.ok || !health.target)) {
    setupError = health.message;
  }

  const webSocketDebuggerUrl = health?.target?.webSocketDebuggerUrl;
  if (health?.ok && health.target && !webSocketDebuggerUrl) {
    setupError =
      "TradingView chart target does not expose a page WebSocket debugger URL.";
  }

  let chartClient: TradingViewChartPageClient | undefined;
  let drawingClient: TradingViewPineDrawingPageClient | undefined;
  let drawingSetupError: string | undefined;
  const target = health?.target;

  if (!setupError && target && webSocketDebuggerUrl) {
    const makeChartClient =
      options.chartClientFactory ??
      ((_target, clientOptions) =>
        createLiveTradingViewChartPageClient(webSocketDebuggerUrl, clientOptions));
    const makeDrawingClient =
      options.drawingClientFactory ??
      ((_target, clientOptions) =>
        createLiveTradingViewPineDrawingPageClient(
          webSocketDebuggerUrl,
          clientOptions
        ));

    try {
      chartClient = await makeChartClient(target, {
        timeoutMs,
        renderTimeoutMs,
        renderSettleMs
      });
    } catch (error: unknown) {
      setupError = `Could not connect to TradingView chart target: ${errorMessage(error)}`;
    }

    if (!setupError) {
      try {
        drawingClient = await makeDrawingClient(target, {
          timeoutMs
        });
      } catch (error: unknown) {
        drawingSetupError = `Could not connect to TradingView drawing extraction target: ${errorMessage(error)}`;
      }
    }
  }

  const symbols: ChartbookSymbolResult[] = [];

  try {
    for (const symbol of plan.symbols) {
      if (setupError) {
        symbols.push(
          await writeFailedSymbolArtifacts({
            fileSystem,
            plan,
            symbol,
            setupError,
            studyName,
            endpoint: health?.endpoint
          })
        );
        continue;
      }

      await fileSystem.mkdir(symbol.directory, {
        recursive: true
      });

      const timeframes: ChartbookTimeframeResult[] = [];

      for (const timeframe of symbol.timeframes) {
        timeframes.push(
          await captureTimeframe({
            chartClient,
            drawingClient,
            drawingSetupError,
            endpoint: health?.endpoint,
            fileSystem,
            plan,
            setupError,
            studyName,
            debug,
            drawingRetryAttempts,
            drawingRetryDelayMs,
            symbol,
            target,
            timeframe
          })
        );
      }

      const symbolResult = buildSymbolResult(symbol, timeframes);
      await fileSystem.writeFile(
        symbol.notesPath,
        renderSymbolNotesMarkdown(symbol, symbolResult, plan)
      );
      symbols.push(symbolResult);
    }
  } finally {
    await chartClient?.close();
    await drawingClient?.close();
  }

  const result: ChartbookResult = {
    ok: symbols.every((symbol) => symbol.ok),
    schemaVersion: CHARTBOOK_SCHEMA_VERSION,
    sessionId: plan.sessionId,
    capturedAt: plan.capturedAt,
    preset: plan.preset,
    profile: plan.profile,
    sessionDirectory: plan.sessionDirectory,
    indexPath: plan.indexPath,
    indexHtmlPath: plan.indexHtmlPath,
    endpoint: health?.endpoint ?? `http://${endpoint.host}:${endpoint.port}`,
    symbols
  };

  if (plan.selection) {
    result.selection = plan.selection;
  }

  const macros = macroMetadataCopy(plan.macros);
  if (macros) {
    result.macros = macros;
  }

  if (target) {
    result.target = target;
  }

  if (setupError) {
    result.error = setupError;
  }

  await fileSystem.writeFile(
    plan.indexPath,
    renderChartbookIndexMarkdown(plan, result)
  );
  await fileSystem.writeFile(
    plan.indexHtmlPath,
    renderChartbookIndexHtml(plan, result)
  );

  return result;
}
