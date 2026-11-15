import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  benchmarkMarkdown,
  groundTruthSchema,
  normaliseKey,
  scoreBenchmark,
  type GroundTruth,
  type Prediction,
} from '../src/index';

const GT_DIR = join(import.meta.dirname, '../../../../documentation/benchmark/ground-truth');

const truth: GroundTruth = {
  version: 1,
  corpus: {
    name: 'example/app',
    url: 'https://example.com/app',
    commit: 'a'.repeat(40),
    licence: 'MIT',
  },
  labelling: {
    status: 'claude-labelled',
    labelledBy: 'test',
    labelledOn: '2026-11-15',
    method: 'fixture',
  },
  scope: [
    { type: 'handled_by', paths: ['src'], rule: 'routes' },
    { type: 'writes_table', paths: ['src/repo'], rule: 'writes' },
  ],
  relationships: [
    {
      type: 'handled_by',
      from: 'GET /a',
      to: 'src/A.java#A.a',
      evidence: { path: 'src/A.java', line: 3 },
    },
    {
      type: 'handled_by',
      from: 'post /b/',
      to: 'src/A.java#A.b',
      evidence: { path: 'src/A.java', line: 7 },
    },
    {
      type: 'handled_by',
      from: 'GET /missed',
      to: 'src/A.java#A.m',
      evidence: { path: 'src/A.java', line: 9 },
    },
  ],
  outOfScope: [],
};

const p = (
  type: string,
  from: string,
  to: string,
  confidence: Prediction['confidence'],
  sourcePath: string | null = 'src/A.java',
): Prediction => ({ type, from, to, confidence, method: 'rule', sourcePath });

