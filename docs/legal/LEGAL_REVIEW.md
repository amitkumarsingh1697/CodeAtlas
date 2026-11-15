# Legal and licensing review

- Date: 2026-11-15
- Reviewed at: `main` after PR #18 (`721c1e3`)
- Reviewer: Claude, asked by the founder to act as the legal team because there is none yet
- **This is not legal advice.** It is a careful reading of the licences, the code and public sources by an AI model. Nothing here replaces a qualified lawyer in India (and, for EU or UK clients, one there). Every item marked **Lawyer** must be confirmed by one before the first paid delivery, a public launch or fundraising.

## How the review was done

Three passes over the repository, each fixing what it found and checking the fixes:

1. Read the licence files, every package licence (`pnpm licenses list --prod`), the grammar manifest, the ArchLens bundle and its build script, the privacy description, ADR 0029 and 0030, CONTRIBUTING, SECURITY, the benchmark corpus and its ground truth, and the statement-of-work template (package doc 20).
2. Checked each privacy claim against the code that implements it (paths cited below).
3. Searched the web for other uses of the names (2026-11-15, US search results only; no trademark registry was queried directly).

## Summary

| ID    | Finding                                                                                  | Severity | Status                                     |
| ----- | ---------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
| LR-01 | Confidential business documents are in a public repository                               | High     | **Needs founder decision**                 |
| LR-02 | The names CodeAtlas, ArchLens and Nexora are already used by others                      | High     | Disclaimed in NOTICE; **Lawyer**           |
| LR-03 | Bundled MIT, ISC and BSD code shipped without its licence text                           | Medium   | Fixed                                      |
| LR-04 | Copyleft grammars (MPL-2.0, LGPL-2.1) shipped without a statement of where the source is | Low      | Fixed; **Lawyer** before commercial resale |
| LR-05 | No NOTICE file or copyright line                                                         | Medium   | Fixed                                      |
| LR-06 | The privacy description described another product and overstated CodeAtlas's isolation   | Medium   | Fixed                                      |
| LR-07 | Git author email addresses stored but never used                                         | Medium   | Fixed (code and test)                      |
| LR-08 | No privacy notice, data processing terms or data clauses for the paid assessment         | High     | Clause list below; **Lawyer**              |
| LR-09 | No record of where contributions come from                                               | Medium   | Fixed (DCO); CLA is a **Lawyer** question  |
| LR-10 | Copyright in AI-written code, and who owns the IP                                        | Medium   | **Lawyer**                                 |
| LR-11 | Open-core split had no rules for the private module                                      | Medium   | Fixed (ADR 0030 amendment)                 |
| LR-12 | Benchmark corpus includes AGPL projects                                                  | Low      | No change needed; rule recorded            |
| LR-13 | ArchLens could read as an Anthropic product                                              | Low      | Fixed (NOTICE, README)                     |

## Findings

### LR-01 Confidential business documents in a public repository (High, needs founder decision)

`github.com/amitkumarsingh1697/codeatlas` is public (GitHub API, 2026-11-15: `"visibility": "public"`, 0 forks, 0 stars). `docs/strategy-and-delivery/` holds the financial scenario model, pricing and packaging, the sales and negotiation playbooks, the investor narrative and draft pitch deck, the risk register and the Claude execution prompt. `docs/audit/` holds the internal gap analysis and risk register. Anyone can read and copy these, and a competitor or customer can read your pricing floor and negotiation positions. Information that has been published is generally hard to protect later as confidential or as a trade secret.

Deleting the files in a new commit does not remove them from git history. Rewriting history is a destructive operation that needs your explicit approval, and copies may already exist.

Options, recommended first:

1. **Make this repository private now** (GitHub → Settings → General → Danger zone → Change visibility). Publish the open-source engine later from a clean public repository that holds only code, at launch. Cheapest, fully reversible, and also stops the engine code here being public before you are ready (the same code is already public in NEXORA, so that part cannot be undone).
2. Keep it public and move the business documents to a private repository from now on, accepting that the history keeps the old copies.
3. Leave it as it is.

Only you can change the visibility; I can't from here.

### LR-02 The names are in use by others (High, Lawyer)

