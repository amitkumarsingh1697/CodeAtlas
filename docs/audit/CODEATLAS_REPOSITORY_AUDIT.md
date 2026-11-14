# CodeAtlas repository audit (Phase 1)

**Date:** 2026-11-14 · **Auditor:** Claude Code, Phase 1 of the master execution prompt · **Status:** for founder review. No application code was changed.

Companion documents:

| Document                                                           | What it holds                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md)                       | 84 capabilities with status and evidence                      |
| [ACCURACY_BASELINE.md](ACCURACY_BASELINE.md)                       | Measurements on PetClinic, Immich, Keycloak and Twenty        |
| [GAP_ANALYSIS.md](GAP_ANALYSIS.md)                                 | FR-001…FR-020, NFRs, UX and release gates against the code    |
| [TECHNICAL_RISK_REGISTER.md](TECHNICAL_RISK_REGISTER.md)           | Technical, security, delivery, licensing and commercial risks |
| [DOCUMENTATION_RECONCILIATION.md](DOCUMENTATION_RECONCILIATION.md) | Inventory of all 27 package files and 15 conflicts            |
| [PROPOSED_TARGET_ARCHITECTURE.md](PROPOSED_TARGET_ARCHITECTURE.md) | As-is and proposed architecture, ADRs needed                  |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)             | Sprints 0–6 with tasks, acceptance criteria and gates         |

## 1. Checkout facts (doc 23 §1)

| Item                  | Value                                                                                |
| --------------------- | ------------------------------------------------------------------------------------ |
| Repository            | https://github.com/amitkumarsingh1697/codeatlas                                      |
| Commit                | `2fc3767` "Use the repository's own tagline in the README"                           |
| Branch                | `claude/project-thread-trwxlj` (same tree as `main` at audit start)                  |
| Working tree          | Clean before the audit. This audit adds only `docs/` and one `.prettierignore` line. |
| History               | Extracted from NEXORA on 2026-11-14 with history (first commit 2026-11-02)           |
| Toolchain             | Node 22.23.4, pnpm 10.28.0, TypeScript 5.9.3 (lockfile authoritative)                |
| Audit machine         | Linux container, 4 vCPU, 15 GB RAM                                                   |
| Supported OS (tested) | Ubuntu 24.04 in CI only. macOS and Windows are untested.                             |
| Licence               | Apache-2.0 (`LICENSE`); no root NOTICE or third-party inventory                      |

## 2. Baseline commands (doc 23 §2)

Run on 2026-11-14 without changing any file.

| Command                                             | Exit | Duration  | Result                                                                                                                                                                           |
| --------------------------------------------------- | :--: | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                    |  0   | 3.3 s     | —                                                                                                                                                                                |
| `pnpm check` (typecheck + lint + all Vitest suites) |  0   | ≈ 1–2 min | **637 tests passed, 0 failed, 0 skipped** across 11 packages (core 245, service 34, languages 108, syntax 98, brain 57, orm 33, sql 26, scip 20, ai 11, validation 4, logging 1) |
| `pnpm format:check`                                 |  0   | —         | All files formatted                                                                                                                                                              |
| `pnpm audit --prod`                                 |  0   | —         | No known vulnerabilities                                                                                                                                                         |
| `node skills/archlens/scripts/check.mjs`            |  0   | 0.04 s    | Skill structure valid                                                                                                                                                            |
| `pnpm --filter @nexora/codeatlas-web build`         |  0   | 1.2 s     | —                                                                                                                                                                                |
| Playwright E2E (`playwright test --trace off`)      |  0   | 68 s      | **1 journey passed**: index, explore, ask, bug → patch → approval → local merge, with axe scans                                                                                  |

The coordinator's note said 656 tests passed at extraction. This run counts 637; the difference could not be traced and 637 is the baseline from now on.

Coverage (line/branch) is not measured by the repo; there is no coverage tool configured.

## 3. Repository assessment (master prompt §6.A)

### Technology stack

TypeScript (strict ESM) on Node ≥ 22.13 using built-in `node:sqlite` (experimental in Node 22). pnpm workspace. zod 4.6 for boundaries. Vitest 5.1, Playwright 1.63 + axe. Web: Vite 8, React 19, Tailwind 4, cytoscape, React Flow, three.js for the brain. Analysis: TypeScript Compiler API, web-tree-sitter 0.27.1 with 71 grammars built from pinned commits, libpg-query 18 (WASM), yaml, smol-toml, Linguist 9.7.0 data. Optional AI: Ollama or an OpenAI-compatible endpoint.

### Modules (about 48k lines of TS per the repo context brief, excluding tests and generated bundles)

