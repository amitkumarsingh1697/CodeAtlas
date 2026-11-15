/**
 * JPA queries → tables (JV-004): JPQL and native SQL written in Java and Kotlin, linked from the
 * method that runs them to the tables they read and write.
 *
 * Read: Spring Data `@Query` (JPQL, or SQL with `nativeQuery = true`, or `name = …`), `@NamedQuery`
 * and `@NamedNativeQuery` definitions, and `createQuery`, `createNativeQuery` and
 * `createNamedQuery` calls. Only files that import JPA, Hibernate or Spring Data JPA are read.
 *
 * Labelling (rules `orm.jpa-query`, `orm.jpa-named-query`):
 * - A query written as a literal (or literals joined by `+`) at the call or annotation names its
 *   entities or tables. The link is observed when the entity's table is written in the source (or
 *   the SQL names a table the repository defines), inferred when the table name is a framework
 *   default.
 * - A query reached through a named query is matched by its name repository-wide: inferred.
 * - A query whose text is not a literal, a named query not found or defined twice, and an entity
 *   that no class in the repository maps, are recorded as `query` gaps, never guessed.
 *
 * Association paths (rule `orm.jpa-path-join`, inferred): a JPQL path from an alias through an
 * association attribute (`join fetch o.pets p`, `p.owner.city` in WHERE) also reads the table of
 * each entity it joins (see `pathTargets`: comparing an association or its id joins nothing). Attributes are read from the entity classes (and their
 * `@MappedSuperclass` bases), matched by simple class name. A path through an `@Embedded` value or
 * a basic attribute ends there.
 *
 * Entity graphs (rule `orm.entity-graph`, inferred): `@EntityGraph(attributePaths = …)` on a Spring
 * Data repository method reads the tables its paths reach from the repository's entity. A named
 * graph (`@EntityGraph("Owner.detail")`) is not read.
 */
import {
  lit,
  parseAnnotation,
  splitArgs,
  tableKey,
  type OrmModel,
  type ResolvedMapping,
} from '@nexora/orm';
import { bodyRefs, tokenize, type SqlRef } from '@nexora/sql';
import type { GraphBuilder, NodeRec, NodeRef } from '../model';
import { isTestSupportPath } from '../test-paths';

export interface JpaQueryStats {
  /** Query annotations and calls read. */
  sites: number;
  /** Sites linked to at least one table. */
  linked: number;
  /** Sites recorded as gaps (dynamic text, unknown named query, unmapped entity). */
  gaps: number;
}

export type JpaSite =
  | { kind: 'query'; line: number; text: string; native: boolean; via: string }
  | { kind: 'define'; line: number; name: string; text: string; native: boolean }
  | { kind: 'named'; line: number; name: string; via: string }
  | { kind: 'dynamic'; line: number; via: string }
  | { kind: 'graph'; line: number; paths: string[]; via: string };

const JPA_IMPORT =
  /\bimport\s+(jakarta\.persistence|javax\.persistence|org\.hibernate|org\.springframework\.data\.jpa)\b/u;
const SITE =
  /@(Query|NamedQuery|NamedNativeQuery|EntityGraph)\s*\(|\.(createQuery|createNativeQuery|createNamedQuery)\s*\(/gu;

/** The text with comments blanked (newlines and string contents kept), so offsets still match. */
function blankComments(text: string): string {
  const out = text.split('');
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('"""', i)) {
      const end = text.indexOf('"""', i + 3);
      i = end < 0 ? text.length : end + 3;
    } else if (text[i] === '"' || text[i] === "'") {
      const q = text[i]!;
      i++;
      while (i < text.length && text[i] !== q && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1;
      i++;
    } else if (text.startsWith('//', i)) {
      while (i < text.length && text[i] !== '\n') out[i++] = ' ';
    } else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      for (; i < stop; i++) if (out[i] !== '\n') out[i] = ' ';
    } else i++;
  }
  return out.join('');
}

/** The text between the parenthesis at `open` and its match, skipping strings. */
function argsAt(text: string, open: number): string | undefined {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text.startsWith('"""', i)) {
      const end = text.indexOf('"""', i + 3);
      if (end < 0) return undefined;
      i = end + 2;
    } else if (text[i] === '"') {
      i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    } else if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  return undefined;
}

