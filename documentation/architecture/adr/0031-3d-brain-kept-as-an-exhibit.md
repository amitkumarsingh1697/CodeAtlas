# ADR 0031: The 3D architecture brain is a recorded deviation, kept as an optional exhibit

- Status: accepted
- Date: 2026-11-14
- Amends: ADR 0012 (which stays as written)

## Context

The old master specification §5.5 says "do not introduce expensive 3D visualization in v1". ADR 0012 built the 3D brain (shared three.js viewer, single-file HTML) and recorded "deviation: none", which was wrong. Package document 01 §10 lists "advanced 3D polish" as a 90-day non-goal. The audit (reconciliation item C-05) found that the brain works and is used by the ArchLens skill, and that its lobe placement is a path heuristic that can mislead a client (risk T-09).

## Decision

1. ADR 0012's decision was a deviation from spec §5.5. This ADR records it; ADR 0012 is not rewritten.
2. The brain stays, with no new 3D features during the 90-day plan. Fixes and accuracy work that also feed the 2D views are allowed.
3. In the paid assessment, the 2D module and dependency views are the primary architecture view. The offline brain HTML may be attached as an optional exhibit, labelled as a navigation aid whose placement is heuristic.

## Consequences

- No effort goes into 3D polish until the TypeScript/PostgreSQL accuracy gate has passed.
- The report work in Sprint 1 draws its diagrams from the 2D views.
