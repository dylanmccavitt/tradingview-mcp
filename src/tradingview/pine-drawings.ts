export const DEFAULT_PINE_DRAWING_STUDY_NAME =
  "TVMCP Objective Drawing Overlay";
export const DEFAULT_PINE_DRAWING_STUDY_SHORT_TITLE =
  "TVMCP Objective Overlay";

export type PineDrawingSourceKind =
  | "line"
  | "plot"
  | "box"
  | "label"
  | "table"
  | "unknown";

export interface PineDrawingChartContext {
  url?: string;
  title?: string;
  symbol?: string;
  interval?: string;
}

export interface PineDrawingStudySummary {
  name: string;
  id?: string;
  shortTitle?: string;
  source?: string;
}

export interface PineDrawingLevel {
  name?: string;
  price: number;
  sources: PineDrawingSourceKind[];
  color?: string;
  style?: string;
  width?: number;
  extend?: string;
  startIndex?: number;
  endIndex?: number;
  startTime?: string;
  endTime?: string;
}

export interface PineDrawingZone {
  name?: string;
  high: number;
  low: number;
  source: PineDrawingSourceKind;
  color?: string;
  borderColor?: string;
  backgroundColor?: string;
  startIndex?: number;
  endIndex?: number;
  startTime?: string;
  endTime?: string;
}

export interface PineDrawingLabel {
  text: string;
  price?: number;
  source: PineDrawingSourceKind;
  color?: string;
  textColor?: string;
  index?: number;
  time?: string;
}

export interface PineDrawingTable {
  title?: string;
  source: PineDrawingSourceKind;
  position?: string;
  cells: string[][];
}

export interface PineDrawingCounts {
  levels: number;
  zones: number;
  labels: number;
  tables: number;
}

export interface PineDrawingExtractionData {
  ok: boolean;
  studyName: string;
  chart?: PineDrawingChartContext;
  study?: PineDrawingStudySummary;
  drawings: {
    levels: PineDrawingLevel[];
    zones: PineDrawingZone[];
    labels: PineDrawingLabel[];
    tables: PineDrawingTable[];
  };
  counts: PineDrawingCounts;
  warnings: string[];
  raw?: unknown;
}

export interface NormalizePineDrawingPayloadOptions {
  studyName?: string;
  debug?: boolean;
}

interface StudyCandidate {
  value: Record<string, unknown>;
  source: string;
}

interface LevelCandidate {
  level: PineDrawingLevel;
  key: string;
}

const STUDY_COLLECTION_KEYS = [
  "studies",
  "studySources",
  "indicators",
  "sources",
  "overlays",
  "children"
] as const;
const CONTAINER_KEYS = [
  "study",
  "meta",
  "state",
  "data",
  "graphics",
  "drawings",
  "objects",
  "payload",
  "content",
  "panes"
] as const;
const LINE_KEYS = [
  "lines",
  "levels",
  "horizontalLines",
  "priceLevels"
] as const;
const PLOT_KEYS = [
  "plots",
  "priceScalePlots",
  "plotValues",
  "series"
] as const;
const BOX_KEYS = ["boxes", "zones", "rectangles"] as const;
const LABEL_KEYS = ["labels", "markers", "plotshapes", "plotShapes"] as const;
const TABLE_KEYS = ["tables"] as const;
const NAME_KEYS = [
  "name",
  "title",
  "text",
  "label",
  "studyName",
  "visibleStudyName",
  "description",
  "shortTitle",
  "shortName",
  "displayName",
  "legendText"
] as const;
const PRICE_KEYS = [
  "price",
  "value",
  "level",
  "y",
  "last",
  "currentValue"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : undefined;
}

function numberValue(
  value: Record<string, unknown>,
  key: string
): number | undefined {
  const candidate = value[key];

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === "string" && candidate.trim().length > 0) {
    const parsed = Number(candidate.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function optionalNumberFromKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): number | undefined {
  for (const key of keys) {
    const candidate = numberValue(value, key);
    if (typeof candidate === "number") {
      return candidate;
    }
  }

  return undefined;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function studyAliases(studyName: string): string[] {
  const aliases = [studyName];

  if (studyName === DEFAULT_PINE_DRAWING_STUDY_NAME) {
    aliases.push(DEFAULT_PINE_DRAWING_STUDY_SHORT_TITLE);
  }

  return aliases;
}

function textMatchesStudy(text: string, studyName: string): boolean {
  const normalized = normalizeText(text);

  return studyAliases(studyName).some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return (
      normalized === normalizedAlias ||
      normalized.startsWith(`${normalizedAlias} `)
    );
  });
}

