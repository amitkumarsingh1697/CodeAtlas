# ADR 0024: The strategy and delivery package is the product baseline

- Status: accepted
- Date: 2026-11-14
- Decision owner: founder (delegated to engineering on 2026-11-14, audit decision D-1)

## Context

`documentation/product/MASTER_SPECIFICATION.md` was written for NEXORA. It still holds the CVForge sections, and only §5 (Architecture Brain) and the shared sections apply to this repository. The founder's strategy and delivery package (documents 00 to 23, copied unchanged into `docs/strategy-and-delivery/`) defines the product this company sells: a local-first code intelligence engine and a paid Architecture Intelligence Assessment. The Phase 1 audit (`docs/audit/DOCUMENTATION_RECONCILIATION.md`) found 14 conflicts between the two.

## Decision

1. The package in `docs/strategy-and-delivery/` is the product baseline. Where it and the master specification differ, the package wins.
2. The audit's reconciliation (`docs/audit/DOCUMENTATION_RECONCILIATION.md`) records how each conflict is resolved. A later ADR may change a resolution.
3. `MASTER_SPECIFICATION.md` stays unchanged as the record of what was built before 2026-11-14. Its §5 still describes current behaviour where the package says nothing.
4. `CLAUDE.md` §1 names the package as the source of truth.

## Consequences

- Requirement IDs in new work come from package document 02 (PRD) and the audit roadmap. The old `AB-*` IDs stay valid for existing traceability rows.
- The package's own documents are not reformatted (`.prettierignore`), so they stay identical to what the founder approved.
