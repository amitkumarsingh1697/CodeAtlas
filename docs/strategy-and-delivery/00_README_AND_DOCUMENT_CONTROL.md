# CodeAtlas — Founder Execution & Product Delivery Package

**Version:** 1.0  
**Prepared:** 14 November 2026  
**Status:** Strategic baseline; must be reconciled against the live repository before implementation.

## Purpose
This package is the operating blueprint for building, validating, selling and financing CodeAtlas. It is designed for a founder-led company using Claude Code as the primary engineering execution environment.

## Decisions treated as approved
- Business ambition: globally scalable venture.
- Product direction: local-first, evidence-backed software architecture intelligence.
- Licensing: open-core; existing Apache-2.0 code remains governed by its existing grants. Any commercial split requires legal review.
- Initial stack coverage: TypeScript/PostgreSQL and Java/Spring Boot, with independent capability and accuracy gates.
- Geography: India and international markets in parallel.
- Initial monetization: fixed-scope paid architecture assessment.
- Follow-on monetization: Professional and Enterprise software licences.
- Core execution: Claude Code performs repository inspection, implementation, tests, integrations, documentation updates and release validation; founder approves scope, business decisions, security posture and customer commitments.

## Important baseline and evidence limitations
The latest supplied independent repository review refers to commit `2fc3767` and describes approximately 48k lines of TypeScript, 500+ automated tests, local-only execution, confidence labels, partial impact analysis, and gaps in reporting, Java/Spring, real-model evaluation, packaging and enterprise governance. These are **snapshot claims**, not verified facts about the current checkout. Claude Code must inspect the actual repository and record the actual commit, test status and capability state before relying on them.

The review also states that TypeScript is compiler-accurate, while many other languages use tree-sitter and name-based call matching; Java/Spring route detection, Gradle and Kafka resolution are incomplete. Treat these as investigation hypotheses to verify, not permanent product truths.

No document in this package certifies security, legal compliance, SOC 2, ISO 27001, production readiness, product-market fit or investment readiness.

## Document map
| ID | Document | Purpose |
|---|---|---|
| 00 | README and document control | Package guide and governance |
| 01 | Company and product strategy | Business thesis, positioning and strategic choices |
| 02 | PRD | Product requirements and acceptance criteria |
| 03 | TDD | Technical design and implementation constraints |
| 04 | Architecture and data model | System boundaries, graph and data handling |
| 05 | UI/UX specification | Information architecture, flows and visual direction |
| 06 | Security and privacy | Threat model, data flows and security requirements |
| 07 | QA and validation plan | Test strategy, accuracy benchmarks and release gates |
| 08 | Sprint roadmap | Phases, sprint goals, backlog and dependencies |
| 09 | Claude Code master prompt | Operating instructions for autonomous engineering work |
| 10 | Packaging, deployment and operations | Local, private-cloud and enterprise deployment |
| 11 | Pricing and packaging | Commercial tiers and pricing hypotheses |
| 12 | Sales and customer discovery | ICP, discovery, qualification and funnel |
| 13 | Negotiation and procurement playbook | Commercial negotiation and security objections |
| 14 | Marketing and product pitch | Website, demo, messaging and content |
| 15 | Investor strategy and pitch narrative | Seed narrative and evidence requirements |
| 16 | Financial model assumptions | Model definitions and scenario logic |
| 17 | Legal and governance checklist | Legal workstreams requiring professional counsel |
| 18 | Metrics and operating cadence | Product, sales, financial and delivery scorecard |
| 19 | Risk register and decision log | Risks, owners, gates and unresolved decisions |
| 20 | Customer pilot SOW template | Fixed-scope engagement structure |
| 21 | Data room checklist | Seed diligence preparation |
| 22 | Release readiness checklist | Go/no-go criteria |
| 23 | Repository audit and gap assessment template | Reconcile plan to actual codebase |

## How to use this package
1. Put the `documentation` folder into the CodeAtlas repository under `/docs/strategy-and-delivery/` or another agreed location.
2. Run the Claude Code master prompt in document 09.
3. Require Claude Code to inspect the actual repository before editing code.
4. Have it create a traceability matrix mapping every PRD requirement to code, tests and evidence.
5. Implement in small, reviewable sprints. Do not allow a large unreviewed rewrite.
6. Founder approves scope changes, licence changes, customer-facing claims, security exceptions and production release.
7. Update decision log, risk register, financial assumptions and release evidence continuously.

## Status vocabulary
- **Planned:** specified but not implemented.
- **Implemented:** code exists.
- **Tested:** defined tests pass.
- **Validated:** tested against realistic representative systems and manually checked.
- **Customer-proven:** used and accepted by a paying or documented design partner.
- **Production-ready:** all release gates met for the stated deployment model.
- **Investor-ready:** evidence, financials, legal and data room are coherent and diligenceable.

Never mark a feature complete merely because code was generated.
