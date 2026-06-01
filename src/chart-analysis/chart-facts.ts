import {
  CHART_ANALYSIS_PROFILE_NAMES,
  type ChartAnalysisProfileName
} from "../domain.js";
import type {
  PineDrawingExtractionData,
  PineDrawingLevel,
  PineDrawingTable,
  PineDrawingZone
} from "../tradingview/pine-drawings.js";

export const CHART_FACTS_SCHEMA_VERSION = 1;
export const DEFAULT_CHART_ANALYSIS_PROFILE: ChartAnalysisProfileName = "focus";

export type ChartFactLevelRole =
  | "prior-day"
  | "prior-week"
  | "prior-month"
  | "breakout"
  | "swing"
  | "timing"
  | "avwap"
  | "unknown";

export interface ChartFactLevel {
  name: string;
  price: number;
  role: ChartFactLevelRole;
  sources: PineDrawingLevel["sources"];
}

export interface ChartFacts {
  schemaVersion: typeof CHART_FACTS_SCHEMA_VERSION;
  profile: ChartAnalysisProfileName;
  chart?: {
    symbol?: string;
    interval?: string;
    currentPrice?: number;
  };
  extracted: {
    levels: number;
    zones: number;
    labels: number;
    tables: number;
  };
  nearest: {
    support?: ChartFactLevel;
    resistance?: ChartFactLevel;
    referencePrice?: number;
  };
  breakout: {
    referenceLevels: ChartFactLevel[];
  };
  compression: {
    state: "active" | "quiet" | "unknown";
    range?: {
      high: number;
      low: number;
      source: "zone" | "table";
    };
  };
  avwap: {
    present: boolean;
    value?: number;
  };
  timing: {
    priorDayLevels: ChartFactLevel[];
    premarketLevels: ChartFactLevel[];
    openingRangeLevels: ChartFactLevel[];
  };
  profileFocus: string[];
  warnings: string[];
}

export function parseChartAnalysisProfile(
  value: string | undefined
): ChartAnalysisProfileName {
  if (!value) {
    return DEFAULT_CHART_ANALYSIS_PROFILE;
  }

  if (
    CHART_ANALYSIS_PROFILE_NAMES.includes(value as ChartAnalysisProfileName)
  ) {
    return value as ChartAnalysisProfileName;
  }

  throw new Error(
    `Chart-analysis profile must be one of: ${CHART_ANALYSIS_PROFILE_NAMES.join(", ")}.`
  );
}

function normalizedName(level: PineDrawingLevel): string {
  return (level.name ?? "unnamed").trim();
}

function levelRole(name: string): ChartFactLevelRole {
  if (["PDH", "PDL"].includes(name)) {
    return "prior-day";
  }

  if (["PWH", "PWL"].includes(name)) {
    return "prior-week";
  }

  if (["PMH", "PML"].includes(name)) {
    return "prior-month";
  }

  if (["20D-H", "20D-L", "50D-H", "50D-L"].includes(name)) {
    return "breakout";
  }

  if (["SW-H", "SW-L"].includes(name)) {
    return "swing";
  }

  if (["PMKT-H", "PMKT-L", "OR-H", "OR-L"].includes(name)) {
    return "timing";
  }

  if (name === "AVWAP") {
    return "avwap";
  }

  return "unknown";
}

function factLevel(level: PineDrawingLevel): ChartFactLevel {
  const name = normalizedName(level);

  return {
    name,
    price: level.price,
    role: levelRole(name),
    sources: [...level.sources]
  };
}

function levelsByName(
  levels: PineDrawingLevel[],
  names: readonly string[]
): ChartFactLevel[] {
  return levels
    .filter((level) => level.name && names.includes(level.name))
    .map(factLevel)
    .sort((left, right) => right.price - left.price);
}

function nearestLevels(
  levels: PineDrawingLevel[],
  referencePrice: number | undefined
): ChartFacts["nearest"] {
  if (typeof referencePrice !== "number") {
    return {};
  }

  const facts = levels.map(factLevel);
  const support = facts
    .filter((level) => level.price <= referencePrice)
    .sort((left, right) => right.price - left.price)[0];
  const resistance = facts
    .filter((level) => level.price >= referencePrice)
    .sort((left, right) => left.price - right.price)[0];
  const nearest: ChartFacts["nearest"] = {
    referencePrice
  };

  if (support) {
    nearest.support = support;
  }

  if (resistance) {
    nearest.resistance = resistance;
  }

  return nearest;
}

function tableCellValue(
  tables: PineDrawingTable[],
  fieldName: string
): string | undefined {
  for (const table of tables) {
    for (const row of table.cells) {
      if (row[0]?.trim().toLowerCase() === fieldName.toLowerCase()) {
        return row[1]?.trim();
      }
    }
  }

  return undefined;
}

