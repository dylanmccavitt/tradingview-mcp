import type { CdpEndpoint } from "./cdp.js";
import { fetchCdpJson, formatCdpEndpoint } from "./cdp.js";
import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS,
  resolveTradingViewApp,
  TRADINGVIEW_APP_PATH_ENV,
  type ResolveTradingViewAppOptions,
  type TradingViewAppResolution
} from "./desktop.js";
import {
  findTradingViewChartTarget,
  normalizeCdpTargets,
  type CdpTarget
} from "./targets.js";

export type TradingViewHealthStatus =
  | "healthy"
  | "missing-app"
  | "cdp-unreachable"
  | "cdp-invalid-response"
  | "no-chart-target";

export interface CdpBrowserVersion {
  browser: string;
  protocolVersion: string;
  userAgent?: string;
  webSocketDebuggerUrl?: string;
}

export interface TradingViewHealthResult {
  ok: boolean;
  status: TradingViewHealthStatus;
  message: string;
  endpoint: string;
  nextSteps: string[];
  checkedAt: string;
  app: TradingViewAppResolution;
  browser?: CdpBrowserVersion;
  target?: CdpTarget;
  targetCount?: number;
}

export type CdpJsonFetcher = (
  pathname: string,
  options: CdpEndpoint & {
    timeoutMs: number;
  }
) => Promise<unknown>;

export interface CheckTradingViewHealthOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
  appPath?: string;
  env?: NodeJS.ProcessEnv;
  fetchJson?: CdpJsonFetcher;
  fileExists?: (path: string) => boolean | Promise<boolean>;
  now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : undefined;
}

function normalizeBrowserVersion(value: unknown): CdpBrowserVersion | null {
  if (!isRecord(value)) {
    return null;
  }

  const browser = stringValue(value, "Browser");
  const protocolVersion = stringValue(value, "Protocol-Version");

  if (!browser || !protocolVersion) {
    return null;
  }

  const userAgent = stringValue(value, "User-Agent");
  const webSocketDebuggerUrl = stringValue(value, "webSocketDebuggerUrl");
  const version: CdpBrowserVersion = {
    browser,
    protocolVersion
  };

  if (userAgent) {
    version.userAgent = userAgent;
  }

  if (webSocketDebuggerUrl) {
    version.webSocketDebuggerUrl = webSocketDebuggerUrl;
  }

  return version;
}

function baseResult(
  status: TradingViewHealthStatus,
  options: {
    message: string;
    endpoint: string;
    nextSteps: string[];
    checkedAt: string;
    app: TradingViewAppResolution;
    browser?: CdpBrowserVersion;
    target?: CdpTarget;
    targetCount?: number;
  }
): TradingViewHealthResult {
  const result: TradingViewHealthResult = {
    ok: status === "healthy",
    status,
    message: options.message,
    endpoint: options.endpoint,
    nextSteps: options.nextSteps,
    checkedAt: options.checkedAt,
    app: options.app
  };

  if (options.browser) {
    result.browser = options.browser;
  }

  if (options.target) {
    result.target = options.target;
  }

  if (typeof options.targetCount === "number") {
    result.targetCount = options.targetCount;
  }

  return result;
}

export async function checkTradingViewHealth(
  options: CheckTradingViewHealthOptions = {}
): Promise<TradingViewHealthResult> {
  const endpoint = {
    host: options.host ?? DEFAULT_CDP_HOST,
    port: options.port ?? DEFAULT_CDP_PORT
  };
  const timeoutMs = options.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS;
  const endpointUrl = formatCdpEndpoint(endpoint);
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const appOptions: ResolveTradingViewAppOptions = {};

  if (options.appPath) {
    appOptions.appPath = options.appPath;
  }

  if (options.env) {
    appOptions.env = options.env;
  }

  if (options.fileExists) {
    appOptions.fileExists = options.fileExists;
  }

  const app = await resolveTradingViewApp(appOptions);
  const fetchJson = options.fetchJson ?? fetchCdpJson;

  let browser: CdpBrowserVersion;

  try {
    const versionJson = await fetchJson("/json/version", {
      ...endpoint,
      timeoutMs
    });
    const normalizedBrowser = normalizeBrowserVersion(versionJson);

    if (!normalizedBrowser) {
      return baseResult("cdp-invalid-response", {
        message:
          "CDP responded at /json/version, but the response did not include Browser and Protocol-Version fields.",
        endpoint: endpointUrl,
        checkedAt,
        app,
        nextSteps: [
          "Confirm the port belongs to TradingView Desktop launched with CDP enabled.",
          "Try a different --port if another Chromium app is using this CDP endpoint."
        ]
      });
    }

    browser = normalizedBrowser;
  } catch {
    if (!app.found) {
      return baseResult("missing-app", {
        message:
          "TradingView Desktop was not found and CDP is not reachable.",
        endpoint: endpointUrl,
        checkedAt,
        app,
        nextSteps: [
          "Install TradingView Desktop for macOS.",
          `Set ${TRADINGVIEW_APP_PATH_ENV} or pass --app when TradingView is installed outside /Applications.`,
          "After installing, run npm run tv:launch and then npm run tv:health."
        ]
      });
    }

    return baseResult("cdp-unreachable", {
      message: `CDP is not reachable at ${endpointUrl}. TradingView may be closed, launched without --remote-debugging-port, or running on a different port.`,
      endpoint: endpointUrl,
      checkedAt,
      app,
      nextSteps: [
        "Quit TradingView Desktop if it is already running without CDP.",
        `Launch it with npm run tv:launch -- --port ${endpoint.port}.`,
        "If you used another port, re-run health with npm run tv:health -- --port <port>."
      ]
    });
  }

  let targets: CdpTarget[];

  try {
    const targetsJson = await fetchJson("/json/list", {
      ...endpoint,
      timeoutMs
    });
    const normalizedTargets = normalizeCdpTargets(targetsJson);

    if (!normalizedTargets) {
      return baseResult("cdp-invalid-response", {
        message:
          "CDP responded at /json/list, but the response was not a target array.",
        endpoint: endpointUrl,
        checkedAt,
        app,
        browser,
        nextSteps: [
          "Confirm the port belongs to TradingView Desktop launched with CDP enabled.",
          "Try a different --port if another Chromium app is using this CDP endpoint."
        ]
      });
    }

    targets = normalizedTargets;
  } catch {
    return baseResult("cdp-unreachable", {
      message: `CDP version metadata responded at ${endpointUrl}, but /json/list could not be reached.`,
      endpoint: endpointUrl,
      checkedAt,
      app,
      browser,
      nextSteps: [
        "Re-run npm run tv:health to rule out a transient startup race.",
        "If the problem persists, quit TradingView Desktop and launch it again with npm run tv:launch."
      ]
    });
  }

  const target = findTradingViewChartTarget(targets);

  if (!target) {
    return baseResult("no-chart-target", {
      message:
        "CDP is reachable, but no active TradingView chart target was found.",
      endpoint: endpointUrl,
      checkedAt,
      app,
      browser,
      targetCount: targets.length,
      nextSteps: [
        "Open a TradingView chart tab in TradingView Desktop.",
        "If a chart is already open, focus or reload it and run npm run tv:health again."
      ]
    });
  }

  return baseResult("healthy", {
    message: `TradingView Desktop CDP is reachable and chart target ${target.id} is available.`,
    endpoint: endpointUrl,
    checkedAt,
    app,
    browser,
    target,
    targetCount: targets.length,
    nextSteps: [
      "Keep TradingView Desktop open while using later chart-control tools."
    ]
  });
}
