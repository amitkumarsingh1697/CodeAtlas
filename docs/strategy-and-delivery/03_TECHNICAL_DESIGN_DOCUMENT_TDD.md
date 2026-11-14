# CodeAtlas — Technical Design Document (TDD)

## 1. Design goals
- Local-first analysis with explicit data boundaries.
- Evidence-aware graph model.
- Language adapters with independently measurable capability.
- Reproducible runs and versioned artifacts.
- Stable API consumed by UI, report generator and optional MCP adapter.
- Open-source core and commercial modules with clean boundaries.

## 2. Proposed logical architecture
1. **CLI / Desktop entry point:** validates arguments, selects repository, loads policy.
2. **Repository safety layer:** canonical path resolution, ignore rules, symlink policy, file-size limits, archive handling and secret exclusions.
3. **Inventory service:** file metadata, language and framework detection, build/config/schema discovery.
4. **Language adapter layer:** parser, symbol extractor, framework resolver, dependency resolver.
5. **Relationship normalizer:** converts adapter-specific facts into canonical nodes/edges.
6. **Evidence engine:** observed/inferred/unknown classification, provenance, confidence rationale and unresolved findings.
7. **Graph store:** versioned local SQLite or other repository-appropriate persistence, after audit of current schema.
8. **Analysis API:** search, graph traversal, impact, coverage, report data.
9. **ArchLens UI:** visualization, exploration, evidence inspection and report preview.
10. **Report generator:** deterministic HTML/PDF export with source references and limitations.
11. **Optional AI adapter:** separate opt-in enrichment interface; never required for core scan.
12. **Optional MCP adapter:** thin, permission-scoped adapter over stable API.

## 3. Repository-first rule
Before changing architecture, inspect the current codebase and preserve working implementations. Claude Code must not replace existing components solely because this document describes a target architecture. Create an as-is diagram and gap assessment first.

## 4. Canonical graph model
### Node
- id (stable within project/run; avoid exposing sensitive path-derived identifiers unnecessarily)
- type: repository, module, file, symbol, class, function, route, table, column, service, topic, config, build target, external dependency
- display_name
- normalized_name
- language/framework
- source_location (optional)
- attributes (typed, allowlisted)
- first_seen_run / last_seen_run

### Edge
- id
- source_node_id
- target_node_id
- relationship_type (calls, imports, defines, routes_to, reads, writes, maps_to, publishes, subscribes, depends_on, configures, extends, implements, contains, etc.)
- evidence_class: observed | inferred | unknown
- evidence_method
- provenance (file, line range, parser/rule identifier)
- confidence (only if calibrated or explicitly described as heuristic; do not imply statistical probability)
- limitations
- run_id

### Analysis run
- run_id, product_version, schema_version, start/end time, repo fingerprint, scan policy fingerprint, adapter versions, environment summary, status, error summary, coverage counters.
- Avoid storing raw source by default.

## 5. Evidence semantics
- **Observed:** directly established by a deterministic parser/compiler/index or explicit declaration under a documented rule.
- **Inferred:** plausible relationship derived from heuristic/name matching/pattern or incomplete resolution.
- **Unknown:** relationship cannot be established or evidence is insufficient. Unknown can be represented as an unresolved candidate or coverage finding; do not fabricate a definite edge.
- Confidence values require calibration against ground truth. If not calibrated, use qualitative confidence or label as heuristic score.

## 6. Analysis pipeline
1. Validate selected root and policy.
2. Enumerate eligible files safely.
3. Exclude secrets, generated artifacts, binaries and configured paths.
4. Inventory file types and frameworks.
5. Parse supported languages.
6. Extract symbols and explicit references.
7. Resolve dependencies and framework semantics.
8. Normalize graph.
9. Attach evidence/provenance.
10. Calculate coverage and unresolved findings.
11. Persist run and graph.
12. Generate report model and UI view.
13. Produce diagnostics and final status.

Pipeline must support partial success. Unsupported files must be counted and reported.

