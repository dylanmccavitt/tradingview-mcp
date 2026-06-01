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
  preset: string;
  profile: ChartAnalysisProfileName;
  selection?: ChartbookSelectionSummary;
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
  endpoint: string;
  selection?: ChartbookSelectionSummary;
  target?: CdpTarget;
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
    preset,
    profile,
    symbols
  };

  const selection = selectionCopy(options.selection);
  if (selection) {
    plan.selection = selection;
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
  plan: Pick<ChartbookPlan, "capturedAt" | "preset" | "profile">,
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

  return {
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
}

function markdownList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
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
  const rangeFacts = daily ?? weekly ?? intraday;

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
    plan: Pick<ChartbookPlan, "capturedAt" | "preset" | "profile">;
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
    endpoint: health?.endpoint ?? `http://${endpoint.host}:${endpoint.port}`,
    symbols
  };

  if (plan.selection) {
    result.selection = plan.selection;
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

  return result;
}
