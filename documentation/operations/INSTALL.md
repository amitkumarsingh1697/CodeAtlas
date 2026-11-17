# Installing CodeAtlas (PKG-001)

This file is shipped inside each CodeAtlas archive. The archive holds everything CodeAtlas needs: its own Node.js runtime, the service, and the web UI. It does not install anything outside the folder you extract it to, and it does not need Node.js, pnpm or network access on your machine.

Archives exist for Linux (x64, arm64) and macOS (Apple silicon, Intel). Only Linux x64 is tested: CI builds and installs it on every change. The other three targets are built from the same script but have not been tested; macOS in particular has no CI run yet.

## Install

1. Check the archive against the checksum you were given:
   ```bash
   sha256sum -c SHA256SUMS        # Linux
   shasum -a 256 -c SHA256SUMS    # macOS
   ```
2. Extract it wherever you like, for example in your home folder:
   ```bash
   tar -xzf codeatlas-<version>-<os>-<arch>.tar.gz -C ~/
   ```
3. Run it from that folder, or add its `bin` folder to your `PATH`:
   ```bash
   ~/codeatlas-<version>-<os>-<arch>/bin/codeatlas
   ```

On macOS, a downloaded archive may be marked as quarantined, and the bundled `node` binary is not signed by us. If macOS refuses to run it, remove the quarantine flag from the extracted folder: `xattr -dr com.apple.quarantine ~/codeatlas-<version>-darwin-arm64`.

## Use

```bash
codeatlas serve                                     # web UI at http://127.0.0.1:4317/#token=…
codeatlas assessment /path/to/repo --out assessment.json [--exclude pattern]…
codeatlas brain /path/to/repo --out brain.html
codeatlas support-bundle --out support.json         # diagnostics without source, paths or secrets
```

An installed copy only indexes folders inside your home folder. To allow others, set `CODEATLAS_ALLOWED_ROOTS` to a comma-separated list of folders. Data is kept in `~/.codeatlas`, readable by you only. Set `CODEATLAS_HOME` to keep it somewhere else.

## Upgrade

Extract the new archive next to the old one, then delete the old folder. The data in `~/.codeatlas` is kept and migrated on first use.

## Uninstall and delete your data

```bash
rm -rf ~/codeatlas-<version>-<os>-<arch>   # the program
rm -rf ~/.codeatlas                         # the index, including copies of source text
```

Everything else CodeAtlas creates is inside `~/.codeatlas` too: repositories cloned from a URL you entered (`clones/`) and investigation worktrees (`worktrees/`). An investigation also registers its worktree in the repository's own `.git` folder; `git worktree prune` in that repository removes the entry once the folder is gone. Files you asked for with `--out` are where you put them.

## What is inside

| Path                                          | What it is                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `bin/codeatlas`                               | Launcher                                                                 |
| `runtime/bin/node`, `runtime/NODE-LICENSE`    | Node.js, from nodejs.org, checked against its published SHA-256 at build |
| `app/`                                        | The CodeAtlas service and its production dependencies                    |
| `web/`                                        | The web UI                                                               |
| `sbom.cdx.json`                               | CycloneDX SBOM of the npm packages                                       |
| `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md` | Licences                                                                 |
