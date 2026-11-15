# Data flow (PKG-004)

This page lists where data goes when CodeAtlas runs, and how far a test proves it. It describes the code as it stands on 2026-11-15. Storage, retention and the legal open items are in [PRIVACY_AND_DATA_HANDLING.md](PRIVACY_AND_DATA_HANDLING.md).

## 1. Flows

```
  repository on disk ──read──► CodeAtlas (local process) ──write──► CODEATLAS_HOME (SQLite, files)
                                   │        ▲
                 browser on 127.0.0.1 ◄─────┘  (token in the URL fragment; loopback only)
                                   │
      only when the user starts it ├──► model endpoint (default: Ollama on 127.0.0.1)
                                   ├──► git host (public https clone the user asked for)
                                   └──► whatever the repository's own allowlisted scripts do
```

| #   | Flow                                 | Starts when                                               | Data sent                                                                                                              | Destination                                                                                          | Control                                                                                            |
| --- | ------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Read the repository                  | `index`, `assessment` or `brain`, or indexing from the UI | Nothing leaves the machine                                                                                             | Local files only; files with credential-like names are listed but never read                         | The user picks the path; `CODEATLAS_ALLOWED_ROOTS` can restrict it                                 |
| 2   | Store the index                      | Every index run                                           | Nothing leaves the machine                                                                                             | `CODEATLAS_HOME` (default `~/.codeatlas`)                                                            | Remove a repository, or delete local data in Settings                                              |
| 3   | Web UI                               | `serve`                                                   | Index results, to the user's own browser                                                                               | `127.0.0.1` only; Host and Origin checked; session token required                                    | The service binds to loopback                                                                      |
| 4   | Ask a question (AI)                  | A user question while AI is on                            | The question, up to 8 excerpts of at most 60 lines with secret-looking values redacted, related graph facts with paths | The configured model. Default: Ollama at `127.0.0.1:11434`. A remote host is refused without consent | Settings switch, or `AI_PROVIDER=disabled`; `AI_REMOTE_CONSENT=true` is needed for any remote host |
| 5   | Clone a public repository            | The user pastes a repository URL                          | The git protocol request for that repository                                                                           | The git host in the URL (`https` and public addresses only, no credentials)                          | Only on that user action                                                                           |
| 6   | Validate a patch in an investigation | The user asks an investigation to run its checks          | Whatever the repository's scripts send                                                                                 | Unknown: decided by the repository's authors                                                         | Only allowlisted script names run; what they do is not limited                                     |

No telemetry, usage data, crash report or update check is sent anywhere. The web UI loads no fonts, scripts or images from other sites.

## 2. What is proved by test

`scripts/egress-check.sh` runs `index`, `assessment` and `brain` on a repository with two layers of denial:

1. **A Linux network namespace** (`unshare -n`) with no interface but loopback. The script first checks that a direct connection to `1.1.1.1:443` fails inside it, so a namespace that still reaches the internet fails the check.
2. **The egress guard** (`products/codeatlas/service/scripts/egress-guard.mjs`, loaded with `node --import`). It wraps `net` and `tls` connections, `http` and `https` requests, `fetch`, DNS lookups, UDP sends, and `git clone`/`fetch`/`pull`/`push`/`ls-remote` and `curl`/`wget`/`ssh`/package-manager child processes. Each attempt is recorded and refused. Loopback is refused too, because none of these commands needs it.

The check passes only if all three commands exit 0, write non-empty output, and the guard records no attempt. The guard's own test (`products/codeatlas/service/test/egress-guard.test.ts`) proves that each wrapped path is recorded and refused, and that local file reads and `git --version` are not.

| Run                                   | Where                    | Result                                                                               |
| ------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `products/codeatlas/core` (default)   | CI job `egress`, each PR | 101 files analysed, 996 symbols, 1 module; 0 attempts (local run 2026-11-15)         |
| Immich `e5d6eb7` (3,154 files, local) | Local, 2026-11-15        | 3,154 files analysed, 17,905 symbols, 15 modules in the assessment; 0 attempts, 67 s |

Not covered by the egress check:

- **`serve` and the web UI.** The service talks to the browser over loopback, which the guard refuses. Loopback binding and the Host and Origin checks have their own tests (`service.test.ts`).
- **Flows 4 to 6 above.** They need the network by design and run only when the user starts them.
- **`--run-indexers`.** This runs installed SCIP indexers (scip-python, scip-go), which are not part of CodeAtlas and were not tested offline.
- **macOS and Windows.** The namespace layer is Linux only. On other systems only the guard layer could be used, and that has not been run.
- **Native code.** A native add-on could open a socket without going through Node's `net` module. CodeAtlas's own dependencies were not audited for this. The namespace layer still blocks such traffic on Linux.

## 3. Customer data-flow sheet

For a client whose repository is analysed with CodeAtlas, in plain terms:

- **Where the analysis runs.** CodeAtlas runs on the machine where it is installed. Indexing, the assessment model and the offline brain file are produced with no network connection, and a test checks this on every change (section 2).
- **What is stored.** The index lives in one folder (`CODEATLAS_HOME`) on that machine. It holds the structure of the code, copies of source text for search, and git author names (not email addresses). Deleting the folder deletes everything.
- **What can leave the machine, and only if someone turns it on.**
  - Questions to an AI model. The default model runs on the same machine (Ollama), and a model on another host needs explicit consent.
  - Cloning a public repository the user names.
  - The repository's own test scripts, when an investigation is asked to run them.
- **What never leaves.** Telemetry, usage data and crash reports: CodeAtlas has none of these.
- **When the founder's business runs the assessment for a client,** the business holds the client's code during the engagement. Contract terms, retention and deletion for that service are still open items in [PRIVACY_AND_DATA_HANDLING.md](PRIVACY_AND_DATA_HANDLING.md) and must be settled before the first paid delivery.
