# System Architecture & Data Model

## Target component boundaries
- `codeatlas-core`: open-source analysis primitives, canonical graph, evidence model and adapters.
- `codeatlas-cli`: local command-line experience and configuration.
- `codeatlas-service`: local API, job lifecycle, storage and query services.
- `archlens`: interactive architecture explorer and report preview.
- `codeatlas-report`: report model, HTML/PDF rendering and templates.
- `codeatlas-pro`: commercial professional workflows, subject to licensing/legal review.
- `codeatlas-enterprise`: identity, governance, audit, policy, private deployment and CI capabilities.
- `codeatlas-mcp`: optional, thin, read-only agent adapter.
These are logical boundaries, not a mandate to create repositories or packages before inspecting the existing project.

## Trust boundaries
1. Customer source repository.
2. Local CodeAtlas process.
3. Local database/cache/artifacts.
4. Optional customer-approved model endpoint.
5. Optional customer-controlled private deployment.
6. Optional external services (updates/licensing/support) with explicit data minimization.

## Data classification
| Data | Default handling |
|---|---|
| Raw source code | Read locally; do not upload |
| Source snippets | Do not transmit by default |
| File paths | Local only; redact in exported diagnostics unless needed |
| Symbols and graph | Local storage; customer-controlled export |
| Secrets | Exclude/redact; never log |
| Reports | Customer-owned artifacts |
| Usage telemetry | Off or opt-in, minimized and documented |
| Crash logs | No source/secret content; customer-controlled sharing |
| Licence metadata | Minimal activation data only if commercially required |

## Data lifecycle
Discover → scan → parse → resolve → normalize → persist local graph → explore → export report → customer retention/deletion. Define cleanup for temporary files and cache. Customer must be able to delete project data and generated artifacts.

## Graph schema
Use the TDD node, edge and analysis-run definitions. Add database migrations and schema version. Do not make node identifiers dependent on unstable display names alone. Preserve provenance and run lineage.

## Architecture diagrams required from Claude Code
- C4 context diagram.
- C4 container diagram.
- Component diagram for analysis pipeline.
- Data-flow diagram.
- Threat-boundary diagram.
- Sequence diagram: local assessment.
- Sequence diagram: report generation.
- Sequence diagram: optional MCP query.
- Deployment diagrams: local workstation and customer private cloud.

## Architecture quality attributes
Security, privacy, accuracy, explainability, performance, portability, deterministic behavior, maintainability and extensibility. Every architecture trade-off should have an ADR.
