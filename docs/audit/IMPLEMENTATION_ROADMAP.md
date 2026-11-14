# Implementation roadmap

**Audit date:** 2026-11-14 · **Status:** proposal for founder approval. No sprint starts before approval.

**Goal of this roadmap:** the first genuinely sellable paid assessment on a TypeScript/PostgreSQL repository, then the same for Java/Spring, without overstating either.

This keeps the package's sprint structure (doc 08) and ticket prefixes, re-ordered and re-scoped by what the audit found. Complexity: **S** ≤ 2 days, **M** 3–7 days, **L** 1–3 weeks, **XL** > 3 weeks of Claude Code work with founder review. Two-week sprints are a planning unit, not a promise.

## Recommended sequence and why

```
Sprint 0  Hygiene and truth fixes ──┐
Sprint 1  Assessment report ────────┼──► Sprint 3  TS/PostgreSQL gate ──► first design-partner pilot
Sprint 2  Benchmark + impact ───────┘          │
                                                └─► Sprint 4  Java/Spring gate (starts routes in S2)
Sprint 5  Packaging, egress proof, security ──► Sprint 6  Pilot feedback, release candidate
```

1. **Report before accuracy work** (as doc 08 says): without a report there is nothing to sell or show, and building it exposes which analysis gaps matter most to a reader.
2. **Benchmark and impact together**: impact is the feature buyers ask about, and it cannot be trusted until evidence classes flow through it and a ground truth exists.
3. **TS/PostgreSQL before Java/Spring**: TS is compiler-backed and needs mainly NestJS routes; Java needs routes, DI, EntityManager and Gradle (decision D-2).
4. **Packaging before the first external pilot**, unless the founder runs the first pilot on the customer's machine personally.

## Sprint 0: hygiene and truth fixes (≈ 1 week)

Small, low-risk fixes that stop the product saying misleading things. All are reversible.

| ID      | Task                                                                                                                                                                                              | Priority | Depends on | Acceptance criteria                                                                                   | Tests                                                                     | Size |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---- |
| SEC-001 | Ollama provider: apply the loopback check and `AI_REMOTE_CONSENT` gate                                                                                                                            | P0       | —          | A non-loopback `OLLAMA_BASE_URL` without consent refuses with `consent_required`                      | Unit tests in `packages/ai` for loopback, remote with and without consent | S    |
| SEC-002 | AI stays on by default (D-6): clear on/off switch in Settings, a first-use notice saying which model endpoint is used and what context is sent, and an ADR recording the deviation from doc 06 §4 | P0       | SEC-001    | User can turn AI off in one step; the notice names the endpoint; turning it off stops all model calls | Service test; E2E still passes                                            | S    |
| ACC-007 | Separate markup elements (XML/SVG/HTML) from code symbols in counts; remove the contradictory legacy `files` block from the CLI summary or make it agree                                          | P0       | —          | PetClinic summary shows code symbols ≈ 1,100, not 7,402; one analysed-file number                     | Core tests on a fixture with an SVG                                       | S    |
| ACC-009 | Coverage headline shows "files read / files in repository" and a loud warning when a limit applied; `--max-files` on `cli index`                                                                  | P0       | —          | Twenty run prints both numbers and the warning                                                        | Core + CLI tests                                                          | S    |
| JV-008  | Fix Spring Data `Repository<T, ID>` pre-filter (`jvm.ts:483`)                                                                                                                                     | P0       | —          | PetClinic: 3 of 3 repositories linked to tables                                                       | ORM fixture test                                                          | S    |
| DOC-001 | Remove CVForge/extension content from `KNOWN_LIMITATIONS`, risk register, threat model; fix stale statements; record ADR 0012 deviation; update `CLAUDE.md` source-of-truth line (after D-1)      | P1       | D-1        | No CVForge mention outside history files                                                              | `pnpm format:check`                                                       | M    |

**Exit:** `pnpm check`, format, audit and E2E green; capability matrix rows updated.

## Sprint 1: assessment report foundation

