/**
 * Database schema reading: tables, columns and foreign keys from SQL (`CREATE TABLE`,
 * `ALTER TABLE … ADD`), Prisma schema files and Drizzle table definitions in TypeScript.
 *
 * Labelling:
 * - A table, its columns and a foreign key are **observed**: they are written in the
 *   schema at the cited line. Types, lengths, precision and scale are recorded exactly as
 *   written; nothing is filled in from database defaults.
 * - A Drizzle query that names a table object (`db.select().from(users)`,
 *   `db.insert(users)`) is an **observed** read or write.
 * - A Prisma client call (`prisma.user.findMany()`) and a table named inside a SQL string
 *   (`'SELECT … FROM users'`) are **inferred**: the model or the string is only matched by
 *   name.
 *
 * The parsers are deliberately small. They cover the common forms and say nothing about
 * what they cannot read: views, stored procedures, dynamic SQL and the Drizzle relational
 * query API (`db.query.users`) are not linked.
 */
import ts from 'typescript';
import type { GraphBuilder, NodeRef } from './model';
import { isTestSupportPath } from './test-paths';

export interface ColumnDef {
  name: string;
  /** Type as written: `varchar`, `numeric`, `Int`, `timestamp with time zone`… */
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  /** Default as written in the schema. */
  default?: string;
  references?: { table: string; column?: string };
  line?: number;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  line: number;
  /** sql, prisma, drizzle, or the ORM framework that defines it (django, jpa, rails…; see @nexora/orm). */
  source: string;
  /** Prisma: the model name when the table is mapped to another name. */
  model?: string;
}

/** The key that matches a table across schema and queries: the bare, lower-case name. */
export function tableKey(name: string): string {
  const bare = name.split('.').pop() ?? name;
  return bare.replace(/^["'`[]|["'`\]]$/g, '').toLowerCase();
}

const unquote = (s: string): string => s.replace(/^["'`[]|["'`\]]$/g, '');

// ---------------------------------------------------------------------------------------
// SQL

/** Replaces comments with spaces, keeping line breaks so positions still map to lines. */
function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, (m) => ' '.repeat(m.length));
}

/** The text between the parenthesis at `open` and its match, or null. */
function balanced(text: string, open: number): { body: string; end: number } | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return { body: text.slice(open + 1, i), end: i };
  }
  return null;
}

/** Splits on commas that are not inside parentheses or quotes. */
function splitTop(text: string): { part: string; offset: number }[] {
  const out: { part: string; offset: number }[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push({ part: text.slice(start, i), offset: start });
      start = i + 1;
    }
  }
  out.push({ part: text.slice(start), offset: start });
  return out.filter((p) => p.part.trim());
}

const NAME = String.raw`(?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[A-Za-z_][\w$]*))?`;
const COLUMN_STOP =
  /^(NOT|NULL|DEFAULT|PRIMARY|REFERENCES|UNIQUE|CHECK|CONSTRAINT|GENERATED|COLLATE|AUTO_INCREMENT|AUTOINCREMENT|IDENTITY|ON|AS)$/i;
const LENGTH_TYPES = /char|binary|bit|varchar|string/i;
const DECIMAL_TYPES = /^(numeric|decimal|number|dec|money)$/i;

function sizeOf(type: string, args: number[]): Partial<ColumnDef> {
  if (!args.length) return {};
  if (DECIMAL_TYPES.test(type))
    return { precision: args[0], ...(args[1] !== undefined ? { scale: args[1] } : {}) };
  if (LENGTH_TYPES.test(type)) return { length: args[0] };
  return { precision: args[0] };
}

function names(list: string): string[] {
  return list
    .split(',')
    .map((s) => unquote(s.trim()))
    .filter(Boolean);
}

/** Parses one column definition (`price numeric(10, 2) NOT NULL DEFAULT 0`). */
export function parseSqlColumn(def: string): ColumnDef | null {
  const m = new RegExp(`^\\s*(${NAME})\\s+([\\s\\S]*)$`).exec(def);
  if (!m) return null;
  const name = unquote(m[1]!);
  const rest = m[2]!;
  const tokens = rest.match(/"[^"]*"|'[^']*'|\([^()]*(?:\([^()]*\)[^()]*)*\)|[^\s(]+/g) ?? [];
  const typeWords: string[] = [];
  let args: number[] = [];
  let i = 0;
  for (; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (COLUMN_STOP.test(t)) break;
    if (t.startsWith('(')) {
      args = t
        .slice(1, -1)
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x));
      continue;
    }
    typeWords.push(t);
  }
  const type = typeWords.join(' ').replace(/\s*\[\]$/, '[]');
  if (!type) return null;
  const col: ColumnDef = { name, type, nullable: true, ...sizeOf(typeWords[0] ?? type, args) };
  // Re-attach argument lists the tokenizer split off (`now ()` → `now()`).
  const tail = tokens
    .slice(i)
    .join(' ')
    .replace(/(\w) \(/g, '$1(');
  if (/\bNOT\s+NULL\b/i.test(tail)) col.nullable = false;
  if (/\bPRIMARY\s+KEY\b/i.test(tail)) {
    col.primaryKey = true;
    col.nullable = false;
  }
  if (/\bUNIQUE\b/i.test(tail)) col.unique = true;
  if (/^(serial|bigserial|smallserial)$/i.test(type)) col.nullable = false;
  const d = /\bDEFAULT\s+('(?:[^']|'')*'|\((?:[^()]|\([^()]*\))*\)|[^\s,]+(?:\([^()]*\))?)/i.exec(
    tail,
  );
  if (d) col.default = d[1];
  const r = new RegExp(`\\bREFERENCES\\s+(${NAME})\\s*(?:\\(\\s*([^)]+)\\))?`, 'i').exec(tail);
  if (r)
    col.references = { table: unquote(r[1]!.split('.').pop()!), column: r[2] && names(r[2])[0] };
  return col;
}

/** Tables in SQL text. `lineBase` is the line of the first character (for SQL inside code). */
/**
 * One schema change, in statement order (`pos` is the offset in the batch), so migrations can be
 * replayed: tables created, columns and foreign keys added, tables and columns renamed or dropped.
 */
