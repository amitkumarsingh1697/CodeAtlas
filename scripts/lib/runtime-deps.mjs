// The run-time npm dependency tree of every workspace package, read from `pnpm list --prod`
// and the installed package.json files. No network access. Used by third-party-notices.mjs
// (LIC-001) and sbom.mjs (PKG-005).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * `pkgs`: installed external packages with licence, source and licence files; `platformOnly`:
 * packages installed only on some systems (`os` or `cpu` field), as `name version`; `projects`:
 * workspace packages; `edges`: `name@version` → the `name@version` ids it depends on.
 */
export function runtimeDependencies() {
  const tree = JSON.parse(
    execFileSync('pnpm', ['list', '--prod', '-r', '--json', '--depth', 'Infinity'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  const found = new Map();
  const walk = (deps) => {
    for (const [name, d] of Object.entries(deps ?? {})) {
      const id = `${name}@${d.version}`;
      if (found.has(id)) continue;
      found.set(id, { name, version: d.version, path: d.path });
      walk(d.dependencies);
    }
  };
  for (const project of tree) walk(project.dependencies);

  const files = (dir, re) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => re.test(f))
          .sort()
      : [];
  // Platform-specific optional packages (an `os` or `cpu` field, such as fsevents) are installed
  // only on some systems; they are listed by name so the file is the same on every machine.
  const external = [...found.values()].filter(
    (p) => !p.name.startsWith('@nexora/') && p.path && !p.version.startsWith('link:'),
  );
  const metaOf = (p) => {
    const f = join(p.path, 'package.json');
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  };
  const platformOnly = external
    .filter((p) => {
      const m = metaOf(p);
      return !m || m.os || m.cpu;
    })
    .map((p) => `${p.name} ${p.version}`)
    .sort();
  const pkgs = external
    .filter((p) => !platformOnly.includes(`${p.name} ${p.version}`))
    .map((p) => {
      const meta = metaOf(p);
      const license =
        typeof meta.license === 'string'
          ? meta.license
          : (meta.license?.type ?? meta.licenses?.map((l) => l.type).join(' OR ') ?? 'UNKNOWN');
      const repo = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;
      return {
        ...p,
        license,
        repository: (repo ?? meta.homepage ?? '').replace(/^git\+/u, '').replace(/\.git$/u, ''),
        licenseFiles: files(p.path, /^(LICEN[CS]E|COPYING)(\.(md|txt))?$/iu),
        notices: files(p.path, /^NOTICE/iu).map((f) =>
          readFileSync(join(p.path, f), 'utf8').trim(),
        ),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  const edges = new Map();
  const link = (from, deps) => {
    for (const [name, d] of Object.entries(deps ?? {})) {
      const id = `${name}@${d.version}`;
      const set = edges.get(from) ?? new Set();
      set.add(id);
      edges.set(from, set);
      if (!edges.has(id)) {
        edges.set(id, new Set());
        link(id, d.dependencies);
      }
    }
  };
  const projects = tree.map((p) => ({ name: p.name, version: p.version, path: p.path }));
  for (const p of tree) link(`${p.name}@${p.version}`, p.dependencies);
  return { pkgs, platformOnly, projects, edges };
}
