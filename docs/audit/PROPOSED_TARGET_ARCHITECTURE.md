# Proposed target architecture

**Audit date:** 2026-11-14 · **Status:** proposal for founder review. Nothing here is implemented.

**Principle:** evolve the existing system. The as-is architecture already matches most of the TDD's logical design (doc 03 §2). The work is to add four missing pieces (report, framework adapters, a stable API and packaging) and tighten two existing ones (evidence metadata and run metadata). No rewrite, no new database, no new language for the engine.

## 1. As-is architecture

```
                 ┌──────────────────────── user's machine ────────────────────────┐
Browser ─────────┤ 127.0.0.1:4317 (token in URL fragment, Host/Origin checks)     │
(13 tabs, React) │  products/codeatlas/service  (node:http, zod, JobRunner)        │
                 │     ├─ /api/* routes ─────► products/codeatlas/core/query       │
                 │     │                         (views, graph, impact, brain)     │
                 │     ├─ fork ─► index child ─► core/indexer                      │
                 │     │            ├ TS compiler API (ts-indexer, sfc)            │
                 │     │            ├ packages/syntax  (web-tree-sitter, 71 langs) │
                 │     │            ├ packages/sql     (libpg-query + reader)      │
                 │     │            ├ packages/orm     (23 ORM/migration readers)  │
                 │     │            ├ packages/scip    (optional SCIP input)       │
                 │     │            └ packages/languages (inventory, Linguist)     │
                 │     ├─ chat ─► retrieval ─► packages/ai ─► Ollama / OpenAI-comp.│
                 │     └─ investigations ─► git worktree + allowlisted commands    │
                 │  core/store ─► SQLite (node:sqlite, FTS5) ~/.codeatlas/*.db     │
                 └────────────────────────────────────────────────────────────────┘
CLI (same core): index | brain → one offline HTML | search
ArchLens skill:  skills/archlens + generated bundle of the indexer (ADR 0020)
```

**Strengths worth preserving**

- One engine, two front doors (app and Claude skill), with a test that the bundle matches the source.
- Evidence states are enforced in the schema (`CHECK (confidence IN …)`), with file and line on every edge.
- The file inventory with seven statuses and reasons is better than the TDD asks for at the file level.
- Indexing runs in a child process, so a crash or cancel cannot take down the service.
- No graph DB, no vector DB, no queue. SQLite is adequate for single-machine assessments.
- Deterministic first: no feature needs a model.

**Weaknesses to fix**

- Framework semantics live inside language indexers (`detectExpressRoute` inside `ts-indexer.ts`), so adding NestJS or Spring means editing a 1,500-line file. There is no framework-adapter seam.
- Edge method and limitation are free text in `detail`.
- `index_runs` lacks product, schema and adapter versions; each re-index replaces the previous graph, so runs cannot be compared.
- `/api/*` is internal-shaped, unversioned, and has no OpenAPI document.
- No report model; the closest things are the brain model and module Markdown.

## 2. Target logical architecture

```
 entry points:  CLI (index | report | brain | serve)      Web UI      ArchLens skill     MCP (P1)
                         │                                  │              │                │
                         ▼                                  ▼              ▼                ▼
               ┌────────────────────────────── Analysis API  /api/v1  (read-only for MCP) ─┐
               │ repos · runs · coverage · graph · search · impact · report                 │
               └────────────────────────────────────────────────────────────────────────────┘
                         │                                        │
          ┌──────────────┴──────────────┐            ┌────────────┴─────────────┐
          │ Pipeline (existing indexer) │            │ Report service (NEW)     │
          │ 1 safety + inventory        │            │ report model v1 (JSON)   │
          │ 2 language adapters         │            │ → HTML (self-contained)  │
          │ 3 framework adapters (NEW)  │            │ → PDF (from the HTML)    │
          │ 4 normalize + evidence      │            │ redaction pass           │
          │ 5 coverage + unresolved     │            └──────────────────────────┘
          └──────────────┬──────────────┘
                         ▼
               SQLite store (existing, schema v9+): runs kept, versioned run metadata
```

### 2.1 Framework adapters (new seam inside the existing indexer)

A small interface that runs after language extraction and adds framework facts to the same graph:

```ts
interface FrameworkAdapter {
  id: string; // 'spring-mvc', 'nestjs', 'jaxrs', 'express'
  version: string; // adapter version, stored with the run
  detect(ctx): boolean; // from manifests and imports
  extract(ctx): void; // add route nodes, handled_by, injects, reads_table… edges
  limitations(): string[]; // shown in coverage and in the report
}
```

