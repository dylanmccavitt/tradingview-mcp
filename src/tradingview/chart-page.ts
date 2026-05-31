import type { ChartTimeframePlan } from "./chart-plan.js";
import {
  connectCdpClient,
  type CdpClient
} from "./cdp-session.js";

export interface TradingViewChartPageClient {
  navigate(url: string): Promise<void>;
  waitForRender(plan: ChartTimeframePlan): Promise<void>;
  captureScreenshot(): Promise<Buffer>;
  close(): Promise<void>;
}

export interface CreateLiveTradingViewChartPageClientOptions {
  timeoutMs: number;
  renderTimeoutMs: number;
  renderSettleMs: number;
}

interface RuntimeEvaluateResponse {
  result?: {
    value?: unknown;
  };
  exceptionDetails?: unknown;
}

interface PageCaptureScreenshotResponse {
  data?: unknown;
}

interface RenderProbeState {
  ready: boolean;
  symbolMatches: boolean;
  intervalMatches: boolean;
  hasSizedCanvas: boolean;
  href: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRenderProbeState(value: unknown): value is RenderProbeState {
  return (
    isRecord(value) &&
    typeof value.ready === "boolean" &&
    typeof value.symbolMatches === "boolean" &&
    typeof value.intervalMatches === "boolean" &&
    typeof value.hasSizedCanvas === "boolean" &&
    typeof value.href === "string"
  );
}

function renderProbeExpression(plan: ChartTimeframePlan): string {
  return `(() => {
  const expectedSymbol = ${JSON.stringify(plan.symbol)};
  const expectedInterval = ${JSON.stringify(plan.interval)};
  const currentUrl = new URL(window.location.href);
  const canvases = Array.from(document.querySelectorAll("canvas"));

  return {
    ready: document.readyState === "complete" || document.readyState === "interactive",
    symbolMatches: currentUrl.searchParams.get("symbol") === expectedSymbol,
    intervalMatches: currentUrl.searchParams.get("interval") === expectedInterval,
    hasSizedCanvas: canvases.some((canvas) => canvas.width > 0 && canvas.height > 0),
    href: window.location.href
  };
})()`;
}

export class LiveTradingViewChartPageClient
  implements TradingViewChartPageClient
{
  readonly #client: CdpClient;
  readonly #renderTimeoutMs: number;
  readonly #renderSettleMs: number;

  constructor(
    client: CdpClient,
    options: Pick<
      CreateLiveTradingViewChartPageClientOptions,
      "renderTimeoutMs" | "renderSettleMs"
    >
  ) {
    this.#client = client;
    this.#renderTimeoutMs = options.renderTimeoutMs;
    this.#renderSettleMs = options.renderSettleMs;
  }

  async navigate(url: string): Promise<void> {
    await this.#client.send("Page.bringToFront");
    await this.#client.send("Page.navigate", {
      url
    });
  }

  async waitForRender(plan: ChartTimeframePlan): Promise<void> {
    const startedAt = Date.now();
    let lastState: RenderProbeState | null = null;

    while (Date.now() - startedAt < this.#renderTimeoutMs) {
      const state = await this.#readRenderState(plan);
      if (state) {
        lastState = state;
      }

      if (
        state?.ready &&
        state.symbolMatches &&
        state.intervalMatches &&
        state.hasSizedCanvas
      ) {
        await delay(this.#renderSettleMs);
        return;
      }

      await delay(250);
    }

    const stateText = lastState ? JSON.stringify(lastState) : "unavailable";
    throw new Error(
      `TradingView chart did not finish rendering ${plan.label} ${plan.symbol} before ${this.#renderTimeoutMs}ms. Last state: ${stateText}`
    );
  }

  async captureScreenshot(): Promise<Buffer> {
    const response = await this.#client.send<PageCaptureScreenshotResponse>(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true
      }
    );

    if (typeof response.data !== "string" || response.data.length === 0) {
      throw new Error("CDP Page.captureScreenshot did not return PNG data.");
    }

    return Buffer.from(response.data, "base64");
  }

  async close(): Promise<void> {
    await this.#client.close();
  }

  async #readRenderState(
    plan: ChartTimeframePlan
  ): Promise<RenderProbeState | null> {
    const response = await this.#client.send<RuntimeEvaluateResponse>(
      "Runtime.evaluate",
      {
        expression: renderProbeExpression(plan),
        returnByValue: true
      }
    );

    if (response.exceptionDetails) {
      return null;
    }

    const value = response.result?.value;
    return isRenderProbeState(value) ? value : null;
  }
}

export async function createLiveTradingViewChartPageClient(
  webSocketDebuggerUrl: string,
  options: CreateLiveTradingViewChartPageClientOptions
): Promise<TradingViewChartPageClient> {
  const client = await connectCdpClient(webSocketDebuggerUrl, {
    timeoutMs: options.timeoutMs
  });

  await client.send("Page.enable");
  await client.send("Runtime.enable");

  return new LiveTradingViewChartPageClient(client, options);
}
