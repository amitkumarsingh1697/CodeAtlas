/**
 * Puts the Maven and Gradle module model (JV-001) into the graph: one `module` node per module,
 * a `depends_on` edge per declared module dependency (rule `build.module-dependency`), and a
 * check of every resolved import between two build modules against the declared dependencies.
 */
import { dependencyClosure, type BuildModel, type BuildModule } from './build-modules';
import type { GraphBuilder } from './model';

export interface BuildModuleNode {
  key: string;
  dir: string;
  module: BuildModule;
}

export interface BuildModuleStats {
  maven: number;
  gradle: number;
  /** Distinct module pairs with a declared dependency. */
  dependencies: number;
  /** Project dependencies that name no module of the build (recorded as `config` gaps). */
  unresolved: number;
  /** Resolved imports from a file in one build module to a file in another. */
  crossModuleImports: number;
  /** Of those, imports whose target module is not among the declared dependencies (direct, transitive or inherited). */
  undeclaredImports: number;
  /** The module pairs behind them, most imports first (at most 20). */
  undeclared: {
    from: string;
    to: string;
    imports: number;
    example: { path: string; line?: number };
  }[];
}

/** Module keys: the module name, or `name (folder)` when another module already has the name. */
export function buildModuleNodes(
  model: BuildModel,
  takenNames: Set<string>,
  takenDirs: Set<string>,
): BuildModuleNode[] {
  const out: BuildModuleNode[] = [];
  const names = new Set(takenNames);
  const dup = new Map<string, number>();
  for (const m of model.modules) dup.set(m.name, (dup.get(m.name) ?? 0) + 1);
  for (const m of model.modules) {
    if (takenDirs.has(m.dir)) continue;
    const key =
      names.has(m.name) || (dup.get(m.name) ?? 0) > 1 ? `${m.name} (${m.dir || '.'})` : m.name;
    names.add(key);
    out.push({ key, dir: m.dir, module: m });
  }
  return out;
}

export function addBuildModuleLinks(
  graph: GraphBuilder,
  model: BuildModel,
  nodes: BuildModuleNode[],
): BuildModuleStats {
  const keyOf = new Map(nodes.map((n) => [n.dir, n.key]));
  const dirOf = new Map(nodes.map((n) => [n.key, n.dir]));
  const pairs = new Set<string>();
  for (const d of model.dependencies) {
    const src = keyOf.get(d.from);
    const dst = keyOf.get(d.to);
    if (!src || !dst || src === dst) continue;
    pairs.add(`${src}\u0000${dst}`);
    graph.addEdge({
      kind: 'depends_on',
      method: 'build.module-dependency',
      src: { kind: 'module', key: src },
      dst: { kind: 'module', key: dst },
      confidence: d.confidence,
      evidencePath: d.path,
      evidenceLine: d.line,
      detail: `${d.scope} dependency on ${dst}`,
    });
  }
  for (const u of model.unresolved)
    graph.addUnresolved({
      filePath: u.path,
      line: u.line,
      kind: 'config',
      text: u.text,
      reason: u.reason,
    });

  const closure = dependencyClosure(model);
  let cross = 0;
  let undeclared = 0;
  const byPair = new Map<string, BuildModuleStats['undeclared'][number]>();
  for (const e of graph.edges) {
    if (e.kind !== 'imports' || e.src.kind !== 'file' || e.dst.kind !== 'file') continue;
    const a = graph.get(e.src)?.module;
    const b = graph.get(e.dst)?.module;
    if (!a || !b || a === b) continue;
    const da = dirOf.get(a);
    const db = dirOf.get(b);
    if (da === undefined || db === undefined) continue;
    cross++;
    if (closure.get(da)?.has(db)) continue;
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
  return {
    maven: nodes.filter((n) => n.module.build === 'maven').length,
    gradle: nodes.filter((n) => n.module.build === 'gradle').length,
    dependencies: pairs.size,
    unresolved: model.unresolved.length,
    crossModuleImports: cross,
    undeclaredImports: undeclared,
    undeclared: [...byPair.values()]
      .sort(
        (x, y) => y.imports - x.imports || `${x.from} ${x.to}`.localeCompare(`${y.from} ${y.to}`),
      )
      .slice(0, 20),
  };
}
