import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ChartPlanError,
  normalizeTradingViewSymbol
} from "../tradingview/chart-plan.js";

export const DEFAULT_UNIVERSE_CONFIG_PATH = "config/universe.sample.json";
export const UNIVERSE_CONFIG_VERSION = 1;
export const UNIVERSE_TIERS = ["core", "extended"] as const;

export type UniverseTier = (typeof UNIVERSE_TIERS)[number];
export type UniverseSelectionTier = UniverseTier | "all";

export interface UniverseSymbolConfig {
  symbol: string;
  alias: string;
  name?: string;
  tags: string[];
}

export interface UniverseGroupConfig {
  id: string;
  label: string;
  tags: string[];
  core: UniverseSymbolConfig[];
  extended: UniverseSymbolConfig[];
}

export interface UniverseConfig {
  version: typeof UNIVERSE_CONFIG_VERSION;
  groups: UniverseGroupConfig[];
}

export interface UniverseGroupSummary {
  id: string;
  label: string;
  tags: string[];
  coreCount: number;
  extendedCount: number;
}

export interface ResolveUniverseSelectionOptions {
  groupIds?: string[];
  tier?: UniverseSelectionTier;
}

export interface ResolvedUniverseSymbol {
  symbol: string;
  alias: string;
  name?: string;
  tags: string[];
  groups: string[];
  tiers: UniverseTier[];
}