| Path                                   | Role                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `products/codeatlas/core`              | Indexer, SQLite store (schema v8), queries (views, graph, impact, brain), chat, investigations, clone       |
| `products/codeatlas/service`           | Local HTTP API on 127.0.0.1, CLI (`serve`, `index`, `brain`, `search`), job runner, ArchLens bundle builder |
| `products/codeatlas/web`               | React UI with 13 tabs                                                                                       |
| `packages/languages`                   | File and language registry, inventory                                                                       |
| `packages/syntax`                      | tree-sitter layer, extraction specs, resolver                                                               |
| `packages/sql`, `packages/orm`         | SQL (PostgreSQL parser + dialect reader), 23 ORM/migration readers                                          |
| `packages/scip`                        | SCIP index reader (compiler-checked references, optional)                                                   |
| `packages/brain`                       | Brain model, layout, three.js viewer, diagrams                                                              |
| `packages/ai`, `logging`, `validation` | Model providers, redacting logger, zod helpers                                                              |
| `skills/archlens`                      | Claude Code skill plus a generated bundle of the indexer                                                    |

### Analysis pipeline

Discover (git ls-files or walk, with exclusions) → classify (Linguist + rules) → parse (TS compiler, tree-sitter, SQL, ORM, format readers) → resolve (TS types; Java/others by declared types and imports; SCIP if supplied) → graph (nodes, edges with observed/inferred/unknown and file:line) → coverage and unresolved → persist in SQLite → UI, brain HTML, search, chat.

### UI and visualisation

13 tabs (Overview, Brain, Structure, Modules, Dependencies, Flows, Integrations, Risk, Ownership, Knowledge, Search, Ask, Investigate), a 3D brain with an offline single-file HTML export, and ER/schema/class diagrams in SVG.

### Integrations

Optional Ollama/OpenAI-compatible model; git (local history, worktrees); public HTTPS clone. No MCP server, no GitHub/GitLab app, no CI integration.

### Deployment model

Clone the repo, `pnpm install`, build the web UI, start the local service. No package, installer, binary or container image for customers.

### Security controls present

Loopback-only bind; token in URL fragment and header; Host and Origin checks (DNS-rebinding defence); realpath containment for source reads; optional allowed roots; secret-path exclusion; symlinks never followed; log redaction; untrusted-content prompt framing and citation checks in chat; investigation commands through `execFile` with a scrubbed environment and an allowlist; patch approval bound to the patch hash; remote-model consent gate for the OpenAI-compatible provider. Threats A1–A22 in `documentation/SECURITY_THREAT_MODEL.md`.

### Technical debt

- Framework logic is embedded in language indexers (no adapter seam).
- Free-text evidence method; no rule catalogue.
- Runs overwrite each other; run metadata incomplete.
- Unversioned internal API.
- Two documentation trees; repo docs still mix in CVForge.
- `node:sqlite` experimental.
- The CLI summary carries a legacy block that contradicts the inventory.

## 4. Findings summary (master prompt §21, step 8)

### What is already working

- **Indexing breadth and honesty at the file level.** Every file gets a status and reason; Keycloak (13.6k files) indexes in 85 s, Immich in 40 s. Symlinks, secrets and generated files are handled correctly.
- **The evidence model is real and enforced.** Every edge is observed, inferred or unknown, with file and line, at the database level.
- **TypeScript analysis is compiler-backed.** On Immich, 91% of TS call edges are observed.
- **Java call resolution is better than assumed.** It follows declared types, imports and inheritance (not name only). 24 of 24 sampled Keycloak edges were correct in my reading. It is still not a compiler and is labelled inferred.
- **Database schemas.** PostgreSQL DDL through the real parser; JPA entities 6/6 on PetClinic; Liquibase gives Keycloak's 102 tables.
- **Engineering discipline.** 637 tests, lint, typecheck, format, audit and a full E2E journey all green; CI on every PR; governance documents and ADRs.

### What is partially working

- **Change impact**: works as a reverse closure but drops the evidence class, so it cannot honestly answer "what might break".
- **Code → table links**: inferred only; 37 of 85 Immich tables, 0 of 102 Keycloak tables.
- **Spring Data**: 2 of 3 PetClinic repositories (a regex pre-filter misses plain `Repository<T, ID>`).
- **Coverage headline**: correct by definition but misleading when a limit applies (Twenty: 20,000 of 44,522 files read, printed as 99.4% coverage).
- **Run metadata**: times and git HEAD, but no product or adapter versions.
- **AI consent**: enforced for the OpenAI-compatible provider, not for a remote Ollama URL.

### What is broken (defects)