/** Literal parts joined by `+`: their value; undefined when any part is not a literal. */
export function stringValue(expr: string | undefined, kotlin = false): string | undefined {
  if (expr === undefined) return undefined;
  const parts: string[] = [];
  let i = 0;
  const s = expr.trim();
  while (i < s.length) {
    while (/\s/u.test(s[i] ?? '')) i++;
    if (s.startsWith('"""', i)) {
      const end = s.indexOf('"""', i + 3);
      if (end < 0) return undefined;
      parts.push(s.slice(i + 3, end));
      i = end + 3;
    } else if (s[i] === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j += s[j] === '\\' ? 2 : 1;
      if (j >= s.length) return undefined;
      parts.push(s.slice(i + 1, j).replace(/\\(.)/gu, '$1'));
      i = j + 1;
    } else return undefined;
    while (/\s/u.test(s[i] ?? '')) i++;
    if (i < s.length) {
      if (s[i] !== '+') return undefined;
      i++;
    }
  }
  if (!parts.length) return undefined;
  const v = parts.join('');
  // A Kotlin string template is filled in at run time.
  if (kotlin && /\$[{\w]/u.test(v)) return undefined;
  return v;
}

const lineAt = (text: string, offset: number) => {
  let n = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
};

/** The query sites in one Java or Kotlin file; empty when the file does not use JPA. */
export function jpaQuerySites(text: string, kotlin = false): JpaSite[] {
  if (!JPA_IMPORT.test(text)) return [];
  const code = blankComments(text);
  const out: JpaSite[] = [];
  for (const m of code.matchAll(SITE)) {
    const open = m.index + m[0].length - 1;
    const args = argsAt(code, open);
    if (args === undefined) continue;
    const line = lineAt(code, m.index);
    const via = m[1] ? `@${m[1]}` : m[2]!;
    if (m[1]) {
      const a = parseAnnotation(`@${m[1]}(${args})`);
      if (!a) continue;
      if (m[1] === 'EntityGraph') {
        const paths = [...(a.args.get('attributePaths') ?? '').matchAll(/"([^"\\]+)"/gu)].map(
          (x) => x[1]!,
        );
        if (paths.length) out.push({ kind: 'graph', line, paths, via: '@EntityGraph' });
        continue;
      }
      if (m[1] === 'Query') {
        // Spring Data's @Query; a repository may name a query instead of writing it.
        const name = lit(a.args.get('name'));
        const value = a.args.get('value') ?? a.pos[0];
        if (value === undefined && name) out.push({ kind: 'named', line, name, via });
        else {
          const q = stringValue(value, kotlin);
          if (q === undefined) out.push({ kind: 'dynamic', line, via });
          else
            out.push({
              kind: 'query',
              line,
              text: q,
              native: lit(a.args.get('nativeQuery')) === 'true',
              via,
            });
        }
      } else {
        const name = lit(a.args.get('name'));
        const q = stringValue(a.args.get('query'), kotlin);
        if (!name) continue;
        if (q === undefined) out.push({ kind: 'dynamic', line, via });
        else out.push({ kind: 'define', line, name, text: q, native: m[1] === 'NamedNativeQuery' });
      }
      continue;
    }
    const first = splitArgs(args)[0];
    // createQuery() with no argument is not the EntityManager's (Keycloak's event store has one).
    if (first === undefined) continue;
    // CriteriaBuilder.createQuery(Foo.class) builds a query object; where it runs is the gap.
    if (/^[\w.]+(::|\.)class(\.java)?$/u.test(first.trim())) continue;
    if (m[2] === 'createNamedQuery') {
      const name = stringValue(first, kotlin);
      out.push(
        name === undefined ? { kind: 'dynamic', line, via } : { kind: 'named', line, name, via },
      );
      continue;
    }
    const q = stringValue(first, kotlin);
    if (q === undefined) out.push({ kind: 'dynamic', line, via });
    else out.push({ kind: 'query', line, text: q, native: m[2] === 'createNativeQuery', via });
  }
  return out;
}

/** Names a query reads and writes. JPQL names are entities; native SQL names are tables. */
export function queryTargets(text: string, native: boolean): { reads: SqlRef[]; writes: SqlRef[] } {
  // JOIN FETCH is JPQL; the reader would take FETCH for a relation name.
  const q = native ? text : text.replace(/\bjoin\s+fetch\b/giu, 'join');
  const r = bodyRefs(tokenize(q, 'generic'), 'generic');
  // In JPQL a qualified name is a path from an alias (join o.pets p), not an entity.
  const keep = (x: SqlRef) => native || x.schema === undefined;
  return { reads: r.reads.filter(keep), writes: r.writes.filter(keep) };
}

