# ADR 0028: Installable archive with a bundled Node.js runtime

- Status: accepted
- Date: 2026-11-16
- Decision owner: founder (chosen on the PKG-001 decision card, 2026-11-16)

## Context

Package document 10 asks for a local CLI installed "from signed release or verified package", with uninstall and data deletion documented, and release artifacts only for tested platforms. Until now CodeAtlas was installed from source with git, pnpm and Node.js 22, and needed the network for `pnpm install`. Clients run assessments on their own machines (PKG-006), often with restricted network access.

Options considered: an npm package (`npx codeatlas`; needs a public npm publish, and the client still needs Node.js 22), an install script that clones and runs `pnpm install` (needs the network and pnpm on the client machine), and an archive per operating system with its own Node.js runtime.

## Decision

1. One `.tar.gz` archive per operating system and CPU, built by `scripts/package.mjs` on that platform. It holds:
   - a pinned Node.js runtime from nodejs.org, checked against its published SHA-256 (`scripts/lib/node-runtime.json`);
   - the service and its production dependencies (`pnpm deploy --prod`);
   - the built web UI;
   - the launcher `bin/codeatlas`, which sets `CODEATLAS_PACKAGED=1` (allowed roots default to the home folder, PKG-002);
   - `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, Node.js's licence, a CycloneDX SBOM and `INSTALL.md`.
2. A `SHA256SUMS` file is written beside each archive.
3. CI builds and installs the archive on Linux x64 (`ubuntu-24.04`) and macOS arm64 (`macos-14`) on every change (`scripts/package-smoke.sh`). Linux arm64 and macOS x64 have pinned runtimes but are not tested, so they are not offered.
4. Nothing is uploaded or published. A release, signing and where archives are hosted are separate founder decisions.

## Consequences

- The client needs nothing installed, and no network access, to run CodeAtlas.
- The archive is about 75 MB, and about 216 MB once extracted (Linux x64, 2026-11-16). Most of that is Node.js, TypeScript (used by the indexer) and the tree-sitter grammars.
- The service still runs TypeScript source through `tsx` at run time, as in development. Bundling it into one file (as the ArchLens skill does) would shrink the archive, but it was not needed for this decision.
- The bundled `node` binary is the one nodejs.org publishes. On macOS it is not notarised by us, so a downloaded archive may need its quarantine flag removed (`INSTALL.md`). Signing and notarisation wait for the release decision.
- Windows is not supported.
