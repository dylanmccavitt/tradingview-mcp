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
  type PineDrawingExtractionData
} from "./pine-drawings.js";
import type { CdpTarget } from "./targets.js";

export interface ExtractPineDrawingsOptions {
  studyName?: string;
  host?: string;
  port?: number;
  timeoutMs?: number;
  appPath?: string;
  debug?: boolean;
  checkHealth?: (
    options: CheckTradingViewHealthOptions
  ) => Promise<TradingViewHealthResult>;
  pageClientFactory?: (
    target: CdpTarget,
    options: {
      timeoutMs: number;
    }
  ) => Promise<TradingViewPineDrawingPageClient>;
  now?: () => Date;
}

export interface ExtractPineDrawingsResult
  extends PineDrawingExtractionData {
  endpoint: string;
  target?: CdpTarget;
  extractedAt: string;
  error?: string;
}

function emptyExtraction(studyName: string): PineDrawingExtractionData {
  const drawings = {
    levels: [],
    zones: [],
    labels: [],
    tables: []
  };

  return {
    ok: false,
    studyName,
    drawings,
    counts: {
      levels: 0,
      zones: 0,
      labels: 0,
      tables: 0
    },
    warnings: []
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function extractPineDrawings(
  options: ExtractPineDrawingsOptions = {}
): Promise<ExtractPineDrawingsResult> {
  const endpoint = {
    host: options.host ?? DEFAULT_CDP_HOST,
    port: options.port ?? DEFAULT_CDP_PORT
  };
  const timeoutMs = options.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS;
  const studyName = options.studyName ?? DEFAULT_PINE_DRAWING_STUDY_NAME;
  const debug = options.debug ?? false;
  const extractedAt = (options.now ?? (() => new Date()))().toISOString();
  const healthOptions: CheckTradingViewHealthOptions = {
    ...endpoint,
    timeoutMs
  };

  if (options.appPath) {
    healthOptions.appPath = options.appPath;
  }

  const healthCheck = options.checkHealth ?? checkTradingViewHealth;
  const health = await healthCheck(healthOptions);

  if (!health.ok || !health.target) {
    const extraction = emptyExtraction(studyName);
    return {
      ...extraction,
      endpoint: health.endpoint,
      extractedAt,
      error: health.message,
      warnings: [...extraction.warnings, ...health.nextSteps]
    };
  }

  const webSocketDebuggerUrl = health.target.webSocketDebuggerUrl;

  if (!webSocketDebuggerUrl) {
    const extraction = emptyExtraction(studyName);
    return {
      ...extraction,
      endpoint: health.endpoint,
      target: health.target,
      extractedAt,
      error:
        "TradingView chart target does not expose a page WebSocket debugger URL.",
      warnings: extraction.warnings
    };
  }

  const makeClient =
    options.pageClientFactory ??
    ((_target, clientOptions) =>
      createLiveTradingViewPineDrawingPageClient(
        webSocketDebuggerUrl,
        clientOptions
      ));

  let client: TradingViewPineDrawingPageClient;

  try {
    client = await makeClient(health.target, {
      timeoutMs
    });
  } catch (error: unknown) {
    const extraction = emptyExtraction(studyName);
    return {
      ...extraction,
      endpoint: health.endpoint,
      target: health.target,
      extractedAt,
      error: `Could not connect to TradingView chart target: ${errorMessage(error)}`,
      warnings: extraction.warnings
    };
  }

  try {
    const payload = await client.readDrawingPayload({
      studyName,
      debug
    });
    const extraction = normalizePineDrawingPayload(payload, {
      studyName,
      debug
    });

    return {
      ...extraction,
      endpoint: health.endpoint,
      target: health.target,
      extractedAt
    };
  } catch (error: unknown) {
    const extraction = emptyExtraction(studyName);
    return {
      ...extraction,
      endpoint: health.endpoint,
      target: health.target,
      extractedAt,
      error: errorMessage(error),
      warnings: extraction.warnings
    };
  } finally {
    await client.close();
  }
}
