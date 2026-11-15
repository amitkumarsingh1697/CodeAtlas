/**
 * Scores CodeAtlas against a ground-truth file (ACC-004, package doc 07 §3).
 *
 * Usage: pnpm --filter @nexora/codeatlas-core exec tsx scripts/score-benchmark.ts \
 *          <ground-truth.json> <repository checkout> [--json <out.json>]
 *
 * The checkout must be at the ground truth's pinned commit; the script refuses otherwise. It
 * indexes into an in-memory database with default options (no SCIP, no model), so a run is
 * reproducible from the commit, the ground truth and the CodeAtlas version.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ENGINE_VERSION,
  benchmarkMarkdown,
  groundTruthSchema,
  indexRepository,
  openDb,
  predictionsFromDb,
  scoreBenchmark,
} from '../src/index';

const [truthPath, repoPath, flag, out] = process.argv.slice(2);
if (!truthPath || !repoPath || (flag !== undefined && (flag !== '--json' || !out))) {
  console.error('usage: score-benchmark.ts <ground-truth.json> <repo> [--json <out.json>]');
  process.exit(2);
}
const truth = groundTruthSchema.parse(JSON.parse(readFileSync(truthPath, 'utf8')));
const root = resolve(repoPath);
const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== truth.corpus.commit) {
  console.error(`checkout is at ${head}, ground truth is pinned to ${truth.corpus.commit}`);
  process.exit(1);
}
const db = openDb(':memory:');
const report = indexRepository(db, root);
const score = scoreBenchmark(truth, predictionsFromDb(db, report.repoId));
process.stdout.write(benchmarkMarkdown(score, ENGINE_VERSION));
if (out) writeFileSync(out, JSON.stringify({ engineVersion: ENGINE_VERSION, ...score }, null, 2));