1. Spring Data `Repository<T, ID>` repositories are missed (`packages/orm/src/jvm.ts:483`).
2. Ollama provider declares itself local whatever its URL (`packages/ai/src/providers/ollama.ts:33`).
3. "Symbol" counts include XML/SVG elements (85% of PetClinic's count).
4. CLI `index` summary reports `structurallyAnalysed: 0` next to 98 analysed files.

### What is missing

- **Routes for the target frameworks**: Spring MVC 0/17, NestJS 0/≈317 (Immich) and 0/≈173 (Twenty), JAX-RS 0/≈1,289.
- **The assessment report** (HTML and PDF), the paid offer's main deliverable.
- **An accuracy benchmark** with ground truth.
- **Spring bean wiring, EntityManager/JPQL table access, Gradle model, messaging.**
- **Packaging** a customer can install; **egress test**; **SBOM**; **macOS/Windows**.
- **API v1, MCP, run comparison.**
- **Any real-model evaluation** of Ask, module overviews or model patches.

### What should be preserved

The indexer and its packages, the SQLite store and schema-level evidence states, the file inventory, the job runner and child-process isolation, the web UI and 2D explorers, the offline brain HTML (as an optional exhibit), the ArchLens skill and its bundle, the Investigate workflow (outside the assessment), the test suites and CI, and the governance discipline in `CLAUDE.md`.

### What should be redesigned (narrowly)

- A **framework-adapter seam** inside the indexer (move Next.js/Express behind it first, no behaviour change).
- **Evidence metadata**: machine-readable method and adapter version per edge.
- **Run records**: versioned, kept, comparable.
- **Impact**: evidence-aware paths and caveats.
- **Coverage headline**: read/total beside coverage.

Nothing here justifies a rewrite or a new storage engine.

### Largest technical risks

1. Zero route extraction for both target stacks (T-01, T-02).
2. No ground truth, so no defensible accuracy number (T-04).
3. Impact overstating certainty (T-03) and coverage overstating completeness (T-10).
4. Customer cannot install it without a developer (D-01).
5. "Nothing leaves the machine" not yet provable (S-03), with one concrete gap (S-01).

### Largest commercial-readiness gaps

1. No report to deliver (C-01).
2. No published capability sheet for either stack, so no honest SOW scope.
3. GitNexus and general agent tools cover much of the "ask the codebase" job; the defensible ground is evidence labels, coverage honesty, a client-ready report and local operation (C-02).
4. Licence boundary undecided while the code is already Apache-2.0 and public (L-01).
5. Financial model does not yet follow doc 16's own rules (C-04 / reconciliation C-09).

### Recommended implementation sequence

Sprint 0 (one week of truth fixes and two security fixes) → Sprint 1 (report) → Sprint 2 (benchmark, evidence-aware impact, NestJS and Spring MVC routes) → Sprint 3 (TS/PostgreSQL gate, first design-partner pilot) → Sprint 4 (Java/Spring gate) → Sprint 5 (packaging, egress proof, SBOM) → Sprint 6 (pilot feedback, release candidate). Details and acceptance criteria are in [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md).

## 5. Founder decisions

Answered by the founder on 2026-11-14 (D-1 and D-5 delegated to engineering judgement).

| ID  | Decision                                                                           | Outcome                                                                                                                                                          | Notes                                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1 | Strategy package becomes the product baseline instead of `MASTER_SPECIFICATION.md` | **Decided: yes** (delegated)                                                                                                                                     | Record in ADR 0024 and update `CLAUDE.md` §1 in Sprint 0 (DOC-001). The master spec §5 stays as the record of what was built.                                                                                                                                                              |
| D-2 | Lead stack order                                                                   | **Decided: TS/PostgreSQL first, Java/Spring second**                                                                                                             | Spring MVC routes still start in Sprint 2 because they are cheap.                                                                                                                                                                                                                          |
| D-3 | Open-core boundary for new code (starting with the report generator)               | **Open**                                                                                                                                                         | Explained to the founder again; needs an answer before Sprint 1 writes `packages/report`.                                                                                                                                                                                                  |
| D-4 | Meaning of "ArchLens"                                                              | **Decided: the Claude skill**                                                                                                                                    | The UI is "CodeAtlas Explorer" in new docs.                                                                                                                                                                                                                                                |
| D-5 | First pilot before the TS gate                                                     | **Decided: yes** (delegated), as a discounted design-partner pilot with written scope limits (doc 20 exclusions), after Sprint 1 and the Sprint 0 security fixes | Gate G2 in the roadmap.                                                                                                                                                                                                                                                                    |
| D-6 | AI default                                                                         | **Decided: AI stays on by default; the user can turn it off**                                                                                                    | This deviates from doc 06 §4 ("off by default") and must be recorded in an ADR. Mitigations that still apply: the Ollama remote-consent fix (SEC-001), a clear AI on/off switch and a "what is sent" notice in Settings and on first use (SEC-002), and core analysis never needs a model. |
| D-7 | Documentation layout and tracker files                                             | Proposed: keep `documentation/`; add `DECISION_LOG.md` and `BENCHMARK_HISTORY.md`                                                                                | Engineering default unless the founder objects.                                                                                                                                                                                                                                            |
| D-8 | PDF technology                                                                     | Proposed: browser "print to PDF" first                                                                                                                           | Engineering default, ADR 0027.                                                                                                                                                                                                                                                             |
| D-9 | Who adjudicates ground truth                                                       | **Open**                                                                                                                                                         | Founder or second developer, with Claude drafting. Needed by Sprint 2.                                                                                                                                                                                                                     |

## 6. What this audit did not do

- No real AI model was run (no Ollama in the environment).
- The ArchLens conversational playbooks were not exercised in a live Claude session.
- Peak memory was not measured (no `time -v` in the container).
- No macOS or Windows runs.
- No competitor products were re-tested; competitor facts come from the 2026-11-14 project review and were not re-verified here.
- Ground-truth counts on Immich, Keycloak and Twenty are `grep` approximations, labelled as such.
