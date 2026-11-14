/** Runs the framework route adapters over the indexed files (FW-001, ADR 0025). */
import type { DiscoveredFile } from '../files';
import type { GraphBuilder } from '../model';
import { nestAdapter } from './nestjs';
import { springAdapter } from './spring';
import { stringConstants } from './annotations';
import type { DeclView, RouteAdapter } from './types';

export const ROUTE_ADAPTERS: RouteAdapter[] = [springAdapter, nestAdapter];

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
  adapters: RouteAdapter[] = ROUTE_ADAPTERS,
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
    for (const f of files) {
      if (!a.languages.includes(f.language)) continue;
      const text = texts.get(f.path);
      const declarations = declsByFile.get(f.path);
      if (!text || !declarations || !a.applies(text)) continue;
      s.files++;
      const r = a.routes({ path: f.path, text, declarations, constants });
      for (const g of r.gaps) {
        s.gaps++;
        graph.addUnresolved({
          filePath: f.path,
          line: g.line,
          kind: 'route_handler',
          text: g.text,
          reason: `${a.name}: ${g.reason}`,
        });
      }
      for (const x of r.routes) {
        let key = `${x.verb} ${x.path}`;
        const prev = graph.get({ kind: 'route', key });
        if (prev && prev.filePath !== f.path) key = `${key} (${f.path})`;
        const route = graph.addNode({
          kind: 'route',
          key,
          name: `${x.verb} ${x.path}`,
          filePath: f.path,
          module: moduleOf(f.path),
          startLine: x.line,
          data: { method: x.verb, path: x.path, framework: a.id },
        });
        graph.addEdge({
          kind: 'handled_by',
          method: x.rule,
          src: route,
          dst: { kind: 'symbol', key: x.handlerKey },
          confidence: x.confidence,
          evidencePath: f.path,
          evidenceLine: x.line,
          detail: x.detail,
        });
        s.routes++;
      }
    }
    stats.push(s);
  }
  return stats;
}
