import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import { runCli } from "../src/cli.js";
import type { ChartOneSymbolOptions, ChartOneSymbolResult } from "../src/tradingview/chart-runner.js";
import type {
  LaunchTradingViewDesktopOptions,
  TradingViewLaunchResult
} from "../src/tradingview/desktop.js";
import type {
  CheckTradingViewHealthOptions,
  TradingViewHealthResult
} from "../src/tradingview/health.js";

function captureStream(chunks: string[]): Writable {
  return new Writable({
    write(
      chunk: Buffer | string,
      _encoding: BufferEncoding,
      callback: (error?: Error | null) => void
    ) {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      callback();
    }
  });
}

function healthyResult(port: number): TradingViewHealthResult {
  return {
    ok: true,
    status: "healthy",
    message: "TradingView Desktop CDP is reachable.",
    endpoint: `http://127.0.0.1:${port}`,
    nextSteps: [],
    checkedAt: "2026-06-01T17:30:00.000Z",
    app: {
      found: true,
      executablePath: "/Applications/TradingView.app/Contents/MacOS/TradingView",
      checkedPaths: ["/Applications/TradingView.app/Contents/MacOS/TradingView"],
      source: "option"
    },
    browser: {
      browser: "TradingView/1.0",
      protocolVersion: "1.3",
      webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/test`
    },
    target: {
      id: "chart-target",
      title: "NVDA Chart",
      type: "page",
      url: "https://www.tradingview.com/chart/abc/?symbol=NASDAQ%3ANVDA",
      webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/chart-target`
    },
    targetCount: 1
  };
}

function chartResult(symbol: string): ChartOneSymbolResult {
  return {
    ok: true,
    symbol,
    outputDirectory: `/tmp/charts/${symbol.replace(":", "-")}`,
    endpoint: "http://127.0.0.1:9223",
    results: [
      {
        symbol,
        timeframe: "weekly",
        interval: "1W",
        url: "https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA&interval=1W",
        outputPath: "/tmp/charts/NASDAQ-NVDA/NASDAQ-NVDA-weekly.png",
        ok: true
      }
    ]
  };
}

function launchResult(port: number): TradingViewLaunchResult {
  return {
    ok: true,
    message: `Launched TradingView Desktop with CDP on http://127.0.0.1:${port}.`,
    endpoint: `http://127.0.0.1:${port}`,
    command: {
      command: "/Applications/TradingView.app/Contents/MacOS/TradingView",
      args: [`--remote-debugging-port=${port}`]
    },
    pid: 1234,
    nextSteps: ["Open a TradingView chart tab."]
  };
}

void test("CLI parses health arguments and formats human status", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let capturedOptions: CheckTradingViewHealthOptions | undefined;

  const exitCode = await runCli(
    [
      "health",
      "--port",
      "9223",
      "--timeout-ms",
      "4000",
      "--app",
      "/Applications/TradingView.app"
    ],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      handlers: {
        checkTradingViewHealth: (options) => {
          capturedOptions = options;
          return Promise.resolve(healthyResult(options?.port ?? 9222));
        }
      }
    }
  );

  const output = stdout.join("");

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.equal(capturedOptions?.port, 9223);
  assert.equal(capturedOptions?.timeoutMs, 4000);
  assert.equal(capturedOptions?.appPath, "/Applications/TradingView.app");
  assert.match(output, /Status: healthy/);
  assert.match(output, /OK: yes/);
  assert.match(output, /Browser: TradingView\/1\.0 \(CDP 1\.3\)/);
  assert.match(output, /Chart target: NVDA Chart/);
});

void test("CLI parses chart arguments and formats timeframe results", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let capturedOptions: ChartOneSymbolOptions | undefined;

  const exitCode = await runCli(
    [
      "chart",
      "NASDAQ:NVDA",
      "--port",
      "9223",
      "--output-dir",
      "/tmp/charts",
      "--render-timeout-ms",
      "5000"
    ],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      handlers: {
        chartOneSymbol: (options) => {
          capturedOptions = options;
          return Promise.resolve(chartResult(options.symbol));
        }
      }
    }
  );

  const output = stdout.join("");

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.equal(capturedOptions?.symbol, "NASDAQ:NVDA");
  assert.equal(capturedOptions?.port, 9223);
  assert.equal(capturedOptions?.outputRoot, "/tmp/charts");
  assert.equal(capturedOptions?.renderTimeoutMs, 5000);
  assert.match(output, /Status: success/);
  assert.match(output, /Symbol: NASDAQ:NVDA/);
  assert.match(output, /weekly \(1W\): OK \/tmp\/charts\/NASDAQ-NVDA\/NASDAQ-NVDA-weekly\.png/);
});

void test("CLI parses launch arguments and formats next steps", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let capturedOptions: LaunchTradingViewDesktopOptions | undefined;

  const exitCode = await runCli(
    ["launch", "--port", "9333", "--app", "/Applications/TradingView.app"],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      handlers: {
        launchTradingViewDesktop: (options) => {
          capturedOptions = options;
          return Promise.resolve(launchResult(options.port));
        }
      }
    }
  );

  const output = stdout.join("");

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.equal(capturedOptions?.port, 9333);
  assert.equal(capturedOptions?.appPath, "/Applications/TradingView.app");
  assert.match(output, /Launched TradingView Desktop with CDP/);
  assert.match(output, /Command: \/Applications\/TradingView\.app\/Contents\/MacOS\/TradingView --remote-debugging-port=9333/);
  assert.match(output, /- Open a TradingView chart tab\./);
});
