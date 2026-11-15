#!/usr/bin/env node
// PKG-005: writes a CycloneDX 1.6 JSON software bill of materials of the run-time npm
// dependencies, and SHA-256 checksums of the files given after --checksum.
//   node scripts/sbom.mjs [--out sbom.cdx.json] [--checksum file…]
// No network access. The SBOM covers npm packages only: the tree-sitter grammars are listed in
// packages/syntax/grammars/MANIFEST.json with their own SHA-256 checksums.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { ROOT, runtimeDependencies } from './lib/runtime-deps.mjs';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT = resolve(outAt >= 0 ? args[outAt + 1] : join(ROOT, 'sbom.cdx.json'));
const checkAt = args.indexOf('--checksum');
const toHash = checkAt >= 0 ? args.slice(checkAt + 1).filter((a) => !a.startsWith('--')) : [];

const { pkgs, projects, edges } = runtimeDependencies();
const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/** Package URL for an npm package: the scope's `@` is percent-encoded (purl spec, npm type). */
const purl = (name, version) =>
  `pkg:npm/${name.startsWith('@') ? `%40${name.slice(1)}` : name}@${version}`;
/** An SPDX expression stays an expression; a single id is an id. */
const licenses = (l) =>
  !l || l === 'UNKNOWN'
    ? undefined
    : /\s(OR|AND|WITH)\s|[()]/u.test(l)
      ? [{ expression: l }]
      : [{ license: { id: l } }];

const known = new Set(pkgs.map((p) => `${p.name}@${p.version}`));
const workspace = projects.filter((p) => p.name !== root.name);
const components = [
  ...workspace.map((p) => ({
    type: 'library',
    'bom-ref': `${p.name}@${p.version}`,
    name: p.name,
    version: p.version,
    licenses: [{ license: { id: 'Apache-2.0' } }],
    description: 'Workspace package of this repository',
  })),
  ...pkgs.map((p) => ({
    type: 'library',
    'bom-ref': `${p.name}@${p.version}`,
    name: p.name,
    version: p.version,
    purl: purl(p.name, p.version),
    ...(licenses(p.license) ? { licenses: licenses(p.license) } : {}),
    ...(p.repository ? { externalReferences: [{ type: 'vcs', url: p.repository }] } : {}),
  })),
];
const refs = new Set([`${root.name}@${root.version}`, ...components.map((c) => c['bom-ref'])]);
const dependencies = [...edges.entries()]
  .filter(([from]) => refs.has(from))
  .map(([from, to]) => ({ ref: from, dependsOn: [...to].filter((t) => refs.has(t)).sort() }))
  .sort((a, b) => a.ref.localeCompare(b.ref));

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: { components: [{ type: 'application', name: 'scripts/sbom.mjs' }] },
    component: {
      type: 'application',
      'bom-ref': `${root.name}@${root.version}`,
      name: root.name,
      version: root.version,
      licenses: [{ license: { id: 'Apache-2.0' } }],
    },
  },
  components,
  dependencies,
};
writeFileSync(OUT, `${JSON.stringify(bom, null, 2)}\n`);
process.stdout.write(
  `Wrote ${OUT}: ${components.length} components (${pkgs.length} npm, ${workspace.length} workspace), ${dependencies.length} dependency entries; ${known.size} npm packages read.\n`,
);

if (toHash.length) {
  // Written beside the SBOM, with paths relative to it, so `sha256sum -c` runs from that folder.
  const sums = join(dirname(OUT), 'SHA256SUMS');
  const lines = toHash.map(
    (f) =>
      `${createHash('sha256').update(readFileSync(f)).digest('hex')}  ${relative(dirname(sums), resolve(f))}`,
  );
  writeFileSync(sums, `${lines.join('\n')}\n`);
  process.stdout.write(`Wrote ${sums} (${lines.length} files; verify with sha256sum -c).\n`);
}
