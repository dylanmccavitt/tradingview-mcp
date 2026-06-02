import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { parseChartAnalysisProfile } from "../chart-analysis/chart-facts.js";
import type { ChartAnalysisProfileName } from "../domain.js";
import { normalizeTradingViewSymbol } from "../tradingview/chart-plan.js";
import {
  parseUniverseConfigJson,
  resolveUniverseSelection,
  UniverseConfigError,
  type ResolvedUniverseSymbol,
  type UniverseSelectionTier
} from "../universe/config.js";

export interface QuantScanArtifactPaths {
  runDir?: string;
  scanJson?: string;
  summaryMd?: string;
  chartbookUniverseLocalJson?: string;
  chartbookCommandTxt?: string;
}

export interface QuantScanSymbolMetadata {
  runId?: string;
  scanRank?: number;
  setupLane?: string;
  matchingLanes: string[];
  score?: number;
  trigger?: string;
  invalidation?: string;
  warnings: string[];
  sourceArtifactPaths: QuantScanArtifactPaths;
}

export interface QuantScanChartbookSymbol extends ResolvedUniverseSymbol {
  quantScan?: QuantScanSymbolMetadata;
}

export interface QuantScanHandoffInput {
  symbols: QuantScanChartbookSymbol[];
  profile?: ChartAnalysisProfileName;
  selection: {
    configPath: string;
    groups: string[] | "all";
    tier: UniverseSelectionTier;
  };
}

export class QuantScanHandoffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuantScanHandoffError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => optionalString(item))
    .filter((item): item is string => typeof item === "string");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveInputPaths(inputPath: string): Promise<{
  scanJsonPath?: string;
  universePath?: string;
}> {
  const resolved = resolve(inputPath);

  if (resolved.endsWith("scan.json")) {
    return {
      scanJsonPath: resolved
    };
  }

  if (resolved.endsWith("chartbook.universe.local.json")) {
    const siblingScanJson = join(dirname(resolved), "scan.json");
    return {
      universePath: resolved,
      ...(await pathExists(siblingScanJson)
        ? {
            scanJsonPath: siblingScanJson
          }
        : {})
    };
  }

  const scanJsonPath = join(resolved, "scan.json");
  const universePath = join(resolved, "chartbook.universe.local.json");
  return {
    scanJsonPath,
    ...(await pathExists(universePath)
      ? {
          universePath
        }
      : {})
  };
}

function sourcePathsFromScan(
  scanJsonPath: string | undefined,
  scanPayload: Record<string, unknown> | undefined,
  universePath: string | undefined
): QuantScanArtifactPaths {
  const metadata = isRecord(scanPayload?.metadata) ? scanPayload.metadata : {};
  const artifactPaths = isRecord(metadata.artifact_paths)
    ? metadata.artifact_paths
    : {};
  const sourcePaths: QuantScanArtifactPaths = {};

  const runDir = optionalString(artifactPaths.run_dir);
  if (runDir) {
    sourcePaths.runDir = runDir;
  }

  const scanJson = optionalString(artifactPaths.scan_json) ?? scanJsonPath;
  if (scanJson) {
    sourcePaths.scanJson = scanJson;
  }

  const summaryMd = optionalString(artifactPaths.summary_md);
  if (summaryMd) {
    sourcePaths.summaryMd = summaryMd;
  }

  const chartbookUniverse =
    optionalString(artifactPaths.chartbook_universe_local_json) ?? universePath;
  if (chartbookUniverse) {
    sourcePaths.chartbookUniverseLocalJson = chartbookUniverse;
  }

  const chartbookCommand = optionalString(artifactPaths.chartbook_command_txt);
  if (chartbookCommand) {
    sourcePaths.chartbookCommandTxt = chartbookCommand;
  }

  return sourcePaths;
}

