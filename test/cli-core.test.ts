import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import type {
  ChartbookResult,
  RunChartbookOptions
} from "../src/chartbook/chartbook.js";
import { runCli } from "../src/cli.js";
import {
  RAW_AUTOMATION_ENV,
  type RawEvaluateOptions,
  type RawFindElementOptions,
  type RawScrollOptions,
  type RawSelectorClickOptions,
  type RawSelectorHoverOptions
} from "../src/tradingview/raw-automation.js";
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
    indexHtmlPath: `/tmp/chartbooks/${sessionId}/index.html`,
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

void test("CLI raw commands are gated by the explicit raw automation env", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let rawCalled = false;

  const exitCode = await runCli(
    ["raw", "evaluate", "--expression", "document.title"],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      env: {},
      handlers: {
        runRawEvaluate: () => {
          rawCalled = true;
          return Promise.resolve({
            ok: true,
            action: "evaluate",
            endpoint: "http://127.0.0.1:9222",
            executedAt: "2026-06-02T14:30:00.000Z",
            warnings: []
          });
        }
      }
    }
  );

  assert.equal(exitCode, 2);
  assert.equal(stdout.join(""), "");
  assert.equal(rawCalled, false);
  assert.match(stderr.join(""), /TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION=1/);
});

void test("CLI raw evaluate parses arguments and returns compact JSON when enabled", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let capturedOptions: RawEvaluateOptions | undefined;

  const exitCode = await runCli(
    [
      "raw",
      "evaluate",
      "--expression",
      "document.title",
      "--max-result-bytes",
      "128",
      "--port",
      "9223",
      "--json"
    ],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      env: {
        [RAW_AUTOMATION_ENV]: "1"
      },
      handlers: {
        runRawEvaluate: (options) => {
          capturedOptions = options;
          return Promise.resolve({
            ok: true,
            action: "evaluate",
            endpoint: "http://127.0.0.1:9223",
            executedAt: "2026-06-02T14:30:00.000Z",
            value: "NVDA Chart",
            warnings: []
          });
        }
      }
    }
  );

  const parsed = JSON.parse(stdout.join("")) as Record<string, unknown>;

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.equal(capturedOptions?.expression, "document.title");
  assert.equal(capturedOptions?.port, 9223);
  assert.equal(capturedOptions?.maxResultBytes, 128);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.action, "evaluate");
  assert.equal(parsed.value, "NVDA Chart");
});

void test("CLI raw input commands parse click, keypress, and text payloads", async () => {
  const calls: string[] = [];
  const runOptions = {
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawClick: (options: { x: number; y: number; button?: string }) => {
        calls.push(`click:${options.x},${options.y}:${options.button ?? "left"}`);
        return Promise.resolve({
          ok: true,
          action: "click" as const,
          endpoint: "http://127.0.0.1:9222",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawKeypress: (options: { key: string }) => {
        calls.push(`keypress:${options.key}`);
        return Promise.resolve({
          ok: true,
          action: "keypress" as const,
          endpoint: "http://127.0.0.1:9222",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawTypeText: (options: { text: string }) => {
        calls.push(`type-text:${options.text}`);
        return Promise.resolve({
          ok: true,
          action: "type-text" as const,
          endpoint: "http://127.0.0.1:9222",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      }
    }
  };

  const clickCode = await runCli(
    ["raw", "click", "--x", "10", "--y", "20", "--button", "right"],
    {
      stdout: captureStream([]),
      stderr: captureStream([])
    },
    runOptions
  );
  const keyCode = await runCli(
    ["raw", "keypress", "--key", "Escape"],
    {
      stdout: captureStream([]),
      stderr: captureStream([])
    },
    runOptions
  );
  const textCode = await runCli(
    ["raw", "type-text", "--text", "NASDAQ:NVDA"],
    {
      stdout: captureStream([]),
      stderr: captureStream([])
    },
    runOptions
  );

  assert.equal(clickCode, 0);
  assert.equal(keyCode, 0);
  assert.equal(textCode, 0);
  assert.deepEqual(calls, [
    "click:10,20:right",
    "keypress:Escape",
    "type-text:NASDAQ:NVDA"
  ]);
});

void test("CLI raw selector and scroll commands parse bounded payloads", async () => {
  const calls: string[] = [];
  const runOptions = {
    env: {
      [RAW_AUTOMATION_ENV]: "1"
    },
    handlers: {
      runRawFindElement: (options: RawFindElementOptions) => {
        calls.push(
          `find:${options.strategy}:${options.value}:${options.maxMatches}`
        );
        return Promise.resolve({
          ok: true,
          action: "find-element" as const,
          endpoint: "http://127.0.0.1:9222",
          executedAt: "2026-06-02T14:30:00.000Z",
          value: {
            count: 1,
            elements: []
          },
          warnings: []
        });
      },
      runRawSelectorClick: (options: RawSelectorClickOptions) => {
        calls.push(
          `selector-click:${options.strategy}:${options.value}:${options.matchIndex}:${options.clickMethod}`
        );
        return Promise.resolve({
          ok: true,
          action: "selector-click" as const,
          endpoint: "http://127.0.0.1:9222",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawSelectorHover: (options: RawSelectorHoverOptions) => {
        calls.push(
          `selector-hover:${options.strategy}:${options.value}:${options.matchIndex}`
        );
        return Promise.resolve({
          ok: true,
          action: "selector-hover" as const,
          endpoint: "http://127.0.0.1:9222",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      },
      runRawScroll: (options: RawScrollOptions) => {
        calls.push(
          `scroll:${options.direction}:${options.amount}:${options.x}:${options.y}`
        );
        return Promise.resolve({
          ok: true,
          action: "scroll" as const,
          endpoint: "http://127.0.0.1:9222",
          executedAt: "2026-06-02T14:30:00.000Z",
          warnings: []
        });
      }
    }
  };

  const findCode = await runCli(
    [
      "raw",
      "find-element",
      "--strategy",
      "text",
      "--value",
      "Watchlist",
      "--max-matches",
      "3"
    ],
    {
      stdout: captureStream([]),
      stderr: captureStream([])
    },
    runOptions
  );
  const clickCode = await runCli(
    [
      "raw",
      "selector-click",
      "--strategy",
      "css",
      "--value",
      "[data-name=watchlist-button]",
      "--match-index",
      "1",
      "--click-method",
      "dom"
    ],
    {
      stdout: captureStream([]),
      stderr: captureStream([])
    },
    runOptions
  );
  const hoverCode = await runCli(
    [
      "raw",
      "selector-hover",
      "--strategy",
      "aria-label",
      "--value",
      "Watchlist",
      "--match-index",
      "0"
    ],
    {
      stdout: captureStream([]),
      stderr: captureStream([])
    },
    runOptions
  );
  const scrollCode = await runCli(
    ["raw", "scroll", "--direction", "down", "--amount", "300", "--x", "10"],
    {
      stdout: captureStream([]),
      stderr: captureStream([])
    },
    runOptions
  );

  assert.equal(findCode, 0);
  assert.equal(clickCode, 0);
  assert.equal(hoverCode, 0);
  assert.equal(scrollCode, 0);
  assert.deepEqual(calls, [
    "find:text:Watchlist:3",
    "selector-click:css:[data-name=watchlist-button]:1:dom",
    "selector-hover:aria-label:Watchlist:0",
    "scroll:down:300:10:undefined"
  ]);
});
