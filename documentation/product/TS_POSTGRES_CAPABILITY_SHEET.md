# TypeScript / PostgreSQL capability sheet (CAP-001)

**Status: draft for founder approval.** The roadmap makes this sheet a Sprint 3 exit item and says the founder approves it (`docs/audit/IMPLEMENTATION_ROADMAP.md`, CAP-001). Until it is approved, and until a ground-truth file is `spot-checked` or `adjudicated` under decision D-9, the figures are for engineering use only and must not be quoted externally (see [benchmark/README.md](../benchmark/README.md)).

This sheet says what CodeAtlas reads in a TypeScript repository backed by PostgreSQL, how well, and what it cannot see. Each capability is classed as follows:

- **Supported:** measured against labels on a real repository.
- **Partial:** implemented and tested, but either not measured against labels or measured with known gaps.
- **Unsupported:** not read at all.

Every figure was measured on 2026-11-15, with CodeAtlas run on default options: no SCIP index, no model, no `npm install`. The ground truth is **claude-labelled**, which means Claude made the labels with a separate script and no human has reviewed them yet.

## 1. Measured accuracy

The corpus is Immich `e5d6eb7` (NestJS, Kysely, PostgreSQL, a SvelteKit web app, 14 workspace packages), with labels in [immich.json](../benchmark/ground-truth/immich.json).

| Relationship                                            | Labels | Precision | Recall | Evidence class             |
| ------------------------------------------------------- | -----: | --------: | -----: | -------------------------- |
| `handled_by` (HTTP route → NestJS handler method)       |    315 |      100% |   100% | 269 observed, 46 inferred  |
| `imports` (file → file, workspace package, `#` subpath) |    558 |      100% |   100% | 283 observed, 275 inferred |
| `maps_to` (`@Table` class → table)                      |     71 |      100% |   100% | observed                   |
| `reads_table` (repository method → table, Kysely)       |    507 |      100% |  99.8% | inferred                   |
| `writes_table` (repository method → table, Kysely)      |    195 |      100% |  99.5% | inferred                   |

How to read these figures:

- **One repository only.** The labels come from one codebase. Several rules were fixed after this benchmark found defects (each fix is listed in the ground-truth method and in [BENCHMARK_HISTORY.md](../benchmark/BENCHMARK_HISTORY.md)), so the scores also show how closely CodeAtlas was tuned to Immich. They do not predict accuracy on another codebase.
- **Table links are inferred.** Immich's dependencies were not installed, so CodeAtlas matched Kysely calls by import and method name. With `node_modules` present, the receiver type is checked and links become observed.
- **The two table misses:**
  - `kysely_migrations`: Kysely creates this table itself and the repository never declares it.
  - A `sql.table('smart_search')` inside a raw `sql` delete.

Measured but not labelled:

| What                                               | Immich `e5d6eb7`                                                                                               | Twenty (first 20,000 files)                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Declared tables found (TS-003)                     | 71 of 71 (`@immich/sql-tools` classes); 33 migration-only names marked `undeclared`                            | not measured                                            |
| Workspace packages, declared dependencies (TS-005) | 14 packages, 9 dependencies; 401 imports between packages, 4 undeclared                                        | 36 packages, 26 dependencies; 432 imports, 4 undeclared |
| Calls                                              | 18,247 call links (12,998 resolved by the type checker); 5,000 call gaps stored (the per-kind cap; more exist) | not measured                                            |

## 2. What is read

