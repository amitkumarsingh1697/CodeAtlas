/**
 * The rule catalogue (GRAPH-001, ADR 0026): every relationship CodeAtlas stores names the rule
 * that produced it, so a reader can see how a link was decided and a benchmark can measure each
 * rule's precision on its own. `edges.method` holds the rule id and `edges.adapter` its adapter.
 *
 * `labels` lists the evidence classes a rule can assign. The catalogue document
 * (documentation/architecture/RULE_CATALOGUE.md) is generated from this table and a test keeps
 * the two identical.
 */
import type { Confidence } from './model';

export interface Rule {
  adapter: string;
  labels: readonly Confidence[];
  description: string;
}

const O = ['observed'] as const;
const I = ['inferred'] as const;
const OI = ['observed', 'inferred'] as const;

export const RULES = {
  'core.module-contains-file': {
    adapter: 'core',
    labels: O,
    description: 'A file belongs to the module its path places it in.',
  },
  'manifest.package-entry-point': {
    adapter: 'manifest',
    labels: O,
    description: 'A `main`, `bin` or script entry in package.json names this file.',
  },
  'docs.section-nesting': {
    adapter: 'docs',
    labels: O,
    description: 'A Markdown heading nests under the heading above it, or under its file.',
  },
  'docs.path-mention': {
    adapter: 'docs',
    labels: I,
    description: 'Documentation names a repository file path.',
  },
  'docs.identifier-mention': {
    adapter: 'docs',
    labels: I,
    description:
      'Documentation names an identifier that exactly one exported symbol in the repository has.',
  },
  'orm.foreign-key': {
    adapter: 'orm',
    labels: OI,
    description:
      'An ORM relation declares a foreign key; inferred when the column or table name comes from the framework default.',
  },
  'orm.entity-table': {
    adapter: 'orm',
    labels: OI,
    description:
      'An entity or model class maps to a table, named explicitly (observed) or by the framework naming default (inferred).',
  },
  'orm.repository-table': {
    adapter: 'orm',
    labels: I,
    description:
      'A repository or DAO typed by an entity reads and writes that entity table (for example Spring Data `Repository<T, ID>`).',
  },
  'sql.object-nesting': {
    adapter: 'sql',
    labels: O,
    description: 'A database object (column, package member) is declared inside its parent.',
  },
  'sql.table-use-parsed': {
    adapter: 'sql',
    labels: O,
    description: 'The PostgreSQL parser found the table read or written in a routine body.',
  },
  'sql.table-use-statement-reader': {
    adapter: 'sql',
    labels: I,
    description: 'The statement reader (other dialects) matched a table name in a routine body.',
  },
  'sql.routine-call': {
    adapter: 'sql',
    labels: OI,
    description:
      'A routine body calls another routine; observed only when parsed and declared in the same file, otherwise matched by name.',
  },
  'sql.table-attachment': {
    adapter: 'sql',
    labels: O,
    description: 'A trigger, index, policy, rule or sequence is declared on a table.',
  },
  'schema.foreign-key': {
    adapter: 'schema',
    labels: O,
    description: 'A SQL, Prisma or Drizzle schema declares a foreign key.',
  },
  'schema.drizzle-query': {
    adapter: 'schema',
    labels: O,
    description: 'A Drizzle query names a table object (`db.select().from(users)`).',
  },
  'schema.prisma-client': {
    adapter: 'schema',
    labels: I,
    description: 'A Prisma client call (`prisma.user.findMany()`) is matched to a model by name.',
  },
  'schema.sql-string': {
    adapter: 'schema',
    labels: I,
    description: 'A SQL string literal in TypeScript names a table.',
  },
  'integrations.env-var': {
    adapter: 'integrations',
    labels: O,
    description: '`process.env.NAME` is read or assigned.',
  },
  'integrations.dotenv': {
    adapter: 'integrations',
    labels: I,
    description: 'dotenv is loaded, which reads `.env` from the working directory by default.',
  },
  'integrations.config-file-read': {
    adapter: 'integrations',
    labels: I,
    description:
      'A file-reading call is given a literal path that looks like a configuration file.',
  },
  'integrations.db-client': {
    adapter: 'integrations',
    labels: I,
    description: 'A call on a client from a known database package.',
  },
  'integrations.http-call': {
    adapter: 'integrations',
    labels: I,
    description: 'A call on a known HTTP client, with the URL prefix where the source states it.',
  },
  'typescript.declaration-nesting': {
    adapter: 'typescript',
    labels: O,
    description: 'The TypeScript compiler places a declaration inside its file or parent.',
  },
  'typescript.import-resolved': {
    adapter: 'typescript',
    labels: O,
    description: 'The compiler resolved an import to a file in the repository.',
  },
  'typescript.import-package': {
    adapter: 'typescript',
    labels: O,
    description: 'The compiler resolved an import to an installed package.',
  },
  'typescript.import-asset': {
    adapter: 'typescript',
    labels: O,
    description: 'A relative import names a non-code file that exists (CSS, SVG, JSON).',
  },
  'typescript.import-builtin': {
    adapter: 'typescript',
    labels: O,
    description: 'An import names a Node.js built-in module.',
  },
  'typescript.import-uninstalled-package': {
    adapter: 'typescript',
    labels: I,
    description: 'A bare import names a package that is not installed, so it was not resolved.',
  },
  'typescript.checker-call': {
    adapter: 'typescript',
    labels: O,
    description: 'The type checker resolved a call or `new` to its declaration.',
  },
  'typescript.unique-name-fallback': {
    adapter: 'typescript',
    labels: I,
    description:
      'An untyped call matched to the only declaration with that name (no type information).',
  },
  'typescript.checker-heritage': {
    adapter: 'typescript',
    labels: O,
    description: 'The type checker resolved an `extends` or `implements` clause.',
  },
  'typescript.jsx-render': {
    adapter: 'typescript',
    labels: O,
    description: 'A JSX tag resolved by the type checker to its component.',
  },
  'typescript.component-render': {
    adapter: 'typescript',
    labels: O,
    description: 'A Svelte, Vue or Astro component tag resolved to its component.',
  },
  'typescript.test-imports': {
    adapter: 'typescript',
    labels: I,
    description: 'A test file imports a non-test file, so it is taken to test it.',
  },
  'typescript.next-route': {
    adapter: 'typescript',
    labels: I,
    description: 'Next.js file-system routing: the exported handler in a route file.',
  },
  'typescript.express-route-handler': {
    adapter: 'typescript',
    labels: I,
    description: 'An Express-style `app.get(path, handler)` registration names its handler.',
  },
  'typescript.express-inline-handler': {
    adapter: 'typescript',
    labels: I,
    description: 'An Express-style registration with an inline handler function.',
  },
  'spring.request-mapping': {
    adapter: 'spring-mvc',
    labels: OI,
    description:
      'A `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping` or `@RequestMapping` on a method of a `@Controller` or `@RestController` class, joined to the class `@RequestMapping` prefix. Observed for string-literal paths; inferred when a path is a constant declared once elsewhere in the repository.',
  },
  'nestjs.controller-route': {
    adapter: 'nestjs',
    labels: OI,
    description:
      'A NestJS `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Options`, `@Head` or `@All` method of a `@Controller` class, joined to the controller path; inferred when a path is a constant (such as an enum member) declared elsewhere. A global prefix set elsewhere is not included.',
  },
  'config.class-reference': {
    adapter: 'config',
    labels: I,
    description: 'Configuration (XML, YAML, properties) names a class found by its package path.',
  },
  'build.module-dependency': {
    adapter: 'build',
    labels: OI,
    description:
      'A Maven or Gradle dependency names a module built in this repository (observed on an exact group:artifact match).',
  },
  'structured.nesting': {
    adapter: 'structured',
    labels: OI,
    description: 'A key, element or build entry nests inside its parent in a structured file.',
  },
  'structured.file-link': {
    adapter: 'structured',
    labels: OI,
    description:
      'A structured file (Dockerfile, CI, build or config file) names another repository file.',
  },
  'syntax.declaration-nesting': {
    adapter: 'tree-sitter',
    labels: O,
    description: 'The parse tree places a declaration inside its file or parent.',
  },
  'syntax.receiver-method': {
    adapter: 'tree-sitter',
    labels: OI,
    description:
      'A Go, Rust or C++ receiver method belongs to its type (observed when declared in the same file).',
  },
  'syntax.call.new-class': {
    adapter: 'tree-sitter',
    labels: OI,
    description: '`new X` resolved to class X (observed when declared in the same file).',
  },
  'syntax.call.receiver-type': {
    adapter: 'tree-sitter',
    labels: I,
    description:
      '`x.m()` where the source states the type of x (declared type, `new T` or field), resolved to that type or an inherited member.',
  },
  'syntax.call.self-member': {
    adapter: 'tree-sitter',
    labels: OI,
    description:
      '`this.m()`, `self.m()` or an implicit member call resolved to a member of the enclosing class (observed in the same file).',
  },
  'syntax.call.local-function': {
    adapter: 'tree-sitter',
    labels: O,
    description: 'A bare call to a top-level function declared in the same file.',
  },
  'syntax.call.imported-name': {
    adapter: 'tree-sitter',
    labels: I,
    description: 'A bare call to a name the file imports from a repository file.',
  },
  'syntax.call.same-package': {
    adapter: 'tree-sitter',
    labels: I,
    description: 'A call to a function declared in the same package folder (Go, Java and similar).',
  },
  'syntax.call.module-import': {
    adapter: 'tree-sitter',
    labels: I,
    description: '`mod.f()` where mod is an imported repository module.',
  },
  'syntax.call.class-member': {
    adapter: 'tree-sitter',
    labels: OI,
    description: '`Class.m()` resolved to a member of a repository class with that name.',
  },
  'syntax.call.unique-name': {
    adapter: 'tree-sitter',
    labels: I,
    description:
      'The only declaration with that name the call can reach in the repository; the receiver type was not checked.',
  },
  'syntax.base.same-file': {
    adapter: 'tree-sitter',
    labels: O,
    description: 'A base class or interface declared in the same file.',
  },
  'syntax.base.imported-name': {
    adapter: 'tree-sitter',
    labels: I,
    description: 'A base class or interface the file imports.',
  },
  'syntax.base.same-folder': {
    adapter: 'tree-sitter',
    labels: I,
    description: 'The only base class or interface with that name in the same folder.',
  },
  'syntax.base.unique-name': {
    adapter: 'tree-sitter',
    labels: I,
    description: 'The only base class or interface with that name in the repository.',
  },
  'scip.reference': {
    adapter: 'scip',
    labels: O,
    description: 'A SCIP index written by a compiler-grade indexer resolved the reference.',
  },
  'declarations.nesting': {
    adapter: 'declarations',
    labels: OI,
    description:
      'Declaration patterns (languages without a grammar) place a member inside its parent by indentation or braces.',
  },
  'declarations.receiver-method': {
    adapter: 'declarations',
    labels: I,
    description: 'Declaration patterns attach a receiver method to a type in the same folder.',
  },
  'declarations.import-resolved': {
    adapter: 'declarations',
    labels: I,
    description: 'An import resolved to a repository file by path, module path or go.mod.',
  },
  'declarations.import-external': {
    adapter: 'declarations',
    labels: ['unknown'],
    description: 'An import that names nothing in the repository (a library, or not resolvable).',
  },
} as const satisfies Record<string, Rule>;

export type RuleId = keyof typeof RULES;

export function adapterOf(method: RuleId): string {
  return RULES[method].adapter;
}

/** The catalogue as Markdown, the content of documentation/architecture/RULE_CATALOGUE.md. */
export function ruleCatalogueMarkdown(): string {
  const rows = (Object.entries(RULES) as [RuleId, Rule][]).map(
    ([id, r]) => `| \`${id}\` | ${r.adapter} | ${r.labels.join(', ')} | ${r.description} |`,
  );
  return [
    '# Relationship rule catalogue',
    '',
    'Generated from `products/codeatlas/core/src/indexer/rules.ts` (GRAPH-001, ADR 0026); a test keeps this file identical to it. Every stored relationship names one of these rules in `edges.method`, and its adapter in `edges.adapter`.',
    '',
    '| Rule | Adapter | Evidence classes | What it means |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}
