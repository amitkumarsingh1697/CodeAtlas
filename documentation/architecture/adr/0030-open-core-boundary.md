# ADR 0030: Open-core boundary: free engine, paid report generator in a separate repository

- Status: accepted (licence wording for the paid module still to be reviewed by counsel)
- Date: 2026-11-14
- Decision owner: founder (audit decision D-3; open-core confirmed 2026-11-14)

## Context

Everything in this repository is published under Apache-2.0 (`LICENSE`). The business sells the Architecture Intelligence Assessment, whose deliverable is a client report. Code already published under Apache-2.0 cannot be withdrawn from those who received it (risk L-01), so a paid boundary can only apply to new modules.

## Decision

1. The engine stays free and open under Apache-2.0: indexer, language and framework adapters, local service, web UI, CLI and the ArchLens skill.
2. The assessment report generator (report model rendering, HTML and PDF export, executive narrative, redaction pass for client delivery) and future Pro and team features are paid. They live in a separate private repository that depends on the engine's published interfaces.
3. The engine repository keeps whatever the report needs as stable, documented data: coverage, inventory, evidence labels, routes, tables, impact and unresolved items. Anything that only formats or sells that data belongs in the private module.
4. No code moves from this repository to the private one. Contributions to the engine stay Apache-2.0.

## Consequences

- Sprint 1 starts in the private repository once the founder creates it; until then report work in this repository is limited to the data model and its tests.
- Counsel reviews the split and the private module's licence before the first paid delivery (package document 17).
- Anyone can build their own report from the free engine. The paid value is the tested generator, the assessment method and the service around it.
