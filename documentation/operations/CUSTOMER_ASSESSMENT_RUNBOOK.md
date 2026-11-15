# Customer-operated assessment runbook (PKG-006)

This runbook is for an engineer at a client who runs CodeAtlas on their own machine, so that the client's source code never leaves it. It describes CodeAtlas as it is on 2026-11-15. Where a step is still manual or a feature is missing, the runbook says so.

**What the client produces:** an assessment model (`assessment.json`) and an offline architecture map (`brain.html`). The paid written report is generated from the assessment model in a separate module that does not exist yet (ADR 0030). Until it does, the provider writes the report from the assessment model the client chose to share.

## 1. Before you start

| Check                         | What to confirm                                                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Written authorisation         | The client has authorised analysis of the named repository (statement of work §6).                                                                                                                                                                                |
| Machine                       | Linux or macOS that the client controls. Linux is the tested platform (CI and the network-denied check). macOS is used in development but has no CI run. Windows is not tested.                                                                                   |
| Tools                         | Node.js 22.13 or later, pnpm 10, git.                                                                                                                                                                                                                             |
| Supported stack               | TypeScript/JavaScript with PostgreSQL (see `documentation/product/TS_POSTGRES_CAPABILITY_SHEET.md`) or Java/Spring (`documentation/product/JAVA_CAPABILITY_SHEET.md`). Anything else is indexed for files, structure and git history only.                        |
| Repository                    | A git checkout of the agreed revision. Note the commit; the assessment records it with the number of uncommitted files.                                                                                                                                           |
| Files the client must exclude | CodeAtlas has **no exclusion option yet**. Files with credential-like names (`.env`, keys, keystores and similar) are listed but never read. Anything else the client wants left out must be removed from a copy of the checkout before indexing (see section 3). |

## 2. Install (from source)

There is no installer yet (PKG-001). Install from the source repository:

```bash
git clone https://github.com/amitkumarsingh1697/CodeAtlas.git codeatlas
cd codeatlas
git checkout <release tag or commit agreed with the provider>
pnpm install --frozen-lockfile
```

`pnpm install` is the only step that needs the network. To check what was installed, compare the run-time packages against `THIRD_PARTY_NOTICES.md`, or generate an SBOM with `node scripts/sbom.mjs --out sbom.cdx.json`.

## 3. Prepare the repository

1. Check out the agreed revision.
2. If files must be excluded, make a copy and delete them from it, then index the copy:
   ```bash
   git worktree add ../assessment-copy <commit>
   rm -r ../assessment-copy/<path to exclude>
   ```
   CodeAtlas reports the copy's uncommitted file count, which shows that files were removed.
3. Folders named like build output or dependencies (`node_modules`, `dist`, `build`, `target` and similar) are skipped automatically and reported as excluded.

## 4. Run the analysis with the network off

All commands run from `products/codeatlas/service`. Pick a data folder for this engagement, so that it can be deleted in one step afterwards:

```bash
export CODEATLAS_HOME="$HOME/codeatlas-<client>-<date>"
export AI_PROVIDER=disabled
cd products/codeatlas/service
node --import tsx src/cli.ts assessment /path/to/repository --out assessment.json --max-files all
node --import tsx src/cli.ts brain /path/to/repository --out brain.html --json brain.json
```

- The network is not needed for these commands. To prove that, run them through the network-denied check, which works on Linux only: `scripts/egress-check.sh /path/to/repository` from the repository root. It passes only if nothing tried to connect (`documentation/security/DATA_FLOW.md` §2).
- `AI_PROVIDER=disabled` keeps the AI features off. The assessment and brain do not use a model.
- `--max-files all` reads every file. The default limit is 20,000 files. When the limit cuts a run short, the command prints a warning and the coverage section says so.
- The data folder is created owner-only (0700). It holds the index, including copies of source text for search, and git author names.

## 5. Review the outputs before anything leaves the machine

The client decides what to share. What each file holds:

| File              | Contains                                                                                                                                                                                                          | Source code                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `assessment.json` | Run details (engine version, scan policy, rule catalogue hash, Node version, platform), repository name, branch and commit, coverage, modules and their dependencies, evidence for each finding, unresolved items | File paths and symbol names; no code excerpts                  |
| `brain.json`      | The architecture map as data: regions, symbols, relationships, notes, coverage                                                                                                                                    | File paths, symbol names and **one-line signatures** from code |
| `brain.html`      | `brain.json` with an offline viewer. It makes no network requests                                                                                                                                                 | Same as `brain.json`                                           |
| `CODEATLAS_HOME`  | The full index                                                                                                                                                                                                    | **Copies of source text**: never share this folder             |

Before sharing:

1. Open `brain.html` and `assessment.json` and read them. Search them for names the client treats as confidential, such as internal hostnames, customer names in paths, or project code names.
2. If signatures must not leave the machine, share `assessment.json` only.
3. Share through the channel agreed in the statement of work. CodeAtlas itself sends nothing anywhere.

## 6. Clean up

```bash
rm -rf "$CODEATLAS_HOME"            # the index and every copy of source text
git worktree remove --force ../assessment-copy   # if a copy was made; --force because files were deleted from it
```

Keep or delete `assessment.json`, `brain.json` and `brain.html` as the statement of work says. Retention terms for the provider's copy are still open (`documentation/security/PRIVACY_AND_DATA_HANDLING.md`).

## 7. If something goes wrong

| Symptom                             | What to do                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Out of memory on a large repository | The commands relaunch themselves with a larger heap. If a run still fails, send the provider the last lines of the terminal output after reading them yourself: they can name files and paths. |
| A file is reported as `too_deep`    | Brackets are nested more than 256 levels deep. The file is skipped so the parser does not crash; it is listed in coverage.                                                                     |
| Coverage lower than expected        | Check `coverage.exclusions`, `coverage.limitations` and `coverage.fileLimitReached` in `assessment.json`.                                                                                      |
| `egress-check.sh` exits 2           | The machine cannot create a network namespace. Run without the check, or on another Linux machine.                                                                                             |

**Rehearsal:** sections 3 to 6 were run on 2026-11-15 on a worktree copy of this repository with one folder deleted: both commands exited 0, the data folder was 0700, the assessment recorded the commit and 33 uncommitted files, and `egress-check.sh` recorded 0 outbound attempts (530 files analysed). This was a rehearsal on our own code, not a client run.

**Support bundle.** For any problem, `node --import tsx src/cli.ts support-bundle --out support.json` writes versions, settings, the data folder's state and, per repository, counts and the last ten index-run outcomes. It holds no source text, repository names, paths, token, API keys or model endpoints, and error messages keep only their first line with paths and secret-looking values removed. Read it before sending it.

Not yet available, and tracked separately: an installer (PKG-001) and an exclusion option.
