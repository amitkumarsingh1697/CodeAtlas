/** Runs the framework route adapters over the indexed files (FW-001, ADR 0025). */
import type { DiscoveredFile } from '../files';
import type { GraphBuilder } from '../model';
import { jaxrsAdapter } from './jaxrs';
import { nestAdapter } from './nestjs';
import { springAdapter } from './spring';
import { stringConstants } from './annotations';
import type {
  AdapterFile,
  DeclView,
  RepositoryRouteAdapter,
  RouteAdapter,
  RouteFinding,
  RouteGap,
} from './types';

export const ROUTE_ADAPTERS: (RouteAdapter | RepositoryRouteAdapter)[] = [
  springAdapter,
  nestAdapter,
  jaxrsAdapter,
];

export interface RouteAdapterStats {
  id: string;
  name: string;
  files: number;
  routes: number;
  gaps: number;
}

export function runRouteAdapters(
  graph: GraphBuilder,
  files: DiscoveredFile[],
  texts: Map<string, string>,
  moduleOf: (path: string) => string,
  adapters: (RouteAdapter | RepositoryRouteAdapter)[] = ROUTE_ADAPTERS,
): RouteAdapterStats[] {
  const declsByFile = new Map<string, DeclView[]>();
  for (const n of graph.nodes.values()) {
    if (n.kind !== 'symbol' || !n.filePath || !n.startLine) continue;
    const l = declsByFile.get(n.filePath) ?? [];
    l.push({ key: n.key, name: n.name, kind: n.symbolKind ?? '', line: n.startLine });
    declsByFile.set(n.filePath, l);
  }
  // Constants are read only from files an adapter will read, plus every TS/Java file that
  // declares an enum or string constant; the scan is a regular expression, not a parse.
  const constants = stringConstants(
    files
      .filter((f) => /^(TypeScript|JavaScript|Java|Kotlin)$/.test(f.language))
      .map((f) => ({ path: f.path, language: f.language, text: texts.get(f.path) ?? '' }))
      .filter((f) => /\benum\b|\bconst\b|static\s+final\s+String/.test(f.text)),
  );
  const stats: RouteAdapterStats[] = [];
  for (const a of adapters) {
    const s: RouteAdapterStats = { id: a.id, name: a.name, files: 0, routes: 0, gaps: 0 };
    const gap = (file: string, g: RouteGap) => {
      s.gaps++;
      graph.addUnresolved({
        filePath: file,
        line: g.line,
        kind: 'route_handler',
        text: g.text,
        reason: `${a.name}: ${g.reason}`,
      });
    };
    const route = (file: string, x: RouteFinding) => {
      let key = `${x.verb} ${x.path}`;
      const prev = graph.get({ kind: 'route', key });
      if (prev && prev.filePath !== file) key = `${key} (${file})`;
      const node = graph.addNode({
        kind: 'route',
        key,
        name: `${x.verb} ${x.path}`,
        filePath: file,
        module: moduleOf(file),
        startLine: x.line,
        data: { method: x.verb, path: x.path, framework: a.id },
      });
      graph.addEdge({
        kind: 'handled_by',
        method: x.rule,
        src: node,
        dst: { kind: 'symbol', key: x.handlerKey },
        confidence: x.confidence,
        evidencePath: file,
        evidenceLine: x.line,
        detail: x.detail,
      });
      s.routes++;
    };
    const applicable: AdapterFile[] = [];
    for (const f of files) {
      if (!a.languages.includes(f.language)) continue;
      const text = texts.get(f.path);
      const declarations = declsByFile.get(f.path);
      if (!text || !declarations || !a.applies(text)) continue;
      s.files++;
      applicable.push({ path: f.path, text, declarations });
    }
    if ('repositoryRoutes' in a) {
      const r = a.repositoryRoutes(applicable, constants);
      for (const g of r.gaps) gap(g.file, g);
      for (const x of r.routes) route(x.file, x);
    } else
      for (const f of applicable) {
        const r = a.routes({ ...f, constants });
        for (const g of r.gaps) gap(f.path, g);
        for (const x of r.routes) route(f.path, x);
      }
    stats.push(s);
  }
  return stats;
}
