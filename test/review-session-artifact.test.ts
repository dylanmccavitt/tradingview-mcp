import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  REVIEW_SESSION_ARTIFACT_KIND,
  REVIEW_SESSION_ARTIFACT_SCHEMA_VERSION,
  ReviewSessionArtifactSchema,
  isReviewSessionArtifact,
  parseReviewSessionArtifact
} from "../src/review-session/artifact.js";

const fixturePath = join(
  process.cwd(),
  "test",
  "fixtures",
  "review-session-artifact.v1.json"
);

async function loadFixture(): Promise<unknown> {
  return JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }

  return keys;
}

void test("review session v1 fixture validates the artifact contract", async () => {
  const artifact = parseReviewSessionArtifact(await loadFixture());

  assert.equal(artifact.schemaVersion, REVIEW_SESSION_ARTIFACT_SCHEMA_VERSION);
  assert.equal(artifact.kind, REVIEW_SESSION_ARTIFACT_KIND);
  assert.equal(artifact.session.sourceType, "chartbook");
  assert.equal(artifact.session.profileContext?.profile, "breakout");
  assert.equal(artifact.symbols[0]?.setupEvidenceLabels[0]?.label, "watch");
  assert.equal(
    artifact.symbols[0]?.setupEvidenceLabels[0]?.deterministic,
    true
  );
  assert.equal(artifact.symbols[0]?.reviewMarks[0]?.humanAuthored, true);
  assert.equal(artifact.symbols[0]?.thesisNotes[0]?.humanAuthored, true);
});

void test("review session contract rejects machine-authored manual notes", async () => {
  const artifact = (await loadFixture()) as {
    symbols: Array<{
      reviewMarks: Array<{
        humanAuthored: boolean;
      }>;
    }>;
  };
  artifact.symbols[0]!.reviewMarks[0]!.humanAuthored = false;

  assert.equal(isReviewSessionArtifact(artifact), false);
  assert.throws(() => ReviewSessionArtifactSchema.parse(artifact), /Invalid input/);
});

void test("review session contract keeps setup labels deterministic", async () => {
  const artifact = (await loadFixture()) as {
    symbols: Array<{
      setupEvidenceLabels: Array<{
        deterministic: boolean;
      }>;
    }>;
  };
  artifact.symbols[0]!.setupEvidenceLabels[0]!.deterministic = false;

  assert.equal(isReviewSessionArtifact(artifact), false);
  assert.throws(() => ReviewSessionArtifactSchema.parse(artifact), /Invalid input/);
});

void test("review session contract stays chart-review-only by field shape", async () => {
  const artifact = parseReviewSessionArtifact(await loadFixture());
  const forbiddenKeys = new Set([
    "rank",
    "ranking",
    "score",
    "recommendation",
    "recommendations",
    "advice",
    "alert",
    "alerts",
    "order",
    "orders",
    "broker",
    "account",
    "pnl",
    "pl"
  ]);

  const keys = collectKeys(artifact);
  const matches = [...keys].filter((key) => forbiddenKeys.has(key.toLowerCase()));

  assert.deepEqual(matches, []);
  assert.equal(artifact.session.sourceType, "chartbook");
  assert.ok(
    artifact.symbols.every(
      (symbol) =>
        symbol.chartCaptures.length > 0 ||
        symbol.objectiveEvidence.length > 0 ||
        symbol.setupEvidenceLabels.length > 0
    )
  );
});
