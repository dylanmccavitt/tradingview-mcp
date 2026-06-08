import { z } from "zod";

import { CHART_ANALYSIS_PROFILE_NAMES } from "../domain.js";
import { SETUP_REVIEW_VERDICTS } from "../chartbook/setup-review.js";

export const REVIEW_SESSION_ARTIFACT_SCHEMA_VERSION = 1;
export const REVIEW_SESSION_ARTIFACT_KIND = "review_session_artifact";

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const NonEmptyStringSchema = z.string().trim().min(1);

const IsoTimestampSchema = z.string().refine(
  (value) => ISO_TIMESTAMP_PATTERN.test(value) && !Number.isNaN(Date.parse(value)),
  {
    message: "Expected an ISO-8601 UTC timestamp."
  }
);

export const ReviewSessionSourceTypeSchema = z.enum([
  "chartbook",
  "current_chart_capture",
  "quant_scan_handoff",
  "manual_import",
  "mixed"
]);

export const ReviewSessionArtifactReferenceTypeSchema = z.enum([
  "chartbook_index",
  "chartbook_dashboard_view",
  "current_chart_capture",
  "levels_json",
  "setup_review",
  "setup_review_index",
  "drawing_metadata",
  "review_notes_view",
  "quant_scan_handoff",
  "other"
]);

export const ReviewSessionArtifactFormatSchema = z.enum([
  "json",
  "png",
  "markdown",
  "html",
  "directory",
  "other"
]);

export const ReviewSessionReviewMarkValueSchema = z.enum([
  "clear",
  "needs_follow_up",
  "skip",
  "watch_manually"
]);

const ArtifactReferenceSchema = z
  .object({
    type: ReviewSessionArtifactReferenceTypeSchema,
    path: NonEmptyStringSchema,
    format: ReviewSessionArtifactFormatSchema,
    description: NonEmptyStringSchema.optional()
  })
  .strict();

const ProfileContextSchema = z
  .object({
    profile: z.enum(CHART_ANALYSIS_PROFILE_NAMES),
    preset: NonEmptyStringSchema.optional(),
    selectedBy: z.enum(["user", "workflow_default"])
  })
  .strict();

const ChartCaptureSchema = z
  .object({
    id: NonEmptyStringSchema,
    timeframe: NonEmptyStringSchema.optional(),
    label: NonEmptyStringSchema.optional(),
    capturedAt: IsoTimestampSchema.optional(),
    screenshot: ArtifactReferenceSchema,
    warnings: z.array(NonEmptyStringSchema)
  })
  .strict();

const ObjectiveEvidenceSchema = z
  .object({
    id: NonEmptyStringSchema,
    timeframe: NonEmptyStringSchema.optional(),
    artifact: ArtifactReferenceSchema,
    studyName: NonEmptyStringSchema.optional(),
    factsProfile: z.enum(CHART_ANALYSIS_PROFILE_NAMES).optional(),
    warnings: z.array(NonEmptyStringSchema)
  })
  .strict();

const SetupEvidenceLabelSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: z.enum(SETUP_REVIEW_VERDICTS),
    deterministic: z.literal(true),
    sourceArtifact: ArtifactReferenceSchema,
    reasons: z.array(NonEmptyStringSchema),
    warnings: z.array(NonEmptyStringSchema)
  })
  .strict();

const DrawingMetadataArtifactSchema = z
  .object({
    id: NonEmptyStringSchema,
    artifact: ArtifactReferenceSchema,
    sourceTool: NonEmptyStringSchema.optional(),
    drawingIds: z.array(NonEmptyStringSchema),
    warnings: z.array(NonEmptyStringSchema)
  })
  .strict();

const HumanAuthoredNoteBaseSchema = z
  .object({
    id: NonEmptyStringSchema,
    createdAt: IsoTimestampSchema,
    author: NonEmptyStringSchema,
    humanAuthored: z.literal(true),
    body: NonEmptyStringSchema.optional(),
    linkedArtifacts: z.array(ArtifactReferenceSchema)
  })
  .strict();

const ReviewMarkSchema = HumanAuthoredNoteBaseSchema.extend({
  mark: ReviewSessionReviewMarkValueSchema
}).strict();

const ThesisNoteSchema = HumanAuthoredNoteBaseSchema.extend({
  body: NonEmptyStringSchema
}).strict();

const ReviewSessionSymbolSchema = z
  .object({
    symbol: NonEmptyStringSchema,
    alias: NonEmptyStringSchema.optional(),
    name: NonEmptyStringSchema.optional(),
    chartCaptures: z.array(ChartCaptureSchema),
    objectiveEvidence: z.array(ObjectiveEvidenceSchema),
    setupEvidenceLabels: z.array(SetupEvidenceLabelSchema),
    drawingMetadataArtifacts: z.array(DrawingMetadataArtifactSchema),
    reviewMarks: z.array(ReviewMarkSchema),
    thesisNotes: z.array(ThesisNoteSchema),
    warnings: z.array(NonEmptyStringSchema)
  })
  .strict();

export const ReviewSessionArtifactSchema = z
  .object({
    schemaVersion: z.literal(REVIEW_SESSION_ARTIFACT_SCHEMA_VERSION),
    kind: z.literal(REVIEW_SESSION_ARTIFACT_KIND),
    session: z
      .object({
        id: NonEmptyStringSchema,
        name: NonEmptyStringSchema.optional(),
        createdAt: IsoTimestampSchema,
        sourceType: ReviewSessionSourceTypeSchema,
        sourceArtifacts: z.array(ArtifactReferenceSchema),
        profileContext: ProfileContextSchema.optional(),
        warnings: z.array(NonEmptyStringSchema)
      })
      .strict(),
    symbols: z.array(ReviewSessionSymbolSchema).min(1)
  })
  .strict();

export type ReviewSessionArtifact = z.infer<typeof ReviewSessionArtifactSchema>;
export type ReviewSessionArtifactReference = z.infer<typeof ArtifactReferenceSchema>;
export type ReviewSessionSourceType = z.infer<typeof ReviewSessionSourceTypeSchema>;
export type ReviewSessionReviewMarkValue = z.infer<
  typeof ReviewSessionReviewMarkValueSchema
>;

export function parseReviewSessionArtifact(
  artifact: unknown
): ReviewSessionArtifact {
  return ReviewSessionArtifactSchema.parse(artifact);
}

export function isReviewSessionArtifact(
  artifact: unknown
): artifact is ReviewSessionArtifact {
  return ReviewSessionArtifactSchema.safeParse(artifact).success;
}