export class UniverseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UniverseConfigError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new UniverseConfigError(`${path} must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  return assertString(value, path);
}

function parseTags(value: unknown, path: string): string[] {
  if (typeof value === "undefined") {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new UniverseConfigError(`${path} must be an array of strings.`);
  }

  const tags: string[] = [];
  const seen = new Set<string>();

  for (const [index, item] of value.entries()) {
    const tag = assertString(item, `${path}[${index}]`).toLowerCase();

    if (!seen.has(tag)) {
      tags.push(tag);
      seen.add(tag);
    }
  }

  return tags;
}

function parseGroupId(value: unknown, path: string): string {
  const id = assertString(value, path).toLowerCase();

  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new UniverseConfigError(
      `${path} must use lowercase letters, numbers, and hyphens.`
    );
  }

  return id;
}

function parseSymbolEntry(
  value: unknown,
  path: string
): UniverseSymbolConfig {
  if (!isRecord(value)) {
    throw new UniverseConfigError(`${path} must be an object.`);
  }

  let symbol: string;

  try {
    symbol = normalizeTradingViewSymbol(assertString(value.symbol, `${path}.symbol`));
  } catch (error: unknown) {
    if (error instanceof ChartPlanError) {
      throw new UniverseConfigError(`${path}.symbol ${error.message}`);
    }

    throw error;
  }

  const name = optionalString(value.name, `${path}.name`);
  const result: UniverseSymbolConfig = {
    symbol,
    alias: assertString(value.alias, `${path}.alias`),
    tags: parseTags(value.tags, `${path}.tags`)
  };

  if (name) {
    result.name = name;
  }

  return result;
}

function parseTierSymbols(
  value: unknown,
  path: string
): UniverseSymbolConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new UniverseConfigError(`${path} must be a non-empty array.`);
  }

  const symbols: UniverseSymbolConfig[] = [];
  const seen = new Set<string>();

  for (const [index, item] of value.entries()) {
    const entry = parseSymbolEntry(item, `${path}[${index}]`);

    if (seen.has(entry.symbol)) {
      throw new UniverseConfigError(
        `${path} contains duplicate symbol ${entry.symbol}.`
      );
    }

    symbols.push(entry);
    seen.add(entry.symbol);
  }

  return symbols;
}

function parseGroup(value: unknown, path: string): UniverseGroupConfig {
  if (!isRecord(value)) {
    throw new UniverseConfigError(`${path} must be an object.`);
  }

  return {
    id: parseGroupId(value.id, `${path}.id`),
    label: assertString(value.label, `${path}.label`),
    tags: parseTags(value.tags, `${path}.tags`),
    core: parseTierSymbols(value.core, `${path}.core`),
    extended: parseTierSymbols(value.extended, `${path}.extended`)
  };
}

export function parseUniverseConfig(input: unknown): UniverseConfig {
  if (!isRecord(input)) {
    throw new UniverseConfigError("Universe config must be an object.");
  }

  if (input.version !== UNIVERSE_CONFIG_VERSION) {
    throw new UniverseConfigError("Universe config version must be 1.");
  }

  if (!Array.isArray(input.groups) || input.groups.length === 0) {
    throw new UniverseConfigError("Universe config groups must be a non-empty array.");
  }

  const groups: UniverseGroupConfig[] = [];
  const seenGroupIds = new Set<string>();

  for (const [index, item] of input.groups.entries()) {
    const group = parseGroup(item, `groups[${index}]`);

    if (seenGroupIds.has(group.id)) {
      throw new UniverseConfigError(`Duplicate universe group id ${group.id}.`);
    }

    groups.push(group);
    seenGroupIds.add(group.id);
  }

  return {
    version: UNIVERSE_CONFIG_VERSION,
    groups
  };
}

export function parseUniverseConfigJson(
  json: string,
  source = "universe config"
): UniverseConfig {
  try {
    return parseUniverseConfig(JSON.parse(json) as unknown);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new UniverseConfigError(`${source} is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

export async function loadUniverseConfig(
  configPath = DEFAULT_UNIVERSE_CONFIG_PATH
): Promise<UniverseConfig> {
  const resolvedPath = resolve(configPath);
  const json = await readFile(resolvedPath, "utf8");
  return parseUniverseConfigJson(json, resolvedPath);
}

export function listUniverseGroups(config: UniverseConfig): UniverseGroupSummary[] {
  return config.groups.map((group) => ({
    id: group.id,
    label: group.label,
    tags: group.tags,
    coreCount: group.core.length,
    extendedCount: group.extended.length
  }));
}

function normalizeSelectionTier(
  tier: UniverseSelectionTier | undefined
): UniverseSelectionTier {
  return tier ?? "core";
}

function selectedTiers(tier: UniverseSelectionTier): UniverseTier[] {
  if (tier === "all") {
    return [...UNIVERSE_TIERS];
  }

  return [tier];
}

function appendUnique(values: string[], additions: readonly string[]): void {
  const seen = new Set(values);

  for (const value of additions) {
    if (!seen.has(value)) {
      values.push(value);
      seen.add(value);
    }
  }
}

function appendUniqueTier(values: UniverseTier[], tier: UniverseTier): void {
  if (!values.includes(tier)) {
    values.push(tier);
  }
}

export function resolveUniverseSelection(
  config: UniverseConfig,
  options: ResolveUniverseSelectionOptions = {}
): ResolvedUniverseSymbol[] {
  const groupIds = options.groupIds
    ?.map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  const selectedGroupIds = new Set(
    groupIds && groupIds.length > 0
      ? groupIds
      : config.groups.map((group) => group.id)
  );
  const unknownGroupIds = [...selectedGroupIds].filter(
    (id) => !config.groups.some((group) => group.id === id)
  );

  if (unknownGroupIds.length > 0) {
    throw new UniverseConfigError(
      `Unknown universe group${unknownGroupIds.length === 1 ? "" : "s"}: ${unknownGroupIds.join(", ")}.`
    );
  }

  const tier = normalizeSelectionTier(options.tier);
  const tiers = selectedTiers(tier);
  const resolved: ResolvedUniverseSymbol[] = [];
  const bySymbol = new Map<string, ResolvedUniverseSymbol>();

  for (const group of config.groups) {
    if (!selectedGroupIds.has(group.id)) {
      continue;
    }

    for (const selectedTier of tiers) {
      for (const entry of group[selectedTier]) {
        const existing = bySymbol.get(entry.symbol);

        if (existing) {
          appendUnique(existing.groups, [group.id]);
          appendUniqueTier(existing.tiers, selectedTier);
          appendUnique(existing.tags, [...group.tags, ...entry.tags]);
          continue;
        }

        const symbol: ResolvedUniverseSymbol = {
          symbol: entry.symbol,
          alias: entry.alias,
          tags: [],
          groups: [group.id],
          tiers: [selectedTier]
        };

        if (entry.name) {
          symbol.name = entry.name;
        }

        appendUnique(symbol.tags, [...group.tags, ...entry.tags]);
        resolved.push(symbol);
        bySymbol.set(entry.symbol, symbol);
      }
    }
  }

  return resolved;
}
