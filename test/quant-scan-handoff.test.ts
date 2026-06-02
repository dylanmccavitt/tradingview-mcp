import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadQuantScanHandoffInput,
  QuantScanHandoffError
} from "../src/chartbook/quant-scan-handoff.js";

async function writeQuantScanRun(options: {
  selectedSymbols?: string[];
  candidates?: unknown[];
} = {}): Promise<string> {
  const runDir = await mkdtemp(join(tmpdir(), "tvmcp-quant-scan-"));
  const scanJsonPath = join(runDir, "scan.json");
  const summaryPath = join(runDir, "summary.md");
  const chartbookUniversePath = join(runDir, "chartbook.universe.local.json");
  const commandPath = join(runDir, "chartbook-command.txt");
  const selectedSymbols = options.selectedSymbols ?? ["NASDAQ:AMD", "NASDAQ:NVDA"];
  const candidates =
    options.candidates ??
    [
      candidate("AMD", "NASDAQ:AMD", "squeeze", 88.5),
      candidate("NVDA", "NASDAQ:NVDA", "momentum", 91.5)
    ];

  await writeFile(
    chartbookUniversePath,
    `${JSON.stringify(
      {
        version: 1,
        groups: [
          {
            id: "scan-candidates",
            label: "Quant Scan Candidates",
            tags: ["quant-scan", "stock-setup"],
            core: [
              {
                symbol: "NASDAQ:AMD",
                alias: "AMD",
                name: "Advanced Micro Devices",
                tags: ["quant-scan", "squeeze"]
              },
              {
                symbol: "NASDAQ:NVDA",
                alias: "NVDA",
                name: "NVIDIA",
                tags: ["quant-scan", "momentum"]
              }
            ],
            extended: [
              {
                symbol: "NASDAQ:AMD",
                alias: "AMD",
                tags: ["quant-scan", "squeeze"]
              },
              {
                symbol: "NASDAQ:NVDA",
                alias: "NVDA",
                tags: ["quant-scan", "momentum"]
              }
            ]
          }
        ]
      },
      null,
      2
    )}\n`
  );
  await writeFile(summaryPath, "# Summary\n");
  await writeFile(commandPath, "npm run tv:chartbook -- --group scan-candidates\n");
  await writeFile(
    scanJsonPath,
    `${JSON.stringify(
      {
        metadata: {
          run_id: "setup-scan-fixture",
          artifact_paths: {
            run_dir: runDir,
            scan_json: scanJsonPath,
            summary_md: summaryPath,
            chartbook_universe_local_json: chartbookUniversePath,
            chartbook_command_txt: commandPath
          }
        },
        chartbook: {
          status: selectedSymbols.length > 0 ? "ready" : "no_selected_candidates",
          group_id: "scan-candidates",
          tier: "core",
          profile: "squeeze",
          selected_symbols: selectedSymbols,
          universe_schema_version: 1
        },
        selected_candidates: candidates
      },
      null,
      2
    )}\n`
  );

  return runDir;
}

function candidate(
  ticker: string,
  symbol: string,
  lane: string,
  score: number
): Record<string, unknown> {
  return {
    ticker,
    tradingview_metadata: {
      symbol,
      alias: ticker,
      name: ticker,
      tags: [lane],
      groups: ["fixtures"],
      tiers: ["core"]
    },
    matching_lanes: [lane],
    primary_lane: lane,
    trigger: `${ticker} trigger`,
    invalidation: `${ticker} invalidation`,
    warnings: [`${ticker} warning`],
    score_breakdown: {
      primary_score: score
    }
  };
}

