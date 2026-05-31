export interface CdpTarget {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : undefined;
}

export function normalizeCdpTarget(value: unknown): CdpTarget | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = optionalString(value, "id");
  const title = optionalString(value, "title");
  const type = optionalString(value, "type");
  const url = optionalString(value, "url");

  if (!id || !title || !type || !url) {
    return null;
  }

  const webSocketDebuggerUrl = optionalString(value, "webSocketDebuggerUrl");
  const target: CdpTarget = {
    id,
    title,
    type,
    url
  };

  if (webSocketDebuggerUrl) {
    target.webSocketDebuggerUrl = webSocketDebuggerUrl;
  }

  return target;
}

export function normalizeCdpTargets(value: unknown): CdpTarget[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const targets: CdpTarget[] = [];

  for (const item of value) {
    const target = normalizeCdpTarget(item);
    if (target) {
      targets.push(target);
    }
  }

  return targets;
}

export function isTradingViewChartTarget(target: CdpTarget): boolean {
  if (target.type !== "page") {
    return false;
  }

  let parsed: URL;

  try {
    parsed = new URL(target.url);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isTradingViewHost =
    hostname === "tradingview.com" || hostname.endsWith(".tradingview.com");

  if (!isTradingViewHost) {
    return false;
  }

  return parsed.pathname === "/chart" || parsed.pathname.startsWith("/chart/");
}

export function findTradingViewChartTarget(
  targets: readonly CdpTarget[]
): CdpTarget | null {
  return targets.find((target) => isTradingViewChartTarget(target)) ?? null;
}