function textFields(value: Record<string, unknown>): string[] {
  const fields: string[] = [];

  for (const key of NAME_KEYS) {
    const candidate = stringValue(value, key);
    if (candidate) {
      fields.push(candidate);
    }
  }

  for (const key of ["meta", "state", "study", "payload"]) {
    const nested = value[key];
    if (isRecord(nested)) {
      for (const field of textFields(nested)) {
        fields.push(field);
      }
    }
  }

  return fields;
}

function candidateMatchesStudy(
  candidate: Record<string, unknown>,
  studyName: string
): boolean {
  return textFields(candidate).some((field) => textMatchesStudy(field, studyName));
}

function unwrapCdpPayload(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const result = value.result;
  if (isRecord(result) && "value" in result) {
    return result.value;
  }

  return value;
}

function collectStudyCandidates(
  value: unknown,
  source = "payload",
  depth = 4,
  seen = new Set<unknown>()
): StudyCandidate[] {
  if (depth < 0 || seen.has(value)) {
    return [];
  }

  seen.add(value);

  const candidates: StudyCandidate[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      candidates.push(
        ...collectStudyCandidates(item, `${source}[]`, depth - 1, seen)
      );
    }

    return candidates;
  }

  if (!isRecord(value)) {
    return candidates;
  }

  if (textFields(value).length > 0) {
    candidates.push({
      value,
      source
    });
  }

  for (const key of STUDY_COLLECTION_KEYS) {
    const collection = value[key];
    if (Array.isArray(collection)) {
      for (const item of collection) {
        if (isRecord(item)) {
          candidates.push(
            ...collectStudyCandidates(item, `${source}.${key}`, depth - 1, seen)
          );
        }
      }
    }
  }

  for (const key of CONTAINER_KEYS) {
    const nested = value[key];
    if (isRecord(nested) || Array.isArray(nested)) {
      candidates.push(
        ...collectStudyCandidates(nested, `${source}.${key}`, depth - 1, seen)
      );
    }
  }

  return candidates;
}

function findStudyPayload(
  payload: unknown,
  studyName: string
): StudyCandidate | null {
  const unwrapped = unwrapCdpPayload(payload);
  const candidates = collectStudyCandidates(unwrapped);

  return (
    candidates.find((candidate) =>
      candidateMatchesStudy(candidate.value, studyName)
    ) ?? null
  );
}

function collectRecordsByKeys(
  value: unknown,
  keys: readonly string[],
  depth = 4,
  seen = new Set<unknown>()
): Record<string, unknown>[] {
  if (depth < 0 || seen.has(value)) {
    return [];
  }

  seen.add(value);

  const records: Record<string, unknown>[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      records.push(...collectRecordsByKeys(item, keys, depth - 1, seen));
    }

    return records;
  }

  if (!isRecord(value)) {
    return records;
  }

  for (const key of keys) {
    const collection = value[key];
    if (Array.isArray(collection)) {
      for (const item of collection) {
        if (isRecord(item)) {
          records.push(item);
        }
      }
    }
  }

  for (const key of CONTAINER_KEYS) {
    const nested = value[key];
    if (isRecord(nested)) {
      records.push(...collectRecordsByKeys(nested, keys, depth - 1, seen));
    }
  }

  return records;
}

function firstStringFromKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const candidate = stringValue(value, key);
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

function normalizeLevelName(name: string | undefined): string | undefined {
  if (!name) {
    return undefined;
  }

  const stripped = name
    .replace(/\s+price\s+scale$/i, "")
    .replace(/^debug\s+/i, "")
    .trim();

  return stripped.length > 0 ? stripped : undefined;
}

function linePrice(value: Record<string, unknown>): number | undefined {
  const direct = optionalNumberFromKeys(value, PRICE_KEYS);
  if (typeof direct === "number") {
    return direct;
  }

  const y1 = numberValue(value, "y1");
  const y2 = numberValue(value, "y2");
  if (typeof y1 === "number" && typeof y2 === "number") {
    return Math.abs(y1 - y2) <= 0.000001 ? y1 : undefined;
  }

  return undefined;
}

function optionalStringFromKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const candidate = stringValue(value, key);
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

function assignOptionalString<T extends object>(
  target: T,
  key: keyof T,
  value: string | undefined
): void {
  if (value) {
    (target as unknown as Record<string, unknown>)[String(key)] = value;
  }
}

function assignOptionalNumber<T extends object>(
  target: T,
  key: keyof T,
  value: number | undefined
): void {
  if (typeof value === "number") {
    (target as unknown as Record<string, unknown>)[String(key)] = value;
  }
}

function normalizeLevelRecord(
  value: Record<string, unknown>,
  source: PineDrawingSourceKind
): LevelCandidate | null {
  const price = linePrice(value);
  if (typeof price !== "number") {
    return null;
  }

  const level: PineDrawingLevel = {
    price,
    sources: [source]
  };
  const name = normalizeLevelName(firstStringFromKeys(value, NAME_KEYS));
  if (name) {
    level.name = name;
  }

  assignOptionalString(level, "color", optionalStringFromKeys(value, ["color"]));
  assignOptionalString(level, "style", optionalStringFromKeys(value, ["style"]));
  assignOptionalString(level, "extend", optionalStringFromKeys(value, ["extend"]));
  assignOptionalNumber(level, "width", optionalNumberFromKeys(value, ["width"]));
  assignOptionalNumber(
    level,
    "startIndex",
    optionalNumberFromKeys(value, ["startIndex", "x1", "fromIndex"])
  );
  assignOptionalNumber(
    level,
    "endIndex",
    optionalNumberFromKeys(value, ["endIndex", "x2", "toIndex"])
  );
  assignOptionalString(
    level,
    "startTime",
    optionalStringFromKeys(value, ["startTime", "fromTime", "time1"])
  );
  assignOptionalString(
    level,
    "endTime",
    optionalStringFromKeys(value, ["endTime", "toTime", "time2"])
  );

  const rounded = price.toFixed(4);
  const key = name ? `${normalizeText(name)}:${rounded}` : `price:${rounded}`;

  return {
    level,
    key
  };
}

function mergeLevel(
  levelsByKey: Map<string, PineDrawingLevel>,
  candidate: LevelCandidate
): void {
  const existing = levelsByKey.get(candidate.key);
  if (!existing) {
    levelsByKey.set(candidate.key, candidate.level);
    return;
  }

  for (const source of candidate.level.sources) {
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
  }

  if (!existing.name && candidate.level.name) {
    existing.name = candidate.level.name;
  }

  for (const key of [
    "color",
    "style",
    "extend",
    "startTime",
    "endTime"
  ] as const) {
    if (!existing[key] && candidate.level[key]) {
      existing[key] = candidate.level[key];
    }
  }

  for (const key of ["width", "startIndex", "endIndex"] as const) {
    if (typeof existing[key] !== "number" && typeof candidate.level[key] === "number") {
      existing[key] = candidate.level[key];
    }
  }
}

function extractLevels(study: Record<string, unknown>): PineDrawingLevel[] {
  const levelsByKey = new Map<string, PineDrawingLevel>();

  for (const line of collectRecordsByKeys(study, LINE_KEYS)) {
    const candidate = normalizeLevelRecord(line, "line");
    if (candidate) {
      mergeLevel(levelsByKey, candidate);
    }
  }

  for (const plot of collectRecordsByKeys(study, PLOT_KEYS)) {
    const candidate = normalizeLevelRecord(plot, "plot");
    if (candidate) {
      mergeLevel(levelsByKey, candidate);
    }
  }

  return [...levelsByKey.values()].sort((left, right) => right.price - left.price);
}

