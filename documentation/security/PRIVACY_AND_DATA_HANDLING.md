# Privacy and data handling

This page describes what CodeAtlas and ArchLens do with data, as the code behaves on 2026-11-15. It is an engineering description, checked against the code paths named below. It is not a privacy policy and not legal advice. The legal review that found the gaps listed at the end is [docs/legal/LEGAL_REVIEW.md](../../docs/legal/LEGAL_REVIEW.md).

The CVForge section that this page used to hold described a product that stayed in the NEXORA repository on 2026-11-14. It was removed here because it does not apply to anything in this repository.

## Who is responsible for the data

- **The CodeAtlas app and the ArchLens skill run on the user's own machine.** Nothing they read is sent to the CodeAtlas authors. The person or organisation running them decides what to index and is responsible for that data. The authors do not receive, host or process it.
- **The Architecture Intelligence Assessment is different.** When the founder's business runs CodeAtlas on a client's repository, the business does handle the client's code and the personal data inside it (see [Personal data in source code](#personal-data-in-source-code)). That service needs its own contract terms and privacy notice before the first paid delivery; see the open items at the end.

## What the CodeAtlas app stores

Everything is stored under `CODEATLAS_HOME` (default `~/.codeatlas`) on the machine that runs the service.

| Data                                                                                                                      | Why                                      | Where (SQLite unless noted)                       | Kept until                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| Repository path and, for a cloned repository, its URL                                                                     | Find the repository again                | `repos`                                           | The repository is removed                                      |
| Symbols, relationships, file inventory, routes, tables and coverage                                                       | The index itself                         | `nodes`, `edges`, `file_inventory`, `unresolved`  | The repository is removed or re-indexed                        |
| Copies of source and documentation text, in chunks                                                                        | Search and the excerpts Ask cites        | `chunks`, `chunks_fts`                            | The repository is removed or re-indexed                        |
| Git history per file: commit count, churn, last change, and up to five author **names** with their share of changed lines | Ownership, bus factor and risk views     | `nodes.data`                                      | The repository is removed or re-indexed                        |
| Investigations: the bug text the user typed, patches, test output, approvals and merges                                   | The investigate workflow and its audit   | `investigations`, `inv_*`; a git worktree on disk | The investigation is discarded (the worktree folder: see K-08) |
| Clones of public repositories the user asked for                                                                          | Index a repository not on the machine    | `clones/` folder                                  | The user deletes the folder                                    |
| Local usage events: counts, durations and enums, plus the optional note a user types when rating an answer                | Product metrics the user can see (§5.11) | `analytics_events`                                | Settings → delete local data                                   |
| Settings, including the AI on/off switch                                                                                  | Preferences                              | `meta`                                            | Settings → delete local data                                   |

Author **email addresses** are read from git only to tell authors apart while counting, and are not stored (since 2026-11-15; test: `products/codeatlas/core/test/indexer.test.ts`, "stores git author names but not their email addresses"). An index built before that date still holds them until the repository is re-indexed.

Files whose names look like they hold credentials (`.env`, keys, certificates and similar, `isSecretPath` in `products/codeatlas/core/src/indexer/files.ts`) are listed in coverage but never read.

## When CodeAtlas connects to another machine

CodeAtlas sends no telemetry and no usage data anywhere. It makes outbound connections only in these cases, each one started by the user or by the user's configuration:

1. **The AI model endpoint (on by default, ADR 0029).** When AI is on and a model is reachable, each question sends: the question, up to 8 source excerpts of at most 60 lines each with secret-looking values redacted, and related graph facts with file paths and line numbers. The default endpoint is a local Ollama (`127.0.0.1`). Any host other than `localhost`, `127.0.0.0/8` or `::1` counts as remote and is refused unless the operator sets `AI_REMOTE_CONSENT=true`. The Ask page and Settings show the endpoint and what is sent; Settings → **Turn AI off** stops every model request. Indexing, search, coverage and every other feature never use a model.
2. **Cloning a public repository.** When the user pastes a repository URL, git connects to that host. Only `https`, public addresses, no credentials (risks S-07 and S-08).
3. **A repository's own scripts.** When the user asks an investigation to validate a patch, CodeAtlas runs the repository's allowlisted scripts (for example `test`). Those scripts can do anything the repository's authors wrote, including network access. CodeAtlas limits which scripts run, not what they do ([SECURITY.md](../../SECURITY.md)).

The web UI loads no fonts, scripts or images from other sites, and the offline brain HTML file contains everything it needs. A network-denied test checks on every change that indexing, the assessment and the brain make no outbound connection; see [DATA_FLOW.md](DATA_FLOW.md).

## ArchLens

The ArchLens skill runs inside the user's Claude session. What it reads is sent to Claude as part of that conversation, under the terms the user has with Anthropic; ArchLens adds no other recipient. Its bundled brain command (`scripts/brain/brain.mjs`) runs locally, makes no network connection of its own, and writes only the files the user names plus a temporary folder that it removes when it exits (ADR 0023). With `--run-indexers` it also runs `scip-python` or `scip-go` if they are on the PATH; those are third-party programs with their own behaviour.

## Personal data in source code

A repository is not only code. It can hold personal data: author names in git history and file headers, email addresses in commits and `CODEOWNERS`, and sometimes customer records in fixtures, seed files or test data. CodeAtlas does not try to find or classify it. What this means:

- The index holds the author names described above and any personal data that appears in text it copies into `chunks`.
- A model request can include such text if it is in a cited excerpt. The redaction pass removes secret-looking values (tokens, keys, passwords), not personal data.
- For the assessment service, the client's code is the client's data, and personal data in it falls under the client's obligations and the business's obligations as the party processing it for them (DPDP Act 2023 in India, GDPR for EU and UK data subjects). See the open items.

## User controls

- **Turn AI off:** Settings. No request then reaches any model.
- **Remove a repository:** deletes all of its indexed rows, including the copied text and author names.
- **Discard an investigation:** removes its worktree and branch.
- **Delete all local data:** Settings. Clears the database; the clones and worktree folders are named for the user to delete (K-08).
- **Everything is a file under `CODEATLAS_HOME`,** so the user can also inspect, back up or delete it directly.

## Open items before the first paid assessment or a public launch

These need the founder or a qualified lawyer; see [docs/legal/LEGAL_REVIEW.md](../../docs/legal/LEGAL_REVIEW.md) for the reasoning.

- A privacy notice and contract terms for the assessment service: what client data is received, purpose, retention and deletion after delivery, who can see it, the breach process, and the client's instructions as data controller or data fiduciary.
- A data processing agreement template for clients with EU or UK personal data, and a decision on whether the business is a processor or a controller for each kind of data it handles.
- A named contact for data requests and, if required, a grievance officer under the DPDP rules.
- A record of processing and a sub-processor list (none today: no hosted service and no hosted model).
- A redaction pass for client deliverables that removes author names where the client asks for it (planned in the paid report module, ADR 0030).