function avwapValue(
  levels: PineDrawingLevel[],
  tables: PineDrawingTable[]
): number | undefined {
  const levelValue = levels.find((level) => level.name === "AVWAP")?.price;
  if (typeof levelValue === "number") {
    return levelValue;
  }

  const tableValue = tableCellValue(tables, "AVWAP");
  if (!tableValue || tableValue.toLowerCase() === "n/a") {
    return undefined;
  }

  const parsed = Number(tableValue.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compressionZone(zones: PineDrawingZone[]): PineDrawingZone | undefined {
  return zones.find((zone) => {
    const name = zone.name?.toLowerCase() ?? "";
    const color = `${zone.borderColor ?? ""} ${zone.backgroundColor ?? ""}`.toLowerCase();

    return (
      name.includes("compression") ||
      name.includes("range") ||
      color.includes("yellow")
    );
  });
}

function compressionFacts(
  zones: PineDrawingZone[],
  tables: PineDrawingTable[]
): ChartFacts["compression"] {
  const zone = compressionZone(zones);
  if (zone) {
    return {
      state: "active",
      range: {
        high: zone.high,
        low: zone.low,
        source: "zone"
      }
    };
  }

  const tableRange = tableCellValue(tables, "Range")?.toLowerCase();
  if (tableRange === "active") {
    return {
      state: "active"
    };
  }

  if (tableRange === "quiet") {
    return {
      state: "quiet"
    };
  }

  return {
    state: "unknown"
  };
}

function profileFocus(profile: ChartAnalysisProfileName): string[] {
  if (profile === "breakout") {
    return [
      "breakout.referenceLevels",
      "nearest.resistance",
      "avwap",
      "timing.priorDayLevels"
    ];
  }

  if (profile === "squeeze") {
    return [
      "compression",
      "breakout.referenceLevels",
      "nearest.support",
      "nearest.resistance"
    ];
  }

  if (profile === "momentum") {
    return [
      "nearest.support",
      "breakout.referenceLevels",
      "avwap",
      "timing.openingRangeLevels"
    ];
  }

  return ["nearest", "breakout.referenceLevels", "compression", "avwap"];
}

export function buildChartFacts(
  extraction: Pick<
    PineDrawingExtractionData,
    "chart" | "counts" | "drawings" | "warnings"
  >,
  profile: ChartAnalysisProfileName = DEFAULT_CHART_ANALYSIS_PROFILE
): ChartFacts {
  const levels = extraction.drawings.levels;
  const tables = extraction.drawings.tables;
  const warnings = [...extraction.warnings];
  const currentPrice = extraction.chart?.currentPrice;

  if (typeof currentPrice !== "number") {
    warnings.push(
      "Nearest support/resistance unavailable because TradingView did not expose a current chart price."
    );
  }

  if (levels.length === 0) {
    warnings.push(
      "Chart facts are limited because no extracted objective overlay levels were available."
    );
  }

  const avwap = avwapValue(levels, tables);
  if (typeof avwap !== "number") {
    warnings.push("AVWAP value was not available from extracted overlay data.");
  }

  const facts: ChartFacts = {
    schemaVersion: CHART_FACTS_SCHEMA_VERSION,
    profile,
    extracted: {
      ...extraction.counts
    },
    nearest: nearestLevels(levels, currentPrice),
    breakout: {
      referenceLevels: levelsByName(levels, [
        "20D-H",
        "20D-L",
        "50D-H",
        "50D-L",
        "PWH",
        "PWL",
        "PDH",
        "PDL"
      ])
    },
    compression: compressionFacts(extraction.drawings.zones, tables),
    avwap: typeof avwap === "number"
      ? {
          present: true,
          value: avwap
        }
      : {
          present: false
        },
    timing: {
      priorDayLevels: levelsByName(levels, ["PDH", "PDL"]),
      premarketLevels: levelsByName(levels, ["PMKT-H", "PMKT-L"]),
      openingRangeLevels: levelsByName(levels, ["OR-H", "OR-L"])
    },
    profileFocus: profileFocus(profile),
    warnings
  };

  if (extraction.chart) {
    const chart: NonNullable<ChartFacts["chart"]> = {};
    if (extraction.chart.symbol) {
      chart.symbol = extraction.chart.symbol;
    }
    if (extraction.chart.interval) {
      chart.interval = extraction.chart.interval;
    }
    if (typeof extraction.chart.currentPrice === "number") {
      chart.currentPrice = extraction.chart.currentPrice;
    }
    facts.chart = chart;
  }

  if (facts.compression.state === "unknown") {
    facts.warnings.push(
      "Compression state is unknown because no compression range box or focus table Range value was extracted."
    );
  }

  return facts;
}