## 7. API design principles
- Version all public API routes.
- Validate input schemas.
- Enforce project/run scoping.
- Limit graph traversal depth and result sizes.
- Add cancellation and timeouts for expensive analysis.
- Return evidence and coverage metadata with findings.
- Use structured error codes.
- Never expose arbitrary filesystem read endpoints.
- Bind API to loopback by default; require explicit secure configuration for network exposure.
- Authenticate local API requests with short-lived or scoped tokens.

Suggested endpoint families (reconcile with current server):
- `/api/v1/repos`
- `/api/v1/repos/{repoId}/runs`
- `/api/v1/runs/{runId}/coverage`
- `/api/v1/runs/{runId}/graph`
- `/api/v1/runs/{runId}/search`
- `/api/v1/runs/{runId}/impact/{nodeId}`
- `/api/v1/runs/{runId}/report`
- `/api/v1/health`

## 8. Storage
Use the existing store if safe and adequate. SQLite is a reasonable local default. Define migrations, schema versioning, integrity checks, retention and deletion. Keep source content out of the graph store unless a specific feature requires it and the customer is informed.

## 9. Language adapter contract
Each adapter should expose:
- supported language/framework versions;
- file discovery;
- parsing;
- symbol extraction;
- relationship extraction;
- resolution strategy;
- evidence classification;
- unsupported construct reporting;
- fixture suite;
- benchmark suite;
- performance characteristics.

Do not report a language as supported solely because a parser accepts its syntax.

## 10. Stack-specific design
### TypeScript/Node/PostgreSQL
- TypeScript compiler API or equivalent compiler-backed semantic resolution where available.
- Respect tsconfig path aliases, project references and package boundaries.
- Framework adapters for routes/controllers where validated.
- SQL migration/schema parsing and ORM mappings.
- Distinguish static references from runtime/dynamic imports and reflection.

### Java/Spring/PostgreSQL
- Java semantic resolution using classpath/build model where possible.
- Maven and Gradle dependency graph.
- Spring component scanning, bean wiring, configuration and profiles.
- Controller mappings and composed annotations.
- JPA entity/table/column mapping.
- Repository/service relationships.
- Kafka producer/consumer and event contracts where resolvable.
- Report unresolved reflection, proxies, runtime configuration and dynamic SQL.

## 11. MCP design
MCP is an adapter, not the product thesis. Expose only safe read operations initially:
- list projects/runs;
- search symbols;
- retrieve evidence for a node/edge;
- inspect dependency neighborhood;
- impact analysis;
- coverage and limitations.
Use bounded results, explicit project selection, read-only defaults, audit logs where appropriate and no arbitrary source-file dumping. Evaluate agents with and without CodeAtlas before claiming productivity gains.

## 12. Report generation
Generate from a versioned report model, not UI scraping. Include:
- scope and run metadata;
- executive summary;
- technology inventory;
- architecture overview;
- key dependencies;
- database/API findings;
- impact findings;
- evidence classes;
- coverage and exclusions;
- unresolved findings;
- known limitations;
- reproducibility details.
Provide HTML and PDF; ensure reports are self-contained where possible and sanitize output.

## 13. Failure handling
- Never silently drop parser errors.
- Partial analysis must produce explicit partial status.
- A failed adapter must not corrupt other adapter results.
- Preserve run diagnostics without logging source contents or secrets.
- Support cancellation and cleanup.
- Report memory/resource limits.

## 14. Architectural decisions requiring ADRs
- ADR-001 Open-core module boundary.
- ADR-002 Local persistence and graph schema.
- ADR-003 Parser/compiler strategy by language.
- ADR-004 Evidence taxonomy and confidence semantics.
- ADR-005 Report generation technology.
- ADR-006 Optional AI provider boundary.
- ADR-007 MCP interface and authorization.
- ADR-008 Packaging/update/signing strategy.
- ADR-009 Telemetry and privacy defaults.
- ADR-010 Enterprise identity and audit architecture.