function normalizeZoneRecord(
  value: Record<string, unknown>
): PineDrawingZone | null {
  const top = optionalNumberFromKeys(value, ["high", "top", "y1", "priceHigh"]);
  const bottom = optionalNumberFromKeys(value, [
    "low",
    "bottom",
    "y2",
    "priceLow"
  ]);

  if (typeof top !== "number" || typeof bottom !== "number") {
    return null;
  }

  const zone: PineDrawingZone = {
    high: Math.max(top, bottom),
    low: Math.min(top, bottom),
    source: "box"
  };
  const name = normalizeLevelName(firstStringFromKeys(value, NAME_KEYS));
  if (name) {
    zone.name = name;
  }

  assignOptionalString(zone, "color", optionalStringFromKeys(value, ["color"]));
  assignOptionalString(
    zone,
    "borderColor",
    optionalStringFromKeys(value, ["borderColor", "border_color"])
  );
  assignOptionalString(
    zone,
    "backgroundColor",
    optionalStringFromKeys(value, ["backgroundColor", "bgcolor"])
  );
  assignOptionalNumber(
    zone,
    "startIndex",
    optionalNumberFromKeys(value, ["startIndex", "left", "x1", "fromIndex"])
  );
  assignOptionalNumber(
    zone,
    "endIndex",
    optionalNumberFromKeys(value, ["endIndex", "right", "x2", "toIndex"])
  );
  assignOptionalString(
    zone,
    "startTime",
    optionalStringFromKeys(value, ["startTime", "fromTime", "time1"])
  );
  assignOptionalString(
    zone,
    "endTime",
    optionalStringFromKeys(value, ["endTime", "toTime", "time2"])
  );

  return zone;
}

function extractZones(study: Record<string, unknown>): PineDrawingZone[] {
  const zones = new Map<string, PineDrawingZone>();

  for (const box of collectRecordsByKeys(study, BOX_KEYS)) {
    const zone = normalizeZoneRecord(box);
    if (!zone) {
      continue;
    }

    const key = `${zone.name ?? "zone"}:${zone.high.toFixed(4)}:${zone.low.toFixed(4)}`;
    if (!zones.has(key)) {
      zones.set(key, zone);
    }
  }

  return [...zones.values()].sort((left, right) => right.high - left.high);
}

function normalizeLabelRecord(
  value: Record<string, unknown>
): PineDrawingLabel | null {
  const text = firstStringFromKeys(value, NAME_KEYS);
  if (!text) {
    return null;
  }

  const label: PineDrawingLabel = {
    text,
    source: "label"
  };

  assignOptionalNumber(label, "price", optionalNumberFromKeys(value, PRICE_KEYS));
  assignOptionalNumber(
    label,
    "index",
    optionalNumberFromKeys(value, ["index", "barIndex", "x"])
  );
  assignOptionalString(label, "time", optionalStringFromKeys(value, ["time"]));
  assignOptionalString(label, "color", optionalStringFromKeys(value, ["color"]));
  assignOptionalString(
    label,
    "textColor",
    optionalStringFromKeys(value, ["textColor", "textcolor"])
  );

  return label;
}

function extractLabels(study: Record<string, unknown>): PineDrawingLabel[] {
  const labels = new Map<string, PineDrawingLabel>();

  for (const value of collectRecordsByKeys(study, LABEL_KEYS)) {
    const label = normalizeLabelRecord(value);
    if (!label) {
      continue;
    }

    const key = `${normalizeText(label.text)}:${label.price?.toFixed(4) ?? ""}:${label.index ?? ""}:${label.time ?? ""}`;
    if (!labels.has(key)) {
      labels.set(key, label);
    }
  }

  return [...labels.values()];
}

function stringifyCell(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (isRecord(value)) {
    return (
      stringValue(value, "text") ??
      stringValue(value, "value") ??
      stringValue(value, "label") ??
      ""
    );
  }

  return "";
}

function tableCells(value: Record<string, unknown>): string[][] {
  const rows = value.rows;
  if (Array.isArray(rows)) {
    return rows
      .map((row) => (Array.isArray(row) ? row.map(stringifyCell) : [stringifyCell(row)]))
      .filter((row) => row.some((cell) => cell.length > 0));
  }

  const cells = value.cells;
  if (Array.isArray(cells)) {
    return [
      cells.map(stringifyCell).filter((cell) => cell.length > 0)
    ].filter((row) => row.length > 0);
  }

  return [];
}

