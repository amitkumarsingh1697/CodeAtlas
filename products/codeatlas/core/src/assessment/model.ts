/**
 * Assessment data model v1 (REP-001, ADR 0030). The free engine produces this versioned,
 * validated JSON from an index; the paid report generator (a separate private repository)
 * renders it. Everything here is read from the stored index: no field is estimated, and each
 * finding carries its evidence class and the path and line it was read from.
 *
 * Paths are repository-relative. The absolute root of the analysed checkout is never included.
 */
import { z } from 'zod';

export const ASSESSMENT_MODEL_VERSION = 1;

const evidence = z.enum(['observed', 'inferred', 'unknown']);
const location = z.strictObject({ path: z.string(), line: z.number().int().nullable() });
const confidenceCounts = z.strictObject({
  observed: z.number().int().nonnegative(),
  inferred: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});

export const runMetadataSchema = z.strictObject({
  engineVersion: z.string(),
  schemaVersion: z.number().int(),
  /** SHA-256 of the scan policy: file limits, analysers, incremental mode and SCIP options. */
  scanPolicyHash: z.string().regex(/^[0-9a-f]{64}$/),
  scanPolicy: z.strictObject({
    maxFiles: z.number().nullable(),
    maxFileBytes: z.number(),
    maxLockfileBytes: z.number(),
    adapters: z.array(z.string()),
    incremental: z.boolean(),
    scipFiles: z.number().int(),
    runIndexers: z.boolean(),
  }),
  /** SHA-256 of the rule catalogue (rule ids, adapters and labels), so rule changes are visible. */
  ruleCatalogueHash: z.string().regex(/^[0-9a-f]{64}$/),
  typescriptVersion: z.string(),
  environment: z.strictObject({ node: z.string(), platform: z.string(), arch: z.string() }),
});
export type RunMetadata = z.infer<typeof runMetadataSchema>;

export const assessmentModelSchema = z.strictObject({
  modelVersion: z.literal(ASSESSMENT_MODEL_VERSION),
  generatedAt: z.string(),
  run: runMetadataSchema.extend({ indexedAt: z.string(), durationMs: z.number() }),
  scope: z.strictObject({
    repository: z.string(),
    head: z.string().nullable(),
    branch: z.string().nullable(),
    uncommittedFiles: z.number().int().nullable(),
  }),
  coverage: z.strictObject({
    summary: z.string(),
    filesInRepository: z.number().int(),
    filesRead: z.number().int(),
    analysed: z.number().int(),
    readable: z.number().int(),
    coverage: z.number().nullable(),
    fullCoverage: z.number().nullable(),
    fileLimitReached: z.boolean(),
    languages: z.array(
      z.strictObject({ language: z.string(), files: z.number().int(), analysed: z.number().int() }),
    ),
    exclusions: z.array(z.strictObject({ reason: z.string(), files: z.number().int() })),
    limitations: z.array(z.string()),
  }),
  evidence: z.strictObject({
    total: z.number().int(),
    byKind: z.array(confidenceCounts.extend({ kind: z.string() })),
    byRule: z.array(confidenceCounts.extend({ method: z.string(), adapter: z.string() })),
    /** Edges stored before schema v9, with no rule recorded. */
    withoutRule: z.number().int(),
  }),
  architecture: z.strictObject({
    modules: z.array(
      z.strictObject({ name: z.string(), files: z.number().int(), codeSymbols: z.number().int() }),
    ),
    entryPoints: z.array(location.extend({ name: z.string(), evidence })),
    routes: z.array(
      location.extend({
        method: z.string().nullable(),
        route: z.string(),
        framework: z.string().nullable(),
        handler: z.string().nullable(),
        evidence: evidence.nullable(),
      }),
    ),
    tables: z.array(
      location.extend({
        name: z.string(),
        columns: z.number().int(),
        /** Code that reads or writes the table, by evidence class. */
        accessedBy: confidenceCounts,
      }),
    ),
    integrations: z.array(
      location.extend({
        kind: z.string(),
        target: z.string(),
        evidence,
        method: z.string().nullable(),
      }),
    ),
  }),
  unresolved: z.strictObject({
    recorded: z.number().int(),
    /** Unresolved references beyond the stored cap; when above 0 the total is at least recorded + dropped. */
    dropped: z.number().int(),
    capped: z.boolean(),
    /** `count` is stored; `dropped` went past that kind's cap (each kind is capped on its own). */
    byKind: z.array(
      z.strictObject({ kind: z.string(), count: z.number().int(), dropped: z.number().int() }),
    ),
  }),
});
export type AssessmentModel = z.infer<typeof assessmentModelSchema>;
