import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { indexRepository, openDb, type Db } from '../src/index';

/**
 * Migrations replayed in order (TS-003): renames and drops in SQL files and in SQL strings of
 * TypeScript migrations, `down()` ignored, and DDL whose names are built at run time as gaps.
 */
const j = (...lines: string[]) => lines.join('\n') + '\n';
const M = 'server/src/schema/migrations';
const FILES: Record<string, string> = {
  [`${M}/1700000000001-Initial.ts`]: j(
    "import { Kysely, sql } from 'kysely';",
    'export async function up(db: Kysely<any>): Promise<void> {',
    '  await sql`CREATE TABLE "albums" ("id" uuid PRIMARY KEY, "albumName" character varying NOT NULL);`.execute(db);',
    '  await sql`CREATE TABLE "scratch" ("id" integer);`.execute(db);',
    '}',
    'export async function down(db: Kysely<any>): Promise<void> {',
    '  await sql`DROP TABLE "albums";`.execute(db);',
    '}',
  ),
  [`${M}/1700000000002-Rename.ts`]: j(
    "import { Kysely, sql } from 'kysely';",
    'export async function up(db: Kysely<any>): Promise<void> {',
    '  await sql`ALTER TABLE "albums" RENAME TO "album";`.execute(db);',
    '  await sql`ALTER TABLE "album" RENAME COLUMN "albumName" TO "name";`.execute(db);',
    '  await sql`ALTER TABLE "album" ADD COLUMN "description" text;`.execute(db);',
    '  await sql`ALTER TABLE "album" ADD COLUMN "legacy" text;`.execute(db);',
    '}',
    'export async function down(db: Kysely<any>): Promise<void> {',
    '  await sql`ALTER TABLE "album" RENAME TO "albums";`.execute(db);',
    '}',
  ),
  [`${M}/1700000000003-Drop.ts`]: j(
    "import { Kysely, sql } from 'kysely';",
    'export async function up(db: Kysely<any>): Promise<void> {',
    '  await sql`DROP TABLE IF EXISTS "scratch";`.execute(db);',
    '  await sql`ALTER TABLE "album" DROP COLUMN "legacy";`.execute(db);',
    '}',
    'export async function down(): Promise<void> {}',
  ),
  [`${M}/1700000000004-Dynamic.ts`]: j(
    "import { Kysely, sql } from 'kysely';",
    "const tables = [{ oldName: 'scratch2', newName: 'scratch_two' }];",
    'export async function up(db: Kysely<any>): Promise<void> {',
    '  for (const t of tables) {',
    '    await sql`ALTER TABLE ${sql.raw(t.oldName)} RENAME TO ${sql.raw(t.newName)};`.execute(db);',
    '  }',
    '}',
  ),
  // Columns added to a table whose creation was not read: kept, and marked partial.
  [`${M}/1700000000005-Photo.ts`]: j(
    "import { Kysely, sql } from 'kysely';",
    'export async function up(db: Kysely<any>): Promise<void> {',
    '  await sql`ALTER TABLE "photo" ADD COLUMN "width" integer;`.execute(db);',
    '}',
  ),
  // Flyway-style SQL files: V10 runs after V2, not before it.
  'db/V1__init.sql': 'CREATE TABLE users (id integer PRIMARY KEY);\n',
  'db/V2__email.sql': 'ALTER TABLE users ADD COLUMN email text;\n',
  'db/V10__rename.sql': 'ALTER TABLE users RENAME TO account;\n',
  // A Kysely `eb.table('album')` names a row of the query, not a table definition.
  'server/src/repositories/album.repository.ts': j(
    "import { Kysely } from 'kysely';",
    'export class AlbumRepository {',
    '  constructor(private db: Kysely<any>) {}',
    "  get() { return this.db.selectFrom('album').select((eb) => eb.fn.toJson(eb.table('res')).as('x')); }",
    '}',
  ),
};

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function index(files: Record<string, string>): { db: Db; repoId: number } {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-replay-'));
  roots.push(root);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  const db = openDb(':memory:');
  return { db, repoId: indexRepository(db, root).repoId };
}

describe('schema migrations replayed in order (TS-003)', () => {
  const { db, repoId } = index(FILES);
  const tables = () =>
    (
      db
        .prepare(
          "SELECT key, file_path, data FROM nodes WHERE repo_id = ? AND kind = 'table' ORDER BY key",
        )
        .all(repoId) as { key: string; file_path: string; data: string }[]
    ).map((r) => ({ key: r.key, path: r.file_path, data: JSON.parse(r.data) }));

  it('keeps the tables and columns the migrations leave, under their final names', () => {
    expect(
      tables().map(
        (t) => `${t.key}: ${t.data.columns.map((c: { name: string }) => c.name).join(', ')}`,
      ),
    ).toEqual([
      'table:account: id, email',
      'table:album: id, name, description',
      'table:photo: width',
    ]);
    expect(tables().map((t) => `${t.key} ${t.data.partial ?? '-'}`)).toEqual([
      'table:account -',
      'table:album -',
      'table:photo columns added by ALTER TABLE; no CREATE TABLE was read for this name',
    ]);
  });

  it('records where a table was renamed, and keeps its creating migration as the definition', () => {
    const album = tables().find((t) => t.key === 'table:album')!;
    expect(album.path).toBe(`${M}/1700000000001-Initial.ts`);
    expect(album.data.renamedFrom).toEqual([
      { name: 'albums', path: `${M}/1700000000002-Rename.ts`, line: 3 },
    ]);
  });

  it('records DDL whose table name is built at run time as a gap', () => {
    const gaps = db
      .prepare(
        "SELECT file_path, line, kind, reason FROM unresolved WHERE repo_id = ? AND kind = 'query'",
      )
      .all(repoId) as { file_path: string; line: number; kind: string; reason: string }[];
    expect(gaps).toEqual([
      {
        file_path: `${M}/1700000000004-Dynamic.ts`,
        line: 5,
        kind: 'query',
        reason: 'schema change whose table name is built at run time; not replayed',
      },
    ]);
  });

  it('links Kysely queries to the final table name', () => {
    const n = db
      .prepare(
        `SELECT COUNT(*) n FROM edges e JOIN nodes d ON d.id = e.dst
          WHERE e.repo_id = ? AND e.kind = 'reads_table' AND d.key = 'table:album'`,
      )
      .get(repoId) as { n: number };
    expect(n.n).toBe(1);
  });
});