function normalizeTableRecord(
  value: Record<string, unknown>
): PineDrawingTable | null {
  const cells = tableCells(value);
  if (cells.length === 0) {
    return null;
  }

  const table: PineDrawingTable = {
    source: "table",
    cells
  };
  const title = firstStringFromKeys(value, ["title", "name", "label"]);
  if (title) {
    table.title = title;
  }

  assignOptionalString(
    table,
    "position",
    optionalStringFromKeys(value, ["position", "location"])
  );

  return table;
}

function extractTables(study: Record<string, unknown>): PineDrawingTable[] {
  const tables: PineDrawingTable[] = [];

  for (const value of collectRecordsByKeys(study, TABLE_KEYS)) {
    const table = normalizeTableRecord(value);
    if (table) {
      tables.push(table);
    }
  }

  return tables;
}

function extractChartContext(payload: unknown): PineDrawingChartContext | undefined {
  const unwrapped = unwrapCdpPayload(payload);
  if (!isRecord(unwrapped)) {
    return undefined;
  }

  const chart = isRecord(unwrapped.chart) ? unwrapped.chart : unwrapped;
  const context: PineDrawingChartContext = {};

  assignOptionalString(context, "url", optionalStringFromKeys(chart, ["url", "href"]));
  assignOptionalString(context, "title", optionalStringFromKeys(chart, ["title"]));
  assignOptionalString(
    context,
    "symbol",
    optionalStringFromKeys(chart, ["symbol", "ticker"])
  );
  assignOptionalString(
    context,
    "interval",
    optionalStringFromKeys(chart, ["interval", "timeframe"])
  );

  return Object.keys(context).length > 0 ? context : undefined;
}

function summarizeStudy(
  candidate: StudyCandidate,
  studyName: string
): PineDrawingStudySummary {
  const value = candidate.value;
  const name =
    firstStringFromKeys(value, [
      "studyName",
      "visibleStudyName",
      "name",
      "title",
      "description",
      "legendText"
    ]) ?? studyName;
  const study: PineDrawingStudySummary = {
    name,
    source: candidate.source
  };

  assignOptionalString(study, "id", optionalStringFromKeys(value, ["id"]));
  assignOptionalString(
    study,
    "shortTitle",
    optionalStringFromKeys(value, ["shortTitle", "shortName"])
  );

  return study;
}

function emptyDrawings() {
  return {
    levels: [],
    zones: [],
    labels: [],
    tables: []
  };
}

function countsFromDrawings(
  drawings: PineDrawingExtractionData["drawings"]
): PineDrawingCounts {
  return {
    levels: drawings.levels.length,
    zones: drawings.zones.length,
    labels: drawings.labels.length,
    tables: drawings.tables.length
  };
}

export function normalizePineDrawingPayload(
  payload: unknown,
  options: NormalizePineDrawingPayloadOptions = {}
): PineDrawingExtractionData {
  const studyName = options.studyName ?? DEFAULT_PINE_DRAWING_STUDY_NAME;
  const chart = extractChartContext(payload);
  const warnings: string[] = [];
  const candidate = findStudyPayload(payload, studyName);

  if (!candidate) {
    warnings.push(
      `Study '${studyName}' was not found in the compact TradingView payload.`
    );
    const drawings = emptyDrawings();
    const result: PineDrawingExtractionData = {
      ok: false,
      studyName,
      drawings,
      counts: countsFromDrawings(drawings),
      warnings
    };

    if (chart) {
      result.chart = chart;
    }

    if (options.debug) {
      result.raw = unwrapCdpPayload(payload);
    }

    return result;
  }

  const drawings = {
    levels: extractLevels(candidate.value),
    zones: extractZones(candidate.value),
    labels: extractLabels(candidate.value),
    tables: extractTables(candidate.value)
  };
  const counts = countsFromDrawings(drawings);
  const totalObjects = counts.levels + counts.zones + counts.labels + counts.tables;

  if (totalObjects === 0) {
    warnings.push(
      `Study '${studyName}' was found, but no supported Pine drawing objects were detected.`
    );
  }

  const result: PineDrawingExtractionData = {
    ok: totalObjects > 0,
    studyName,
    study: summarizeStudy(candidate, studyName),
    drawings,
    counts,
    warnings
  };

  if (chart) {
    result.chart = chart;
  }

  if (options.debug) {
    result.raw = unwrapCdpPayload(payload);
  }

  return result;
}
