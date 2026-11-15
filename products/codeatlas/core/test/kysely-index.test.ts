import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { edgesTo, indexRepository, nodeByKey, openDb, type Db } from '../src/index';

/** Kysely query-builder calls → table links (TS-004, rule schema.kysely-query). */
const MIGRATION = [
  'CREATE TABLE asset (id uuid PRIMARY KEY, "ownerId" uuid);',
  'CREATE TABLE album (id uuid PRIMARY KEY);',
  'CREATE TABLE album_asset ("albumId" uuid, "assetId" uuid);',
  'CREATE TABLE audit (id bigserial PRIMARY KEY);',
  '',
].join('\n');

const REPO = [
  "import { Kysely } from 'kysely';",
  '',
  'export class AlbumRepository {',
  '  constructor(private db: Kysely<any>) {}',
  '  getAssets(id: string) {',
  '    return this.db',
  "      .selectFrom('asset as a')",
  "      .innerJoin('album_asset', 'album_asset.assetId', 'a.id')",
  "      .where('albumId', '=', id);",
  '  }',
  '  create() {',
  "    return this.db.insertInto('album').values({ id: '1' });",
  '  }',
  '  purge() {',
  "    return this.db.deleteFrom(['album', 'audit']);",
  '  }',
  '  dynamic(name: string) {',
  '    return this.db.selectFrom(name as any);',
  '  }',
  '  withCte() {',
  "    return this.db.with('recent', (q) => q.selectFrom('asset')).selectFrom('recent');",
  '  }',
  '}',
  '',
].join('\n');

/** Same calls, no Kysely import: nothing may be linked from these. */
const NOT_KYSELY = [
  'export class Other {',
  '  constructor(private db: { selectFrom(t: string): unknown; deleteFrom(t: string): unknown }) {}',
  "  a() { return this.db.selectFrom('album'); }",
  "  b() { return this.db.deleteFrom('asset'); }",
  '}',
  '',
].join('\n');

/** A minimal stand-in for the kysely package so the checker can resolve the receiver type. */
const KYSELY_DTS = [
  'export declare class Kysely<DB> {',
  '  selectFrom(t: string | string[]): any;',
  '  insertInto(t: string): any;',
  '  updateTable(t: string | string[]): any;',
  '  deleteFrom(t: string | string[]): any;',
  '}',
  '',
].join('\n');

function index(files: Record<string, string>): { db: Db; repoId: number; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-kysely-'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  const db = openDb(':memory:');
  return { db, repoId: indexRepository(db, root).repoId, root };
}

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function linksTo(db: Db, repoId: number, name: string) {
  const t = nodeByKey(db, repoId, 'table', `table:${name}`);
  if (!t) return [];
  return edgesTo(db, repoId, t.id)
    .filter((e) => e.kind === 'reads_table' || e.kind === 'writes_table')
    .map((e) => ({
      kind: e.kind,
      confidence: e.confidence,
      method: e.method,
      from: (db.prepare('SELECT key FROM nodes WHERE id = ?').get(e.src) as { key: string }).key,
      line: e.evidenceLine,
    }))
    .sort((a, b) => `${a.from}${a.kind}`.localeCompare(`${b.from}${b.kind}`));
}

const base = {
  'package.json': JSON.stringify({ name: 'photos', dependencies: { kysely: '0.29.9' } }),
  'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
  'migrations/0001_init.sql': MIGRATION,
  'src/album.repository.ts': REPO,
  'src/other.ts': NOT_KYSELY,
};

describe('Kysely query-builder table links (TS-004)', () => {
  it('links reads, joins and writes when dependencies are not installed, as inferred', () => {
    const { db, repoId, root } = index(base);
    roots.push(root);
    const R = 'src/album.repository.ts#AlbumRepository';
    expect(linksTo(db, repoId, 'asset')).toEqual([
      {
        kind: 'reads_table',
        confidence: 'inferred',
        method: 'schema.kysely-query',
        from: `${R}.getAssets`,
        line: 7, // the line of `.selectFrom`, not of `this.db` where the chain starts
      },
      {
        kind: 'reads_table',
        confidence: 'inferred',
        method: 'schema.kysely-query',
        from: `${R}.withCte`,
        line: 21,
      },
    ]);
    expect(linksTo(db, repoId, 'album_asset').map((l) => [l.kind, l.from, l.line])).toEqual([
      ['reads_table', `${R}.getAssets`, 8],
    ]);
    expect(linksTo(db, repoId, 'album').map((l) => [l.kind, l.from])).toEqual([
      ['writes_table', `${R}.create`],
      ['writes_table', `${R}.purge`],
    ]);
    expect(linksTo(db, repoId, 'audit').map((l) => [l.kind, l.from])).toEqual([
      ['writes_table', `${R}.purge`],
    ]);
    // No table named `recent` exists (it is a CTE), and nothing comes from the non-Kysely file.
    expect(nodeByKey(db, repoId, 'table', 'table:recent')).toBeNull();
    const fromOther = db
      .prepare(
        "SELECT COUNT(*) AS n FROM edges e JOIN nodes s ON s.id = e.src WHERE e.repo_id = ? AND s.file_path = 'src/other.ts' AND e.kind IN ('reads_table','writes_table')",
      )
      .get(repoId) as { n: number };
    expect(fromOther.n).toBe(0);
  });

  it('labels a link observed when the receiver type resolves to the kysely package', () => {
    const { db, repoId, root } = index({
      ...base,
      'node_modules/kysely/package.json': JSON.stringify({
        name: 'kysely',
        version: '0.29.9',
        types: 'index.d.ts',
      }),
      'node_modules/kysely/index.d.ts': KYSELY_DTS,
    });
    roots.push(root);
    expect(linksTo(db, repoId, 'album').map((l) => [l.kind, l.confidence])).toEqual([
      ['writes_table', 'observed'],
      ['writes_table', 'observed'],
    ]);
  });
});
