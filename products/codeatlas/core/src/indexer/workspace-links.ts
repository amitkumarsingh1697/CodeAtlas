/**
 * npm, pnpm and Yarn workspace packages (TS-005): each package.json is a module already; this adds a
 * `depends_on` edge per dependency on another package of the repository (rule
 * `npm.workspace-dependency`) and checks every resolved import between two packages against them.
 */
import type { GraphBuilder } from './model';
import type { PackageInfo } from './ts-indexer';

export interface WorkspaceStats {
  packages: number;
  /** Distinct package pairs with a declared dependency. */
  dependencies: number;
  /** Resolved imports from a file of one package to a file of another. */
  crossPackageImports: number;
  /** Of those, imports whose target package the importing package.json does not list (any scope). */
  undeclaredImports: number;
  /** The package pairs behind them, most imports first (at most 20). */
  undeclared: {
    from: string;
    to: string;
    imports: number;
    example: { path: string; line?: number };
  }[];
}

export function addWorkspaceLinks(graph: GraphBuilder, packages: PackageInfo[]): WorkspaceStats {
  // A name two package.json files share is ambiguous: no dependency is linked to it.
  const count = new Map<string, number>();
  for (const p of packages) count.set(p.name, (count.get(p.name) ?? 0) + 1);
  const names = new Set([...count].filter(([, n]) => n === 1).map(([k]) => k));
  const declared = new Map<string, Set<string>>();
  for (const p of packages) {
    if (!names.has(p.name)) continue;
    const to = new Set<string>();
    for (const d of p.deps ?? []) {
      if (!names.has(d.name) || d.name === p.name) continue;
      if (!to.has(d.name))
        graph.addEdge({
          kind: 'depends_on',
          method: 'npm.workspace-dependency',
          src: { kind: 'module', key: p.name },
          dst: { kind: 'module', key: d.name },
          confidence: 'observed',
          evidencePath: p.dir ? `${p.dir}/package.json` : 'package.json',
          evidenceLine: d.line,
          detail: `${d.scope}: ${d.spec}`,
        });
      to.add(d.name);
    }
    declared.set(p.name, to);
  }

  let cross = 0;
  let undeclared = 0;
  const byPair = new Map<string, WorkspaceStats['undeclared'][number]>();
  for (const e of graph.edges) {
    if (e.kind !== 'imports' || e.src.kind !== 'file' || e.dst.kind !== 'file') continue;
    const a = graph.get(e.src)?.module;
    const b = graph.get(e.dst)?.module;
    if (!a || !b || a === b || !declared.has(a) || !declared.has(b)) continue;
    cross++;
    if (declared.get(a)!.has(b)) continue;
    undeclared++;
    const k = `${a}\u0000${b}`;
    const prev = byPair.get(k);
    if (prev) prev.imports++;
    else
      byPair.set(k, {
        from: a,
        to: b,
        imports: 1,
        example: {
          path: e.evidencePath ?? e.src.key,
          ...(e.evidenceLine ? { line: e.evidenceLine } : {}),
        },
      });
  }
  let pairs = 0;
  for (const s of declared.values()) pairs += s.size;
  return {
    packages: packages.length,
    dependencies: pairs,
    crossPackageImports: cross,
    undeclaredImports: undeclared,
    undeclared: [...byPair.values()]
      .sort(
        (x, y) => y.imports - x.imports || `${x.from} ${x.to}`.localeCompare(`${y.from} ${y.to}`),
      )
      .slice(0, 20),
  };
}
