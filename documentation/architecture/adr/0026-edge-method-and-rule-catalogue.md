# ADR 0026: Every relationship names the rule that produced it

- Status: accepted
- Date: 2026-11-15
- Roadmap: GRAPH-001 (Sprint 1)

## Context

Edges carried an evidence class (observed, inferred, unknown) and a free-text `detail`, but not which rule decided the link. The audit could not separate, for example, Java calls resolved by a declared receiver type from calls matched by a unique name (risk T-05), and a benchmark needs per-rule precision. The assessment report also has to say how each finding was derived.

## Decision

1. `products/codeatlas/core/src/indexer/rules.ts` holds the rule catalogue: each rule id, its adapter, the evidence classes it may assign and a one-line meaning. `EdgeRec.method` is a required `RuleId`, so the compiler rejects an edge without a catalogued rule.
2. The tree-sitter resolver (`@nexora/syntax`) reports which call rule (`new-class`, `receiver-type`, `self-member`, `local-function`, `imported-name`, `same-package`, `module-import`, `class-member`, `unique-name`) and which base rule decided each link. A link SCIP confirmed or corrected is `scip.reference`.
3. Schema v9 adds `edges.method` and `edges.adapter`. Rows written before v9 keep NULL until the repository is re-indexed. The TypeScript cache format is bumped to 4 so cached files are re-analysed and get methods.
4. `documentation/architecture/RULE_CATALOGUE.md` is generated from the table; a test fails if they differ. Another test indexes a TypeScript fixture and a mixed Java, Python, SQL, YAML and Markdown repository and checks that every edge has a catalogued rule, the right adapter and an evidence class that rule may give.

## Consequences

- Adding a relationship means adding a catalogue rule first.
- The benchmark (Sprint 2) can report precision per rule, and a rule with low precision can be downgraded on its own.
- Merged duplicate edges keep the method of the strongest evidence, as they already kept its evidence location.
