/**
 * Benchmark scoring (ACC-004): precision, recall and F1 by relationship type, and precision by
 * evidence class, following package doc 07 §3. Pure apart from `predictionsFromDb`, which only reads.
 */
import type { Db } from '../store/db';
import {
  BENCHMARK_TYPES,
  normaliseKey,
  type BenchmarkType,
  type GroundTruth,
} from './ground-truth';

type Conf = 'observed' | 'inferred' | 'unknown';

export interface Prediction {
  type: string;
  from: string;
  to: string;
  confidence: Conf;
  method: string | null;
  /** Repository-relative file of the relationship's source, used for the scope check. */
  sourcePath: string | null;
}

export interface TypeScore {
  type: BenchmarkType;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  /** null when nothing of this type was predicted in scope (precision undefined). */
  precision: number | null;
  /** null when the ground truth has no relationship of this type (recall undefined). */
  recall: number | null;
  f1: number | null;
  byEvidence: Record<Conf, { truePositives: number; falsePositives: number }>;
  falsePositiveList: { from: string; to: string; confidence: Conf; method: string | null }[];
  falseNegativeList: { from: string; to: string; evidence: { path: string; line: number } }[];
}

export interface BenchmarkScore {
  corpus: GroundTruth['corpus'];
  labelling: GroundTruth['labelling'];
  types: TypeScore[];
  /** Predictions of an in-scope type whose source file lies outside the labelled paths. */
  predictionsOutOfScope: number;
}

const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

export function predictionsFromDb(db: Db, repoId: number): Prediction[] {
  const rows = db
    .prepare(
      `SELECT e.kind, e.confidence, e.method, e.evidence_path, s.key AS src, s.file_path AS src_path, d.key AS dst
         FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
        WHERE e.repo_id = ?`,
    )
    .all(repoId) as {
    kind: string;
    confidence: Conf;
    method: string | null;
    evidence_path: string | null;
    src: string;
    src_path: string | null;
    dst: string;
  }[];
  return rows.map((r) => ({
    type: r.kind,
    from: r.src,
    to: r.dst,
    confidence: r.confidence,
    method: r.method,
    sourcePath: r.src_path ?? r.evidence_path,
  }));
}

export function scoreBenchmark(truth: GroundTruth, predictions: Prediction[]): BenchmarkScore {
  const pair = (from: string, to: string) => `${normaliseKey(from)}\u0000${normaliseKey(to)}`;
  let outOfScope = 0;
  const types: TypeScore[] = [];
  for (const type of BENCHMARK_TYPES) {
    const scopes = truth.scope.filter((s) => s.type === type);
    if (scopes.length === 0) continue;
    const paths = scopes.flatMap((s) => s.paths);
    const inScope = (p: string | null) =>
      p !== null && paths.some((root) => p === root || p.startsWith(root.replace(/\/?$/u, '/')));

    const expected = new Map<string, GroundTruth['relationships'][number]>();
    for (const r of truth.relationships) if (r.type === type) expected.set(pair(r.from, r.to), r);

    // Collapse duplicate predictions of the same pair, keeping the strongest evidence class.
    const rank: Record<Conf, number> = { observed: 0, inferred: 1, unknown: 2 };
    const predicted = new Map<string, Prediction>();
    for (const p of predictions) {
      if (p.type !== type) continue;
      if (!inScope(p.sourcePath)) {
        outOfScope++;
        continue;
      }
      const k = pair(p.from, p.to);
      const prev = predicted.get(k);
      if (!prev || rank[p.confidence] < rank[prev.confidence]) predicted.set(k, p);
    }

    const byEvidence: TypeScore['byEvidence'] = {
      observed: { truePositives: 0, falsePositives: 0 },
      inferred: { truePositives: 0, falsePositives: 0 },
      unknown: { truePositives: 0, falsePositives: 0 },
    };
    const falsePositiveList: TypeScore['falsePositiveList'] = [];
    let tp = 0;
    for (const [k, p] of predicted) {
      if (expected.has(k)) {
        tp++;
        byEvidence[p.confidence].truePositives++;
      } else {
        byEvidence[p.confidence].falsePositives++;
        falsePositiveList.push({
          from: p.from,
          to: p.to,
          confidence: p.confidence,
          method: p.method,
        });
      }
    }
    const falseNegativeList = [...expected]
      .filter(([k]) => !predicted.has(k))
      .map(([, r]) => ({ from: r.from, to: r.to, evidence: r.evidence }));
    const fp = falsePositiveList.length;
    const fn = falseNegativeList.length;
    const precision = ratio(tp, tp + fp);
    const recall = ratio(tp, tp + fn);
    const f1 =
      precision === null || recall === null || precision + recall === 0
        ? null
        : (2 * precision * recall) / (precision + recall);
    types.push({
      type,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision,
      recall,
      f1,
      byEvidence,
      falsePositiveList: falsePositiveList.sort((a, b) =>
        `${a.from} ${a.to}`.localeCompare(`${b.from} ${b.to}`),
      ),
      falseNegativeList: falseNegativeList.sort((a, b) =>
        `${a.from} ${a.to}`.localeCompare(`${b.from} ${b.to}`),
      ),
    });
  }
  return {
    corpus: truth.corpus,
    labelling: truth.labelling,
    types,
    predictionsOutOfScope: outOfScope,
  };
}

const pct = (v: number | null) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);

/** A Markdown summary with the labelling status first, so no figure is read without it. */
export function benchmarkMarkdown(s: BenchmarkScore, engineVersion: string): string {
  const lines = [
    `## ${s.corpus.name} @ \`${s.corpus.commit.slice(0, 7)}\``,
    '',
    `Labelling: **${s.labelling.status}** by ${s.labelling.labelledBy} on ${s.labelling.labelledOn}` +
      (s.labelling.reviewedBy
        ? `, reviewed by ${s.labelling.reviewedBy} on ${s.labelling.reviewedOn ?? 'unknown date'}`
        : ', not independently reviewed') +
      `. CodeAtlas engine ${engineVersion}.`,
    s.labelling.status === 'adjudicated'
      ? ''
      : '\n> Not adjudicated: these figures are for engineering use only and must not be quoted externally.\n',
    '| Type | TP | FP | FN | Precision | Recall | F1 | Observed TP/FP | Inferred TP/FP |',
    '| --- | --: | --: | --: | --: | --: | --: | --: | --: |',
    ...s.types.map(
      (t) =>
        `| ${t.type} | ${t.truePositives} | ${t.falsePositives} | ${t.falseNegatives} | ${pct(t.precision)} | ${pct(t.recall)} | ${pct(t.f1)} | ${t.byEvidence.observed.truePositives}/${t.byEvidence.observed.falsePositives} | ${t.byEvidence.inferred.truePositives}/${t.byEvidence.inferred.falsePositives} |`,
    ),
  ];
  for (const t of s.types) {
    for (const f of t.falsePositiveList)
      lines.push(
        `- FP ${t.type}: \`${f.from}\` → \`${f.to}\` (${f.confidence}, ${f.method ?? 'no rule'})`,
      );
    for (const f of t.falseNegativeList)
      lines.push(
        `- FN ${t.type}: \`${f.from}\` → \`${f.to}\` (${f.evidence.path}:${f.evidence.line})`,
      );
  }
  return lines.join('\n') + '\n';
}
