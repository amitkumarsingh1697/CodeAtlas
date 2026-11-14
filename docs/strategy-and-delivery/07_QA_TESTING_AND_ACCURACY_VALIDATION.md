# QA, Testing & Accuracy Validation Plan

## 1. Test pyramid
- Unit: parser rules, normalizers, graph operations, evidence classification, redaction.
- Component: language adapters, storage, report generator, API.
- Integration: full repository analysis pipeline.
- End-to-end: user workflows in supported OS/browser combinations.
- Security: path handling, secrets, API authorization, dependency/supply chain.
- Performance: small/medium/large corpus and resource measurement.
- Accuracy: hand-adjudicated relationships and framework semantics.
- Customer acceptance: pilot-specific scope and findings review.

## 2. Golden corpus
Maintain versioned fixture repositories with known ground truth:
- TypeScript/Node with PostgreSQL and representative framework patterns.
- Java/Spring with Maven and Gradle, routes, beans, JPA, messaging.
- Small controlled fixtures for each language feature.
- Realistic public repositories for scale and integration testing, subject to licence review.
- Customer repositories only with written authorization and agreed retention.

## 3. Accuracy methodology
For each benchmark:
1. Define relationship types in scope.
2. Establish ground truth through independent manual review.
3. Record adjudication rules and disagreements.
4. Run a fixed product version/configuration.
5. Match predicted relationships to ground truth.
6. Calculate precision, recall and F1 where meaningful.
7. Break results down by relationship type and evidence class.
8. Report unresolved and unsupported cases.
9. Publish corpus, environment, limitations and date where licensing permits.

Precision = true positives / (true positives + false positives).  
Recall = true positives / (true positives + false negatives).  
Do not compare tools unless scope, repository version, configuration and matching methodology are reasonably equivalent.

## 4. Test categories
- Parser syntax and version compatibility.
- Semantic resolution.
- Framework annotation and convention handling.
- Dynamic/reflection limitations.
- Database migration and ORM mappings.
- Monorepo/package boundaries.
- Generated code and vendored dependencies.
- Symlinks, ignored files and malformed files.
- Incremental and repeat analysis.
- Graph consistency and stable identifiers.
- Report sanitization and evidence links.
- Offline mode and network egress.
- Cancellation and partial failure.
- Memory/CPU ceilings.

## 5. Release gates
A release cannot be called production-ready unless:
- All P0 acceptance criteria pass.
- No unresolved critical/high security defect.
- Supported-platform CI passes.
- Accuracy benchmark is published for each marketed stack.
- No critical data-loss/corruption issue.
- Reports show scope, limitations and provenance.
- Installation, upgrade, rollback and uninstall are tested.
- Signed artifacts and SBOM are available where applicable.
- Support and vulnerability reporting channels exist.
- Release notes and known issues are complete.

## 6. Claude Code test discipline
Claude Code must run the repository's actual test commands, capture exit codes and summarize failures. It must not claim tests passed when tests were skipped, mocked, flaky or not executed. New behavior requires tests. Fix root causes rather than weakening assertions. Do not delete or disable tests to achieve a green build without explicit founder approval.