| ID        | Task                                                                                                                            | Priority | Depends on  | Acceptance criteria                                             | Tests                                      | Size |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | --------------------------------------------------------------- | ------------------------------------------ | ---- |
| REP-001   | Versioned report model v1 (JSON schema) + run metadata columns (product/schema/adapter versions, scan policy hash, environment) | P0       | ADR 0027    | Model validates with zod; run metadata present on every new run | Schema and migration tests                 | M    |
| REP-002   | Executive summary section (scope, what was analysed, top findings, limitations up front)                                        | P0       | REP-001     | Generated from a real repo; no hard-coded text claims           | Snapshot test                              | S    |
| REP-003   | Technical architecture section: modules, dependencies, entry points, routes, tables, integrations                               | P0       | REP-001     | Every finding links to path:line and carries its evidence class | Snapshot test; fixture with known findings | M    |
| REP-004   | Evidence appendix (observed/inferred/unknown counts by relationship type, rule catalogue extract)                               | P0       | GRAPH-001   | Counts match the DB                                             | Unit test                                  | S    |
| REP-005   | Coverage, exclusions and unresolved appendix                                                                                    | P0       | ACC-009     | Includes limit warnings and "≥ N" when capped                   | Unit test                                  | S    |
| REP-006   | Self-contained HTML export (`cli report`, API endpoint, button in UI)                                                           | P0       | REP-002…005 | Opens offline; no external requests                             | Playwright: open file with network blocked | M    |
| REP-007   | Redaction and secret scan of the report                                                                                         | P0       | REP-006     | Absolute paths removed; known secret patterns absent            | Tests with planted secrets and paths       | S    |
| REP-008   | PDF export (browser print or headless Chromium, per ADR 0027)                                                                   | P0       | REP-006     | PDF renders all sections on a real repo                         | Smoke test                                 | M    |
| GRAPH-001 | Edge `method` and `adapter` columns; rule catalogue doc                                                                         | P0       | ADR 0026    | Every edge has a method id                                      | Schema test; existing tests unchanged      | M    |

**Exit:** a report generated from Immich (or another real TS repo) and reviewed by the founder.

## Sprint 2: benchmark, impact and the first framework adapters

| ID      | Task                                                                                                                    | Priority | Depends on | Acceptance criteria                                      | Tests                       | Size |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | -------------------------------------------------------- | --------------------------- | ---- |
| ACC-001 | Ground-truth schema, adjudication guide, rule for interface vs implementation targets                                   | P0       | —          | Written and approved by founder/second dev               | —                           | S    |
| ACC-002 | Pick and pin corpus: PetClinic, one multi-module Spring Boot app, one NestJS + PostgreSQL app                           | P0       | ACC-001    | Commits pinned; licences recorded                        | —                           | S    |
| ACC-003 | Hand-verify relationships in scope (route→handler, handler→service→repository, entity→table, query→table, import, call) | P0       | ACC-002    | Adjudicated file in repo                                 | —                           | L    |
| ACC-004 | Scoring script (P/R/F1 by relationship type and evidence class) in CI; `BENCHMARK_HISTORY.md`                           | P0       | ACC-003    | Reproducible output; history row per run                 | Script tests                | M    |
| IMP-001 | Impact carries the weakest evidence class along each path; grouped output; caveat text                                  | P0       | GRAPH-001  | API and UI show groups observed/inferred; caveat present | Hand-verified graph fixture | M    |
| IMP-002 | Impact includes affected routes, tests and tables, bounded and exportable                                               | P0       | IMP-001    | Report includes 3–5 impact examples                      | Fixture test                | S    |
| FW-001  | Framework-adapter interface; move Next.js/Express behind it with no behaviour change                                    | P0       | ADR 0025   | All existing tests pass unchanged                        | Existing tests              | M    |
| TS-002  | NestJS adapter: controllers, route decorators with prefixes, handler links                                              | P0       | FW-001     | Immich and Twenty endpoints found; recall measured       | Fixture + benchmark         | M    |
| JV-003  | Spring MVC/WebFlux adapter: `@RequestMapping` prefixes and verb mappings                                                | P0       | FW-001     | PetClinic 17 of 17                                       | Fixture + benchmark         | M    |

**Exit:** benchmark report for both stacks with real numbers, whatever they are. No marketing claims.

## Sprint 3: TypeScript/PostgreSQL commercial gate

| ID      | Task                                                                             | Priority | Depends on | Acceptance criteria              | Size |
| ------- | -------------------------------------------------------------------------------- | -------- | ---------- | -------------------------------- | ---- |
| TS-001  | Verify tsconfig paths, project references, workspace packages on the corpus      | P0       | ACC-004    | Benchmark rows for imports       | M    |
| TS-003  | PostgreSQL schema and migration validation (SQL files, TS migration builders)    | P0       | ACC-004    | Table/column recall on corpus    | M    |
| TS-004  | ORM/query → table mappings (Prisma, TypeORM, Kysely, Drizzle) validated          | P0       | ACC-004    | Precision/recall recorded        | M    |
| TS-005  | Monorepo boundaries: package level between module and file                       | P1       | —          | Packages shown in report         | M    |
| TS-006  | Fix benchmark defects, add regressions                                           | P0       | above      | No regression in other languages | M    |
| CAP-001 | Customer-facing TS/PostgreSQL capability sheet (supported, partial, unsupported) | P0       | above      | Founder approves                 | S    |

