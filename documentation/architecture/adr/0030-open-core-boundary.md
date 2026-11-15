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

## Amendment 2026-11-15: licence rules for the paid module (legal review)

The legal review of 2026-11-15 ([docs/legal/LEGAL_REVIEW.md](../../../docs/legal/LEGAL_REVIEW.md), not legal advice) found the split itself sound: Apache-2.0 lets anyone, including the founder, build closed software on the engine. It added these rules, which the private repository must follow from its first commit:

1. **Why a separate repository.** Anything pushed to this repository is published under its root `LICENSE` (Apache-2.0) and, while the repository is public, can be copied and kept by anyone under that licence. A paid module pushed here, even briefly, could not be taken back (risk L-01). A branch or folder in this repository is therefore not a substitute for the private repository.
2. **The private module's licence** is a proprietary commercial licence or the customer contract itself, never an open-source licence. Its wording is for counsel.
3. **Use the engine through its packages.** If the paid module ships engine code to a customer (bundled or copied), it ships the engine's `LICENSE` and `NOTICE` with it and keeps every Apache-2.0 header (Apache-2.0 §4).
4. **No strong copyleft in the paid module.** No dependency under GPL, AGPL, SSPL or a similar licence. MPL-2.0 and LGPL code only as separate, unmodified files. Every dependency is listed with its licence in that repository before the first paid delivery.
5. **Only founder-owned code may move into it.** Code written by the founder (or for the founder, including by Claude sessions) can be reused there because the founder holds the rights. Code contributed here by anyone else stays Apache-2.0 and is not copied into the paid module without that contributor's written permission (point 4 of the decision above).
6. **Client data never enters either repository.** Reports, client code, indexes and screenshots of client systems stay in the client engagement's storage, under the statement of work.