const JPQL_KEYWORDS = new Set(
  'where join left right inner outer cross on with fetch order group having set and or union select from as'.split(
    ' ',
  ),
);

/**
 * The classes whose tables a JPQL query reads through association paths. Aliases are declared by
 * `FROM Entity e` and `JOIN e.attr x` (in order). A `JOIN` path joins every association on it. Any
 * other dotted path (`p.owner.city` in WHERE or SELECT) joins an association only when the path
 * goes on past it to an attribute that is not its id: `p.owner = :o` and `p.owner.id` compare the
 * key column and read no other table. String literals and `:param` names are skipped.
 */
export function pathTargets(
  text: string,
  entityClass: (name: string) => string | undefined,
  assoc: (cls: string, attr: string) => string | undefined,
  isId: (cls: string, attr: string) => boolean = (_c, attr) => attr === 'id',
): string[] {
  const q = text.replace(/'(?:[^']|'')*'/gu, "''");
  const types = new Map<string, string>();
  const out = new Set<string>();
  const walk = (path: string, joined: boolean): string | undefined => {
    const [head, ...rest] = path.split('.');
    let cls = types.get(head!.toLowerCase());
    for (let i = 0; i < rest.length; i++) {
      if (!cls) return undefined;
      cls = assoc(cls, rest[i]!);
      const next = rest[i + 1];
      if (cls && (joined || (next !== undefined && !isId(cls, next)))) out.add(cls);
    }
    return cls;
  };
  // The alias is read after each match, not consumed by it: in `, p FROM Pet p` the FROM after
  // `p` (a keyword, not an alias) must stay for the next declaration.
  const DECL = /\b(from|join(?:\s+fetch)?|,)\s+([A-Za-z_][\w.]*)/giu;
  for (const d of q.matchAll(DECL)) {
    const a = /^\s+(?:as\s+)?([A-Za-z_]\w*)/iu.exec(q.slice(d.index + d[0].length))?.[1];
    const alias = a && !JPQL_KEYWORDS.has(a.toLowerCase()) ? a : undefined;
    const cls = d[2]!.includes('.') ? walk(d[2]!, /^join/iu.test(d[1]!)) : entityClass(d[2]!);
    if (alias && cls) types.set(alias.toLowerCase(), cls);
  }
  for (const p of q.matchAll(/(?<![:\w.])[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+/gu)) walk(p[0], false);
  return [...out];
}

/** The innermost symbol whose lines hold `line`; the next one starting within 3 lines (an annotation above it). */
function enclosing(symbols: NodeRec[], line: number): NodeRec | undefined {
  let best: NodeRec | undefined;
  for (const n of symbols) {
    const s = n.startLine ?? 0;
    const e = n.endLine ?? s;
    if (s <= line && line <= e && (!best || e - s < (best.endLine ?? 0) - (best.startLine ?? 0)))
      best = n;
  }
  const next = symbols
    .filter((n) => (n.startLine ?? 0) > line && (n.startLine ?? 0) <= line + 3)
    .sort((a, b) => (a.startLine ?? 0) - (b.startLine ?? 0))[0];
  // An annotation line sits inside the class but belongs to the method below it.
  if (next && (!best || (next.startLine ?? 0) <= (best.endLine ?? 0))) return next;
  return best;
}

