import {
  connectCdpClient,
  type CdpClient
} from "./cdp-session.js";
import {
  DEFAULT_PINE_DRAWING_STUDY_NAME,
  DEFAULT_PINE_DRAWING_STUDY_SHORT_TITLE
} from "./pine-drawings.js";

export interface TradingViewPineDrawingPageClient {
  readDrawingPayload(options: {
    studyName: string;
    debug: boolean;
  }): Promise<unknown>;
  close(): Promise<void>;
}

export interface CreateLiveTradingViewPineDrawingPageClientOptions {
  timeoutMs: number;
}

interface RuntimeEvaluateResponse {
  result?: {
    value?: unknown;
  };
  exceptionDetails?: unknown;
}

function studyNameAliases(studyName: string): string[] {
  const aliases = [studyName];

  if (studyName === DEFAULT_PINE_DRAWING_STUDY_NAME) {
    aliases.push(DEFAULT_PINE_DRAWING_STUDY_SHORT_TITLE);
  }

  return aliases;
}

function drawingPayloadExpression(studyName: string, debug: boolean): string {
  return `(() => {
  const studyName = ${JSON.stringify(studyName)};
  const aliases = ${JSON.stringify(studyNameAliases(studyName))};
  const debug = ${JSON.stringify(debug)};
  const maxLegendTexts = debug ? 80 : 25;

  const normalize = (value) => String(value || "").trim().replace(/\\s+/g, " ").toLowerCase();
  const containsStudy = (value) => {
    const normalized = normalize(value);
    return aliases.some((alias) => normalized.includes(normalize(alias)));
  };
  const matchesStudy = (value) => {
    const normalized = normalize(value);
    return aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      return normalized === normalizedAlias || normalized.startsWith(normalizedAlias + " ");
    });
  };
  const compactString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  const safeCall = (target, method) => {
    try {
      if (target && typeof target[method] === "function") {
        return target[method]();
      }
    } catch {
      return undefined;
    }
    return undefined;
  };
  const compactStudy = (value, source) => {
    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value;
    const name =
      compactString(record.studyName) ||
      compactString(record.visibleStudyName) ||
      compactString(record.name) ||
      compactString(record.title) ||
      compactString(record.description) ||
      compactString(record.shortTitle) ||
      compactString(record.shortName);

    const legendText = compactString(record.legendText);
    if (!name && !legendText) {
      return null;
    }

    if (!matchesStudy(name || "") && !matchesStudy(legendText || "")) {
      return null;
    }

    const study = {
      id: compactString(record.id),
      name: name || studyName,
      shortTitle: compactString(record.shortTitle) || compactString(record.shortName),
      legendText,
      source
    };

    for (const key of ["lines", "levels", "plots", "priceScalePlots", "boxes", "zones", "labels", "tables"]) {
      if (Array.isArray(record[key])) {
        study[key] = record[key].slice(0, debug ? 200 : 80);
      }
    }

    return study;
  };
  const uniqueTexts = (nodes) => {
    const seen = new Set();
    const texts = [];
    for (const node of nodes) {
      const text = compactString(node.textContent || node.getAttribute?.("aria-label") || node.getAttribute?.("title"));
      if (!text || seen.has(text)) {
        continue;
      }
      seen.add(text);
      texts.push(text);
      if (texts.length >= maxLegendTexts) {
        break;
      }
    }
    return texts;
  };

  const currentUrl = new URL(window.location.href);
  const chart = {
    url: window.location.href,
    title: document.title,
    symbol: currentUrl.searchParams.get("symbol") || undefined,
    interval: currentUrl.searchParams.get("interval") || undefined
  };
  const studies = [];

  const fixture = window.__TVMCP_OBJECTIVE_OVERLAY_PAYLOAD__;
  if (fixture && typeof fixture === "object") {
    const fixtureStudies = Array.isArray(fixture.studies) ? fixture.studies : [fixture.study || fixture];
    for (const value of fixtureStudies) {
      const study = compactStudy(value, "window.__TVMCP_OBJECTIVE_OVERLAY_PAYLOAD__");
      if (study) {
        studies.push(study);
      }
    }
  }

  const widgets = [
    window.tvWidget,
    window.tradingViewWidget,
    window.widget,
    window.chartWidget
  ].filter(Boolean);

  for (const widget of widgets) {
    const chartApi = safeCall(widget, "activeChart") || safeCall(widget, "chart");
    const allStudies = safeCall(chartApi, "getAllStudies");
    if (Array.isArray(allStudies)) {
      for (const studyInfo of allStudies) {
        const study = compactStudy(studyInfo, "chart-api.getAllStudies");
        if (study) {
          const studyApi = typeof chartApi.getStudyById === "function" && study.id ? safeCall({
            getStudyById: () => chartApi.getStudyById(study.id)
          }, "getStudyById") : undefined;
          for (const key of ["getPlots", "getLines", "getLabels", "getBoxes", "getTables"]) {
            const values = safeCall(studyApi, key);
            if (Array.isArray(values)) {
              const targetKey = key.replace(/^get/, "").toLowerCase();
              study[targetKey] = values.slice(0, debug ? 200 : 80);
            }
          }
          studies.push(study);
        }
      }
    }
  }

  const legendNodes = Array.from(document.querySelectorAll([
    "[data-name*='legend']",
    "[class*='legend']",
    "[aria-label*='TVMCP']",
    "[title*='TVMCP']"
  ].join(",")));
  const legendTexts = uniqueTexts(legendNodes);
  const matchingLegendText = legendTexts.find(matchesStudy);
  const containingLegendText = legendTexts.find((text) => !matchesStudy(text) && containsStudy(text));
  if (matchingLegendText || containingLegendText) {
    studies.push({
      name: matchingLegendText || studyName,
      legendText: matchingLegendText,
      legendFullText: containingLegendText,
      source: "legend-dom"
    });
  }

  return {
    schemaVersion: 1,
    chart,
    studies,
    diagnostics: {
      studyName,
      aliases,
      matchedStudyCount: studies.length,
      legendTexts: debug ? legendTexts : legendTexts.filter((text) => matchesStudy(text) || containsStudy(text))
    }
  };
})()`;
}

export class LiveTradingViewPineDrawingPageClient
  implements TradingViewPineDrawingPageClient
{
  readonly #client: CdpClient;

  constructor(client: CdpClient) {
    this.#client = client;
  }

  async readDrawingPayload(options: {
    studyName: string;
    debug: boolean;
  }): Promise<unknown> {
    const response = await this.#client.send<RuntimeEvaluateResponse>(
      "Runtime.evaluate",
      {
        expression: drawingPayloadExpression(options.studyName, options.debug),
        returnByValue: true
      }
    );

    if (response.exceptionDetails) {
      throw new Error("TradingView drawing extraction probe threw an exception.");
    }

    return response.result?.value ?? {};
  }

  async close(): Promise<void> {
    await this.#client.close();
  }
}

export async function createLiveTradingViewPineDrawingPageClient(
  webSocketDebuggerUrl: string,
  options: CreateLiveTradingViewPineDrawingPageClientOptions
): Promise<TradingViewPineDrawingPageClient> {
  const client = await connectCdpClient(webSocketDebuggerUrl, {
    timeoutMs: options.timeoutMs
  });

  await client.send("Page.enable");
  await client.send("Runtime.enable");

  return new LiveTradingViewPineDrawingPageClient(client);
}
