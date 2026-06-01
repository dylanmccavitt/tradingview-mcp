import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import type {
  ChartbookResult,
  RunChartbookOptions
} from "../src/chartbook/chartbook.js";
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
import type { UniverseConfig } from "../src/universe/config.js";

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

const chartbookUniverseConfig: UniverseConfig = {
  version: 1,
  groups: [
    {
      id: "semis",
      label: "Semiconductors",
      tags: ["semis"],
      core: [
        {
          symbol: "NASDAQ:NVDA",
          alias: "NVDA",
          name: "NVIDIA",
          tags: ["gpu"]
        },
        {
          symbol: "NASDAQ:AMD",
          alias: "AMD",
          name: "Advanced Micro Devices",
          tags: ["gpu"]
        }
      ],
      extended: []
    }
  ]
};

function chartbookResultFromOptions(
  options: RunChartbookOptions
): ChartbookResult {
  const sessionId = options.sessionId ?? "session-a";

  return {
    ok: true,
    schemaVersion: 2,
    sessionId,
    capturedAt: "2026-06-01T17:30:00.000Z",
    preset: options.preset ?? "levels",
    profile: options.profile ?? "focus",
    sessionDirectory: `/tmp/chartbooks/${sessionId}`,
    indexPath: `/tmp/chartbooks/${sessionId}/index.md`,
    endpoint: `http://${options.host ?? "127.0.0.1"}:${options.port ?? 9222}`,
    ...(options.selection
      ? {
          selection: options.selection
        }
      : {}),
    symbols: options.symbols.map((symbol) => {
      const symbolSlug = symbol.symbol.replace(":", "-");
      const result = {
        symbol: symbol.symbol,
        alias: symbol.alias,
        tags: [...symbol.tags],
        groups: [...symbol.groups],
        tiers: [...symbol.tiers],
        ok: true,
        symbolSlug,
        directory: `/tmp/chartbooks/${sessionId}/${symbolSlug}`,
        notesPath: `/tmp/chartbooks/${sessionId}/${symbolSlug}/notes.md`,
        timeframes: []
      };

      return symbol.name
        ? {
            ...result,
            name: symbol.name
          }
        : result;
    })
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

void test("CLI parses chartbook profile and preserves selected universe order", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let capturedOptions: RunChartbookOptions | undefined;

  const exitCode = await runCli(
    [
      "chartbook",
      "--config",
      "/tmp/universe.json",
      "--group",
      "semis",
      "--tier",
      "core",
      "--profile",
      "momentum",
      "--session",
      "manual-review",
      "--port",
      "9223",
      "--output-dir",
      "/tmp/chartbooks"
    ],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      handlers: {
        loadUniverseConfig: (configPath) => {
          assert.equal(configPath, "/tmp/universe.json");
          return Promise.resolve(chartbookUniverseConfig);
        },
        runChartbook: (options) => {
          capturedOptions = options;
          return Promise.resolve(chartbookResultFromOptions(options));
        }
      }
    }
  );

  const output = stdout.join("");

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.equal(capturedOptions?.profile, "momentum");
  assert.deepEqual(
    capturedOptions?.symbols.map((symbol) => symbol.symbol),
    ["NASDAQ:NVDA", "NASDAQ:AMD"]
  );
  assert.deepEqual(capturedOptions?.selection, {
    configPath: "/tmp/universe.json",
    groups: ["semis"],
    tier: "core"
  });
  assert.match(output, /Status: success/);
  assert.match(output, /Profile: momentum/);
  assert.doesNotMatch(output, /score|rank|recommend/i);
});

void test("CLI rejects unsupported chartbook profiles before loading config", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let configLoaded = false;
  let chartbookRan = false;

  const exitCode = await runCli(
    ["chartbook", "--profile", "scanner"],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      handlers: {
        loadUniverseConfig: () => {
          configLoaded = true;
          return Promise.resolve(chartbookUniverseConfig);
        },
        runChartbook: (options) => {
          chartbookRan = true;
          return Promise.resolve(chartbookResultFromOptions(options));
        }
      }
    }
  );

  assert.equal(exitCode, 2);
  assert.equal(stdout.join(""), "");
  assert.equal(configLoaded, false);
  assert.equal(chartbookRan, false);
  assert.match(stderr.join(""), /Chart-analysis profile must be one of/);
});
