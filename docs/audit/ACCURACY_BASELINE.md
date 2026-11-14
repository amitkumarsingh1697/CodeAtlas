# Accuracy baseline

**Audit date:** 2026-11-14 · **CodeAtlas commit:** `2fc3767` · **Command:** `pnpm --filter @nexora/codeatlas-service cli index <abs path>` with a fresh `CODEATLAS_HOME`, no model, no SCIP, no installed dependencies in the target repos.

**Environment:** cloud Linux container, 4 vCPU, 15 GB RAM, Node 22.23.4, pnpm 10.28.0. Timings are wall-clock including `pnpm` and `tsx` start-up.

## What this document is and is not

This is a **baseline, not a benchmark.** No ground-truth corpus exists yet, so precision and recall cannot be computed for most relationship types. What I could do honestly in Phase 1:

1. **Counted ground truth with `grep`** for constructs that are easy to count exactly (route annotations, `@Entity`, repository interfaces), and compared with what CodeAtlas extracted.
2. **Hand-checked a small random sample** of call edges against the source line and the declared types.
3. **Recorded coverage and volume** numbers that the product itself reports.

Doc 07 §3 defines the real benchmark method (independent adjudication, matching rules, P/R/F1 by relationship type). That is Sprint 2 work in the [roadmap](IMPLEMENTATION_ROADMAP.md). No number below may be used in marketing.

## Repositories

All public, cloned shallow (`--depth 1`) into a scratch folder, indexed read-only. No build scripts or repo code were executed.

| Repo                             | Why                                                     | Commit    | Git files | Stack                                                         |
| -------------------------------- | ------------------------------------------------------- | --------- | --------: | ------------------------------------------------------------- |
| spring-projects/spring-petclinic | Small, canonical Spring Boot + JPA app; hand-verifiable | `500158f` |       132 | Java 17, Spring MVC, Spring Data JPA, H2/MySQL/PostgreSQL SQL |
| immich-app/immich                | Demo repo; TS/NestJS/PostgreSQL                         | `e5d6eb7` |     3,656 | TypeScript, NestJS, Kysely, PostgreSQL, Svelte, Dart          |
| keycloak/keycloak                | Demo repo; large Java                                   | `a29205c` |    13,621 | Java, JAX-RS (Quarkus/RESTEasy), JPA, Liquibase, Maven        |
| twentyhq/twenty                  | Demo repo; large TS                                     | `1dd1c24` |    44,522 | TypeScript, NestJS, GraphQL, PostgreSQL                       |

## 1. Coverage and run cost

| Repo      | Wall time |   Full | Partial | Text only | Failed |                                Excluded | Binary |
| --------- | --------: | -----: | ------: | --------: | -----: | --------------------------------------: | -----: |
| PetClinic |       5 s |     90 |       8 |        23 |      0 |                                       0 |     11 |
| Immich    |      40 s |  3,098 |      56 |       148 |      0 |                                       5 |    349 |
| Keycloak  |      85 s | 11,250 |     775 |       645 |      2 |                                     237 |    712 |
| Twenty    |     144 s | 19,833 |      49 |       118 |      0 | 23,893 (23,730 by the file-count limit) |    629 |

Coverage reporting itself works well: every file has a status and a reason, and the limitations list is specific (for example "2,334 call sites target callbacks, parameters or computed members; their targets are only known at runtime" on Immich).

## 2. HTTP routes / API endpoints

| Repo      | Framework                                                                  | Endpoints in source (grep) | Routes extracted | Recall |
| --------- | -------------------------------------------------------------------------- | -------------------------: | ---------------: | -----: |
| PetClinic | Spring MVC `@GetMapping`/`@PostMapping` (+1 class-level `@RequestMapping`) |                         17 |                0 | **0%** |
| Immich    | NestJS `@Get`/`@Post`/`@Put`/`@Patch`/`@Delete` in 49 controllers          |                       ≈317 |                0 | **0%** |
| Keycloak  | JAX-RS `@GET`/`@POST`/…                                                    |                     ≈1,289 |                0 | **0%** |
| Twenty    | NestJS decorators under `packages/`                                        |                       ≈173 |                0 | **0%** |

The grep counts are approximate for Immich and Keycloak (a decorator on its own line; a few may be in tests or examples). PetClinic's 17 was read line by line. **Route extraction is the single largest accuracy gap for both target stacks.**

## 3. Database and ORM