**Exit:** a demo on a TS/PostgreSQL repo with documented ground truth, and a capability sheet the founder is willing to put in a SOW.

## Sprint 4: Java/Spring commercial gate

| ID     | Task                                                                                            | Priority | Depends on     | Size |
| ------ | ----------------------------------------------------------------------------------------------- | -------- | -------------- | ---- |
| JV-001 | Maven multi-module and Gradle model (what can be read without running Gradle)                   | P0       | —              | L    |
| JV-002 | Spring bean wiring: stereotypes, constructor/field injection, `@Bean` methods → `injects` edges | P0       | FW-001         | L    |
| JV-004 | JPA via `EntityManager`, JPQL, `@NamedQuery`, `@Query` → tables                                 | P0       | —              | M    |
| JV-005 | Controller → service → repository chains in flows and the report                                | P0       | JV-002, JV-003 | M    |
| JV-006 | Kafka `@KafkaListener` / `KafkaTemplate.send` topics (only if a pilot needs it)                 | P2       | —              | M    |
| JV-007 | Benchmark; document unresolved constructs (proxies, reflection, profiles)                       | P0       | ACC-004        | M    |
| JV-009 | Optional `scip-java` path in the service and the runbook (customer runs it in their build)      | P1       | —              | M    |
| JX-001 | JAX-RS adapter (Keycloak-style apps)                                                            | P1       | FW-001         | M    |

**Exit:** honest Java capability matrix; sell only the scope that passed.

## Sprint 5: packaging, egress proof and security

| ID      | Task                                                                                                        | Priority | Size |
| ------- | ----------------------------------------------------------------------------------------------------------- | -------- | ---- |
| PKG-001 | Installable artifact (ADR 0028), tested on clean Linux and macOS; uninstall and data deletion               | P0       | L    |
| PKG-002 | Token handling audit; allowed-roots default on for packaged installs                                        | P0       | S    |
| PKG-003 | Path, symlink, size and malformed-file tests (doc 06 §5 exercises)                                          | P0       | M    |
| PKG-004 | Network-denied CI job: full index + report with egress blocked; `DATA_FLOW.md` and customer data-flow sheet | P0       | M    |
| PKG-005 | SBOM (CycloneDX or SPDX) and checksums; signing if a free option fits                                       | P0       | M    |
| PKG-006 | Customer-operated assessment runbook                                                                        | P0       | S    |
| PKG-007 | Support bundle with redacted diagnostics                                                                    | P1       | S    |
| LIC-001 | Third-party notices file at the root                                                                        | P0       | S    |

**Exit:** pilot rehearsal on a clean machine with no network.

## Sprint 6: pilot feedback and release candidate

As doc 08 (PIL-001…006): deliver the first design-partner assessment, record hours, corrections and findings used, fix high-impact defects, manual accessibility pass, full regression, release notes. **Exit:** release candidate for the explicitly supported stack and platform only.

## Release gates

| Gate                                            | Before                        | Must be true                                                            |
| ----------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| G1: Show a sample report                        | Any sales demo                | Sprint 1 exit, on a public repo                                         |
| G2: Design-partner pilot                        | First external use            | G1 + Sprint 0 security fixes + written scope limits (doc 20 exclusions) |
| G3: Paid TS/PostgreSQL assessment at list price | Charging the doc 11 prices    | Sprint 3 exit + Sprint 5 packaging and egress proof                     |
| G4: Paid Java/Spring assessment                 | Selling Java scope            | Sprint 4 exit for the sold scope                                        |
| G5: Public claims                               | Website proof points (doc 14) | The relevant benchmark is published                                     |

## Test requirements for every sprint

`pnpm check`, `pnpm format:check`, `pnpm audit --prod`, the Playwright E2E when a journey changes, and from Sprint 2 the benchmark script. Baseline on 2026-11-14: all green, 637 Vitest tests, 1 E2E journey.

## Parallel founder work (not engineering)

Customer discovery (doc 12) should start now, not after Sprint 3. The single most useful input for Sprint 1 is two or three real consultancy deliverables: what their current assessment report contains.
