import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  DEFAULT_CHART_ANALYSIS_PROFILE,
  buildChartFacts,
  type ChartFacts
} from "../chart-analysis/chart-facts.js";
import type { ChartAnalysisProfileName } from "../domain.js";
import {
  DEFAULT_RENDER_SETTLE_MS,
  DEFAULT_RENDER_TIMEOUT_MS
} from "./chart-plan.js";
import {
  createLiveTradingViewChartPageClient
} from "./chart-page.js";
import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS
} from "./desktop.js";
import {
  checkTradingViewHealth,
  type CheckTradingViewHealthOptions,
  type TradingViewHealthResult
} from "./health.js";
import {
  createLiveTradingViewPineDrawingPageClient,
  type TradingViewPineDrawingPageClient
} from "./pine-drawing-page.js";
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
} from "./pine-drawings.js";
import type { CdpTarget } from "./targets.js";

export const CURRENT_CHART_CAPTURE_SCHEMA_VERSION = 2;
export const DEFAULT_CURRENT_CHART_CAPTURE_OUTPUT_ROOT =
  "artifacts/tradingview-current-chart";

interface CurrentChartCaptureFileSystem {
  mkdir: (
    path: string,
    options: {
      recursive: true;
    }
  ) => Promise<unknown>;
  writeFile: (path: string, data: string | Buffer) => Promise<unknown>;
}

interface CurrentChartScreenshotClient {
  captureScreenshot(): Promise<Buffer>;
  close(): Promise<void>;
}

export interface CurrentChartCapturePlan {
  schemaVersion: typeof CURRENT_CHART_CAPTURE_SCHEMA_VERSION;
  captureId: string;
  capturedAt: string;
  outputRoot: string;
  outputDirectory: string;
  screenshotPath: string;
  levelsJsonPath: string;
}

export interface CurrentChartCaptureExtraction {
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

export interface CurrentChartCaptureArtifact {
  schemaVersion: typeof CURRENT_CHART_CAPTURE_SCHEMA_VERSION;
  ok: boolean;
  captureId: string;
  capturedAt: string;
  profile: ChartAnalysisProfileName;
  target?: CdpTarget;
  paths: {
    screenshot: string;
    levelsJson: string;
  };
  screenshot: {
    ok: boolean;
    error?: string;
  };
  extraction: CurrentChartCaptureExtraction;
}

export interface CurrentChartCaptureResult {
  ok: boolean;
  schemaVersion: typeof CURRENT_CHART_CAPTURE_SCHEMA_VERSION;
  captureId: string;
  capturedAt: string;
  outputDirectory: string;
  screenshotPath: string;
  levelsJsonPath: string;
  endpoint: string;
  screenshotOk: boolean;
  extractionOk: boolean;
  levelsJsonOk: boolean;
  facts: ChartFacts;
  target?: CdpTarget;
  error?: string;
  warnings: string[];
}

export interface CaptureCurrentChartOptions {
  outputRoot?: string;
  captureId?: string;
  profile?: ChartAnalysisProfileName;
  studyName?: string;
  host?: string;
  port?: number;
  timeoutMs?: number;
  appPath?: string;
  debug?: boolean;
  now?: () => Date;
  checkHealth?: (
    options: CheckTradingViewHealthOptions
  ) => Promise<TradingViewHealthResult>;
  chartClientFactory?: (
    target: CdpTarget,
    options: {
      timeoutMs: number;
    }
  ) => Promise<CurrentChartScreenshotClient>;
  drawingClientFactory?: (
    target: CdpTarget,
    options: {
      timeoutMs: number;
    }
  ) => Promise<TradingViewPineDrawingPageClient>;
  fileSystem?: CurrentChartCaptureFileSystem;
}

export class CurrentChartCapturePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurrentChartCapturePlanError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatCaptureDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function slugifyCurrentChartCaptureId(value: string): string {
  const slug = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug || slug === "." || slug === "..") {
    throw new CurrentChartCapturePlanError(
      "Current chart capture id must contain at least one letter or number."
    );
  }

  return slug;
}