function profileFromScan(
  scanPayload: Record<string, unknown> | undefined
): ChartAnalysisProfileName | undefined {
  if (!scanPayload) {
    return undefined;
  }

  const chartbook = isRecord(scanPayload.chartbook) ? scanPayload.chartbook : {};
  const profile = optionalString(chartbook.profile);
  return profile ? parseChartAnalysisProfile(profile) : undefined;
}

function runIdFromScan(
  scanPayload: Record<string, unknown> | undefined
): string | undefined {
  const metadata = isRecord(scanPayload?.metadata) ? scanPayload.metadata : {};
  return optionalString(metadata.run_id);
}

function symbolFromCandidate(
  candidate: Record<string, unknown>
): string | undefined {
  const tradingViewMetadata = isRecord(candidate.tradingview_metadata)
    ? candidate.tradingview_metadata
    : {};
  const symbol = optionalString(tradingViewMetadata.symbol);

  return symbol ? normalizeTradingViewSymbol(symbol) : undefined;
}

function candidateMetadataMap(
  scanPayload: Record<string, unknown> | undefined,
  sourceArtifactPaths: QuantScanArtifactPaths,
  runId: string | undefined
): Map<string, QuantScanSymbolMetadata> {
  const bySymbol = new Map<string, QuantScanSymbolMetadata>();
  const candidates = Array.isArray(scanPayload?.selected_candidates)
    ? scanPayload.selected_candidates
    : [];

  for (const [index, value] of candidates.entries()) {
    if (!isRecord(value)) {
      continue;
    }

    const symbol = symbolFromCandidate(value);
    if (!symbol || bySymbol.has(symbol)) {
      continue;
    }

    const scoreBreakdown = isRecord(value.score_breakdown)
      ? value.score_breakdown
      : {};
    const metadata: QuantScanSymbolMetadata = {
      matchingLanes: stringArray(value.matching_lanes),
      warnings: stringArray(value.warnings),
      sourceArtifactPaths: {
        ...sourceArtifactPaths
      },
      scanRank: index + 1
    };

    if (runId) {
      metadata.runId = runId;
    }

    const setupLane = optionalString(value.primary_lane);
    if (setupLane) {
      metadata.setupLane = setupLane;
    }

    const score = optionalNumber(scoreBreakdown.primary_score);
    if (typeof score === "number") {
      metadata.score = score;
    }

    const trigger = optionalString(value.trigger);
    if (trigger) {
      metadata.trigger = trigger;
    }

    const invalidation = optionalString(value.invalidation);
    if (invalidation) {
      metadata.invalidation = invalidation;
    }

    bySymbol.set(symbol, metadata);
  }

  return bySymbol;
}

function selectedSymbolsFromScan(
  scanPayload: Record<string, unknown> | undefined
): string[] | undefined {
  if (!scanPayload) {
    return undefined;
  }

  const chartbook = isRecord(scanPayload.chartbook) ? scanPayload.chartbook : {};
  const status = optionalString(chartbook.status);
  const selectedSymbolsValue = chartbook.selected_symbols;

  if (!Array.isArray(selectedSymbolsValue)) {
    throw new QuantScanHandoffError(
      "Quant Scan chartbook.selected_symbols must be an array of exchange-qualified symbols."
    );
  }

  const selectedSymbols = selectedSymbolsValue.map((symbol, index) => {
    if (typeof symbol !== "string" || symbol.trim() === "") {
      throw new QuantScanHandoffError(
        `Quant Scan chartbook.selected_symbols[${index}] must be a non-empty string.`
      );
    }

    return normalizeTradingViewSymbol(symbol);
  });

  if (status === "no_selected_candidates" || selectedSymbols.length === 0) {
    throw new QuantScanHandoffError(
      "Quant Scan handoff does not contain selected chartbook candidates; refusing to invent symbols."
    );
  }

  return selectedSymbols;
}