| Measure                                    | PetClinic                       | Immich                                                                                        | Keycloak                             |
| ------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------ |
| Tables found                               | 7 of 7 (checked by hand)        | 85 (71 `@Table` decorators plus migration-only tables)                                        | 102 (Liquibase)                      |
| Entity class → table (`maps_to`, observed) | 6 of 6 entities                 | 0 (Immich's own `@Table` decorator is read into the schema but no class → table edge is made) | 76 classes (79 files with `@Entity`) |
| Repository/DAO → table (inferred)          | 2 of 3 Spring Data repositories | —                                                                                             | —                                    |
| Tables with any code reader or writer      | 2 of 7                          | 37 of 85                                                                                      | **0 of 102**                         |

Findings:

- **Defect (PetClinic):** `VetRepository extends Repository<Vet, Integer>` gets no table link. `packages/orm/src/jvm.ts:483` pre-filters files with a regex that requires a `Jpa`, `Crud`, `PagingAndSorting` or `ListCrud` prefix, so plain `Repository<…>` never reaches the main matcher at line 377.
- **Gap (Keycloak):** data access through `EntityManager`, JPQL and named queries produces no code → table edges, so a Keycloak impact question such as "what reads `USER_ENTITY`?" returns nothing from code.
- **Provenance choice (PetClinic):** PetClinic ships H2, MySQL and PostgreSQL schemas. Tables are matched by name across the repository and the table nodes point at the H2 file, even though the PostgreSQL file parsed fully. For a Postgres-focused assessment the report should name the dialect it used.

## 4. Call relationships (hand-checked sample)

Random sample of non-test Java call edges from the Keycloak index (12 observed, 12 inferred), each compared with the cited source line and the receiver's declared type.

| Label    | Sampled | Correct in my reading | Rule the edge used                                                                |
| -------- | ------: | --------------------: | --------------------------------------------------------------------------------- |
| observed |      12 |                    12 | Unqualified call to a member of the enclosing class                               |
| inferred |      12 |                    12 | Receiver's declared type (field, parameter or local), import, or inherited member |

Notes:

- **This corrects the hypothesis that Java calls are "matched by name only".** The resolver (`packages/syntax/src/resolve.ts`) follows declared types, imports and inheritance. It has no classpath, overload or generic resolution, and it targets the declared (often interface) type rather than the runtime implementation. That is a sound static answer, but it is not a compiler answer.
- 24 edges is far too few for a precision figure. It shows that the rule is not obviously broken. It does not measure recall at all.
- **Volume:** Keycloak has 33,513 observed and 110,757 inferred Java call edges, and 5,000 unresolved call sites listed (the cap). Immich has 11,225 observed and 1,100 inferred TS call edges.
- The repository's own record (R39, `documentation/RESEARCH_AND_ASSUMPTIONS.md`) reports TS call resolution of 21–44% of call sites on Immich/Twenty without installed dependencies, and 39/40 and 40/40 correct in observed-edge spot checks. I did not re-run those checks.

## 5. Dependency injection (PetClinic)

| Measure                                          | Ground truth | CodeAtlas                                                                                                               |
| ------------------------------------------------ | -----------: | ----------------------------------------------------------------------------------------------------------------------- |
| Constructor injections (controller ← repository) |            5 | 0 injection edges; all 5 dependencies appear indirectly as inferred calls from controller methods to repository methods |

## 6. Twenty

Indexed during the audit; the run hit the 20,000-file limit. See the addendum at the end of this file. Peak memory was not measured in this run (no `/usr/bin/time` in the container); the repo's record is 8.1 GB for an uncapped `cli brain` run.

## 7. Metric hygiene problems found

1. **"Symbols" includes XML and SVG elements.** 6,309 of PetClinic's 7,402 symbol nodes are elements of two SVG web-font files. Keycloak has 5,123 SVG symbol nodes, Immich 1,409. Any "symbols extracted" figure must exclude markup elements or report them separately.
2. **The CLI summary contradicts itself.** `cli index` on PetClinic prints `"structurallyAnalysed": 0` and counts Java files as `"text"` in the legacy `files` block, and `analysed: 98` in the `inventory` block.
3. **The unresolved list is capped at 5,000 rows**, which both large repos hit. The cap is fine; the report must say "at least 5,000" rather than imply a total.

## 8. What the real benchmark needs (input to Sprint 2)

- A pinned corpus: PetClinic plus one larger Spring Boot app (for example a multi-module Spring Boot sample), and one TS/NestJS/PostgreSQL app, each at a fixed commit.
- Relationship types in scope for the first gate: route → handler, handler → service → repository, entity → table, repository/query → table, import, call.
- Ground truth written by a person (or by Claude and then checked by a person), with adjudication rules for interface vs implementation targets, overloads, and generated code.
- A scoring script in the repo that runs in CI and records results in a benchmark history file.

---

## Addendum: Twenty run

Commit `1dd1c24`, 44,522 git files, `cli index`, 144 s.

| Measure                   | Result                                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files indexed             | **20,000 of 44,522**. 23,730 were excluded as "beyond the 20,000-file limit". `cli index` uses the same cap as the service; only `cli brain` is uncapped (the repo's earlier 295 s / 8.1 GB record came from `cli brain`).             |
| Headline coverage printed | **99.4%** (`coverage: 0.994`), because files skipped by the count limit are "excluded" and excluded files are outside the denominator by definition. The limitations list does say "23730 files were skipped by size or count limits". |
| NestJS endpoints          | ≈173 route decorators under `packages/`; **0 routes** extracted                                                                                                                                                                        |
| TS calls                  | 13,562 observed, 13,861 inferred (on the indexed subset)                                                                                                                                                                               |
| Unresolved imports        | 5,000 listed (cap hit)                                                                                                                                                                                                                 |

**Finding (risk T-10):** a capped run reports 99.4% coverage while more than half of the repository was not read. The number is defensible by its definition but would mislead a client reading an assessment. The report must show "files indexed / files in repository" next to coverage, and the cap must be impossible to miss.
