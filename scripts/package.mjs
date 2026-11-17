#!/usr/bin/env node
// PKG-001 (ADR 0028): builds one installable archive for the machine it runs on:
//   dist/package/codeatlas-<version>-<os>-<arch>.tar.gz  and  SHA256SUMS beside it.
// The archive holds a pinned Node.js runtime (scripts/lib/node-runtime.json, checksum verified),
// the CodeAtlas service with its production dependencies (pnpm deploy), the built web UI, a
// `bin/codeatlas` launcher, the licences and notices, and a CycloneDX SBOM of what it contains.
//   node scripts/package.mjs [--node-archive file]   (offline: a Node archive already downloaded)
// It must run on the target OS and CPU, because some dependencies ship native binaries (esbuild,
// used by tsx at run time). It needs the network only to download Node, unless --node-archive is
// given. It publishes nothing.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { arch, platform } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib/runtime-deps.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--node-archive');
const localNode = at >= 0 ? args[at + 1] : undefined;

const runtime = JSON.parse(readFileSync(join(ROOT, 'scripts/lib/node-runtime.json'), 'utf8'));
const target = `${platform()}-${arch()}`;
const pin = runtime.targets[target];
if (!pin)
  throw new Error(
    `No pinned Node.js runtime for ${target}; supported: ${Object.keys(runtime.targets).join(', ')}`,
  );
const version = JSON.parse(
  readFileSync(join(ROOT, 'products/codeatlas/service/package.json'), 'utf8'),
).version;
const name = `codeatlas-${version}-${target}`;
const OUT = join(ROOT, 'dist/package');
const WORK = join(OUT, 'work');
const APP = join(WORK, name);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: 'inherit', ...opts });

const webDist = join(ROOT, 'products/codeatlas/web/dist');
if (!existsSync(join(webDist, 'index.html')))
  throw new Error('The web UI is not built: run pnpm --filter @nexora/codeatlas-web build');

rmSync(WORK, { recursive: true, force: true });
mkdirSync(APP, { recursive: true });

// 1. Node.js runtime, checked against the pinned SHA-256 before anything is extracted.
const archive = localNode ?? join(WORK, pin.file);
if (!localNode) {
  const url = `https://nodejs.org/dist/v${runtime.version}/${pin.file}`;
  process.stdout.write(`Downloading ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
}
const got = sha256(readFileSync(archive));
if (got !== pin.sha256)
  throw new Error(`Node.js archive checksum mismatch: expected ${pin.sha256}, got ${got}`);
const nodeDir = pin.file.replace(/\.tar\.(xz|gz)$/u, '');
run('tar', ['-xf', archive, '-C', WORK, `${nodeDir}/bin/node`, `${nodeDir}/LICENSE`]);
mkdirSync(join(APP, 'runtime/bin'), { recursive: true });
cpSync(join(WORK, nodeDir, 'bin/node'), join(APP, 'runtime/bin/node'));
cpSync(join(WORK, nodeDir, 'LICENSE'), join(APP, 'runtime/NODE-LICENSE'));

// 2. The service and its production dependencies, as pnpm would install them.
run(
  'pnpm',
  ['--filter', '@nexora/codeatlas-service', 'deploy', '--prod', '--legacy', join(APP, 'app')],
  {
    cwd: ROOT,
  },
);
for (const p of ['test', 'scripts', 'vitest.config.ts'])
  rmSync(join(APP, 'app', p), { recursive: true, force: true });

// 3. Web UI, launcher, licences, notices, install guide and SBOM.
cpSync(webDist, join(APP, 'web'), { recursive: true });
mkdirSync(join(APP, 'bin'));
writeFileSync(
  join(APP, 'bin/codeatlas'),
  `#!/bin/sh
# CodeAtlas launcher (PKG-001). Runs the bundled Node.js; nothing outside this folder is needed.
set -e
here="$(cd "$(dirname "$0")/.." && pwd -P)"
export CODEATLAS_PACKAGED=1
export CODEATLAS_WEB_DIR="\${CODEATLAS_WEB_DIR:-$here/web}"
# --import takes a URL; resolving "tsx" would search the current folder, not this one.
loader="file://$(printf '%s' "$here/app/node_modules/tsx/dist/loader.mjs" | sed 's/%/%25/g; s/ /%20/g')"
exec "$here/runtime/bin/node" --no-warnings --import "$loader" "$here/app/src/cli.ts" "$@"
`,
);
chmodSync(join(APP, 'bin/codeatlas'), 0o755);
for (const f of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md'])
  cpSync(join(ROOT, f), join(APP, f));
cpSync(join(ROOT, 'documentation/operations/INSTALL.md'), join(APP, 'INSTALL.md'));
writeFileSync(join(APP, 'VERSION'), `${version}\nnode ${runtime.version}\n${target}\n`);
run(process.execPath, [join(ROOT, 'scripts/sbom.mjs'), '--out', join(APP, 'sbom.cdx.json')], {
  cwd: ROOT,
});

// 4. The archive and its checksum.
const tarball = join(OUT, `${name}.tar.gz`);
run('tar', ['-czf', tarball, '-C', WORK, name]);
const sum = `${sha256(readFileSync(tarball))}  ${name}.tar.gz\n`;
writeFileSync(join(OUT, 'SHA256SUMS'), sum);
rmSync(WORK, { recursive: true, force: true });
process.stdout.write(`Wrote ${tarball}\n${sum}`);