describe('benchmark scoring (ACC-004)', () => {
  it('counts TP, FP and FN with precision, recall and F1 per type', () => {
    const s = scoreBenchmark(truth, [
      p('handled_by', 'GET /a', 'src/A.java#A.a', 'observed'),
      p('handled_by', 'POST /b (src/A.java)', 'src/A.java#A.b', 'inferred'),
      p('handled_by', 'GET /wrong', 'src/A.java#A.x', 'inferred'),
      p('calls', 'src/A.java#A.a', 'src/A.java#A.b', 'observed'), // type not in scope
    ]);
    const h = s.types.find((t) => t.type === 'handled_by')!;
    expect([h.truePositives, h.falsePositives, h.falseNegatives]).toEqual([2, 1, 1]);
    expect(h.precision).toBeCloseTo(2 / 3);
    expect(h.recall).toBeCloseTo(2 / 3);
    expect(h.f1).toBeCloseTo(2 / 3);
    expect(h.byEvidence.observed).toEqual({ truePositives: 1, falsePositives: 0 });
    expect(h.byEvidence.inferred).toEqual({ truePositives: 1, falsePositives: 1 });
    expect(h.falseNegativeList.map((f) => f.from)).toEqual(['GET /missed']);
    expect(s.types.map((t) => t.type)).toEqual(['handled_by', 'writes_table']);
  });

  it('ignores predictions outside the labelled paths and keeps the strongest duplicate', () => {
    const s = scoreBenchmark(truth, [
      p('handled_by', 'GET /a', 'src/A.java#A.a', 'inferred'),
      p('handled_by', 'GET /a', 'src/A.java#A.a', 'observed'),
      p('handled_by', 'GET /t', 'test/T.java#T.t', 'observed', 'test/T.java'),
      p('handled_by', 'GET /s', 'srcx/S.java#S.s', 'observed', 'srcx/S.java'),
      p('handled_by', 'GET /z', 'src/z.spec.ts#Z.z', 'observed', 'src/z.spec.ts'),
      p('writes_table', 'src/repo/R.java#R', 'table:r', 'inferred', 'src/repo/R.java'),
    ]);
    const h = s.types.find((t) => t.type === 'handled_by')!;
    expect(h.byEvidence.observed.truePositives).toBe(1);
    expect(h.byEvidence.inferred.truePositives).toBe(0);
    expect(h.falsePositives).toBe(0);
    expect(s.predictionsOutOfScope).toBe(3);
    const w = s.types.find((t) => t.type === 'writes_table')!;
    expect([w.truePositives, w.falsePositives, w.falseNegatives]).toEqual([0, 1, 0]);
    expect(w.precision).toBe(0);
    expect(w.recall).toBeNull(); // nothing of this type in the ground truth
    expect(w.f1).toBeNull();
  });

  it('normalises route verbs, trailing slashes, de-duplicated keys and table case', () => {
    expect(normaliseKey('get /owners/')).toBe('GET /owners');
    expect(normaliseKey('GET /')).toBe('GET /');
    expect(normaliseKey('GET /x (src/B.ts)')).toBe('GET /x');
    expect(normaliseKey('table:Owners')).toBe('table:owners');
    expect(normaliseKey('src/A.java#A.a')).toBe('src/A.java#A.a');
    // A later overload, keyed with its start line, is the same labelled method.
    expect(normaliseKey('src/A.java#A.a@38')).toBe('src/A.java#A.a');
    expect(normaliseKey('npm:@scope/pkg@1')).toBe('npm:@scope/pkg@1');
  });

  it('puts the labelling status and a warning before any figure that is not adjudicated', () => {
    const md = benchmarkMarkdown(scoreBenchmark(truth, []), '0.1.0');
    expect(md.indexOf('claude-labelled')).toBeLessThan(md.indexOf('| Type |'));
    expect(md).toContain('must not be quoted externally');
    const adjudicated = benchmarkMarkdown(
      scoreBenchmark(
        {
          ...truth,
          labelling: {
            ...truth.labelling,
            status: 'adjudicated',
            reviewedBy: 'r',
            reviewedOn: '2026-11-16',
          },
        },
        [],
      ),
      '0.1.0',
    );
    expect(adjudicated).not.toContain('must not be quoted externally');
  });

  it('rejects ground truth without a full commit hash or with an absolute path', () => {
    expect(() =>
      groundTruthSchema.parse({ ...truth, corpus: { ...truth.corpus, commit: 'abc1234' } }),
    ).toThrow();
    expect(() =>
      groundTruthSchema.parse({
        ...truth,
        scope: [{ type: 'calls', paths: ['/etc'], rule: 'x' }],
      }),
    ).toThrow();
  });

  it('every committed ground-truth file is valid, in scope and free of duplicates', () => {
    const files = readdirSync(GT_DIR).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const gt = groundTruthSchema.parse(JSON.parse(readFileSync(join(GT_DIR, f), 'utf8')));
      const scoped = new Set(gt.scope.map((s) => s.type));
      const seen = new Set<string>();
      for (const r of gt.relationships) {
        expect(scoped.has(r.type), `${f}: ${r.type} has no scope`).toBe(true);
        const k = `${r.type} ${normaliseKey(r.from)} ${normaliseKey(r.to)}`;
        expect(seen.has(k), `${f}: duplicate ${k}`).toBe(false);
        seen.add(k);
      }
    }
  });

  it('the PetClinic ground truth holds 17 routes, 6 entity tables, 7 table reads, 2 table writes and 6 injections', () => {
    const gt = groundTruthSchema.parse(
      JSON.parse(readFileSync(join(GT_DIR, 'spring-petclinic.json'), 'utf8')),
    );
    const count = (t: string) => gt.relationships.filter((r) => r.type === t).length;
    expect([
      count('handled_by'),
      count('maps_to'),
      count('reads_table'),
      count('writes_table'),
      count('injects'),
    ]).toEqual([17, 6, 7, 2, 6]);
  });

  it('the JHipster sample ground truth holds 38 routes, 5 entity tables, 27 table reads, 5 table writes and 20 injections', () => {
    const gt = groundTruthSchema.parse(
      JSON.parse(readFileSync(join(GT_DIR, 'jhipster-sample-app.json'), 'utf8')),
    );
    const count = (t: string) => gt.relationships.filter((r) => r.type === t).length;
    expect([
      count('handled_by'),
      count('maps_to'),
      count('reads_table'),
      count('writes_table'),
      count('injects'),
    ]).toEqual([38, 5, 27, 5, 20]);
  });
});