void test("Quant Scan scan.json handoff preserves explicit chart order and candidate metadata", async () => {
  const runDir = await writeQuantScanRun();

  try {
    const handoff = await loadQuantScanHandoffInput(join(runDir, "scan.json"));

    assert.equal(handoff.profile, "squeeze");
    assert.deepEqual(
      handoff.symbols.map((symbol) => symbol.symbol),
      ["NASDAQ:AMD", "NASDAQ:NVDA"]
    );
    assert.equal(handoff.selection.configPath, join(runDir, "chartbook.universe.local.json"));
    assert.deepEqual(handoff.selection.groups, ["scan-candidates"]);
    assert.equal(handoff.selection.tier, "core");

    const amd = handoff.symbols[0];
    assert.equal(amd?.quantScan?.runId, "setup-scan-fixture");
    assert.equal(amd?.quantScan?.scanRank, 1);
    assert.equal(amd?.quantScan?.setupLane, "squeeze");
    assert.equal(amd?.quantScan?.score, 88.5);
    assert.equal(amd?.quantScan?.trigger, "AMD trigger");
    assert.equal(amd?.quantScan?.invalidation, "AMD invalidation");
    assert.deepEqual(amd?.quantScan?.matchingLanes, ["squeeze"]);
    assert.deepEqual(amd?.quantScan?.warnings, ["AMD warning"]);
    assert.equal(amd?.quantScan?.sourceArtifactPaths.scanJson, join(runDir, "scan.json"));
    assert.equal(
      amd?.quantScan?.sourceArtifactPaths.chartbookUniverseLocalJson,
      join(runDir, "chartbook.universe.local.json")
    );
  } finally {
    await rm(runDir, {
      recursive: true,
      force: true
    });
  }
});

void test("Quant Scan chartbook universe handoff uses sibling scan.json metadata when present", async () => {
  const runDir = await writeQuantScanRun();

  try {
    const handoff = await loadQuantScanHandoffInput(
      join(runDir, "chartbook.universe.local.json")
    );

    assert.deepEqual(
      handoff.symbols.map((symbol) => symbol.quantScan?.scanRank),
      [1, 2]
    );
    assert.equal(handoff.symbols[1]?.quantScan?.setupLane, "momentum");
  } finally {
    await rm(runDir, {
      recursive: true,
      force: true
    });
  }
});

void test("Quant Scan universe-only handoff preserves file order without inventing setup metadata", async () => {
  const runDir = await writeQuantScanRun();
  await rm(join(runDir, "scan.json"));

  try {
    const handoff = await loadQuantScanHandoffInput(
      join(runDir, "chartbook.universe.local.json")
    );

    assert.equal(handoff.profile, undefined);
    assert.deepEqual(
      handoff.symbols.map((symbol) => symbol.symbol),
      ["NASDAQ:AMD", "NASDAQ:NVDA"]
    );
    assert.equal(handoff.symbols[0]?.quantScan, undefined);
  } finally {
    await rm(runDir, {
      recursive: true,
      force: true
    });
  }
});

void test("Quant Scan handoff rejects no-candidate scan artifacts", async () => {
  const runDir = await writeQuantScanRun({
    selectedSymbols: [],
    candidates: []
  });

  try {
    await assert.rejects(
      () => loadQuantScanHandoffInput(join(runDir, "scan.json")),
      QuantScanHandoffError
    );
  } finally {
    await rm(runDir, {
      recursive: true,
      force: true
    });
  }
});

void test("Quant Scan handoff rejects malformed selected symbols instead of dropping them", async () => {
  const runDir = await writeQuantScanRun({
    selectedSymbols: ["NASDAQ:AMD", "NASDAQ:NVDA"]
  });
  const scanJsonPath = join(runDir, "scan.json");
  const payload = JSON.parse(await readFile(scanJsonPath, "utf8")) as {
    chartbook: {
      selected_symbols: unknown[];
    };
  };
  payload.chartbook.selected_symbols = ["NASDAQ:AMD", 123, "NASDAQ:NVDA"];
  await writeFile(scanJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

  try {
    await assert.rejects(
      () => loadQuantScanHandoffInput(scanJsonPath),
      /selected_symbols\[1\] must be a non-empty string/
    );
  } finally {
    await rm(runDir, {
      recursive: true,
      force: true
    });
  }
});

void test("Quant Scan handoff rejects malformed universe files", async () => {
  const runDir = await writeQuantScanRun();
  await writeFile(join(runDir, "chartbook.universe.local.json"), "{}\n");

  try {
    await assert.rejects(
      () => loadQuantScanHandoffInput(join(runDir, "scan.json")),
      /Universe config version must be 1/
    );
  } finally {
    await rm(runDir, {
      recursive: true,
      force: true
    });
  }
});
