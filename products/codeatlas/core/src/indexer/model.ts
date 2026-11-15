import type { RuleId } from './rules';

export type Confidence = 'observed' | 'inferred' | 'unknown';
export type NodeKind =
  | 'file'
  | 'symbol'
  | 'module'
  | 'external'
  | 'route'
  | 'doc'
  | 'entrypoint'
  | 'config'
  | 'service'
  | 'table';

export interface NodeRec {
  kind: NodeKind;
  key: string;
  name: string;
  filePath?: string;
  module?: string;
  symbolKind?: string;
  exported?: boolean;
  startLine?: number;
  endLine?: number;
  data?: Record<string, unknown>;
}

export interface NodeRef {
  kind: NodeKind;
  key: string;
}

export interface EdgeRec {
  kind: string;
  /** The rule that produced the link (rules.ts, GRAPH-001). */
  method: RuleId;
  src: NodeRef;
  dst: NodeRef;
  confidence: Confidence;
  evidencePath?: string;
  evidenceLine?: number;
  detail?: string;
}

export interface UnresolvedRec {
  filePath: string;
  line: number;
  kind: 'import' | 'call' | 'route_handler' | 'heritage' | 'config';
  text: string;
  reason: string;
}

export interface ChunkRec {
  filePath: string;
  startLine: number;
  endLine: number;
  symbolKey?: string;
  kind: 'code' | 'doc' | 'text';
  body: string;
}

function definedOnly(o: Record<string, unknown> | undefined): Record<string, unknown> {
  return o ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) : {};
}

const RANK: Record<Confidence, number> = { observed: 3, inferred: 2, unknown: 1 };

/** One change to the graph, as recorded for the incremental-indexing cache. */
export type GraphOp =
  | { t: 'n'; n: NodeRec }
  | { t: 'e'; e: EdgeRec }
  | { t: 'u'; u: UnresolvedRec }
  | { t: 'd'; ref: NodeRef; data: Record<string, unknown> };

/** Accumulates the graph, de-duplicating nodes and edges. */
export class GraphBuilder {
  readonly nodes = new Map<string, NodeRec>();
  private readonly edgeMap = new Map<string, EdgeRec & { count: number }>();
  readonly unresolved: UnresolvedRec[] = [];
  readonly chunks: ChunkRec[] = [];
  unresolvedDropped = 0;
  /** Dropped references by kind, so a report can say which kind of gap is incomplete. */
  readonly unresolvedDroppedByKind: Partial<Record<UnresolvedRec['kind'], number>> = {};
  /**
   * Each kind has its own cap (risk T-11): before this, call gaps filled a shared 5,000-entry
   * list on large repositories and every route gap after them was dropped.
   */
  static readonly MAX_UNRESOLVED_PER_KIND = 5000;
  private readonly unresolvedPerKind = new Map<string, number>();
  /** When set, every change is also appended here (copied), so it can be replayed later. */
  recorder: GraphOp[] | null = null;

  static id(ref: NodeRef): string {
    return `${ref.kind}:${ref.key}`;
  }

  addNode(n: NodeRec): NodeRef {
    this.recorder?.push({ t: 'n', n: structuredClone(n) });
    const id = GraphBuilder.id(n);
    const prev = this.nodes.get(id);
    if (prev) {
      // Merge: keep earliest location, union data.
      this.nodes.set(id, {
        ...prev,
        ...Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined)),
        startLine: prev.startLine ?? n.startLine,
        // Undefined values do not erase known ones (e.g. the doc comment on the first
        // overload of a method survives the later, undocumented overloads).
        data: { ...prev.data, ...definedOnly(n.data) },
      });
    } else this.nodes.set(id, n);
    return { kind: n.kind, key: n.key };
  }

  has(ref: NodeRef): boolean {
    return this.nodes.has(GraphBuilder.id(ref));
  }

  get(ref: NodeRef): NodeRec | undefined {
    return this.nodes.get(GraphBuilder.id(ref));
  }

  addEdge(e: EdgeRec): void {
    this.recorder?.push({ t: 'e', e: structuredClone(e) });
    if (GraphBuilder.id(e.src) === GraphBuilder.id(e.dst) && e.kind !== 'calls') return;
    const k = `${e.kind}|${GraphBuilder.id(e.src)}|${GraphBuilder.id(e.dst)}`;
    const prev = this.edgeMap.get(k);
    if (!prev) this.edgeMap.set(k, { ...e, count: 1 });
    else {
      prev.count++;
      if (RANK[e.confidence] > RANK[prev.confidence])
        Object.assign(prev, {
          confidence: e.confidence,
          method: e.method,
          evidencePath: e.evidencePath,
          evidenceLine: e.evidenceLine,
        });
    }
  }

  get edges(): (EdgeRec & { count: number })[] {
    return [...this.edgeMap.values()];
  }

  /** Shallow-merge into a node's data (no-op if the node does not exist). */
  mergeData(ref: NodeRef, data: Record<string, unknown>): void {
    this.recorder?.push({ t: 'd', ref: { ...ref }, data: structuredClone(data) });
    const n = this.get(ref);
    if (n) n.data = { ...n.data, ...definedOnly(data) };
  }

  /** Apply a recorded change. */
  replay(op: GraphOp): void {
    if (op.t === 'n') this.addNode(structuredClone(op.n));
    else if (op.t === 'e') this.addEdge(op.e);
    else if (op.t === 'u') this.addUnresolved(op.u);
    else this.mergeData(op.ref, op.data);
  }

  addUnresolved(u: UnresolvedRec): void {
    this.recorder?.push({ t: 'u', u: { ...u } });
    const n = this.unresolvedPerKind.get(u.kind) ?? 0;
    if (n >= GraphBuilder.MAX_UNRESOLVED_PER_KIND) {
      this.unresolvedDropped++;
      this.unresolvedDroppedByKind[u.kind] = (this.unresolvedDroppedByKind[u.kind] ?? 0) + 1;
      return;
    }
    this.unresolvedPerKind.set(u.kind, n + 1);
    this.unresolved.push({ ...u, text: u.text.slice(0, 200) });
  }
}

/** Split identifiers into search terms: refreshDeviceToken -> "refresh device token". */
const SPLITTABLE = /[_$]|[a-z0-9][A-Z]|[A-Z]{2}[a-z]/;

export function splitTerms(text: string): string {
  const out = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z_$][\w$]{2,}/g)) {
    // Only identifiers with a separator or a case change split into parts; skip the rest cheaply.
    if (!SPLITTABLE.test(m[0])) continue;
    const parts = m[0]
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[\s_$]+/)
      .filter((p) => p.length >= 2);
    if (parts.length > 1) for (const p of parts) out.add(p.toLowerCase());
  }
  return [...out].join(' ');
}
