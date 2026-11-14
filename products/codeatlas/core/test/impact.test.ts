// IMP-001 / IMP-002 on a hand-built graph whose answer is worked out by hand.
//
//   start ◄─calls(observed)── a ◄─calls(inferred)── b ◄─handled_by(observed)── GET /b
//     ▲                                           ▲
//     └──────calls(inferred)── c ─────────────────┘ (c ◄─calls(observed)── b is NOT an edge)
//   b ◄─calls(observed)── d          table ◄─reads_table(inferred)── a
//
// a: observed (direct observed call). b: inferred (only via a's inferred link). c: inferred.
// d: inferred (d→b observed, but b itself is only inferred). Route GET /b: inferred.
import { describe, expect, it } from 'vitest';
import { IMPACT_CAVEAT, impactOf, openDb } from '../src';

function graph() {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO repos (id, root, name, created_at) VALUES (1, '/r', 'r', 'now')").run();
  const node = (id: number, kind: string, key: string) =>
    db
      .prepare(
        'INSERT INTO nodes (id, repo_id, kind, key, name, file_path, data) VALUES (?, 1, ?, ?, ?, ?, ?)',
      )
      .run(id, kind, key, key, kind === 'route' ? 'src/routes.ts' : `src/${key}.ts`, '{}');
  const edge = (src: number, dst: number, kind: string, confidence: string) =>
    db
      .prepare(
        'INSERT INTO edges (repo_id, src, dst, kind, confidence, method) VALUES (1, ?, ?, ?, ?, ?)',
      )
      .run(src, dst, kind, confidence, 'test');
  node(1, 'symbol', 'start');
  node(2, 'symbol', 'a');
  node(3, 'symbol', 'b');
  node(4, 'symbol', 'c');
  node(5, 'symbol', 'd');
  node(6, 'route', 'GET /b');
  node(7, 'table', 'owners');
  edge(2, 1, 'calls', 'observed');
  edge(3, 2, 'calls', 'inferred');
  edge(4, 1, 'calls', 'inferred');
  edge(5, 3, 'calls', 'observed');
  edge(6, 3, 'handled_by', 'observed');
  edge(2, 7, 'reads_table', 'inferred');
  return db;
}

describe('impact carries the weakest evidence class along the strongest path (IMP-001)', () => {
  const db = graph();
  const imp = impactOf(db, 1, 1);
  const ev = Object.fromEntries(imp.affected.map((n) => [n.key, n.evidence]));

  it('labels each affected node by its strongest path', () => {
    expect(ev).toEqual({
      a: 'observed',
      b: 'inferred',
      c: 'inferred',
      d: 'inferred',
      'GET /b': 'inferred',
    });
    expect(imp.groups).toEqual({ observed: 1, inferred: 4, unknown: 0 });
  });

  it('lists observed reach first, then by distance, with the route and caveat', () => {
    expect(imp.affected[0]?.key).toBe('a');
    expect(imp.routes).toEqual([expect.objectContaining({ key: 'GET /b', evidence: 'inferred' })]);
    expect(imp.caveat).toBe(IMPACT_CAVEAT);
    expect(imp.caveat).toMatch(/inferred reach includes at least one link/);
  });

  it('prefers a stronger path even when it is longer', () => {
    // Add a longer, fully observed route to c: c → x → start.
    db.prepare(
      "INSERT INTO nodes (id, repo_id, kind, key, name, file_path, data) VALUES (8, 1, 'symbol', 'x', 'x', 'src/x.ts', '{}')",
    ).run();
    db.prepare(
      "INSERT INTO edges (repo_id, src, dst, kind, confidence, method) VALUES (1, 8, 1, 'calls', 'observed', 't'), (1, 4, 8, 'calls', 'observed', 't')",
    ).run();
    const c = impactOf(db, 1, 1).affected.find((n) => n.key === 'c');
    expect(c).toMatchObject({ evidence: 'observed', distance: 2 });
  });
});

describe('impact of a table is the code that uses it (IMP-002)', () => {
  it('walks reads_table back to the reader and its callers', () => {
    const db = graph();
    const imp = impactOf(db, 1, 7);
    expect(imp.affected.map((n) => `${n.key}:${n.evidence}`)).toEqual(
      expect.arrayContaining(['a:inferred', 'b:inferred']),
    );
  });
});