- First adapters: **NestJS**, **Spring MVC/WebFlux**, **JAX-RS**, and the existing Express/Next.js logic moved behind the same interface (a refactor with no behaviour change, covered by existing tests).
- They read the existing parse trees (TS compiler AST, tree-sitter Java tree). No new parser.
- Annotation/decorator facts written in source are **observed** (the route string is literally there). Handler → service links follow the existing resolver's labels.

### 2.2 Evidence metadata (schema change, additive)

Add columns to `edges`: `method` (rule id, e.g. `java.receiver-declared-type`), `adapter` (id@version) and optional `evidence_end_line`. Keep `detail` as the human sentence. Add a **rule catalogue** document listing each rule, its label and its known failure modes. This makes observed/inferred defensible in front of a client.

### 2.3 Runs and reproducibility (schema change, additive)

`index_runs` gains `product_version`, `schema_version`, `adapters` (JSON), `scan_policy_hash`, `environment` (OS, Node, CPU count, RAM), `repo_head`. Keep the last N runs per repo instead of replacing the graph (needed for P1 comparison; N=1 by default until then).

### 2.4 Report service (new module)

- Place: a new package `packages/report` (pure: report model → HTML) plus a thin `cli report` command and `GET /api/v1/runs/:id/report`.
- **Report model v1** is JSON, versioned, built from queries, never from UI scraping (TDD §12).
- **HTML** reuses the self-contained single-file approach the brain already uses. The 2D views (module table, dependency summary, route list, table list, impact examples, coverage appendix) come first; the 3D brain is an optional attachment.
- **PDF** from the same HTML through headless Chromium. Playwright is already a dev dependency, but shipping Chromium to customers is heavy; the alternative is "print to PDF" from the browser. This needs an ADR (TDD ADR-005).
- Redaction pass (paths relative to repo root, optional customer-name mask, secret scan of the final document) with tests.

### 2.5 Analysis API v1

Add `/api/v1/...` endpoints as thin wrappers over existing queries, with an OpenAPI file generated from the zod schemas. Keep `/api/*` for the web UI until it migrates. MCP (P1) is then a thin read-only adapter over v1.

### 2.6 Packaging

Ship a single installable artifact for the customer-operated assessment. Options to evaluate in an ADR (TDD ADR-008): an npm package run with `npx`, or a Node single-executable application. Native dependencies matter: `libpg-query` and tree-sitter grammars are WASM, `node:sqlite` is built in, so a pure-Node package looks feasible, but this must be proven on clean macOS and Linux machines.

## 3. Mapping to the package's logical modules (doc 04)

| Doc 04 module          | Target in this repo                                                    | Note                                  |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| `codeatlas-core`       | `products/codeatlas/core` + `packages/{languages,syntax,sql,orm,scip}` | Exists                                |
| `codeatlas-cli`        | `products/codeatlas/service/src/cli.ts`                                | Exists; add `report`                  |
| `codeatlas-service`    | `products/codeatlas/service`                                           | Exists                                |
| `archlens` (explorer)  | `products/codeatlas/web` + `packages/brain`                            | Name conflict C-03                    |
| `codeatlas-report`     | `packages/report` (new)                                                | Licence boundary decision D-3 applies |
| `codeatlas-pro`        | Not created until customers validate P1                                | —                                     |
| `codeatlas-enterprise` | Not created                                                            | P2                                    |
| `codeatlas-mcp`        | `products/codeatlas/mcp` (new, P1)                                     | After API v1                          |

## 4. Decisions that need ADRs

| ADR  | Decision                                             | Proposed default                                 |
| ---- | ---------------------------------------------------- | ------------------------------------------------ |
| 0024 | Package documents become the product baseline (C-01) | Yes                                              |
| 0025 | Framework-adapter interface                          | As §2.1                                          |
| 0026 | Evidence `method` and rule catalogue (TDD ADR-004)   | As §2.2                                          |
| 0027 | Report model and HTML/PDF technology (TDD ADR-005)   | Self-contained HTML; PDF via browser print first |
| 0028 | Packaging (TDD ADR-008)                              | npm package first, SEA later                     |
| 0029 | AI off by default; Ollama consent gate (TDD ADR-006) | Disabled by default                              |
| 0030 | Open-core boundary (TDD ADR-001)                     | Founder + counsel                                |

## 5. What not to build now

Graph or vector databases, microservices, hosted SaaS, multi-user auth, more languages, more 3D features, MCP before API v1. None of them moves the first paid assessment.