Web search on 2026-11-15 (not a registry search; classes and jurisdictions not checked):

- **CodeAtlas:** several code-analysis projects with the same or near-same name, in the same field: [shwet46/CodeAtlas](https://github.com/shwet46/CodeAtlas), [SerPeter/code-atlas](https://github.com/SerPeter/code-atlas), [code-atlas-mcp on PyPI](https://pypi.org/project/code-atlas-mcp/), [an MCP server listed as CodeAtlas](https://mcpmarket.com/server/codeatlas-5), [@lusiem/code-atlas on npm](https://socket.dev/npm/package/@lusiem/code-atlas/overview/0.5.0), a SaaS listed as [Code Atlas](https://saasbrowser.com/fr/saas/1550349/code-atlas), and hackathon projects such as [CodeAtlas Enterprise](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/atomai/codeatlas-enterprise). No registered mark was found by this search, but that proves nothing.
- **ArchLens:** [ArchLens on PyPI](https://pypi.org/project/ArchLens/0.3.0/) ([github.com/archlens/ArchLens](https://github.com/archlens/ArchLens)) is an architecture-view tool, [archlens-ai](https://jeffev.github.io/archlens-ai) is "powered by Claude Code", and [an "arch-lens" agent skill](https://skillsmp.com/creators/psenger/ai-agent-skills/skills-arch-lens) exists. Same field, and two on the same platform. This is the highest naming risk of the three.
- **Nexora:** pending trademark applications found, for example India [6962521](https://www.registerkaro.in/trademark-search/nexora-6962521), [6953161](https://www.registerkaro.in/trademark-search/nexora-6953161) and [6976844](https://www.registerkaro.in/trademark-search/nexora-6976844), US [99203230](https://markinton.com/trademark/nexora-99203230), Canada [2487145](https://www.trademarkelite.com/canada/trademark/trademark-detail/2487145/NEXORA). Their classes and owners were not checked.

Done: `NOTICE` says the names are not licensed under Apache-2.0 §6 and are not cleared. Recommendation: before any spend on brand, domains or marketing, a trademark attorney runs a clearance search in India (Class 9 software, Class 42 SaaS and IT services) and in your target markets. Consider renaming ArchLens now, while nothing depends on the name.

### LR-03 Bundled code shipped without its licence text (Medium, fixed)

`skills/archlens/scripts/brain/brain.mjs` bundles `yaml` (ISC), `zod`, `web-tree-sitter`, `libpg-query` and `@pgsql/types` (MIT), `smol-toml` (BSD-3-Clause) and TypeScript (Apache-2.0). esbuild kept only the comments marked `/*!`, so the MIT and ISC texts, which ask for the notice to be "included in all copies", were missing. `libpg-query.wasm` is compiled from libpg_query (BSD-3-Clause) and the PostgreSQL parser (PostgreSQL License); the npm package ships neither notice. TypeScript's `ThirdPartyNoticeText.txt` was not shipped.

Fix: `make-skill-brain.mjs` now reads esbuild's metafile, finds every package in the bundle plus the two shipped as files, and writes `THIRD-PARTY-LICENSES.txt` with each licence and any NOTICE or third-party notice file in full. The libpg_query and PostgreSQL texts were fetched from their sources on 2026-11-15 into `packages/sql/notices/libpg-query-wasm.txt`. The build fails if a bundled package has no licence file. Tests: `products/codeatlas/service/test/skill-bundle.test.ts`.

Not covered yet: the web UI build (`products/codeatlas/web`) bundles React, React Flow, Cytoscape and d3 (all MIT or ISC, `pnpm licenses list --prod`). It is only built locally today. When an installer or hosted build is distributed (Sprint 5 packaging), it needs the same notices file.

### LR-04 Copyleft grammars (Low, fixed; Lawyer before resale)

75 grammars: 67 MIT, 4 Apache-2.0, CC0, Unlicense, **Nim (MPL-2.0)** and **Vala (LGPL-2.1-only)** (`packages/syntax/grammars/MANIFEST.json`). Both copyleft licences let you ship the compiled grammar in a product under another licence if you say where its source is and, for LGPL, let the user replace it. Each grammar is a separate WebAssembly file, unmodified, built from a named commit. `THIRD-PARTY-LICENSES.txt` now names the source repository and commit of both, and that each file can be replaced. If the paid module ever ships the grammars, a lawyer should confirm this reading, or the two languages can be dropped from that build.

### LR-05 No NOTICE file or copyright line (Medium, fixed)

Apache-2.0 asks for a copyright notice; the `LICENSE` appendix still has the template line. Added a root `NOTICE` naming the copyright holder (Amit Kumar Singh, as in the git history, and contributors), the NEXORA origin, where third-party licences are, the trademark position and the Anthropic disclaimer. **Change the holder to the company** once the IP is assigned to it (LR-10).

### LR-06 Privacy description inaccurate (Medium, fixed)

`documentation/security/PRIVACY_AND_DATA_HANDLING.md` was mostly about CVForge, which is not in this repository. Its CodeAtlas part said "the only outbound connection is to the configured model endpoint", but CodeAtlas also clones public repositories (`products/codeatlas/core/src/clone/`), runs a repository's own scripts during investigation, and the skill can run `scip-python` or `scip-go`. It did not say that AI is on by default (ADR 0029), that the index holds copies of source text (`chunks`), or that it holds git author names and emails. The README said CodeAtlas "runs entirely on your machine", which is not true when a remote model is consented to.

Rewritten from the code: who is responsible for the data (the user for the local tool; the business for assessments), every table and what it holds, every outbound connection, personal data in source code, user controls, and the open items. README wording corrected. ADR 0029 named a `settings` table that does not exist; the switch is in `meta`.

### LR-07 Author emails stored but not used (Medium, fixed)

`products/codeatlas/core/src/indexer/index.ts` stored up to five author names and emails per file. No view shows the email. Storing personal data with no purpose goes against data minimisation (DPDP Act §§4 and 6, GDPR Art. 5(1)(c)). Emails are now used only to tell authors apart while counting and are not stored. Test: `indexer.test.ts`, "stores git author names but not their email addresses" (it fails without the fix). Indexes built earlier keep emails until re-indexed.

### LR-08 No data terms for the paid assessment (High, Lawyer)

In an assessment the business receives or runs on a client's code. That code contains personal data (author names, emails, sometimes real records in fixtures). The law that applies:

- **India, DPDP Act 2023.** The rules were notified on 13–14 November 2025 with a staggered rollout over 12 to 18 months, so most Data Fiduciary duties apply from about May 2027 ([PIB document](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf), [Khaitan & Co summary](https://www.khaitanco.com/sites/default/files/2025-11/ERGO%20-%20Digital%20Personal%20%20Data%20Protection%20Rules%20-%2015%20November%202025.pdf)). For a client's data the client is normally the Data Fiduciary and the business its Data Processor, which needs a valid contract with the client. A lawyer should confirm the dates and the role.
- **EU and UK, GDPR.** If a client (or its developers) is in the EU or UK, the business is very likely a processor and GDPR Art. 28 requires a written data processing agreement. Moving the data to India is a transfer that needs a safeguard such as standard contractual clauses.

Package doc 20 §7 has one line on data handling. It also says "any optional data transfer or AI service requires separate written approval", while the product has AI on by default (ADR 0029). Until counsel writes the terms, the operating rule for client work is: **turn AI off (Settings) for every client run unless the SOW approves a model, and note it in the engagement record.** (The report's run metadata does not record the AI setting yet; adding it is a small engine task.)

Clauses the lawyer should draft, as a checklist:

- [ ] Roles: client is controller / Data Fiduciary; business is processor / Data Processor; scope and purpose limited to the assessment.
- [ ] Where analysis runs (client environment by default), who can access it, and that no client data enters the CodeAtlas repositories.
- [ ] AI: off unless approved in writing; if approved, which model, where it runs, what is sent.
- [ ] Retention and deletion: delete indexes, clones and working copies within N days of delivery, with written confirmation.
- [ ] Confidentiality of client code and findings; return or destruction on termination.
- [ ] Breach notice to the client without undue delay, with the facts the client needs for its own notices.
- [ ] Sub-processors: none today; the client approves any.
- [ ] Ownership: client owns its code and the delivered report; the business keeps its tools, method and anonymised learnings, if the client agrees.
- [ ] Liability cap, warranty disclaimer (findings are evidence-labelled, not complete), indemnities, governing law and venue.
- [ ] EU/UK clients: Art. 28 terms and transfer clauses.
- [ ] A short privacy notice for the business's own website and contact forms when they exist.

### LR-09 No contribution provenance (Medium, fixed; CLA for Lawyer)

CONTRIBUTING said contributions are Apache-2.0 (inbound equals outbound), which is fine, but kept no record that a contributor had the right to submit. Added the Developer Certificate of Origin: every commit carries `Signed-off-by:`. A CLA (which would let the company relicense contributions) is only needed if you plan to move contributed code into the paid module or change the engine's licence; ADR 0030 says neither will happen, so DCO is enough for now. The lawyer should confirm. CI does not yet enforce the sign-off.

### LR-10 Copyright in AI-written code and IP ownership (Medium, Lawyer)

Of 92 commits, 49 are authored by Claude (`git log`). In the US, the Copyright Office holds that purely AI-generated material is not protected and that protection depends on human authorship (selection, arrangement, modification). Indian law has not settled the question. Anthropic's commercial terms say the customer owns outputs; check which terms your account is on. What this affects: how strongly you can stop someone copying the paid module, and what investors see in IP diligence. It does not affect your right to use and sell the code.

Mitigations already in place or easy: you direct every change and approve every PR (the PR history records this); keep doing so. **Lawyer:** form the company, assign the founder's IP (including NEXORA and this repository) to it, and give an opinion on AI-assisted code for the data room (package docs 17 and 21).

### LR-11 Open-core split rules (Medium, fixed)

ADR 0030 is legally sound: Apache-2.0 allows closed products built on the engine, and code already published under Apache-2.0 cannot be withdrawn (risk L-01). Amended with six rules for the private module: why a branch or folder here cannot replace a private repository, the paid licence is proprietary, the engine's notices travel with any engine code it ships, no GPL/AGPL/SSPL dependencies, only founder-owned code moves into it, and client data enters neither repository. The paid licence text itself is **Lawyer** work.

### LR-12 Benchmark corpus (Low, no change)

Corpus licences (read from each repository's LICENSE on 2026-11-14 and recorded in `documentation/benchmark/CORPUS.md`): PetClinic, PetClinic Microservices, JHipster sample, Conductor and Keycloak are Apache-2.0; Immich and Twenty are AGPL-3.0. Cloning and analysing them locally is use, not distribution, and AGPL's network clause is about running modified versions as a service, which this is not. The ground-truth files hold only repository names, paths, symbol names, line numbers and labelling notes (longest string checked in each file; no source text). Rule kept: never commit their source, and only name them as the subject of a measurement, never as endorsing CodeAtlas.

### LR-13 Relationship to Anthropic (Low, fixed)

The README calls ArchLens "a Claude skill". Naming the platform a product works with is normally fine, but nothing said it is unofficial. `NOTICE` and the README now say it is not made or endorsed by Anthropic.

## What still needs a real lawyer

In order of when it matters:

1. **Before the first paid assessment:** the SOW, MSA/NDA and data processing terms (LR-08), the paid module's licence (LR-11), and the role under DPDP and GDPR.
2. **Before spending on the brand:** trademark clearance for CodeAtlas, ArchLens and Nexora (LR-02).
3. **When the company is formed:** founder IP assignment, then change the NOTICE holder; opinion on AI-assisted code (LR-10).
4. **Before selling a build that includes the grammars:** confirm the MPL-2.0 and LGPL-2.1 reading (LR-04).
5. **Before taking outside contributions at scale:** DCO versus CLA (LR-09).
6. **Before a public website or hosted service:** privacy notice, terms of use, and the grievance contact the DPDP rules ask for.

## Re-review

Pass 2 re-read every changed file against the code and found two more errors, both fixed in the same PR: the privacy page and ADR 0029 named a `settings` table (the switch is stored in `meta`), and the first draft did not mention the third-party SCIP indexers the skill can run. Pass 3 found no further issue within this scope. Out of scope and not reviewed: tax, GST, payments, employment, and the NEXORA repository (left untouched by instruction).