/** Adds JPA query links. Call after `addOrm`, with its resolved mappings. */
export function addJpaQueries(
  graph: GraphBuilder,
  files: { path: string; language: string }[],
  texts: Map<string, string>,
  mappings: ResolvedMapping[],
  models: OrmModel[] = [],
): JpaQueryStats {
  const stats: JpaQueryStats = { sites: 0, linked: 0, gaps: 0 };
  // Entity name → table; a name two entities claim with different tables is not used.
  const entities = new Map<string, { table: string; confidence: 'observed' | 'inferred' } | null>();
  for (const m of mappings) {
    if (m.framework !== 'jpa' || m.access !== 'maps') continue;
    const name = m.entityName ?? m.owner;
    const prev = entities.get(name);
    if (prev === undefined) entities.set(name, { table: m.table, confidence: m.confidence });
    else if (prev && tableKey(prev.table) !== tableKey(m.table)) entities.set(name, null);
  }

  // Class → its own table; entity name → class; table → classes (for a repository's entity).
  const classTable = new Map<string, string | null>();
  const entityClass = new Map<string, string | null>();
  const tableClasses = new Map<string, string[]>();
  for (const m of mappings) {
    if (m.framework !== 'jpa' || m.access !== 'maps') continue;
    const prev = classTable.get(m.owner);
    classTable.set(m.owner, prev === undefined || prev === m.table ? m.table : null);
    const name = m.entityName ?? m.owner;
    const c = entityClass.get(name);
    entityClass.set(name, c === undefined || c === m.owner ? m.owner : null);
    const k = tableKey(m.table);
    tableClasses.set(k, [...new Set([...(tableClasses.get(k) ?? []), m.owner])]);
  }
  // Class → association attributes, own and inherited (bases matched by simple name).
  const jpaModels = new Map<string, OrmModel[]>();
  for (const m of models)
    if (m.framework === 'jpa' && m.role !== 'patch')
      jpaModels.set(m.model, [...(jpaModels.get(m.model) ?? []), m]);
  const assoc = (cls: string, attr: string, seen = new Set<string>()): string | undefined => {
    if (seen.has(cls)) return undefined;
    seen.add(cls);
    const ms = jpaModels.get(cls) ?? [];
    // Two classes of one simple name with different targets for the attribute: not guessed.
    const hits = new Set(
      ms.flatMap((m) =>
        (m.associations ?? []).filter((a) => a.field === attr).map((a) => a.target),
      ),
    );
    if (hits.size) return hits.size === 1 ? [...hits][0] : undefined;
    for (const b of new Set(ms.flatMap((m) => m.bases))) {
      const t = assoc(b, attr, seen);
      if (t) return t;
    }
    return undefined;
  };

  /** The id attributes of a class (`@Id` fields, own or inherited). */
  const ids = (cls: string, seen = new Set<string>()): string[] => {
    if (seen.has(cls)) return [];
    seen.add(cls);
    const ms = jpaModels.get(cls) ?? [];
    return [
      ...ms.flatMap((m) => m.fields.filter((f) => f.primaryKey && f.field).map((f) => f.field!)),
      ...ms.flatMap((m) => m.bases.flatMap((b) => ids(b, seen))),
    ];
  };
  /** The attribute is the class's id; `id` when no `@Id` field is read. */
  const isId = (cls: string, attr: string) => {
    const own = ids(cls);
    return own.length ? own.includes(attr) : attr === 'id';
  };

  const perFile: { path: string; sites: JpaSite[] }[] = [];
  const defined = new Map<string, Extract<JpaSite, { kind: 'define' }>[]>();
  for (const f of files) {
    const kotlin = f.language === 'Kotlin';
    if ((f.language !== 'Java' && !kotlin) || isTestSupportPath(f.path)) continue;
    const text = texts.get(f.path);
    if (text === undefined) continue;
    const sites = jpaQuerySites(text, kotlin);
    if (!sites.length) continue;
    perFile.push({ path: f.path, sites });
    for (const s of sites)
      if (s.kind === 'define') defined.set(s.name, [...(defined.get(s.name) ?? []), s]);
  }
  if (!perFile.length) return stats;

  const symbolsByFile = new Map<string, NodeRec[]>();
  for (const n of graph.nodes.values())
    if (n.kind === 'symbol' && n.filePath && n.startLine !== undefined)
      symbolsByFile.set(n.filePath, [...(symbolsByFile.get(n.filePath) ?? []), n]);

  for (const { path, sites } of perFile) {
    const symbols = symbolsByFile.get(path) ?? [];
    for (const site of sites) {
      if (site.kind === 'define') continue; // linked where it is run
      stats.sites++;
      const gap = (text: string, reason: string) => {
        stats.gaps++;
        graph.addUnresolved({ filePath: path, line: site.line, kind: 'query', text, reason });
      };
      if (site.kind === 'dynamic') {
        gap(site.via, 'the query text is not a literal (built at run time or from a constant)');
        continue;
      }
      const src: NodeRef = (() => {
        const n = enclosing(symbols, site.line);
        return n ? { kind: n.kind, key: n.key } : { kind: 'file' as const, key: path };
      })();
      /** Links the tables of association targets (classes) read through a path. */
      const linkClasses = (
        classes: string[],
        method: 'orm.jpa-path-join' | 'orm.entity-graph',
        what: string,
      ) => {
        let any = false;
        for (const cls of classes) {
          const table = classTable.get(cls);
          if (!table) continue;
          const dst: NodeRef = { kind: 'table', key: `table:${tableKey(table)}` };
          if (!graph.has(dst)) continue;
          graph.addEdge({
            kind: 'reads_table',
            method,
            src,
            dst,
            confidence: 'inferred',
            evidencePath: path,
            evidenceLine: site.line,
            detail: `${what} reaches ${cls} → ${table}`,
          });
          any = true;
        }
        return any;
      };
      if (site.kind === 'graph') {
        // The repository's entity: the table this repository reads, mapped back to its classes.
        const owner = symbols.find((n) => n.key === src.key)?.name.split('.')[0];
        const repoTables = mappings.filter(
          (m) => m.path === path && m.access !== 'maps' && (!owner || m.owner === owner),
        );
        const roots = [
          ...new Set(repoTables.flatMap((m) => tableClasses.get(tableKey(m.table)) ?? [])),
        ];
        if (!roots.length) {
          gap(site.via, "the repository's entity is not known");
          continue;
        }
        const reached = new Set<string>();
        for (const p of site.paths)
          for (const root of roots) {
            let cls: string | undefined = root;
            for (const attr of p.split('.')) {
              cls = cls && assoc(cls, attr);
              if (cls) reached.add(cls);
            }
          }
        if (linkClasses([...reached], 'orm.entity-graph', `@EntityGraph(${site.paths.join(', ')})`))
          stats.linked++;
        continue;
      }
      let text: string;
      let native: boolean;
      let named = false;
      if (site.kind === 'named') {
        const defs = defined.get(site.name) ?? [];
        const distinct = new Set(defs.map((d) => `${d.native}\u0000${d.text}`));
        if (distinct.size !== 1) {
          gap(
            `${site.via} ${site.name}`,
            defs.length
              ? 'the named query is defined more than once with different text'
              : 'no named query of this name is defined in this repository',
          );
          continue;
        }
        text = defs[0]!.text;
        native = defs[0]!.native;
        named = true;
      } else ({ text, native } = site);

      const targets = queryTargets(text, native);
      let linked = false;
      if (!native) {
        const reached = pathTargets(
          text,
          (name) => entityClass.get(name) ?? undefined,
          (cls, attr) => assoc(cls, attr),
          isId,
        );
        if (linkClasses(reached, 'orm.jpa-path-join', `${site.via} path`)) linked = true;
      }
      const link = (r: SqlRef, kind: 'reads_table' | 'writes_table') => {
        let table: string;
        let confidence: 'observed' | 'inferred';
        if (native) {
          table = r.name;
          confidence = 'observed';
        } else {
          const e = entities.get(r.name);
          if (!e) {
            gap(
              `${site.via} ${r.name}`,
              e === null
                ? 'two entities of this name map to different tables'
                : 'no entity of this name is mapped in this repository',
            );
            return;
          }
          table = e.table;
          confidence = e.confidence;
        }
        const dst: NodeRef = { kind: 'table', key: `table:${tableKey(table)}` };
        if (!graph.has(dst)) {
          if (native) gap(`${site.via} ${r.name}`, 'the table is not defined in this repository');
          return;
        }
        graph.addEdge({
          kind,
          method: named ? 'orm.jpa-named-query' : 'orm.jpa-query',
          src,
          dst,
          confidence: named ? 'inferred' : confidence,
          evidencePath: path,
          evidenceLine: site.line,
          detail: `${site.via}${named ? ` ${(site as { name: string }).name}` : ''} (${native ? 'SQL' : 'JPQL'}) ${kind === 'reads_table' ? 'reads' : 'writes'} ${native ? table : `${r.name} → ${table}`}`,
        });
        linked = true;
      };
      for (const r of targets.reads) link(r, 'reads_table');
      for (const r of targets.writes) link(r, 'writes_table');
      if (linked) stats.linked++;
    }
  }
  return stats;
}
