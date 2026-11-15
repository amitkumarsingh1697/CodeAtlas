# CodeAtlas

**Software architecture intelligence. Understand, analyse, change with confidence.**

This repository holds two things that share one engine:

| Name          | In one sentence                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **CodeAtlas** | Indexes a repository in any language on your machine and explains its structure, flows and risks with citations.                       |
| **ArchLens**  | A Claude skill that answers architecture questions with every claim tagged observed, inferred or unknown, and draws the same 3D brain. |

It was extracted on 2026-11-14 from the [NEXORA](https://github.com/amitkumarsingh1697/NEXORA) monorepo, keeping the git history of these paths. The resume product CVForge was left behind. Some documents under `documentation/` (the master specification, traceability, research log, threat model and sprint reports) still describe both products; the CodeAtlas, Architecture Brain and ArchLens parts are the ones that apply here.

A full context brief (features, architecture, how the two connect, maturity and gaps) is in [documentation/product/CONTEXT_CODEATLAS_ARCHLENS.md](documentation/product/CONTEXT_CODEATLAS_ARCHLENS.md).

## Contents

- [CodeAtlas](#codeatlas)
  - [Languages and file types](#languages-and-file-types)
  - [Using CodeAtlas](#using-codeatlas)
- [ArchLens](#archlens)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quality gates](#quality-gates)

## CodeAtlas

CodeAtlas runs on your machine (`127.0.0.1`, protected by a token) and sends no telemetry. AI answers are on by default and use a local Ollama; a model on another machine is refused unless you set `AI_REMOTE_CONSENT=true`, and Settings can turn AI off ([what is stored and sent](documentation/security/PRIVACY_AND_DATA_HANDLING.md)). It indexes a repository into SQLite and labels every relationship **observed**, **inferred** or **unknown**, so you always know how a fact was found. TypeScript and JavaScript are read by the TypeScript Compiler API (Svelte, Vue and Astro components too). 71 more languages, from Java, Go, Python and C# to COBOL and Verilog, are parsed with tree-sitter grammars. SQL is read by PostgreSQL's own parser and a statement reader for other dialects, ORM schemas and migrations of 23 frameworks are read into the database model, and configuration, build, container, CI, infrastructure, API and documentation files are read by format readers (see [Languages and file types](#languages-and-file-types)).

- **Architecture brain:** the whole repository as a 3D brain. Lobes for Frontend, Backend, Database, DevOps, Core & shared and Documentation; click a lobe to fly inside it, click a class or method to see its inputs and output, where its input comes from and where it sends work, each link labelled with its evidence. Search recalls any part. `pnpm --filter @nexora/codeatlas-service cli brain <path> --out brain.html` writes the same brain as one offline HTML file.
- **Database tables and diagrams:** tables from SQL files and ORM schemas and migrations (Prisma, Drizzle, TypeORM, Django, SQLAlchemy, Rails, JPA, EF Core, Liquibase and more), with every column's type, length, precision, scale, nullability, keys and default, and the functions that read and write each table. Views, procedures, functions, triggers and sequences are read with their bodies: the tables each one reads and writes and the routines it calls.
- **Build, configuration and documentation:** every JSON, YAML and TOML key and every XML element, nested, with its line (values are never stored). Maven, Gradle, npm and other manifest dependencies, plugins and tasks, with a dependency on a module the repository builds linked to that module. Spring beans, servlets and other class names in XML linked to their Java classes. Markdown and AsciiDoc sections in a Documentation lobe, with links to the files and code they mention. The **Diagrams** button in the brain draws ER, schema and class diagrams that you can scope, zoom, download as SVG, and click to find a part in the brain.
- **Languages & files:** every file in the repository with its language, file type and one of seven statuses (fully analysed, partially analysed, text only, recognised but not readable, failed, excluded, binary) and the reason. Totals by language, file type, folder and status, and a browser for every file. The same section is in the brain.
- **Coverage report:** what was read, what was skipped and why, manifests and declared frameworks.
- **Structure, modules and dependencies:** a module → file → symbol tree and dependency graphs, with cycle detection.
- **Flows:** pick a route or entry point and trace what it calls.
- **Integrations:** environment variables, configuration files, HTTP services and database clients.
- **Risk, ownership and knowledge:** churn, sensitive configuration, git ownership, and Markdown/ADR knowledge with module documentation.
- **Search and Ask:** full-text search, and questions answered with numbered source citations. Without a model it returns the relevant evidence instead of an explanation.
- **Investigate:** take a bug report through a patch in an isolated git worktree, allowlisted test commands, and a human approval bound to the exact patch hash before a fast-forward merge.

The screenshots show CodeAtlas exploring this repository.

![Architecture brain](documentation/assets/screenshots/codeatlas-brain.png)

| Inside the Backend lobe                                                       | A function: inputs, output and links                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ![Backend lobe](documentation/assets/screenshots/codeatlas-brain-backend.png) | ![Function details](documentation/assets/screenshots/codeatlas-brain-method.png) |

| A table: columns, types and who reads it                                     | ER diagram                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![Table details](documentation/assets/screenshots/codeatlas-brain-table.png) | ![ER diagram](documentation/assets/screenshots/codeatlas-diagram-er.png) |

| DevOps: build manifests with their dependencies, plugins and tasks          | Documentation: every README and guide, section by section                        |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ![DevOps lobe](documentation/assets/screenshots/codeatlas-brain-devops.png) | ![Documentation lobe](documentation/assets/screenshots/codeatlas-brain-docs.png) |

| Schema diagram                                                                   | Class diagram                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Schema diagram](documentation/assets/screenshots/codeatlas-diagram-schema.png) | ![Class diagram](documentation/assets/screenshots/codeatlas-diagram-class.png) |

| Languages & files on the Overview                                              | Languages & files inside the brain                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| ![Languages & files](documentation/assets/screenshots/codeatlas-languages.png) | ![Brain languages](documentation/assets/screenshots/codeatlas-brain-languages.png) |

| Welcome                                                            | Overview and coverage                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| ![Welcome](documentation/assets/screenshots/codeatlas-welcome.png) | ![Overview](documentation/assets/screenshots/codeatlas-overview.png) |

| Structure                                                              | Dependencies                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ![Structure](documentation/assets/screenshots/codeatlas-structure.png) | ![Dependencies](documentation/assets/screenshots/codeatlas-dependencies.png) |

| Flows                                                          | Integrations                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ![Flows](documentation/assets/screenshots/codeatlas-flows.png) | ![Integrations](documentation/assets/screenshots/codeatlas-integrations.png) |

| Risk                                                         | Knowledge                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| ![Risk](documentation/assets/screenshots/codeatlas-risk.png) | ![Knowledge](documentation/assets/screenshots/codeatlas-knowledge.png) |

| Ask (with citations)                                       | Investigate                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| ![Ask](documentation/assets/screenshots/codeatlas-ask.png) | ![Investigate](documentation/assets/screenshots/codeatlas-investigate.png) |

| Repositories                                                                 | Modules                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ![Repositories](documentation/assets/screenshots/codeatlas-repositories.png) | ![Modules](documentation/assets/screenshots/codeatlas-modules.png) |

### Languages and file types

One registry, [`packages/languages`](packages/languages), decides what every file is, for CodeAtlas and ArchLens alike. It uses GitHub Linguist 9.7.0 data (833 languages) plus Nexora's own rules for file types such as Kubernetes manifests, OpenAPI files, CI pipelines and lockfiles. A file is identified by its content (binary signatures, Git LFS pointers), path, file name, extension, shebang, editor modeline or content shape, in that order, and the result records how it was found.

Each file is then read at the deepest level available, and the level is shown:

| Level              | What is read                                            | Examples                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fully analysed     | A complete parser read the file and understood its type | TypeScript and JavaScript (compiler); Java, Go, C#, Python, Ruby, PHP, Kotlin, Swift, Rust, C and C++, COBOL and 60 more languages when their tree-sitter parse has no syntax errors; PostgreSQL SQL; Markdown; JSON, YAML and TOML read to every key; Maven POMs, Spring XML, Liquibase changelogs; package.json, Docker Compose, Kubernetes, GitHub Actions, OpenAPI, go.mod, .sln, CSV, gettext catalogs |
| Partially analysed | Structure read, with the reason it is not full recorded | Source files with syntax errors; SQL in other dialects (statement reader); Terraform/HCL; Protobuf, Thrift and GraphQL; Makefiles, CMake; AsciiDoc and reStructuredText; Helm and Jinja templates with placeholders; JSON over 5,000 keys; Liquibase changes not applied to the schema; Graphviz                                                                                                            |
| Text only          | Identified and searchable, no structure                 | Licences, ignore files, plain lists, recorded HTTP bodies                                                                                                                                                                                                                                                                                                                                                   |
| Excluded           | Not read on purpose, with the reason                    | Vendored and build folders, files that may hold credentials, generated files, symlinks, submodules, files over the size or count limits                                                                                                                                                                                                                                                                     |

Coverage is (fully + partially analysed) ÷ readable files, where readable means every file except excluded and binary ones. Text-only files never count as analysed. The full list is in the generated [support matrix](documentation/reports/LANGUAGE_SUPPORT_MATRIX.md), and the results on 23 public repositories, from Kubernetes to a COBOL course, are in the [validation report](documentation/reports/LANGUAGE_COVERAGE_VALIDATION.md).

### Using CodeAtlas

1. **Build and start it** (see [Getting started](#getting-started) for Node.js and pnpm):

   ```bash
   pnpm --filter @nexora/codeatlas-web build
   pnpm --filter @nexora/codeatlas-service start   # prints http://127.0.0.1:4317/#token=…
   ```

2. **Open the printed address** and choose **Add your first repository**. Enter the absolute path of a local clone and choose **Add and index**. Indexing a large repository takes from a few seconds to under a minute (Kubernetes, 31,746 files: about 40 s).
3. **Overview** shows the coverage summary and the **Languages & files** section: start there to see what was and was not analysed, and why.
4. **Brain** draws the architecture in 3D. Click a lobe to go inside, click a class, method or table for its details, use **Diagrams** for ER, schema and class diagrams, and **Languages & files** for the inventory.
5. **Structure, Modules, Dependencies, Flows, Integrations, Risk, Ownership and Knowledge** explore the code; **Search** and **Ask** answer questions with numbered citations; **Investigate** takes a bug report to a reviewed patch in a separate git worktree.

Everything also works from the command line:

```bash
pnpm --filter @nexora/codeatlas-service cli index /abs/path/to/repo
pnpm --filter @nexora/codeatlas-service cli brain /abs/path/to/repo --out brain.html   # one offline HTML file
pnpm --filter @nexora/codeatlas-service cli search <repoId> "query"
```

`cli brain` prints the coverage sentence and a table of languages, and the HTML file opens in any browser with no server. Use absolute paths: `pnpm --filter` runs the command from the package folder. Ollama is optional; without a model, **Ask** returns the relevant evidence instead of a written answer.

## ArchLens

ArchLens is a Claude Code skill in [`skills/archlens/`](skills/archlens/README.md). It does the same evidence work as CodeAtlas, in conversation: every architectural claim is tagged `[observed]`, `[inferred]` or `[unknown]` and cited to `path:line`.

- **Install:** copy `skills/archlens/` to `~/.claude/skills/archlens/` (every project) or `<project>/.claude/skills/archlens/` (one project). In the Claude app, zip the `archlens` folder and upload it under Settings → Capabilities → Skills. The folder holds 20 files, well under the app's limit of 200 (the indexer's grammars and libraries ship packed in one file, ADR 0023).
- **Use:** run `/archlens <question>` or just ask about a repository's architecture, for example "trace what happens when a user logs in" or "what breaks if I change the orders table?".
- **Architecture brain:** ask for "an architecture brain of https://github.com/owner/repo". ArchLens clones it and runs the CodeAtlas indexer bundled in `scripts/brain/` with Node alone (22.5 or later, no install and no network), so the brain has exactly what CodeAtlas finds: every language, table, view, procedure, build file, configuration key and document. It returns one offline HTML file with the 3D brain, the database tables and ER, schema and class diagrams.
- **Coverage:** the brain's **Languages & files** section counts every file with the same registry and says what was fully analysed, partially analysed or not read, and why. When Node is not available, ArchLens writes the model by hand and labels every file it read "partially analysed".

The full guide, with every step and command, is in the [ArchLens README](skills/archlens/README.md). The brain format is in [`references/brain-model.md`](skills/archlens/references/brain-model.md).

## Getting started

### Requirements

- Node.js 22.13 or later and pnpm 10 (the ArchLens brain script alone needs Node.js 22.5 or later)
- Ollama, optional, for written answers, module overviews and model-proposed patches

### Install

```bash
git clone <this repository> codeatlas
cd codeatlas
pnpm install
```

### Run CodeAtlas

```bash
pnpm --filter @nexora/codeatlas-web build
pnpm --filter @nexora/codeatlas-service start              # prints http://127.0.0.1:4317/#token=…
pnpm --filter @nexora/codeatlas-service cli index /abs/path/to/repo   # or add the repository in the UI
```

Open the printed address. The token in the address is how the browser proves it is you; the page removes it from the address bar after reading it.

### Use or rebuild ArchLens

```bash
cp -r skills/archlens ~/.claude/skills/archlens          # Claude Code
(cd skills && zip -r ../archlens-skill.zip archlens)     # zip to upload in the Claude app
node skills/archlens/scripts/check.mjs                  # structure check
node skills/archlens/scripts/brain/brain.mjs /abs/path/to/repo --out repo-brain.html --json brain-model.json
pnpm --filter @nexora/codeatlas-service skill           # rebuild the bundled indexer after changing CodeAtlas
```

## Configuration

CodeAtlas reads its environment directly (see [`products/codeatlas/service/.env.example`](products/codeatlas/service/.env.example)):

| Variable                                                             | Purpose                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `CODEATLAS_HOME`                                                     | Data folder (default `~/.codeatlas`)                                |
| `CODEATLAS_PORT`                                                     | Port on 127.0.0.1 (default 4317)                                    |
| `CODEATLAS_ALLOWED_ROOTS`                                            | Folders repositories may be registered from (empty: any local path) |
| `AI_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`                     | Local model                                                         |
| `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_MODEL`, `AI_REMOTE_CONSENT` | Hosted model; source is sent only when `AI_REMOTE_CONSENT=true`     |

`infrastructure/local-development/docker-compose.yml` starts Ollama on 127.0.0.1 if you want a local model in Docker.

## Architecture

```
packages/                shared libraries: ai (model providers), logging, validation,
                         languages (language and file-type registry, file inventory),
                         syntax (tree-sitter grammars and extraction rules for 71 languages),
                         sql (PostgreSQL parser and statement reader for other dialects),
                         orm (ORM models and migrations of 23 frameworks), scip (SCIP index reader),
                         brain (3D architecture brain viewer used by CodeAtlas and ArchLens)
products/codeatlas/
  core/                  indexer, SQLite store, queries, chat, investigations
  service/               local HTTP API and CLI; builds the ArchLens bundle
  web/                   Vite + React UI
skills/archlens/         ArchLens skill, with the CodeAtlas indexer bundled in scripts/brain/
infrastructure/          optional docker compose for Ollama
documentation/           product, architecture, API, security, operations and testing docs
```

Domain logic is pure and lives in `core`; persistence and policy live in services; UI and route handlers stay thin. Significant decisions are recorded as ADRs in [`documentation/architecture/`](documentation/architecture/ARCHITECTURE_DECISIONS.md).

## Tech stack

| Area                 | Technology                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language and tooling | TypeScript 5.9.3 (strict, ESM), Node.js 22.13 or later, pnpm 10.28, ESLint 10, Prettier 3.9, vitest 5.1, Playwright 1.63 with axe-core                                                                        |
| Store and service    | SQLite with FTS5 through `node:sqlite`, `node:http` on 127.0.0.1, zod 4.6                                                                                                                                     |
| Analysis             | TypeScript Compiler API 5.9.3, web-tree-sitter 0.27.1 with 71 grammars built from pinned commits, libpg-query 18.2.2 (PostgreSQL's parser), yaml 2.9, smol-toml 1.9, GitHub Linguist 9.7.0 data, SCIP indexes |
| Web                  | Vite 8.3, React 19.3, Tailwind CSS 4.3, cytoscape 3.34, React Flow 12.12                                                                                                                                      |
| Architecture brain   | three.js 0.186.1, one self-contained HTML file                                                                                                                                                                |
| ArchLens bundle      | esbuild 0.28.2 bundles the indexer into `skills/archlens/scripts/brain/brain.mjs`                                                                                                                             |
| AI (optional)        | Ollama or an OpenAI-compatible endpoint; never required                                                                                                                                                       |

## Quality gates

```bash
pnpm check                                  # typecheck + lint + unit and integration tests
pnpm format:check
node skills/archlens/scripts/check.mjs
pnpm --filter @nexora/codeatlas-web build && pnpm --filter @nexora/codeatlas-web e2e
pnpm audit --prod
```

CI runs all of these on every pull request and on `main`. `pnpm --filter @nexora/codeatlas-web screenshots` regenerates the screenshots in `documentation/assets/screenshots/`.

## Ground rules

- Source code stays local by default. Hosted models are used only when configured **and** the user consents.
- CodeAtlas never approves or merges on its own: a fast-forward merge happens only after a human approves the exact patch hash and types it back. It runs only allowlisted commands in isolated worktrees.

## Licence

[Apache License 2.0](LICENSE), inherited from NEXORA. Copyright and third-party notices: [NOTICE](NOTICE). Security reports: see [SECURITY.md](SECURITY.md). Contributions: see [CONTRIBUTING.md](CONTRIBUTING.md).

The licence covers the code, not the names: "CodeAtlas", "ArchLens" and "Nexora" are not licensed for others' use (Apache-2.0 §6). ArchLens works with Anthropic's Claude but is not made or endorsed by Anthropic. The legal and licensing review, which is not legal advice, is [docs/legal/LEGAL_REVIEW.md](docs/legal/LEGAL_REVIEW.md).