export type SchemaOp = { pos: number; line: number } & (
  | { op: 'create'; table: TableDef }
  | { op: 'add-column'; table: string; column: ColumnDef }
  | { op: 'fk'; fk: ForeignKey }
  | { op: 'rename-table'; table: string; to: string }
  | { op: 'rename-column'; table: string; column: string; to: string }
  | { op: 'drop-table'; table: string }
  | { op: 'drop-column'; table: string; column: string }
);

export interface SqlSchemaParse {
  tables: TableDef[];
  foreignKeys: ForeignKey[];
  ops: SchemaOp[];
  /** DDL whose table name is a template substitution (built at run time), by line. */
  dynamic: { line: number; text: string }[];
}

const bare = (n: string) => unquote(n.split('.').pop()!);

export function parseSqlSchema(sqlText: string, lineBase = 1): SqlSchemaParse {
  const sql = stripSqlComments(sqlText);
  const lineAt = (pos: number) => lineBase + (sql.slice(0, pos).match(/\n/g)?.length ?? 0);
  const tables: TableDef[] = [];
  const foreignKeys: ForeignKey[] = [];
  const ops: SchemaOp[] = [];
  const create = new RegExp(
    `\\bCREATE\\s+(?:(?:GLOBAL\\s+|LOCAL\\s+)?(?:TEMP|TEMPORARY)\\s+|UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${NAME})\\s*\\(`,
    'gi',
  );
  for (let m; (m = create.exec(sql));) {
    const open = m.index + m[0].length - 1;
    const b = balanced(sql, open);
    if (!b) continue;
    const name = unquote(m[1]!.split('.').pop()!);
    const table: TableDef = { name, columns: [], line: lineAt(m.index), source: 'sql' };
    for (const { part, offset } of splitTop(b.body)) {
      const item = part.trim();
      const line = lineAt(open + 1 + offset + (part.length - part.trimStart().length));
      const body = item.replace(/^CONSTRAINT\s+\S+\s+/i, '');
      let c;
      if ((c = /^PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(body))) {
        for (const n of names(c[1]!)) {
          const col = table.columns.find((x) => x.name === n);
          if (col) Object.assign(col, { primaryKey: true, nullable: false });
        }
      } else if (
        (c = new RegExp(
          `^FOREIGN\\s+KEY\\s*\\(([^)]*)\\)\\s*REFERENCES\\s+(${NAME})\\s*(?:\\(([^)]*)\\))?`,
          'i',
        ).exec(body))
      ) {
        const from = names(c[1]!);
        const to = c[3] ? names(c[3]) : [];
        const target = unquote(c[2]!.split('.').pop()!);
        from.forEach((f, k) => {
          const col = table.columns.find((x) => x.name === f);
          if (col) col.references = { table: target, column: to[k] };
          const fk = { table: name, column: f, refTable: target, refColumn: to[k], line };
          foreignKeys.push(fk);
          ops.push({ op: 'fk', fk, pos: m!.index + 1, line });
        });
      } else if ((c = /^UNIQUE\s*(?:KEY|INDEX)?\s*\S*?\s*\(([^)]*)\)/i.exec(body))) {
        const cols = names(c[1]!);
        if (cols.length === 1) {
          const col = table.columns.find((x) => x.name === cols[0]);
          if (col) col.unique = true;
        }
      } else if (
        /^(CHECK|EXCLUDE|FULLTEXT|SPATIAL)\b/i.test(body) ||
        // MySQL `KEY name (cols)` and `INDEX (cols)`; a column called `key` or `index` has a
        // type after its name instead.
        /^(INDEX|KEY)\s*(?:[\w"`]+\s+)?\(/i.test(body)
      ) {
        continue;
      } else {
        const col = parseSqlColumn(item);
        if (!col) continue;
        col.line = line;
        table.columns.push(col);
        if (col.references) {
          const fk = {
            table: name,
            column: col.name,
            refTable: col.references.table,
            refColumn: col.references.column,
            line,
          };
          foreignKeys.push(fk);
          ops.push({ op: 'fk', fk, pos: m.index + 1, line });
        }
      }
    }
    tables.push(table);
    ops.push({ op: 'create', table, pos: m.index, line: table.line });
    create.lastIndex = b.end;
  }

  // ALTER TABLE t ADD [COLUMN] … / ADD [CONSTRAINT x] FOREIGN KEY (…) REFERENCES …
  const alter = new RegExp(
    `\\bALTER\\s+TABLE\\s+(?:ONLY\\s+)?(?:IF\\s+EXISTS\\s+)?(${NAME})\\s+([^;]*)`,
    'gi',
  );
  for (let m; (m = alter.exec(sql));) {
    const name = unquote(m[1]!.split('.').pop()!);
    const line = lineAt(m.index);
    for (const { part, offset } of splitTop(m[2]!)) {
      const act = part.trim();
      const pos = m.index + m[0].length - m[2]!.length + offset;
      let c;
      if ((c = new RegExp(`^RENAME\\s+TO\\s+(${NAME})`, 'i').exec(act))) {
        ops.push({ op: 'rename-table', table: name, to: bare(c[1]!), pos, line });
        continue;
      }
      if (
        !/^RENAME\s+CONSTRAINT\b/i.test(act) &&
        (c = new RegExp(`^RENAME\\s+(?:COLUMN\\s+)?(${NAME})\\s+TO\\s+(${NAME})`, 'i').exec(act))
      ) {
        ops.push({
          op: 'rename-column',
          table: name,
          column: unquote(c[1]!),
          to: unquote(c[2]!),
          pos,
          line,
        });
        continue;
      }
      if (
        !/^DROP\s+(CONSTRAINT|PRIMARY|FOREIGN|INDEX|KEY|DEFAULT|NOT)\b/i.test(act) &&
        (c = new RegExp(`^DROP\\s+(?:COLUMN\\s+)?(?:IF\\s+EXISTS\\s+)?(${NAME})`, 'i').exec(act))
      ) {
        ops.push({ op: 'drop-column', table: name, column: unquote(c[1]!), pos, line });
        continue;
      }
      if (
        (c = new RegExp(
          `^ADD\\s+(?:CONSTRAINT\\s+\\S+\\s+)?FOREIGN\\s+KEY\\s*\\(([^)]*)\\)\\s*REFERENCES\\s+(${NAME})\\s*(?:\\(([^)]*)\\))?`,
          'i',
        ).exec(act))
      ) {
        const to = c[3] ? names(c[3]) : [];
        names(c[1]!).forEach((f, k) => {
          const fk = {
            table: name,
            column: f,
            refTable: unquote(c![2]!.split('.').pop()!),
            refColumn: to[k],
            line,
          };
          foreignKeys.push(fk);
          ops.push({ op: 'fk', fk, pos, line });
        });
      } else if ((c = /^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(.+)$/is.exec(act))) {
        if (/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|INDEX)\b/i.test(c[1]!)) continue;
        const col = parseSqlColumn(c[1]!);
        if (!col) continue;
        col.line = line;
        let t = tables.find((x) => x.name === name);
        if (!t) {
          t = { name, columns: [], line, source: 'sql' };
          tables.push(t);
        }
        if (!t.columns.some((x) => x.name === col.name)) t.columns.push(col);
        ops.push({ op: 'add-column', table: name, column: { ...col }, pos, line });
        if (col.references) {
          const fk = {
            table: name,
            column: col.name,
            refTable: col.references.table,
            refColumn: col.references.column,
            line,
          };
          foreignKeys.push(fk);
          ops.push({ op: 'fk', fk, pos, line });
        }
      }
    }
  }

  // DROP TABLE [IF EXISTS] a, b [CASCADE]
  const drop = new RegExp(
    `\\bDROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(${NAME}(?:\\s*,\\s*${NAME})*)`,
    'gi',
  );
  for (let m; (m = drop.exec(sql));)
    for (const n of m[1]!.split(/\s*,\s*/))
      ops.push({ op: 'drop-table', table: bare(n), pos: m.index, line: lineAt(m.index) });

  // A template substitution (` ? ` in the text the TypeScript reader passes) where a table name
  // belongs: the statement is built at run time and cannot be replayed.
  const dynamic: SqlSchemaParse['dynamic'] = [];
  const dyn =
    /\b(?:(?:CREATE\s+(?:\w+\s+)?|ALTER\s+|DROP\s+)TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:ONLY\s+)?["`]?\s*\?|RENAME\s+TO\s+["`]?\s*\?)/gi;
  for (let m; (m = dyn.exec(sql));) {
    const line = lineAt(m.index);
    if (!dynamic.some((d) => d.line === line))
      dynamic.push({
        line,
        text: sql.slice(m.index).split(';')[0]!.replace(/\s+/g, ' ').trim().slice(0, 120),
      });
  }
  return { tables, foreignKeys, ops, dynamic };
}

export interface ForeignKey {
  table: string;
  column: string;
  refTable: string;
  refColumn?: string;
  line: number;
}

// ---------------------------------------------------------------------------------------
// Prisma

const PRISMA_SCALARS = new Set([
  'String',
  'Int',
  'BigInt',
  'Float',
  'Decimal',
  'Boolean',
  'DateTime',
  'Json',
  'Bytes',
  'Unsupported',
]);

/** Models in a Prisma schema file. The table key is the model name (Prisma's client name). */
export function parsePrismaSchema(text: string): { tables: TableDef[]; foreignKeys: ForeignKey[] } {
  const lines = text.split('\n');
  const enums = new Set<string>();
  for (const l of lines) {
    const e = /^\s*enum\s+(\w+)\s*\{/.exec(l);
    if (e) enums.add(e[1]!);
  }
  const models = new Set<string>();
  for (const l of lines) {
    const e = /^\s*model\s+(\w+)\s*\{/.exec(l);
    if (e) models.add(e[1]!);
  }
  const tables: TableDef[] = [];
  const foreignKeys: ForeignKey[] = [];
  let cur: TableDef | null = null;
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const l = raw.replace(/\/\/.*$/, '').trim();
    const start = /^model\s+(\w+)\s*\{/.exec(l);
    if (start) {
      cur = { name: start[1]!, columns: [], line, source: 'prisma' };
      tables.push(cur);
      return;
    }
    if (!cur) return;
    const table: TableDef = cur;
    if (l === '}') {
      cur = null;
      return;
    }
    const map = /^@@map\(\s*"([^"]+)"\s*\)/.exec(l);
    if (map) {
      table.model = table.name;
      table.name = map[1]!;
      return;
    }
    const id = /^@@id\(\s*\[([^\]]*)\]/.exec(l);
    if (id) {
      for (const n of names(id[1]!)) {
        const col = table.columns.find((c) => c.name === n);
        if (col) Object.assign(col, { primaryKey: true, nullable: false });
      }
      return;
    }
    if (l.startsWith('@@') || !l) return;
    const f = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(l);
    if (!f) return;
    const [, fname, ftype, list, optional, attrs] = f as unknown as string[];
    if (models.has(ftype!)) {
      // A relation field, not a column: the foreign key is on the `fields` columns.
      const rel = /@relation\([^)]*fields:\s*\[([^\]]*)\][^)]*references:\s*\[([^\]]*)\]/.exec(
        attrs!,
      );
      if (rel) {
        const to = names(rel[2]!);
        names(rel[1]!).forEach((from, k) =>
          foreignKeys.push({
            table: table.model ?? table.name,
            column: from,
            refTable: ftype!,
            refColumn: to[k],
            line,
          }),
        );
      }
      return;
    }
    if (!PRISMA_SCALARS.has(ftype!) && !enums.has(ftype!)) return;
    const col: ColumnDef = {
      name: fname!,
      type: ftype! + (list ? '[]' : ''),
      nullable: optional === '?',
      line,
    };
    const mapped = /@map\(\s*"([^"]+)"\s*\)/.exec(attrs!);
    if (mapped) col.name = mapped[1]!;
    const db = /@db\.(\w+)(?:\(([^)]*)\))?/.exec(attrs!);
    if (db) {
      col.type = db[1]!;
      const args = (db[2] ?? '')
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x) && x > 0);
      Object.assign(col, sizeOf(col.type, args));
    }
    if (/@id\b/.test(attrs!)) Object.assign(col, { primaryKey: true, nullable: false });
    if (/@unique\b/.test(attrs!)) col.unique = true;
    const def = /@default\(((?:[^()]|\([^()]*\))*)\)/.exec(attrs!);
    if (def) col.default = def[1];
    table.columns.push(col);
  });
  // Foreign key columns point at the referenced model.
  for (const fk of foreignKeys) {
    const t = tables.find((x) => (x.model ?? x.name) === fk.table);
    const col = t?.columns.find((c) => c.name === fk.column);
    if (col) col.references = { table: fk.refTable, column: fk.refColumn };
  }
  return { tables, foreignKeys };
}

// ---------------------------------------------------------------------------------------
// Graph

/** The graph key of a table. Prisma tables are keyed by model name, the name client code uses. */
export function tableRef(t: Pick<TableDef, 'name' | 'model'>): NodeRef {
  return { kind: 'table', key: `table:${tableKey(t.model ?? t.name)}` };
}

/** Adds tables and their foreign keys to the graph. Foreign keys to unknown tables are dropped at save. */
export function addSchema(
  graph: GraphBuilder,
  path: string,
  parsed: { tables: TableDef[]; foreignKeys: ForeignKey[] },
): void {
  // A table a test builds for itself is not the application's schema, and must not replace
  // or add columns to the real table of the same name.
  if (isTestSupportPath(path)) return;
  for (const t of parsed.tables) {
    const ref = tableRef(t);
    const prev = graph.get(ref);
    const prevCols = (prev?.data?.columns as ColumnDef[] | undefined) ?? [];
    // The same table can appear in several places (a Drizzle schema and its migration, or a
    // migration and a later ALTER): the first definition of each column wins, gaps are filled.
    const columns = prevCols.map((c) => ({ ...c }));
    for (const c of t.columns) {
      const same = columns.find((x) => x.name === c.name);
      if (!same) columns.push(c);
      else
        // Fill what the first definition left out (a key, a size, a default); never overwrite.
        for (const [k, v] of Object.entries(c))
          if (v !== undefined && (same as unknown as Record<string, unknown>)[k] === undefined)
            (same as unknown as Record<string, unknown>)[k] = v;
    }
    graph.addNode({
      kind: 'table',
      key: ref.key,
      name: t.name,
      filePath: prev?.filePath ?? path,
      startLine: t.line,
      data: {
        source: t.source,
        columns,
        ...(t.model ? { model: t.model } : {}),
      },
    });
  }
  for (const fk of parsed.foreignKeys) {
    graph.addEdge({
      method: 'schema.foreign-key',
      kind: 'references',
      src: { kind: 'table', key: `table:${tableKey(fk.table)}` },
      dst: { kind: 'table', key: `table:${tableKey(fk.refTable)}` },
      confidence: 'observed',
      evidencePath: path,
      evidenceLine: fk.line,
      detail: `${fk.table}.${fk.column} → ${fk.refTable}${fk.refColumn ? `.${fk.refColumn}` : ''}`,
    });
  }
}

export interface SchemaReplayStats {
  /** SQL statement batches read (SQL files and SQL strings in code). */
  batches: number;
  renamedTables: number;
  renamedColumns: number;
  droppedTables: number;
  droppedColumns: number;
  /** Renames and drops of a table no earlier batch created (made elsewhere, or not read). */
  unknownTargets: number;
  /** DDL whose table name is built at run time, recorded as `query` gaps. */
  dynamic: number;
}

/**
 * Replays the queued SQL schema batches (`GraphBuilder.addSqlSchema`) in migration order and adds
 * the tables they leave to the graph. Order: by path, comparing numbers as numbers (`V2` before
 * `V10`, timestamped files by time), then in the order each file's statements were read. A
 * renamed table keeps its creating statement as its definition and records each rename in
 * `renamedFrom`; dropped tables and columns are removed. Call once every SQL source is read.
 */
export function replaySqlSchema(graph: GraphBuilder): SchemaReplayStats {
  const stats: SchemaReplayStats = {
    batches: graph.sqlSchema.length,
    renamedTables: 0,
    renamedColumns: 0,
    droppedTables: 0,
    droppedColumns: 0,
    unknownTargets: 0,
    dynamic: 0,
  };
  const recs = graph.sqlSchema.map((r, i) => ({ r, i }));
  recs.sort((a, b) =>
    a.r.path === b.r.path ? a.i - b.i : a.r.path.localeCompare(b.r.path, 'en', { numeric: true }),
  );
  interface Entry {
    def: TableDef;
    path: string;
    renamedFrom: { name: string; path: string; line: number }[];
    /** Only ALTER TABLE … ADD named it: its CREATE TABLE (or the rename to it) was not read. */
    partial?: boolean;
  }
  const state = new Map<string, Entry>();
  let fks: ForeignKey[] = [];
  const colOf = (e: Entry, name: string) =>
    e.def.columns.find((c) => c.name === name) ??
    e.def.columns.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const merge = (into: Entry, from: TableDef) => {
    for (const c of from.columns) if (!colOf(into, c.name)) into.def.columns.push({ ...c });
  };
  for (const { r } of recs) {
    const ops = [...r.parsed.ops].sort((a, b) => a.pos - b.pos);
    for (const o of ops) {
      if (o.op === 'create') {
        const k = tableKey(o.table.name);
        const prev = state.get(k);
        if (prev) {
          merge(prev, o.table);
          prev.partial = false;
        } else
          state.set(k, {
            def: { ...o.table, columns: o.table.columns.map((c) => ({ ...c })) },
            path: r.path,
            renamedFrom: [],
          });
      } else if (o.op === 'add-column') {
        const k = tableKey(o.table);
        let e = state.get(k);
        if (!e) {
          e = {
            def: { name: o.table, columns: [], line: o.line, source: 'sql' },
            path: r.path,
            renamedFrom: [],
            partial: true,
          };
          state.set(k, e);
        }
        if (!colOf(e, o.column.name)) e.def.columns.push({ ...o.column });
      } else if (o.op === 'fk') fks.push({ ...o.fk });
      else if (o.op === 'rename-table') {
        const k = tableKey(o.table);
        const e = state.get(k);
        if (!e) {
          stats.unknownTargets++;
          continue;
        }
        const nk = tableKey(o.to);
        state.delete(k);
        e.renamedFrom.push({ name: e.def.name, path: r.path, line: o.line });
        e.def = { ...e.def, name: o.to };
        const there = state.get(nk);
        if (there) {
          merge(e, there.def);
          e.renamedFrom.push(...there.renamedFrom);
        }
        e.partial = false;
        state.set(nk, e);
        for (const f of fks) {
          if (tableKey(f.table) === k) f.table = o.to;
          if (tableKey(f.refTable) === k) f.refTable = o.to;
        }
        stats.renamedTables++;
      } else if (o.op === 'rename-column') {
        const k = tableKey(o.table);
        const e = state.get(k);
        const c = e && colOf(e, o.column);
        if (!c) {
          stats.unknownTargets++;
          continue;
        }
        for (const f of fks) {
          if (tableKey(f.table) === k && f.column === c.name) f.column = o.to;
          if (tableKey(f.refTable) === k && f.refColumn === c.name) f.refColumn = o.to;
        }
        c.name = o.to;
        stats.renamedColumns++;
      } else if (o.op === 'drop-table') {
        const k = tableKey(o.table);
        if (!state.delete(k)) {
          stats.unknownTargets++;
          continue;
        }
        fks = fks.filter((f) => tableKey(f.table) !== k);
        stats.droppedTables++;
      } else if (o.op === 'drop-column') {
        const k = tableKey(o.table);
        const e = state.get(k);
        const c = e && colOf(e, o.column);
        if (!e || !c) {
          stats.unknownTargets++;
          continue;
        }
        e.def.columns = e.def.columns.filter((x) => x !== c);
        fks = fks.filter((f) => !(tableKey(f.table) === k && f.column === c.name));
        stats.droppedColumns++;
      }
    }
    for (const d of r.parsed.dynamic) {
      stats.dynamic++;
      graph.addUnresolved({
        filePath: r.path,
        line: d.line,
        kind: 'query',
        text: d.text,
        reason: 'schema change whose table name is built at run time; not replayed',
      });
    }
  }
  for (const [k, e] of state) {
    addSchema(graph, e.path, {
      tables: [e.def],
      foreignKeys: fks.filter((f) => tableKey(f.table) === k),
    });
    if (e.renamedFrom.length) graph.mergeData(tableRef(e.def), { renamedFrom: e.renamedFrom });
    if (e.partial)
      graph.mergeData(tableRef(e.def), {
        partial: 'columns added by ALTER TABLE; no CREATE TABLE was read for this name',
      });
  }
  return stats;
}

// ---------------------------------------------------------------------------------------
// TypeScript: Drizzle tables, Drizzle queries, SQL strings

const DRIZZLE_TABLE_FN = /^(pg|mysql|sqlite|singlestore|gel)Table$/;
const DRIZZLE_READ = new Set([
  'from',
  'join',
  'innerJoin',
  'leftJoin',
  'rightJoin',
  'fullJoin',
  'crossJoin',
]);
const DRIZZLE_WRITE = new Set(['insert', 'update', 'delete']);
/**
 * Kysely builder methods whose first argument names a table, checked against kysely 0.28.8 and 0.29.9
 * (`QueryCreator` in dist/esm/query-creator.d.ts and the `SelectQueryBuilder` joins).
 */
const KYSELY_READ = new Set([
  'selectFrom',
  'innerJoin',
  'leftJoin',
  'rightJoin',
  'fullJoin',
  'crossJoin',
  'innerJoinLateral',
  'leftJoinLateral',
  'crossJoinLateral',
]);
/**
 * Read methods that only name a table on one builder: `DeleteQueryBuilder.using` and
 * `UpdateQueryBuilder.from` (kysely 0.28.8 and 0.29.9). Schema builders also have `using`
 * (an index type), so these count only in a chain that starts with the matching statement.
 */
const KYSELY_CHAIN_READ = new Map([
  ['using', 'deleteFrom'],
  ['from', 'updateTable'],
]);
/** Methods that name a common table expression: `with('name', …)` or `with((cte) => cte('name'), …)`. */
const KYSELY_WITH = new Set(['with', 'withRecursive']);
const KYSELY_WRITE = new Set([
  'insertInto',
  'updateTable',
  'deleteFrom',
  'replaceInto',
  'mergeInto',
]);
/** Methods whose table argument may be a list (`TableExpressionOrList`). */
const KYSELY_LISTS = new Set(['selectFrom', 'updateTable', 'deleteFrom', 'using', 'from']);

/** The method name of a call such as `x.selectFrom(…)`, or undefined. */
function calledMethod(n: ts.Node): string | undefined {
  return ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
    ? n.expression.name.text
    : undefined;
}

/** The name a `with` call gives its CTE: `'jennifers(id, age)'` → `jennifers`. */
function cteName(call: ts.CallExpression): string | undefined {
  const a = call.arguments[0];
  if (!a) return undefined;
  if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))
    return a.text.split('(')[0]!.trim();
  if (!(ts.isArrowFunction(a) || ts.isFunctionExpression(a))) return undefined;
  const param = a.parameters[0]?.name;
  if (!param || !ts.isIdentifier(param)) return undefined;
  let found: string | undefined;
  const walk = (n: ts.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === param.text
    ) {
      const lit = n.arguments[0];
      if (lit && (ts.isStringLiteral(lit) || ts.isNoSubstitutionTemplateLiteral(lit)))
        found = lit.text.split('(')[0]!.trim();
    }
    ts.forEachChild(n, walk);
  };
  walk(a.body);
  return found;
}

/** The calls before `call` in its builder chain (`a.b().c()` → c's receivers b, then a). */
function* receivers(call: ts.CallExpression): Generator<ts.CallExpression> {
  let e: ts.Expression = (call.expression as ts.PropertyAccessExpression).expression;
  for (;;) {
    if (ts.isCallExpression(e)) {
      yield e;
      e = e.expression;
    } else if (
      ts.isPropertyAccessExpression(e) ||
      ts.isNonNullExpression(e) ||
      ts.isParenthesizedExpression(e)
    )
      e = e.expression;
    else return;
  }
}

/**
 * Whether the table name `name` in Kysely call `call` refers to a CTE rather than a table. A CTE
 * named earlier in the same chain, or in an enclosing chain, wins over a table of the same name;
 * inside its own body a CTE names the real table, unless it is recursive.
 */
function isCteReference(call: ts.CallExpression, name: string): boolean {
  let x: ts.Node = call;
  for (;;) {
    if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression))
      for (const r of receivers(x)) {
        const m = calledMethod(r);
        if (m && KYSELY_WITH.has(m) && cteName(r) === name) return true;
      }
    // Step out to the call whose arguments hold `x`.
    let p: ts.Node | undefined = x.parent;
    let child: ts.Node = x;
    while (p && !(ts.isCallExpression(p) && p.arguments.includes(child as ts.Expression))) {
      if (ts.isSourceFile(p) || ts.isClassLike(p)) return false;
      child = p;
      p = p.parent;
    }
    if (!p) return false;
    const m = calledMethod(p);
    if (m && KYSELY_WITH.has(m) && cteName(p as ts.CallExpression) === name)
      return m === 'withRecursive';
    x = p;
  }
}
/** `'asset as a'` → `asset`; `'public.asset'` keeps its schema. */
function kyselyTableName(t: string): string | null {
  const name = t
    .trim()
    .split(/\s+as\s+/iu)[0]!
    .trim();
  return /^[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*)?$/u.test(name) ? name : null;
}
const SQL_START = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|REPLACE|MERGE)\b/i;

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function str(e: ts.Expression | undefined): string | undefined {
  return e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : undefined;
}

function num(o: ts.ObjectLiteralExpression | undefined, key: string): number | undefined {
  if (!o) return undefined;
  for (const p of o.properties)
    if (
      ts.isPropertyAssignment(p) &&
      p.name.getText() === key &&
      ts.isNumericLiteral(p.initializer)
    )
      return Number(p.initializer.text);
  return undefined;
}

/**
 * Whether `node` is inside a migration's `down` function or method (Kysely, Knex and TypeORM
 * migrations export `up` and `down`), in a file whose path names migrations.
 */
function inDownMigration(node: ts.Node, path: string): boolean {
  if (!/migrat/i.test(path)) return false;
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    const name =
      ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)
        ? n.name?.getText()
        : (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) &&
            n.parent &&
            (ts.isVariableDeclaration(n.parent) || ts.isPropertyAssignment(n.parent))
          ? n.parent.name.getText()
          : undefined;
    if (name === 'down') return true;
    if (name !== undefined) return false;
  }
  return false;
}

/** `pgTable('users', …)` → 'users', when `call` is a Drizzle table definition. */
function drizzleTableName(call: ts.Expression | undefined): string | undefined {
  if (!call || !ts.isCallExpression(call)) return undefined;
  const callee = call.expression;
  const fn = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : '';
  // `pgSchema('s').table('users', { … })`; a one-argument `x.table('t')` is something else, such
  // as Kysely's `eb.table('album')`, which names a row of the query.
  if (
    !DRIZZLE_TABLE_FN.test(fn) &&
    !(fn === 'table' && ts.isPropertyAccessExpression(callee) && call.arguments.length >= 2)
  )
    return undefined;
  return str(call.arguments[0]);
}

/** One Drizzle column: `varchar('email', { length: 255 }).notNull().unique()`. */
function drizzleColumn(
  prop: string,
  init: ts.Expression,
  sf: ts.SourceFile,
  resolveTable: (e: ts.Expression) => string | undefined,
  expandHelper: (call: ts.CallExpression) => ts.Expression | undefined,
): ColumnDef | null {
  const chainOf = (start: ts.Expression): ts.CallExpression[] => {
    const out: ts.CallExpression[] = [];
    let e: ts.Expression = start;
    while (ts.isCallExpression(e)) {
      out.unshift(e);
      if (ts.isPropertyAccessExpression(e.expression)) e = e.expression.expression;
      else break;
    }
    return out;
  };
  let chain = chainOf(init);
  // A local column helper (`const id = () => uuid('id').primaryKey()`): read one level into it.
  const first = chain[0];
  const helper = first && expandHelper(first);
  if (helper) chain = [...chainOf(helper), ...chain.slice(1)];
  const base = chain[0];
  if (!base) return null;
  const type = ts.isIdentifier(base.expression)
    ? base.expression.text
    : ts.isPropertyAccessExpression(base.expression)
      ? base.expression.name.text
      : '';
  if (!type) return null;
  const nameArg = str(base.arguments[0]);
  const opts = base.arguments.find(ts.isObjectLiteralExpression);
  const col: ColumnDef = {
    name: nameArg ?? prop,
    type,
    nullable: !/^(serial|bigserial|smallserial)$/.test(type),
    line: lineOf(sf, init.getStart(sf)),
  };
  const length = num(opts, 'length');
  const precision = num(opts, 'precision');
  const scale = num(opts, 'scale');
  if (length !== undefined) col.length = length;
  if (precision !== undefined) col.precision = precision;
  if (scale !== undefined) col.scale = scale;
  for (const c of chain.slice(1)) {
    if (!ts.isPropertyAccessExpression(c.expression)) continue;
    const m = c.expression.name.text;
    if (m === 'notNull') col.nullable = false;
    else if (m === 'primaryKey') Object.assign(col, { primaryKey: true, nullable: false });
    else if (m === 'unique') col.unique = true;
    else if (m === 'defaultNow') col.default = 'now()';
    else if (m === 'default' || m === '$default' || m === '$defaultFn')
      col.default = c.arguments[0]?.getText(c.getSourceFile()).slice(0, 80);
    else if (m === 'array') col.type += '[]';
    else if (m === 'references') {
      const fn = c.arguments[0];
      const body =
        fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))
          ? ts.isArrowFunction(fn) && !ts.isBlock(fn.body)
            ? fn.body
            : undefined
          : undefined;
      if (body && ts.isPropertyAccessExpression(body)) {
        const table =
          resolveTable(body.expression) ?? body.expression.getText(body.getSourceFile());
        col.references = { table, column: body.name.text };
      }
    }
  }
  return col;
}

/**
 * Finds Drizzle tables, Drizzle queries and SQL in string literals. Runs from the reference
 * pass for every node, after the declaration pass.
 */
export class SchemaDetector {
  constructor(private readonly graph: GraphBuilder) {}

  /** The Drizzle table an expression names (`users`, `schema.users`), resolved through imports. */
  private tableOf(e: ts.Expression, checker: ts.TypeChecker): string | undefined {
    const at = ts.isPropertyAccessExpression(e) ? e.name : e;
    let sym = checker.getSymbolAtLocation(at);
    if (sym && sym.flags & ts.SymbolFlags.Alias) {
      try {
        sym = checker.getAliasedSymbol(sym);
      } catch {
        return undefined;
      }
    }
    const decl = sym?.valueDeclaration;
    if (decl && ts.isVariableDeclaration(decl)) return drizzleTableName(decl.initializer);
    return undefined;
  }

  /** The returned expression of a zero-argument arrow helper a column calls, if any. */
  private helperBody(call: ts.CallExpression, checker: ts.TypeChecker): ts.Expression | undefined {
    if (!ts.isIdentifier(call.expression) || call.arguments.length) return undefined;
    let sym = checker.getSymbolAtLocation(call.expression);
    if (sym && sym.flags & ts.SymbolFlags.Alias) {
      try {
        sym = checker.getAliasedSymbol(sym);
      } catch {
        return undefined;
      }
    }
    const decl = sym?.valueDeclaration;
    const fn = decl && ts.isVariableDeclaration(decl) ? decl.initializer : undefined;
    if (fn && ts.isArrowFunction(fn) && !ts.isBlock(fn.body) && ts.isCallExpression(fn.body))
      return fn.body;
    return undefined;
  }

  visit(
    node: ts.Node,
    sf: ts.SourceFile,
    path: string,
    checker: ts.TypeChecker,
    ownerOf: () => NodeRef,
  ): void {
    if (ts.isCallExpression(node)) {
      const name = drizzleTableName(node);
      if (name !== undefined) {
        this.drizzleTable(node, name, sf, path, checker);
        return;
      }
      const callee = node.expression;
      if (!ts.isPropertyAccessExpression(callee)) return;
      const verb = callee.name.text;
      const chainStart = KYSELY_CHAIN_READ.get(verb);
      if (
        (KYSELY_READ.has(verb) ||
          KYSELY_WRITE.has(verb) ||
          (chainStart !== undefined &&
            [...receivers(node)].some((r) => calledMethod(r) === chainStart))) &&
        this.importsKysely(sf)
      ) {
        this.kyselyCall(node, verb, sf, path, checker, ownerOf);
        return;
      }
      const write = DRIZZLE_WRITE.has(verb);
      if (!write && !DRIZZLE_READ.has(verb)) return;
      const arg = node.arguments[0];
      const table = arg && this.tableOf(arg, checker);
      if (!table) return;
      this.useEdge(
        'schema.drizzle-query',
        write ? 'writes_table' : 'reads_table',
        table,
        ownerOf(),
        'observed',
        path,
        lineOf(sf, node.getStart(sf)),
        `${verb}(${arg.getText(sf).slice(0, 40)})`,
      );
      return;
    }
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)
    ) {
      if (node.parent && ts.isTemplateExpression(node.parent)) return;
      if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) return;
      const text = ts.isTemplateExpression(node)
        ? node.head.text + node.templateSpans.map((s) => ` ? ${s.literal.text}`).join('')
        : node.text;
      if (text.length < 12) return;
      const line = lineOf(sf, node.getStart(sf));
      // A migration's down() undoes its up(): its SQL is not the schema, nor the code's queries.
      if (inDownMigration(node, path)) return;
      if (/\b(?:CREATE\s+(?:\w+\s+)?|ALTER\s+|DROP\s+)TABLE\b/i.test(text)) {
        if (!isTestSupportPath(path))
          this.graph.addSqlSchema({ path, parsed: parseSqlSchema(text, line) });
        return;
      }
      if (!SQL_START.test(text)) return;
      for (const u of sqlTableUses(text))
        this.useEdge(
          'schema.sql-string',
          u.write ? 'writes_table' : 'reads_table',
          u.table,
          ownerOf(),
          'inferred',
          path,
          line,
          `table named in a SQL string: ${text.trim().split('\n')[0]!.slice(0, 80)}`,
        );
    }
  }

  private readonly kyselyFiles = new WeakMap<ts.SourceFile, boolean>();

  /** Kysely calls are read only in files that import `kysely` (directly or a `*kysely*` package). */
  private importsKysely(sf: ts.SourceFile): boolean {
    let v = this.kyselyFiles.get(sf);
    if (v === undefined) {
      v = sf.statements.some(
        (st) =>
          ts.isImportDeclaration(st) &&
          ts.isStringLiteral(st.moduleSpecifier) &&
          /(^|[/-])kysely([/-]|$)/u.test(st.moduleSpecifier.text),
      );
      this.kyselyFiles.set(sf, v);
    }
    return v;
  }

  /**
   * A Kysely query-builder call naming a table (`db.selectFrom('asset')`, `.insertInto('album')`,
   * `.innerJoin('album_asset', …)`). Observed when the checker resolves the receiver to a type
   * declared by the kysely package; inferred when it cannot (for example, dependencies not installed).
   */
  private kyselyCall(
    node: ts.CallExpression,
    verb: string,
    sf: ts.SourceFile,
    path: string,
    checker: ts.TypeChecker,
    ownerOf: () => NodeRef,
  ): void {
    const arg = node.arguments[0];
    if (!arg) return;
    const names = (
      ts.isArrayLiteralExpression(arg) && KYSELY_LISTS.has(verb) ? [...arg.elements] : [arg]
    )
      .map((e) => (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : null))
      .map((t) => t && kyselyTableName(t));
    const receiver = (node.expression as ts.PropertyAccessExpression).expression;
    const decls = checker.getTypeAtLocation(receiver).getSymbol()?.getDeclarations() ?? [];
    const typed = decls.some((d) =>
      /[/\\]node_modules[/\\]kysely[/\\]/u.test(d.getSourceFile().fileName),
    );
    const write = KYSELY_WRITE.has(verb);
    for (const name of names)
      if (name && !isCteReference(node, name))
        this.useEdge(
          'schema.kysely-query',
          write ? 'writes_table' : 'reads_table',
          name,
          ownerOf(),
          typed ? 'observed' : 'inferred',
          path,
          lineOf(sf, (node.expression as ts.PropertyAccessExpression).name.getStart(sf)),
          `Kysely ${verb}('${name}')${typed ? '' : ' (receiver type not resolved; matched by import and method name)'}`,
        );
  }

  /** A Prisma client call (`prisma.user.findMany()`): inferred read or write of model `user`. */
  prismaCall(node: ts.CallExpression, sf: ts.SourceFile, path: string, owner: NodeRef): void {
    const callee = node.expression;
    if (!ts.isPropertyAccessExpression(callee)) return;
    const model = callee.expression;
    if (!ts.isPropertyAccessExpression(model)) return;
    const op = callee.name.text;
    const read = /^(find|count|aggregate|groupBy)/.test(op);
    const write = /^(create|update|upsert|delete)/.test(op);
    if (!read && !write) return;
    this.useEdge(
      'schema.prisma-client',
      write ? 'writes_table' : 'reads_table',
      model.name.text,
      owner,
      'inferred',
      path,
      lineOf(sf, node.getStart(sf)),
      `Prisma ${model.name.text}.${op}()`,
    );
  }

  private useEdge(
    method:
      'schema.drizzle-query' | 'schema.sql-string' | 'schema.prisma-client' | 'schema.kysely-query',
    kind: 'reads_table' | 'writes_table',
    table: string,
    owner: NodeRef,
    confidence: 'observed' | 'inferred',
    path: string,
    line: number,
    detail: string,
  ): void {
    this.graph.addEdge({
      method: method,
      kind,
      src: owner,
      dst: { kind: 'table', key: `table:${tableKey(table)}` },
      confidence,
      evidencePath: path,
      evidenceLine: line,
      detail,
    });
  }

  private drizzleTable(
    call: ts.CallExpression,
    name: string,
    sf: ts.SourceFile,
    path: string,
    checker: ts.TypeChecker,
  ): void {
    const cols = call.arguments[1];
    const table: TableDef = {
      name,
      columns: [],
      line: lineOf(sf, call.getStart(sf)),
      source: 'drizzle',
    };
    const fks: ForeignKey[] = [];
    const resolve = (e: ts.Expression) => this.tableOf(e, checker);
    if (cols && ts.isObjectLiteralExpression(cols)) {
      for (const p of cols.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const col = drizzleColumn(p.name.getText(sf), p.initializer, sf, resolve, (call) =>
          this.helperBody(call, checker),
        );
        if (!col) continue;
        table.columns.push(col);
        if (col.references)
          fks.push({
            table: name,
            column: col.name,
            refTable: col.references.table,
            refColumn: col.references.column,
            line: col.line ?? table.line,
          });
      }
    }
    // Table extras: primaryKey({ columns: [t.a, t.b] }) and foreignKey({ columns, foreignColumns }).
    const extra = call.arguments[2];
    if (extra) {
      const byProp = new Map<string, ColumnDef>();
      if (cols && ts.isObjectLiteralExpression(cols))
        cols.properties.forEach((p, k) => {
          if (ts.isPropertyAssignment(p) && table.columns[k])
            byProp.set(p.name.getText(sf), table.columns[k]!);
        });
      const colOf = (e: ts.Expression) =>
        ts.isPropertyAccessExpression(e) ? byProp.get(e.name.text) : undefined;
      const prop = (o: ts.ObjectLiteralExpression, k: string) => {
        for (const x of o.properties)
          if (ts.isPropertyAssignment(x) && x.name.getText(sf) === k) return x.initializer;
        return undefined;
      };
      const walk = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
          const o = n.arguments[0];
          if (o && ts.isObjectLiteralExpression(o)) {
            const columns = prop(o, 'columns');
            if (
              n.expression.text === 'primaryKey' &&
              columns &&
              ts.isArrayLiteralExpression(columns)
            )
              for (const c of columns.elements) {
                const col = colOf(c);
                if (col) Object.assign(col, { primaryKey: true, nullable: false });
              }
            const foreign = prop(o, 'foreignColumns');
            if (
              n.expression.text === 'foreignKey' &&
              columns &&
              foreign &&
              ts.isArrayLiteralExpression(columns) &&
              ts.isArrayLiteralExpression(foreign)
            )
              columns.elements.forEach((c, k) => {
                const col = colOf(c);
                const f = foreign.elements[k];
                if (!col || !f || !ts.isPropertyAccessExpression(f)) return;
                const ref = resolve(f.expression) ?? name;
                col.references = { table: ref, column: f.name.text };
                fks.push({
                  table: name,
                  column: col.name,
                  refTable: ref,
                  refColumn: f.name.text,
                  line: lineOf(sf, n.getStart(sf)),
                });
              });
          }
        }
        ts.forEachChild(n, walk);
      };
      walk(extra);
    }
    addSchema(this.graph, path, { tables: [table], foreignKeys: fks });
  }
}

/** Tables a SQL statement reads (FROM, JOIN) and writes (INSERT INTO, UPDATE, DELETE FROM). */
export function sqlTableUses(sql: string): { table: string; write: boolean }[] {
  const out = new Map<string, boolean>();
  const add = (name: string, write: boolean) => {
    const t = tableKey(name);
    if (!t || /^(select|lateral|unnest|json_each|values)$/.test(t)) return;
    out.set(t, (out.get(t) ?? false) || write);
  };
  const text = stripSqlComments(sql);
  for (const m of text.matchAll(
    new RegExp(`\\bINSERT\\s+(?:OR\\s+\\w+\\s+)?INTO\\s+(${NAME})`, 'gi'),
  ))
    add(m[1]!, true);
  for (const m of text.matchAll(
    new RegExp(`\\bUPDATE\\s+(?:OR\\s+\\w+\\s+)?(${NAME})\\s+SET\\b`, 'gi'),
  ))
    add(m[1]!, true);
  for (const m of text.matchAll(new RegExp(`\\bDELETE\\s+FROM\\s+(${NAME})`, 'gi')))
    add(m[1]!, true);
  const reads = text.replace(/\bDELETE\s+FROM\b/gi, 'DELETE');
  for (const m of reads.matchAll(new RegExp(`\\b(?:FROM|JOIN)\\s+(${NAME})`, 'gi')))
    if (!/^\(/.test(m[1]!)) add(m[1]!, false);
  return [...out].map(([table, write]) => ({ table, write }));
}
