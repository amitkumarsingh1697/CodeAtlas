/**
 * Draws the spot-check sample for a ground-truth file (decision D-9): 10% of each type's labels,
 * rounded up, chosen by a seeded shuffle so the same seed gives the same sample again.
 *
 * Usage: pnpm --filter @nexora/codeatlas-core exec tsx scripts/review-sample.ts \
 *          <ground-truth.json> <seed>
 *
 * Prints a Markdown checklist. After the review, record `reviewedBy`, `reviewedOn` and
 * `review: { checked, disagreements, seed }` in the file and set `status` to `spot-checked`.
 */
import { readFileSync } from 'node:fs';
import { groundTruthSchema, reviewSample } from '../src/index';

const [truthPath, seed] = process.argv.slice(2);
if (!truthPath || !seed) {
  console.error('usage: review-sample.ts <ground-truth.json> <seed>');
  process.exit(2);
}
const truth = groundTruthSchema.parse(JSON.parse(readFileSync(truthPath, 'utf8')));
const sample = reviewSample(truth, seed);
const url = truth.corpus.url.replace(/\.git$/u, '');
const lines = [
  `## ${truth.corpus.name} @ \`${truth.corpus.commit.slice(0, 7)}\`: ${sample.length} of ${truth.relationships.length} labels (seed \`${seed}\`)`,
  '',
  'For each line, open the evidence and tick it if the relationship holds in the source. Note any that does not.',
  '',
  ...sample.map(
    (r) =>
      `- [ ] **${r.type}**: \`${r.from}\` → \`${r.to}\` ([${r.evidence.path}:${r.evidence.line}](${url}/blob/${truth.corpus.commit}/${r.evidence.path}#L${r.evidence.line}))`,
  ),
  '',
];
process.stdout.write(lines.join('\n'));