export function buildCurrentChartCapturePlan(options: {
  outputRoot?: string | undefined;
  captureId?: string | undefined;
  capturedAt?: Date | undefined;
} = {}): CurrentChartCapturePlan {
  const capturedAt = options.capturedAt ?? new Date();
  const captureId = slugifyCurrentChartCaptureId(
    options.captureId ?? formatCaptureDate(capturedAt)
  );
  const outputRoot = resolve(
    options.outputRoot ?? DEFAULT_CURRENT_CHART_CAPTURE_OUTPUT_ROOT
  );
  const outputDirectory = join(outputRoot, captureId);

  return {
    schemaVersion: CURRENT_CHART_CAPTURE_SCHEMA_VERSION,
    captureId,
    capturedAt: capturedAt.toISOString(),
    outputRoot,
    outputDirectory,
    screenshotPath: join(outputDirectory, "current-chart.png"),
    levelsJsonPath: join(outputDirectory, "current-chart-levels.json")
  };
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
): CurrentChartCaptureExtraction {
  const empty = emptyDrawings();
  const extraction: CurrentChartCaptureExtraction = {
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

function extractionFromData(
  data: PineDrawingExtractionData,
  extractedAt: string,
  endpoint: string | undefined,
  profile: ChartAnalysisProfileName
): CurrentChartCaptureExtraction {
  const extraction: CurrentChartCaptureExtraction = {
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

  return extraction;
}

function combinedExtractionWarnings(
  extraction: CurrentChartCaptureExtraction
): string[] {
  return [...new Set([...extraction.warnings, ...extraction.facts.warnings])];
}

function buildArtifact(options: {
  plan: CurrentChartCapturePlan;
  target?: CdpTarget | undefined;
  screenshotOk: boolean;
  screenshotError?: string | undefined;
  extraction: CurrentChartCaptureExtraction;
}): CurrentChartCaptureArtifact {
  const screenshot = options.screenshotOk
    ? {
        ok: true
      }
    : {
        ok: false,
        error: options.screenshotError ?? "Screenshot was not captured."
      };
  const artifact: CurrentChartCaptureArtifact = {
    schemaVersion: CURRENT_CHART_CAPTURE_SCHEMA_VERSION,
    ok: screenshot.ok && options.extraction.ok,
    captureId: options.plan.captureId,
    capturedAt: options.plan.capturedAt,
    profile: options.extraction.facts.profile,
    paths: {
      screenshot: "current-chart.png",
      levelsJson: "current-chart-levels.json"
    },
    screenshot,
    extraction: options.extraction
  };

  if (options.target) {
    artifact.target = options.target;
  }

  return artifact;
}

function resultFromArtifact(options: {
  plan: CurrentChartCapturePlan;
  endpoint: string;
  target?: CdpTarget | undefined;
  artifact: CurrentChartCaptureArtifact;
  levelsJsonOk: boolean;
  levelsJsonError?: string | undefined;
}): CurrentChartCaptureResult {
  const errors: string[] = [];

  if (options.artifact.screenshot.error) {
    errors.push(options.artifact.screenshot.error);
  }

  if (options.artifact.extraction.error) {
    errors.push(options.artifact.extraction.error);
  }

  if (options.levelsJsonError) {
    errors.push(options.levelsJsonError);
  }

  const result: CurrentChartCaptureResult = {
    ok: options.artifact.ok && options.levelsJsonOk,
    schemaVersion: CURRENT_CHART_CAPTURE_SCHEMA_VERSION,
    captureId: options.plan.captureId,
    capturedAt: options.plan.capturedAt,
    outputDirectory: options.plan.outputDirectory,
    screenshotPath: options.plan.screenshotPath,
    levelsJsonPath: options.plan.levelsJsonPath,
    endpoint: options.endpoint,
    screenshotOk: options.artifact.screenshot.ok,
    extractionOk: options.artifact.extraction.ok,
    levelsJsonOk: options.levelsJsonOk,
    facts: options.artifact.extraction.facts,
    warnings: combinedExtractionWarnings(options.artifact.extraction)
  };

  if (options.target) {
    result.target = options.target;
  }

  if (errors.length > 0) {
    result.error = errors.join("; ");
  }

  return result;
}

async function writeLevelsArtifact(
  fileSystem: CurrentChartCaptureFileSystem,
  path: string,
  artifact: CurrentChartCaptureArtifact
): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await fileSystem.writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`);
    return {
      ok: true
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: `Could not write levels JSON: ${errorMessage(error)}`
    };
  }
}

export async function captureCurrentChart(
  options: CaptureCurrentChartOptions = {}
): Promise<CurrentChartCaptureResult> {
  const capturedAt = (options.now ?? (() => new Date()))();
  const plan = buildCurrentChartCapturePlan({
    outputRoot: options.outputRoot,
    captureId: options.captureId,
    capturedAt
  });
  const endpoint = {
    host: options.host ?? DEFAULT_CDP_HOST,
    port: options.port ?? DEFAULT_CDP_PORT
  };
  const timeoutMs = options.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS;
  const studyName = options.studyName ?? DEFAULT_PINE_DRAWING_STUDY_NAME;
  const profile = options.profile ?? DEFAULT_CHART_ANALYSIS_PROFILE;
  const debug = options.debug ?? false;
  const fileSystem = options.fileSystem ?? {
    mkdir,
    writeFile
  };
  const healthOptions: CheckTradingViewHealthOptions = {
    ...endpoint,
    timeoutMs
  };

  if (options.appPath) {
    healthOptions.appPath = options.appPath;
  }

  await fileSystem.mkdir(plan.outputDirectory, {
    recursive: true
  });

  const healthCheck = options.checkHealth ?? checkTradingViewHealth;
  let health: TradingViewHealthResult | undefined;
  let setupError: string | undefined;

  try {
    health = await healthCheck(healthOptions);
  } catch (error: unknown) {
    setupError = `TradingView health check failed: ${errorMessage(error)}`;
  }

  if (health && (!health.ok || !health.target)) {
    setupError = health.message;
  }

  const target = health?.target;
  const webSocketDebuggerUrl = target?.webSocketDebuggerUrl;

  if (!setupError && target && !webSocketDebuggerUrl) {
    setupError =
      "TradingView chart target does not expose a page WebSocket debugger URL.";
  }

  let chartClient: CurrentChartScreenshotClient | undefined;
  let drawingClient: TradingViewPineDrawingPageClient | undefined;
  let screenshotOk = false;
  let screenshotError: string | undefined;
  let extraction = skippedExtraction(
    studyName,
    plan.capturedAt,
    setupError ?? "TradingView chart client is unavailable.",
    profile,
    health?.endpoint
  );

  try {
    if (!setupError && target && webSocketDebuggerUrl) {
      const makeChartClient =
        options.chartClientFactory ??
        ((_target, clientOptions) =>
          createLiveTradingViewChartPageClient(webSocketDebuggerUrl, {
            timeoutMs: clientOptions.timeoutMs,
            renderTimeoutMs: DEFAULT_RENDER_TIMEOUT_MS,
            renderSettleMs: DEFAULT_RENDER_SETTLE_MS
          }));

      try {
        chartClient = await makeChartClient(target, {
          timeoutMs
        });
        const screenshot = await chartClient.captureScreenshot();
        await fileSystem.writeFile(plan.screenshotPath, screenshot);
        screenshotOk = true;
      } catch (error: unknown) {
        screenshotError = errorMessage(error);
        extraction = skippedExtraction(
          studyName,
          plan.capturedAt,
          "Skipped drawing extraction because screenshot capture failed.",
          profile,
          health?.endpoint
        );
      }

      if (screenshotOk) {
        const makeDrawingClient =
          options.drawingClientFactory ??
          ((_target, clientOptions) =>
            createLiveTradingViewPineDrawingPageClient(
              webSocketDebuggerUrl,
              clientOptions
            ));

        try {
          drawingClient = await makeDrawingClient(target, {
            timeoutMs
          });
          const payload = await drawingClient.readDrawingPayload({
            studyName,
            debug
          });
          extraction = extractionFromData(
            normalizePineDrawingPayload(payload, {
              studyName,
              debug
            }),
            plan.capturedAt,
            health?.endpoint,
            profile
          );
        } catch (error: unknown) {
          extraction = skippedExtraction(
            studyName,
            plan.capturedAt,
            errorMessage(error),
            profile,
            health?.endpoint
          );
        }
      }
    }
  } finally {
    await chartClient?.close();
    await drawingClient?.close();
  }

  if (target && !extraction.chart?.url) {
    extraction.chart = {
      url: target.url,
      title: target.title
    };
  }

  const artifact = buildArtifact({
    plan,
    target,
    screenshotOk,
    screenshotError,
    extraction
  });
  const levelsWrite = await writeLevelsArtifact(
    fileSystem,
    plan.levelsJsonPath,
    artifact
  );

  return resultFromArtifact({
    plan,
    endpoint: health?.endpoint ?? `http://${endpoint.host}:${endpoint.port}`,
    target,
    artifact,
    levelsJsonOk: levelsWrite.ok,
    levelsJsonError: levelsWrite.error
  });
}
