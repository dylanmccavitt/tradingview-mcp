import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import { runCli } from "../src/cli.js";
import type {
  ChartUniverseOptions,
  ChartUniverseResult
} from "../src/tradingview/chart-universe-runner.js";

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

function fakeChartUniverseResult(
  options: {
    ok?: boolean;
    groups?: string[];
    tier?: "core" | "extended" | "all";
  } = {}
): ChartUniverseResult {
  const ok = options.ok ?? true;
  const tier = options.tier ?? "core";

  return {
    ok,
    configPath: "/tmp/universe.json",
    selection: {
      configPath: "/tmp/universe.json",
      groups: options.groups ?? ["semis"],
      tier
    },
    symbols: [
      {
        symbol: {
          symbol: "NASDAQ:NVDA",
          alias: "NVDA",
          name: "NVIDIA",
          tags: ["semis", "gpu"],
          groups: ["semis"],
          tiers: ["core"]
        },
        chart: {
          ok,
          symbol: "NASDAQ:NVDA",
          outputDirectory: "/tmp/charts/NASDAQ-NVDA",
          endpoint: "http://127.0.0.1:9223",
          results: [
            {
              symbol: "NASDAQ:NVDA",
              timeframe: "daily",
              interval: "1D",
              url: "https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA&interval=1D",
              outputPath: "/tmp/charts/NASDAQ-NVDA/NASDAQ-NVDA-daily.png",
              ok
            }
          ]
        }
      }
    ]
  };
}

void test("CLI exposes chart-universe in help output", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const exitCode = await runCli(["--help"], {
    stdout: captureStream(stdout),
    stderr: captureStream(stderr)
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.match(stdout.join(""), /tradingview-mcp-cli chart-universe/);
  assert.match(stdout.join(""), /npm run tv:chart-universe/);
});

void test("CLI parses chart-universe arguments and formats human output", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let capturedOptions: ChartUniverseOptions | undefined;

  const exitCode = await runCli(
    [
      "chart-universe",
      "--config",
      "/tmp/universe.json",
      "--group",
      "semis,ai-software",
      "--tier",
      "extended",
      "--port",
      "9223",
      "--output-dir",
      "/tmp/charts",
      "--render-timeout-ms",
      "5000",
      "--render-settle-ms",
      "100"
    ],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      handlers: {
        chartUniverse: (options) => {
          capturedOptions = options;
          return Promise.resolve(
            fakeChartUniverseResult({
              groups: ["semis", "ai-software"],
              tier: "extended"
            })
          );
        }
      }
    }
  );

  const output = stdout.join("");

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.deepEqual(capturedOptions?.groupIds, ["semis", "ai-software"]);
  assert.equal(capturedOptions?.tier, "extended");
  assert.equal(capturedOptions?.port, 9223);
  assert.equal(capturedOptions?.outputRoot, "/tmp/charts");
  assert.equal(capturedOptions?.renderTimeoutMs, 5000);
  assert.equal(capturedOptions?.renderSettleMs, 100);
  assert.match(output, /Status: success/);
  assert.match(output, /Selection: groups semis, ai-software, tier extended/);
  assert.match(output, /- NASDAQ:NVDA \(NVDA\): OK \/tmp\/charts\/NASDAQ-NVDA/);
  assert.match(output, /daily: OK \/tmp\/charts\/NASDAQ-NVDA\/NASDAQ-NVDA-daily\.png/);
});

void test("CLI formats chart-universe JSON output", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const exitCode = await runCli(
    ["chart-universe", "--group", "semis", "--json"],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      handlers: {
        chartUniverse: () => Promise.resolve(fakeChartUniverseResult())
      }
    }
  );

  const parsed = JSON.parse(stdout.join("")) as ChartUniverseResult;

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.selection.groups, ["semis"]);
  assert.equal(parsed.symbols[0]?.symbol.symbol, "NASDAQ:NVDA");
});

void test("CLI rejects invalid chart-universe tiers before running charting", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let chartUniverseCalled = false;

  const exitCode = await runCli(
    ["chart-universe", "--tier", "fast"],
    {
      stdout: captureStream(stdout),
      stderr: captureStream(stderr)
    },
    {
      handlers: {
        chartUniverse: () => {
          chartUniverseCalled = true;
          return Promise.resolve(fakeChartUniverseResult());
        }
      }
    }
  );

  assert.equal(exitCode, 2);
  assert.equal(chartUniverseCalled, false);
  assert.equal(stdout.join(""), "");
  assert.match(stderr.join(""), /--tier must be core, extended, or all/);
});
