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
  'spring.injection': {
    adapter: 'spring-beans',
    labels: I,
    description:
      'A Spring bean is given another bean: a constructor, `@Autowired`/`@Inject`/`@Resource` field or setter, or `@Bean` method parameter whose type only that bean provides (or the one `@Qualifier`, `@Primary` or the parameter name picks). Inferred: Spring decides at run time, and profiles, conditions and library beans are not read.',
  },
  'spring-data.derived-query': {
    adapter: 'orm',
    labels: I,
    description:
      'A method declared in a Spring Data repository whose name is a derived query (`findByLastName`, `countBy…`, `deleteBy…`) reads, or deletes from, the table of the repository entity.',
  },
  'orm.jpa-query': {
    adapter: 'orm',
    labels: OI,
    description:
      'A method runs a JPQL or native SQL query written as a literal (`@Query`, `createQuery`, `createNativeQuery`); the entities or tables it names are read or written. Observed when the table name is written in the source, inferred when it is a naming default.',
  },
  'orm.jpa-path-join': {
    adapter: 'orm',
    labels: I,
    description:
      'A JPQL query follows an association path from an alias (`join fetch o.pets p`, `p.owner.city`): it also reads the table of each entity the path reaches. Associations are read from the entity classes and their `@MappedSuperclass` bases, matched by simple class name.',
  },
  'orm.entity-graph': {
    adapter: 'orm',
    labels: I,
    description:
      "A Spring Data repository method with `@EntityGraph(attributePaths = …)` reads the tables of the associations its paths reach from the repository's entity. Named entity graphs are not read.",
  },
  'orm.jpa-named-query': {
    adapter: 'orm',
    labels: I,
    description:
      'A method runs a JPA named query (`createNamedQuery`, `@Query(name = …)`) matched by name to one `@NamedQuery` or `@NamedNativeQuery` in the repository.',
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
  'schema.kysely-query': {
    adapter: 'schema',
    labels: OI,
    description:
      'A Kysely query-builder call names a table (`selectFrom`, `insertInto`, `updateTable`, `deleteFrom`, joins, `deleteFrom(…).using`, `updateTable(…).from`); a name bound by `with` earlier in the chain is the CTE, not the table; observed when the receiver type resolves to kysely.',
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
  'typescript.import-workspace': {
    adapter: 'typescript',
    labels: OI,
    description:
      "A bare import names a package of this repository's workspace that node_modules does not link: observed when the entry its package.json names is in the repository, inferred when the entry is build output and its source is assumed (TS-001).",
  },
  'typescript.import-subpath': {
    adapter: 'typescript',
    labels: I,
    description:
      'A `#` import matched an entry of the nearest package.json `imports` map and was resolved with extensions tried, as bundlers do (TS-001).',
  },
  'typescript.import-framework-module': {
    adapter: 'typescript',
    labels: O,
    description:
      'A SvelteKit module (`$app/*`, `$env/*`, `$service-worker`) imported in a package that depends on @sveltejs/kit (TS-001).',
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
  'jaxrs.resource-method': {
    adapter: 'jax-rs',
    labels: OI,
    description:
      'A JAX-RS `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`, `@HEAD` or `@OPTIONS` method of a root resource (a class with `@Path`), joined to the class path; inferred when a path is a constant declared elsewhere. `@ApplicationPath` is not included.',
  },
  'jaxrs.sub-resource': {
    adapter: 'jax-rs',
    labels: I,
    description:
      'A JAX-RS resource method reached through one or more sub-resource locators (a `@Path` method with no verb), followed by the declared return type; inferred because the locator may return another object at run time.',
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
  'npm.workspace-dependency': {
    adapter: 'build',
    labels: O,
    description:
      'A package.json lists another package of this repository in dependencies, devDependencies, peerDependencies or optionalDependencies (TS-005).',
  },
  'build.module-dependency': {
    adapter: 'build',
    labels: OI,
    description:
      "A Maven or Gradle dependency names a module built in this repository: the dependency links to that build file, and the module `depends_on` that module (JV-001). Maven: observed on an exact `groupId:artifactId` match, inferred on a unique artifactId when the groupId is a property. Gradle: observed for a `project(':p')` path written as declared, inferred for type-safe accessors, renamed projects and dependencies declared in `subprojects {}` or `allprojects {}`. A child POM also depends on the modules its in-repository parent POMs list (cited at the parent's line); a folder that is also an npm package keeps one module, named by its package.json.",
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
  'syntax.call.library-member': {
    adapter: 'tree-sitter',
    labels: I,
    description:
      "`x.m()` where the source states the type of x, m is not declared in the repository, and that type extends a library type: linked to the class (for example a Spring Data repository's inherited `save`).",
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