| Area                                | Level       | What CodeAtlas reads                                                                                                                                                                                                                                                                                            | Rule ids                                                  |
| ----------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Imports                             | Supported   | Relative imports and tsconfig `paths`. Workspace packages without `node_modules`, mapping `dist` or `build` entries back to `src`. package.json `imports` (`#lib/*`). SvelteKit `$app/*`, `$env/*` and `$service-worker`. Workspace packages beyond the file limit are shown as gaps, not as external packages. | `typescript.import-*`                                     |
| NestJS routes                       | Supported   | `@Controller` prefixes and verb decorators (`@Get`, `@Post` and the rest) on handler methods.                                                                                                                                                                                                                   | `nestjs.controller-route`                                 |
| Kysely queries                      | Supported   | Literal table names in `selectFrom`, joins, lateral joins, `insertInto`, `updateTable`, `deleteFrom`, `replaceInto`, `mergeInto`, `deleteFrom(…).using` and `updateTable(…).from`. CTE names are told apart from tables.                                                                                        | `schema.kysely-query`                                     |
| `@immich/sql-tools` tables          | Supported   | `@Table` classes as the declared schema, with their columns.                                                                                                                                                                                                                                                    | `orm.entity-table`                                        |
| SQL migrations                      | Partial     | `.sql` files and SQL strings in TypeScript migrations, replayed in order: `CREATE`, `ALTER … RENAME`, `DROP`. `down()` is skipped. DDL built at run time becomes a gap. Tested, not labelled.                                                                                                                   | `sql.*`, `schema.foreign-key`                             |
| Workspace packages                  | Partial     | Each package.json is a module, with its dependencies on other workspace packages and an import check against them. Measured, not labelled.                                                                                                                                                                      | `npm.workspace-dependency`                                |
| Calls and inheritance               | Partial     | Calls, `new` and `extends`/`implements` resolved by the TypeScript type checker. Untyped calls fall back to a unique name. Not benchmarked.                                                                                                                                                                     | `typescript.checker-*`, `typescript.unique-name-fallback` |
| Prisma, TypeORM, Drizzle, Sequelize | Partial     | Models and tables read. Prisma client calls matched by model name, Drizzle queries by table object. Never benchmarked; Prisma has never run on a real project.                                                                                                                                                  | `orm.*`, `schema.prisma-client`, `schema.drizzle-query`   |
| Raw SQL in strings                  | Partial     | A string that starts with `SELECT`, `INSERT`, `UPDATE`, `DELETE` or `WITH` is scanned for table names. Text built from pieces (`sql.table()`, `sql.raw()`) is not.                                                                                                                                              | `schema.sql-string`                                       |
| Express and Next.js routes          | Partial     | `app.get(path, handler)` registrations, and Next.js route files. Tests only, no corpus.                                                                                                                                                                                                                         | `typescript.express-*`, `typescript.next-route`           |
| Svelte, Vue, Astro, JSX components  | Partial     | Component tags resolved to their component. Not benchmarked.                                                                                                                                                                                                                                                    | `typescript.jsx-render`, `typescript.component-render`    |
| Environment variables, HTTP clients | Partial     | `process.env.NAME`, dotenv, and calls on known HTTP and database clients. Not benchmarked.                                                                                                                                                                                                                      | `integrations.*`                                          |
| NestJS dependency injection         | Unsupported | Providers and module wiring are not modelled. A call on an injected field still resolves through its declared type.                                                                                                                                                                                             | —                                                         |
| NestJS events and jobs              | Unsupported | `@OnEvent` and `@OnJob` handlers are not entry points, and an emitted event is not linked to its handlers.                                                                                                                                                                                                      | —                                                         |
| Column-level reads and writes       | Unsupported | Queries are linked to tables only, not to the columns they use.                                                                                                                                                                                                                                                 | —                                                         |

## 3. Constructs CodeAtlas cannot resolve

CodeAtlas reads source only. It never runs the build, the application or the database. The counts below come from a grep of Immich `server/src`, which has 465 non-test `.ts` files.

| Construct                                                                               |                               Immich `server/src` | What CodeAtlas does                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS providers (`@Injectable`)                                                        |                                         119 files | The provider graph is not built. A call through an injected field resolves only when the field has a declared type.                                                        |
| Event handlers (`@OnEvent`)                                                             |                             95 handlers, 24 files | Not linked from `emit`. Flows started by an event stop at the `emit` call.                                                                                                 |
| Job handlers (`@OnJob`)                                                                 |                             68 handlers, 24 files | Same as events: queued jobs are not linked to their handlers.                                                                                                              |
| Raw `sql` templates outside migrations                                                  |                                     155, 20 files | A template is scanned for table names only when its text starts with a statement keyword. A fragment such as `(select … from asset)` inside a builder call is not scanned. |
| Tables named at run time (`db.dynamic.table(name)`, a helper that takes the table name) | 1 call, plus helper calls in `sync.repository.ts` | No link.                                                                                                                                                                   |
| A CTE built in one variable and queried through another                                 |                                           unknown | The CTE name can be taken for a table that has the same name.                                                                                                              |
| Guards and auth decorators (`@Authenticated`, `@UseGuards`)                             |                                     306, 48 files | Not modelled. Route access rules do not appear in flows.                                                                                                                   |
| `forwardRef` and `ModuleRef` lookups                                                    |                                        9, 4 files | Not followed.                                                                                                                                                              |

"Unknown" means the construct was not counted. It does not mean zero.

## 4. How to read a TypeScript result

- **Observed** means the compiler or the source states the link: a resolved import, a type-checked call, a literal decorator.
- **Inferred** means CodeAtlas applied a rule that can be wrong, such as matching by name or mapping a `dist` entry to `src`. The detail of each link says which rule matched.
- **A gap** is something CodeAtlas saw but could not resolve. Gaps are counted in the coverage report. A short gap list does not mean a complete graph, because the gap list is capped per kind.
- **Before relying on table links,** install dependencies (`pnpm install` or `npm ci`). The Kysely receiver is then type-checked, and links become observed.
