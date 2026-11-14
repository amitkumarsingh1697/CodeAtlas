# CodeAtlas — Sprint Roadmap & Backlog

## Planning assumptions
- Two-week sprints are a planning unit, not a guarantee.
- Claude Code performs implementation and automated testing.
- Founder is product owner and final approver.
- A second developer may review code and test outputs if available; do not assume dedicated capacity.
- Sprint scope is re-estimated after repository audit.

## Phase 0 — Repository truth and delivery setup (Week 1)
**Goal:** Know exactly what exists and establish safe execution.
- AUD-001: record commit, branch, worktree status and repository structure.
- AUD-002: run all existing tests and capture baseline.
- AUD-003: map implemented capabilities to PRD.
- AUD-004: identify security, licence and dependency risks.
- AUD-005: produce as-is architecture and data-flow diagrams.
- AUD-006: identify build/release commands and platform support.
**Exit:** audited baseline and prioritized gap list approved.

## Sprint 1 — Assessment report foundation (Weeks 2–3)
- REP-001: define versioned report data contract.
- REP-002: build executive summary section.
- REP-003: build technical architecture section.
- REP-004: include evidence and provenance.
- REP-005: include coverage, unsupported and unresolved section.
- REP-006: HTML export.
- REP-007: PDF export and sanitization.
- REP-008: report snapshots and regression tests.
**Exit:** report generated from a real repository and reviewed manually.

## Sprint 2 — Accuracy benchmark and coverage (Weeks 4–5)
- ACC-001: define ground-truth schema and adjudication guide.
- ACC-002: select first TypeScript and Java fixtures.
- ACC-003: hand-verify benchmark relationships.
- ACC-004: calculate precision/recall by relationship type.
- ACC-005: expose analysis status and coverage in UI.
- ACC-006: produce limitations appendix.
**Exit:** reproducible benchmark report; no unsupported accuracy marketing claims.

## Sprint 3 — TypeScript/PostgreSQL commercial gate (Weeks 6–7)
- TS-001: verify compiler resolution and tsconfig paths.
- TS-002: validate framework routes for selected framework(s).
- TS-003: validate PostgreSQL schema/migration parsing.
- TS-004: validate ORM/database mappings.
- TS-005: validate monorepo/package boundaries.
- TS-006: resolve benchmark defects and add regression tests.
**Exit:** documented capability matrix and customer-ready demo for passing scenarios.

## Sprint 4 — Java/Spring commercial gate (Weeks 8–9)
- JV-001: audit Maven and Gradle dependency resolution.
- JV-002: Spring bean/component wiring.
- JV-003: Spring MVC/WebFlux route extraction.
- JV-004: JPA entity/table/column mapping.
- JV-005: service/repository relationships.
- JV-006: Kafka producer/consumer exploration where feasible.
- JV-007: benchmark and document unresolved constructs.
**Exit:** honest Java capability matrix; sell only passing scope.

## Sprint 5 — Packaging, security and pilot workflow (Weeks 10–11)
- PKG-001: reliable install/start/stop/uninstall.
- PKG-002: loopback-only API and token handling audit.
- PKG-003: secret redaction and safe path tests.
- PKG-004: offline/no-egress verification.
- PKG-005: signed build and SBOM pipeline.
- PKG-006: customer-operated assessment runbook.
- PKG-007: support bundle with safe diagnostics.
**Exit:** pilot deployment rehearsal in clean environment.

## Sprint 6 — Pilot feedback and release candidate (Weeks 12–13)
- PIL-001: deliver first paid/design-partner assessment.
- PIL-002: record time saved, report usage and correction rate.
- PIL-003: fix high-impact defects.
- PIL-004: usability test and accessibility fixes.
- PIL-005: regression, performance and security gate.
- PIL-006: release notes, known issues and support workflow.
**Exit:** release candidate for explicitly supported platform/stack scope.

## Parallel founder work every sprint
- 5–8 customer conversations per fortnight where feasible.
- Maintain 100-account prospect list.
- Send targeted outreach and follow up.
- Track objections, willingness to pay and security requirements.
- Review pricing and delivery effort.
- Never postpone customer discovery until engineering is “finished.”

## Backlog priority rules
P0 = blocks safe pilot or truthful delivery.  
P1 = unlocks repeated professional use.  
P2 = enterprise scale.  
Reject work that does not improve customer outcome, accuracy, security, usability, delivery economics or repeatability.

## Definition of Ready
A ticket has user/customer value, scope, dependencies, acceptance criteria, test plan, security/privacy implications and rollback considerations.

## Definition of Done
Code reviewed; tests added and run; no critical lint/type errors; docs updated; migration/backward compatibility checked; security impact reviewed; acceptance criteria demonstrated; evidence recorded. “Claude says done” is not evidence.
