// User exclusions (--exclude): excluded files are never read and leave no trace in the index.
import { rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { indexRepository, openDb } from '../src';
import { excludeMatcher } from '../src/indexer/files';
import { makeFixtureRepo } from './fixture';

describe('excludeMatcher', () => {
  const m = (patterns: string[], path: string) => excludeMatcher(patterns)(path);
  it('matches a bare name anywhere, a path from the root, and a folder with or without a slash', () => {
    expect(m(['*.py'], 'tools/report.py')).toBe(true);
    expect(m(['*.py'], 'tools/report.pyc')).toBe(false);
    expect(m(['ring'], 'src/ring/a.ts')).toBe(true);
    expect(m(['src/ring/'], 'src/ring/a.ts')).toBe(true);
    expect(m(['src/ring'], 'src/ring/a.ts')).toBe(true);
    expect(m(['src/ring'], 'src/ringtone.ts')).toBe(false);
    expect(m(['ring/'], 'lib/src/ring/a.ts')).toBe(true);
    expect(m(['/src'], 'lib/src/x.ts')).toBe(false);
    expect(m(['./src/*.ts'], 'src/cart.ts')).toBe(true);
    expect(m(['src/*.ts'], 'src/ring/a.ts')).toBe(false);
    expect(m(['src/**/*.ts'], 'src/ring/a.ts')).toBe(true);
    expect(m(['src/**/*.ts'], 'src/cart.ts')).toBe(true);
    expect(m(['**/secret-*'], 'a/b/secret-plan.md')).toBe(true);
    expect(m(['a?c.ts'], 'abc.ts')).toBe(true);
    expect(m(['a.c'], 'abc')).toBe(false);
    expect(m([], 'anything')).toBe(false);
  });
  it('refuses a pattern that would match the whole repository or escape it', () => {
    for (const p of ['', '**', '*', '/', '../x', 'a/../b'])
      expect(() => excludeMatcher([p]), p).toThrow(/exclude/u);
  });
});

describe('indexing with exclusions', () => {
  let root: string;
  let home: string;
  beforeAll(() => {
    root = makeFixtureRepo();
    home = `${root}-home`;
  });
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it('never reads excluded files, stores nothing about them, and reports a count per pattern', () => {
    const dbFile = `${home}.db`;
    const db = openDb(dbFile);
    const report = indexRepository(db, root, { limits: { exclude: ['src/ring/', '*.py'] } });
    db.close();
    // Every value in every table, as text.
    const raw = new DatabaseSync(dbFile, { readOnly: true });
    const tables = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    const dump = tables
      .map((t) => JSON.stringify(raw.prepare(`SELECT * FROM "${t.name}"`).all()))
      .join('\n');
    raw.close();
    rmSync(dbFile, { force: true });
    for (const s of ['src/ring/a.ts', 'src/ring/b.ts', 'tools/report.py', 'quarterly report'])
      expect(dump, s).not.toContain(s);
    expect(dump).toContain('src/cart.ts');
    expect(report.inventory.unlisted).toEqual(
      expect.arrayContaining([
        { path: 'src/ring/', reason: 'excluded by the user: 2 files' },
        { path: '*.py', reason: 'excluded by the user: 1 file' },
      ]),
    );
  });

  it('records the exclusions in the scan policy, so runs with different exclusions differ', () => {
    const db = openDb(':memory:');
    const a = indexRepository(db, root, { full: true });
    const b = indexRepository(db, root, { full: true, limits: { exclude: ['*.py'] } });
    expect(a.run!.scanPolicy.excludePatterns).toBeUndefined();
    expect(b.run!.scanPolicy.excludePatterns).toBe(1);
    expect(b.run!.scanPolicyHash).not.toBe(a.run!.scanPolicyHash);
    db.close();
  });
});
