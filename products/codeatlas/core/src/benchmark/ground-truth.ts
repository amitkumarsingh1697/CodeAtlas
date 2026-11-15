/**
 * Benchmark ground truth (ACC-001). A ground-truth file lists, for one pinned repository, every
 * relationship of each in-scope type that a person found in the source, so the scorer can count
 * true positives, false positives and false negatives (package doc 07 §3).
 *
 * Keys use the same spelling as CodeAtlas node keys, so matching is exact after normalisation:
 * - a route is `VERB /path` (verb upper case, no trailing slash except the root);
 * - a code symbol is `<repo-relative file>#<Container.member>`;
 * - a table is `table:<name>` (lower case, schema prefix kept when the source names one).
 */
import { z } from 'zod';

export const GROUND_TRUTH_VERSION = 1;

/** Relationship types the benchmark can score. They are CodeAtlas edge kinds. */
export const BENCHMARK_TYPES = [
  'handled_by',
  'maps_to',
  'reads_table',
  'writes_table',
  'calls',
  'imports',
  'injects',
] as const;
export type BenchmarkType = (typeof BENCHMARK_TYPES)[number];

/**
 * Who has checked the labels. Only `adjudicated` figures may be quoted outside the company
 * (doc 07 §3 step 2: independent manual review).
 */
export const LABEL_STATUSES = ['draft', 'claude-labelled', 'spot-checked', 'adjudicated'] as const;

const relPath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith('/') && !p.split('/').includes('..'), 'repository-relative path');

export const groundTruthSchema = z.object({
  version: z.literal(GROUND_TRUTH_VERSION),
  corpus: z.object({
    name: z.string().min(1),
    url: z.string().url(),
    commit: z.string().regex(/^[0-9a-f]{40}$/u, 'full 40-character commit hash'),
    licence: z.string().min(1),
  }),
  labelling: z.object({
    status: z.enum(LABEL_STATUSES),
    labelledBy: z.string().min(1),
    labelledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    reviewedBy: z.string().min(1).optional(),
    reviewedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
    method: z.string().min(1),
  }),
  /**
   * For each type, the source folders whose relationships of that type were all labelled. A
   * prediction of that type counts only when its source file lies under one of these paths.
   */
  scope: z
    .array(
      z.object({
        type: z.enum(BENCHMARK_TYPES),
        paths: z.array(relPath).min(1),
        rule: z.string().min(1),
      }),
    )
    .min(1),
  relationships: z.array(
    z.object({
      type: z.enum(BENCHMARK_TYPES),
      from: z.string().min(1),
      to: z.string().min(1),
      evidence: z.object({ path: relPath, line: z.number().int().positive() }),
      note: z.string().optional(),
    }),
  ),
  /** Cases a reader might expect but the rules put out of scope, recorded so nobody re-argues them. */
  outOfScope: z.array(z.object({ what: z.string().min(1), reason: z.string().min(1) })),
});
export type GroundTruth = z.infer<typeof groundTruthSchema>;

/** Normalises a node key so a ground-truth key and a CodeAtlas key compare equal. */
export function normaliseKey(key: string): string {
  let k = key.trim().replace(/ \([^()]*\)$/u, ''); // route keys de-duplicated with " (file)"
  const route = /^([A-Za-z]+) (\/\S*)$/u.exec(k);
  if (route) {
    let path = route[2]!;
    if (path.length > 1) path = path.replace(/\/+$/u, '');
    k = `${route[1]!.toUpperCase()} ${path}`;
  }
  if (k.startsWith('table:')) k = k.toLowerCase();
  // The indexer keys a later overload of a method \`File#C.m@<line>\` (indexer/docs.ts); ground
  // truth labels a method by name, so every overload of it compares as the one method.
  if (k.includes('#')) k = k.replace(/@\d+$/u, '');
  return k;
}
