export * from './types';
export * from './naming';
export { resolveOrm, tableKey } from './resolve';
export { readPython, pythonFrameworks, djangoAppLabel } from './python';
export { readJvm, parseAnnotation, splitArgs, lit } from './jvm';
export { readCsharp } from './csharp';
export { readRuby } from './ruby';
export { readPhp } from './php';
export { readGo, gormTag } from './go';
export { readElixir, readRust } from './elixir-rust';
export { readTs, sqlToolsDecorators, type SqlToolsDecorator } from './ts';
export { readLiquibaseTree, liquibaseFromYaml, type LbNode } from './liquibase';

import { readPython } from './python';
import { readJvm } from './jvm';
import { readCsharp } from './csharp';
import { readRuby } from './ruby';
import { readPhp } from './php';
import { readGo } from './go';
import { readElixir, readRust } from './elixir-rust';
import { readTs, sqlToolsDecorators, type SqlToolsDecorator } from './ts';
import type { OrmFile } from './types';

/**
 * Reads one file's ORM models, migrations and table uses. `null` when the file uses no ORM this
 * package reads. The tree-sitter engine must be initialised first (`initSyntax` from @nexora/syntax).
 */
export interface OrmContext {
  /** The repository has an Entity Framework Core DbContext (see `repositoryContext`). */
  efCore?: boolean;
  /** The repository uses GORM. */
  gorm?: boolean;
  /**
   * Column decorators a repository builds on `@immich/sql-tools` (`export const UpdateIdColumn =
   * (o) => Column({ ...o, type: 'uuid' })`), by name, so table files that use them can be read.
   */
  sqlTools?: Map<string, SqlToolsDecorator>;
}

const SQL_TOOLS_IMPORT = /from\s+['"]@immich\/sql-tools['"]/;

/** What a reader needs to know about the whole repository, from a quick look at every file. */
export function repositoryContext(texts: Iterable<string>): OrmContext {
  const ctx: OrmContext = {};
  const sqlTools: string[] = [];
  for (const t of texts) {
    if (SQL_TOOLS_IMPORT.test(t)) sqlTools.push(t);
    if (!ctx.efCore && /:\s*(Identity\w*)?DbContext\b|\bDbSet</.test(t)) ctx.efCore = true;
    if (!ctx.gorm && /"gorm\.io\/gorm"|"github\.com\/jinzhu\/gorm"/.test(t)) ctx.gorm = true;
  }
  if (sqlTools.length) ctx.sqlTools = sqlToolsDecorators(sqlTools);
  return ctx;
}

export function readOrm(
  path: string,
  language: string,
  source: string,
  ctx: OrmContext = {},
): OrmFile | null {
  switch (language) {
    case 'Python':
      return readPython(path, source);
    case 'C#':
      return readCsharp(path, source, { efCore: !!ctx.efCore });
    case 'TypeScript':
    case 'JavaScript':
    case 'TSX':
    case 'JSX':
      return readTs(path, source, ctx.sqlTools);
    case 'Elixir':
      return readElixir(path, source);
    case 'Rust':
      return readRust(path, source);
    case 'Go':
      return readGo(path, source, !!ctx.gorm);
    case 'PHP':
      return readPhp(path, source);
    case 'Ruby':
      return readRuby(path, source);
    case 'Java':
    case 'Kotlin':
      return readJvm(path, language, source);
    default:
      return null;
  }
}
