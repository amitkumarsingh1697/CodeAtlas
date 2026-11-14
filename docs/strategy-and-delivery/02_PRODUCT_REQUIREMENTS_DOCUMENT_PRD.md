# CodeAtlas — Product Requirements Document (PRD)

**Version:** 1.0 | **Status:** Baseline for repository reconciliation

## 1. Product overview
CodeAtlas analyzes an existing software repository locally and produces a navigable, evidence-backed architecture model. It must communicate both what it found and what it could not establish.

## 2. Personas
1. **Modernization consultant:** needs to assess unfamiliar client systems quickly and securely.
2. **CTO/engineering leader:** needs an understandable architecture baseline and risk/impact view.
3. **Senior engineer/maintainer:** needs dependency navigation, source evidence and change planning.
4. **Security-conscious client:** needs assurance that source code remains within its control.
5. **Platform/DevEx owner:** later-stage persona for continuous analysis and team governance.

## 3. Jobs to be done
- When inheriting a repository, understand its modules, technologies and important relationships.
- When assessing modernization, identify architecture, dependencies, data access and unknowns.
- Before changing a component, discover potentially affected components and evidence.
- When presenting findings to a client, produce a professional report with traceable evidence.
- When security prohibits code upload, perform analysis in a customer-controlled environment.

## 4. Product scope
### P0 — Assessment-ready
- Repository selection and safe local scanning.
- File inventory, language/framework detection and analysis status.
- Symbol and relationship extraction for supported stacks.
- Relationship evidence labels: observed, inferred, unknown.
- File/line provenance where available.
- Coverage and unresolved relationship reporting.
- Architecture/module visualization and search.
- Database schema ingestion and code-to-database mapping where supported.
- Change-impact endpoint/workflow with explicit limitations.
- Client-ready PDF/HTML report export.
- Reproducible run metadata and version information.
- Local-only core analysis and documented network behavior.

### P1 — Professional product
- Saved projects/workspaces.
- Repeat analysis and baseline comparison.
- Multi-repository support with explicit boundaries.
- Advanced report templates.
- User-configurable exclusions and scan policy.
- Structured export/API.
- Thin MCP adapter over stable, permission-scoped APIs, only after core reliability.
- Improved stack-specific framework resolution.

### P2 — Enterprise
- Team/organization identity and RBAC.
- Audit events.
- Policy management and retention.
- Private cloud/on-prem packaging.
- CI integration and architecture drift.
- SSO and enterprise identity integrations.
- Centralized repository inventory and deployment management.

## 5. Functional requirements
| ID | Requirement | Priority | Acceptance evidence |
|---|---|---|---|
| FR-001 | Scan only user-selected repository paths | P0 | Integration test verifies scope |
| FR-002 | Respect ignore/exclusion rules and symlink policy | P0 | Fixture tests |
| FR-003 | Detect file type, language and analysis status | P0 | Golden corpus |
| FR-004 | Extract symbols and relationships for declared supported capabilities | P0 | Per-stack benchmark |
| FR-005 | Label every relationship observed/inferred/unknown | P0 | Schema and API tests |
| FR-006 | Attach provenance to supported findings | P0 | File/line fixture tests |
| FR-007 | Report unsupported, skipped and unresolved files/relationships | P0 | Coverage report test |
| FR-008 | Search entities and navigate relationships | P0 | UI end-to-end test |
| FR-009 | Generate a professional assessment report | P0 | Snapshot and human review |
| FR-010 | Show impact results with evidence and confidence | P0 | Hand-verified graph fixture |
| FR-011 | Run core analysis without external LLM | P0 | Network-denial test |
| FR-012 | Disclose all outbound network behavior | P0 | Egress test and data-flow doc |
| FR-013 | Support TypeScript/Node/PostgreSQL target capabilities | P0 | Published benchmark |
| FR-014 | Support Java/Spring target capabilities | P0, gated | Published benchmark |
| FR-015 | Export reproducible run metadata | P0 | Artifact schema test |
| FR-016 | Save and compare analysis baselines | P1 | Repeat-run tests |
| FR-017 | Provide stable structured API | P1 | OpenAPI/contract tests |
| FR-018 | Provide optional MCP adapter | P1 | Agent task evaluation |
| FR-019 | Support multi-user access and audit | P2 | Security test suite |
| FR-020 | Support CI drift checks | P2 | CI integration tests |

## 6. Non-functional requirements
- **Security:** least privilege, no source upload by default, secret redaction, safe path handling, dependency and supply-chain controls.
- **Reliability:** deterministic outputs for same inputs/config/version where feasible; failures surfaced, not hidden.
- **Performance:** benchmark on small, medium and large repositories; publish hardware and memory conditions. Do not promise universal scan times.
- **Usability:** a first-time user can select a repository, understand scan status and open a report without developer assistance.
- **Accessibility:** keyboard navigation, readable contrast, focus states, semantic controls and reduced-motion support.
- **Portability:** supported macOS/Linux/Windows matrix must be explicitly tested; do not claim platform support without CI evidence.
- **Observability:** local diagnostic logs with secrets and source content excluded by default.
- **Maintainability:** modular language adapters and versioned graph schema.

## 7. UX requirements
- First screen explains local processing and what data is read.
- User chooses repository and scan policy.
- Progress screen distinguishes queued, scanning, parsing, resolving, indexing, report generation and failure.
- Results begin with executive summary, coverage and confidence—not an overwhelming graph.
- Users can move from a finding to exact source evidence.
- Every graph edge can be inspected for type, label, provenance and limitation.
- Report preview and export are prominent.
- Empty, partial, unsupported and error states are designed, not afterthoughts.

## 8. Accuracy policy
Every relationship must have a defined evidence class and method. The UI must not visually imply certainty beyond the evidence. Inferred relationships must be visibly distinct. Unknown means not established; it must never silently disappear from coverage reporting.

## 9. Acceptance gates
A stack is commercially supported only after:
- Golden corpus and manually verified benchmark.
- Precision/recall methodology documented.
- Framework-specific scenarios covered.
- Known limitations documented.
- Regression tests run in CI.
- Customer-facing capability matrix approved.

Suggested initial benchmark target: establish a baseline first; set numeric release thresholds only after a representative corpus and adjudication method exist. Do not invent a high accuracy percentage to satisfy a launch date.

## 10. Out of scope
- Guaranteeing runtime behavior from static analysis.
- Guaranteeing safe changes.
- Automatic code modification as a core assessment feature.
- Uploading client source to CodeAtlas servers by default.
- Training on customer repositories without explicit, separately documented consent.

## 11. Product analytics
Default telemetry should be off or privacy-preserving and opt-in. Never transmit source code, snippets, symbols, repository names, file paths or graph contents without explicit customer authorization. Local product metrics may be exportable by the customer.
