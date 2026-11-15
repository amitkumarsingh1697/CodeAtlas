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

describe('tables declared with @immich/sql-tools (TS-003)', () => {
  const T = 'server/src/schema/tables';
  const { db, repoId } = index({
    // An old migration creates `assets`; a later one renames it with a name built at run time.
    [`${M}/1700000000001-Initial.ts`]: j(
      "import { Kysely, sql } from 'kysely';",
      'export async function up(db: Kysely<any>): Promise<void> {',
      '  await sql`CREATE TABLE "assets" ("id" uuid PRIMARY KEY);`.execute(db);',
      '  await sql`CREATE TABLE "migration_overrides" ("name" text PRIMARY KEY);`.execute(db);',
      '}',
    ),
    [`${M}/1700000000002-Standardize.ts`]: j(
      "import { Kysely, sql } from 'kysely';",
      "const renames = [['assets', 'asset']];",
      'export async function up(db: Kysely<any>): Promise<void> {',
      '  for (const [a, b] of renames) {',
      '    await sql`ALTER TABLE ${sql.raw(a)} RENAME TO ${sql.raw(b)};`.execute(db);',
      '  }',
      '}',
    ),
    'server/src/decorators.ts': j(
      "import { Column, ColumnOptions } from '@immich/sql-tools';",
      "export const UpdateIdColumn = (options: ColumnOptions = {}) => Column({ ...options, type: 'uuid' });",
    ),
    [`${T}/user.table.ts`]: j(
      "import { PrimaryGeneratedColumn, Table } from '@immich/sql-tools';",
      "@Table('user')",
      'export class UserTable {',
      '  @PrimaryGeneratedColumn()',
      '  id!: string;',
      '}',
    ),
    [`${T}/asset.table.ts`]: j(
      "import { Column, ForeignKeyColumn, PrimaryGeneratedColumn, Table } from '@immich/sql-tools';",
      "import { UpdateIdColumn } from 'src/decorators';",
      "import { UserTable } from 'src/schema/tables/user.table';",
      "@Table('asset')",
      'export class AssetTable {',
      '  @PrimaryGeneratedColumn()',
      '  id!: string;',
      "  @ForeignKeyColumn(() => UserTable, { onDelete: 'CASCADE' })",
      '  ownerId!: string;',
      '  @Column()',
      '  originalPath!: string;',
      '  @UpdateIdColumn()',
      '  updateId!: string;',
      '}',
    ),
    'server/src/repositories/asset.repository.ts': j(
      "import { Kysely } from 'kysely';",
      'export class AssetRepository {',
      '  constructor(private db: Kysely<any>) {}',
      "  get() { return this.db.selectFrom('asset').selectAll(); }",
      '}',
    ),
  });
  const node = (name: string) => {
    const r = db
      .prepare("SELECT data FROM nodes WHERE repo_id = ? AND kind = 'table' AND key = ?")
      .get(repoId, `table:${name}`) as { data: string } | undefined;
    return r ? (JSON.parse(r.data) as Record<string, unknown>) : undefined;
  };

  it('reads the declared tables and columns, and links them to the queries that use them', () => {
    const asset = node('asset')!;
    expect((asset.columns as { name: string }[]).map((c) => c.name)).toEqual([
      'id',
      'ownerId',
      'originalPath',
      'updateId',
    ]);
    expect(asset.undeclared).toBeUndefined();
    const n = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM edges e JOIN nodes d ON d.id = e.dst
             WHERE e.repo_id = ? AND e.kind = 'reads_table' AND d.key = 'table:asset') reads,
           (SELECT COUNT(*) FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
             WHERE e.repo_id = ? AND e.kind = 'references' AND s.key = 'table:asset' AND d.key = 'table:user') fks`,
      )
      .get(repoId, repoId) as { reads: number; fks: number };
    expect(n).toEqual({ reads: 1, fks: 1 });
  });

  it('says when a table the migrations leave is not among the declared tables', () => {
    expect(node('assets')?.undeclared).toBe(
      'not among the tables this repository declares with @immich/sql-tools; 1 migration statement whose table name is built at run time may have renamed or dropped it',
    );
    expect(node('migration_overrides')?.undeclared).toBeDefined();
    expect(node('user')?.undeclared).toBeUndefined();
  });
});
