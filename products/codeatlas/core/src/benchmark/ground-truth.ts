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
  'depends_on',
] as const;
export type BenchmarkType = (typeof BENCHMARK_TYPES)[number];

/**
 * Who has checked the labels. Figures may be quoted outside the company only from an `adjudicated`
 * file, or from a `spot-checked` one whose reviewer checked a random sample of at least 10% of its
 * labels (decision D-9, 2026-11-15; doc 07 §3 step 2 asks for independent manual review).
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
    /** The spot-check: labels checked (drawn by `reviewSample` with `seed`), and how many were wrong. */
    review: z
      .object({
        checked: z.number().int().positive(),
        disagreements: z.number().int().nonnegative(),
        seed: z.string().min(1),
      })
      .optional(),
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

/** The share of labels a spot-check must cover before its figures may be quoted (D-9). */
export const SPOT_CHECK_SHARE = 0.1;

/** Labels a spot-check of `total` labels must cover. */
export const spotCheckSize = (total: number): number => Math.ceil(total * SPOT_CHECK_SHARE);

/** Whether figures scored against this labelling may be quoted outside the company (D-9). */
export function isPublishable(labelling: GroundTruth['labelling'], labels: number): boolean {
  if (!labelling.reviewedBy || !labelling.reviewedOn) return false;
  if (labelling.status === 'adjudicated') return true;
  return (
    labelling.status === 'spot-checked' &&
    !!labelling.review &&
    labels > 0 &&
    labelling.review.checked >= spotCheckSize(labels)
  );
}

/** FNV-1a, then mulberry32: a small seeded generator, so a review sample can be drawn again. */
function seeded(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random sample of the labels for a reviewer (D-9): 10% of each type, rounded up, so every type
 * is checked. The same file and seed give the same sample, in file order.
 */
export function reviewSample(truth: GroundTruth, seed: string): GroundTruth['relationships'] {
  const rand = seeded(seed);
  const picked = new Set<number>();
  for (const type of BENCHMARK_TYPES) {
    const idx = truth.relationships.flatMap((r, i) => (r.type === type ? [i] : []));
    // Fisher-Yates, then the first n.
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j]!, idx[i]!];
    }
    for (const i of idx.slice(0, spotCheckSize(idx.length))) picked.add(i);
  }
  return truth.relationships.filter((_, i) => picked.has(i));
}