async function readJsonFile(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new QuantScanHandoffError(`${path} is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

export async function loadQuantScanHandoffInput(
  inputPath: string
): Promise<QuantScanHandoffInput> {
  const { scanJsonPath, universePath: discoveredUniversePath } =
    await resolveInputPaths(inputPath);
  let scanPayload: Record<string, unknown> | undefined;

  if (scanJsonPath && (await pathExists(scanJsonPath))) {
    const parsed = await readJsonFile(scanJsonPath);
    if (!isRecord(parsed)) {
      throw new QuantScanHandoffError(`${scanJsonPath} must contain a JSON object.`);
    }
    scanPayload = parsed;
  } else if (!discoveredUniversePath) {
    throw new QuantScanHandoffError(
      `${resolve(inputPath)} must be a Quant Scan run directory, scan.json, or chartbook.universe.local.json file.`
    );
  }

  const metadata = isRecord(scanPayload?.metadata) ? scanPayload.metadata : {};
  const artifactPaths = isRecord(metadata.artifact_paths)
    ? metadata.artifact_paths
    : {};
  const universePath =
    discoveredUniversePath ??
    optionalString(artifactPaths.chartbook_universe_local_json);

  if (!universePath) {
    throw new QuantScanHandoffError(
      "Quant Scan scan.json does not reference chartbook_universe_local_json."
    );
  }

  const parsedUniverse = await readFile(resolve(universePath), "utf8");
  let symbols: QuantScanChartbookSymbol[];

  try {
    const universeConfig = parseUniverseConfigJson(parsedUniverse, resolve(universePath));
    const chartbook = isRecord(scanPayload?.chartbook) ? scanPayload.chartbook : {};
    const groupId = optionalString(chartbook.group_id) ?? "scan-candidates";
    const tier = optionalString(chartbook.tier) ?? "core";
    const selectionTier =
      tier === "extended" || tier === "all" ? tier : "core";
    symbols = resolveUniverseSelection(universeConfig, {
      groupIds: [groupId],
      tier: selectionTier
    });
  } catch (error: unknown) {
    if (error instanceof UniverseConfigError) {
      throw new QuantScanHandoffError(error.message);
    }

    throw error;
  }

  const selectedSymbols = selectedSymbolsFromScan(scanPayload);
  if (selectedSymbols) {
    const bySymbol = new Map(symbols.map((symbol) => [symbol.symbol, symbol]));
    symbols = selectedSymbols.map((symbol) => {
      const resolvedSymbol = bySymbol.get(symbol);
      if (!resolvedSymbol) {
        throw new QuantScanHandoffError(
          `Quant Scan selected symbol ${symbol} is missing from chartbook.universe.local.json.`
        );
      }

      return resolvedSymbol;
    });
  }

  if (symbols.length === 0) {
    throw new QuantScanHandoffError(
      "Quant Scan handoff resolved zero symbols; refusing to invent chartbook input."
    );
  }

  const sourceArtifactPaths = sourcePathsFromScan(
    scanJsonPath,
    scanPayload,
    resolve(universePath)
  );
  const runId = runIdFromScan(scanPayload);
  const metadataBySymbol = candidateMetadataMap(
    scanPayload,
    sourceArtifactPaths,
    runId
  );
  const withMetadata = symbols.map((symbol) => {
    const quantScan = metadataBySymbol.get(symbol.symbol);
    return quantScan
      ? {
          ...symbol,
          quantScan
        }
      : symbol;
  });
  const chartbook = isRecord(scanPayload?.chartbook) ? scanPayload.chartbook : {};
  const groupId = optionalString(chartbook.group_id) ?? "scan-candidates";
  const tier = optionalString(chartbook.tier) ?? "core";
  const selectionTier = tier === "extended" || tier === "all" ? tier : "core";

  const result: QuantScanHandoffInput = {
    symbols: withMetadata,
    selection: {
      configPath: resolve(universePath),
      groups: [groupId],
      tier: selectionTier
    }
  };
  const profile = profileFromScan(scanPayload);
  if (profile) {
    result.profile = profile;
  }

  return result;
}
