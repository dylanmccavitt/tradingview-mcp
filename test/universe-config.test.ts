import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  listUniverseGroups,
  parseUniverseConfig,
  parseUniverseConfigJson,
  resolveUniverseSelection,
  UniverseConfigError
} from "../src/universe/config.js";

const sampleConfigPath = resolve("config/universe.sample.json");

function fixtureConfig() {
  return {
    version: 1,
    groups: [
      {
        id: "semis",
        label: "Semiconductors",
        tags: ["semis"],
        core: [
          {
            symbol: "nasdaq:nvda",
            alias: "NVDA",
            tags: ["gpu"]
          }
        ],
        extended: [
          {
            symbol: "NASDAQ:AMD",
            alias: "AMD",
            tags: ["gpu"]
          }
        ]
      },
      {
        id: "ai-infrastructure",
        label: "AI Infrastructure",
        tags: ["ai", "infrastructure"],
        core: [
          {
            symbol: "NASDAQ:NVDA",
            alias: "NVDA",
            tags: ["accelerators"]
          }
        ],
        extended: [
          {
            symbol: "NASDAQ:MSFT",
            alias: "MSFT",
            tags: ["cloud"]
          }
        ]
      }
    ]
  };
}

void test("sample universe config parses and lists expected groups", () => {
  const config = parseUniverseConfigJson(readFileSync(sampleConfigPath, "utf8"));
  const groups = listUniverseGroups(config);

  assert.deepEqual(
    groups.map((group) => group.id),
    ["semis", "ai-software", "ai-infrastructure", "enterprise-software"]
  );
  assert.equal(groups.every((group) => group.coreCount > 0), true);
  assert.equal(groups.every((group) => group.extendedCount > 0), true);
});

void test("universe parsing normalizes symbols, aliases, and tags", () => {
  const config = parseUniverseConfig(fixtureConfig());
  const first = config.groups[0]?.core[0];

  assert.equal(first?.symbol, "NASDAQ:NVDA");
  assert.equal(first?.alias, "NVDA");
  assert.deepEqual(first?.tags, ["gpu"]);
});

void test("universe parsing rejects invalid exchange-qualified symbols", () => {
  const config = fixtureConfig();
  config.groups[0]!.core[0]!.symbol = "NVDA";

  assert.throws(() => parseUniverseConfig(config), UniverseConfigError);
});

void test("universe parsing rejects duplicate group ids and same-tier symbols", () => {
  const duplicateGroupConfig = fixtureConfig();
  duplicateGroupConfig.groups[1]!.id = "semis";

  assert.throws(
    () => parseUniverseConfig(duplicateGroupConfig),
    /Duplicate universe group id semis/
  );

  const duplicateSymbolConfig = fixtureConfig();
  duplicateSymbolConfig.groups[0]!.core.push({
    symbol: "NASDAQ:NVDA",
    alias: "NVIDIA",
    tags: ["duplicate"]
  });

  assert.throws(
    () => parseUniverseConfig(duplicateSymbolConfig),
    /duplicate symbol NASDAQ:NVDA/
  );
});

void test("universe selection resolves groups and de-duplicates in order", () => {
  const config = parseUniverseConfig(fixtureConfig());

  const symbols = resolveUniverseSelection(config, {
    groupIds: ["semis", "ai-infrastructure"],
    tier: "core"
  });

  assert.deepEqual(
    symbols.map((symbol) => symbol.symbol),
    ["NASDAQ:NVDA"]
  );
  assert.deepEqual(symbols[0]?.groups, ["semis", "ai-infrastructure"]);
  assert.deepEqual(symbols[0]?.tiers, ["core"]);
  assert.deepEqual(symbols[0]?.tags, [
    "semis",
    "gpu",
    "ai",
    "infrastructure",
    "accelerators"
  ]);
});

void test("universe selection supports all tiers and rejects unknown groups", () => {
  const config = parseUniverseConfig(fixtureConfig());

  const symbols = resolveUniverseSelection(config, {
    groupIds: ["semis"],
    tier: "all"
  });

  assert.deepEqual(
    symbols.map((symbol) => symbol.symbol),
    ["NASDAQ:NVDA", "NASDAQ:AMD"]
  );

  assert.throws(
    () =>
      resolveUniverseSelection(config, {
        groupIds: ["missing"],
        tier: "core"
      }),
    /Unknown universe group: missing/
  );
});
