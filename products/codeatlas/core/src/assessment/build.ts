/**
 * Builds assessment data model v1 from the latest successful index of a repository
 * (REP-001, with the data behind REP-003, REP-004 and REP-005). Pure reads: nothing is written.
 */
import { symbolCategory } from '../indexer/symbol-category';
import type { CoverageReport } from '../indexer/index';
import type { Db } from '../store/db';
import {
  ASSESSMENT_MODEL_VERSION,
  assessmentModelSchema,
  runMetadataSchema,
  type AssessmentModel,
} from './model';

type Conf = 'observed' | 'inferred' | 'unknown';
const zero = () => ({ observed: 0, inferred: 0, unknown: 0 });
const json = (s: unknown): Record<string, unknown> => {
  if (typeof s !== 'string' || !s) return {};
  const v = JSON.parse(s) as unknown;
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
};

export class AssessmentUnavailable extends Error {}

export function buildAssessment(db: Db, repoId: number, now: Date = new Date()): AssessmentModel {
  const repo = db
    .prepare('SELECT name, head_commit, branch FROM repos WHERE id = ?')
    .get(repoId) as { name: string; head_commit: string | null; branch: string | null } | undefined;
  if (!repo) throw new AssessmentUnavailable(`No repository with id ${repoId}.`);
  const run = db
    .prepare(
      "SELECT coverage, metadata FROM index_runs WHERE repo_id = ? AND status = 'succeeded' ORDER BY id DESC LIMIT 1",
    )
    .get(repoId) as { coverage: string | null; metadata: string | null } | undefined;
  if (!run?.coverage) throw new AssessmentUnavailable('The repository has no successful index.');
  if (!run.metadata)
    throw new AssessmentUnavailable(
      'The latest index was made by an older CodeAtlas without run metadata; re-index the repository.',
    );
  const c = JSON.parse(run.coverage) as CoverageReport;
  const meta = runMetadataSchema.parse(JSON.parse(run.metadata));

  // Evidence by relationship kind and by rule.
  const byKind = new Map<string, ReturnType<typeof zero>>();
  const byRule = new Map<string, ReturnType<typeof zero> & { adapter: string }>();
  let total = 0;
  let withoutRule = 0;
  for (const r of db
    .prepare(
      'SELECT kind, method, adapter, confidence, COUNT(*) AS n FROM edges WHERE repo_id = ? GROUP BY kind, method, adapter, confidence',
    )
    .all(repoId) as {
    kind: string;
    method: string | null;
    adapter: string | null;
    confidence: Conf;
    n: number;
  }[]) {
    total += r.n;
    const k = byKind.get(r.kind) ?? zero();
    k[r.confidence] += r.n;
    byKind.set(r.kind, k);
    if (!r.method) {
      withoutRule += r.n;
      continue;
    }
    const m = byRule.get(r.method) ?? { ...zero(), adapter: r.adapter ?? '' };
    m[r.confidence] += r.n;
    byRule.set(r.method, m);
  }

  // Modules: files and code symbols.
  const modules = new Map<string, { files: number; codeSymbols: number }>();
  for (const r of db
    .prepare(
      "SELECT module, kind, symbol_kind FROM nodes WHERE repo_id = ? AND kind IN ('file','symbol')",
    )
    .all(repoId) as { module: string | null; kind: string; symbol_kind: string | null }[]) {
    const name = r.module ?? '(none)';
    const m = modules.get(name) ?? { files: 0, codeSymbols: 0 };
    if (r.kind === 'file') m.files++;
    else if (symbolCategory(r.symbol_kind) === 'code') m.codeSymbols++;
    modules.set(name, m);
  }

  const entryPoints = (
    db
      .prepare(
        "SELECT s.name, e.evidence_path AS path, e.evidence_line AS line, e.confidence FROM edges e JOIN nodes s ON s.id = e.src WHERE e.repo_id = ? AND e.kind = 'starts_at' ORDER BY s.name",
      )
      .all(repoId) as { name: string; path: string | null; line: number | null; confidence: Conf }[]
  ).map((r) => ({ name: r.name, path: r.path ?? '', line: r.line, evidence: r.confidence }));

  const routes = (
    db
      .prepare(
        `SELECT r.name, r.file_path AS path, r.start_line AS line, r.data,
           h.name AS handler, e.confidence
         FROM nodes r
         LEFT JOIN edges e ON e.src = r.id AND e.kind = 'handled_by'
         LEFT JOIN nodes h ON h.id = e.dst
         WHERE r.repo_id = ? AND r.kind = 'route' ORDER BY r.file_path, r.start_line`,
      )
      .all(repoId) as {
      name: string;
      path: string | null;
      line: number | null;
      data: string | null;
      handler: string | null;
      confidence: Conf | null;
    }[]
  ).map((r) => {
    const d = json(r.data);
    return {
      method: typeof d.method === 'string' ? d.method : null,
      route: typeof d.path === 'string' ? d.path : r.name,
      framework: typeof d.framework === 'string' ? d.framework : null,
      handler: r.handler,
      evidence: r.confidence,
      path: r.path ?? '',
      line: r.line,
    };
  });

  const access = new Map<number, ReturnType<typeof zero>>();
  for (const r of db
    .prepare(
      "SELECT dst, confidence, COUNT(*) AS n FROM edges WHERE repo_id = ? AND kind IN ('reads_table','writes_table') GROUP BY dst, confidence",
    )
    .all(repoId) as { dst: number; confidence: Conf; n: number }[]) {
    const a = access.get(r.dst) ?? zero();
    a[r.confidence] += r.n;
    access.set(r.dst, a);
  }
  const tables = (
    db
      .prepare(
        "SELECT id, name, file_path AS path, start_line AS line, data FROM nodes WHERE repo_id = ? AND kind = 'table' ORDER BY name",
      )
      .all(repoId) as {
      id: number;
      name: string;
      path: string | null;
      line: number | null;
      data: string | null;
    }[]
  ).map((t) => {
    const cols = json(t.data).columns;
    return {
      name: t.name,
      path: t.path ?? '',
      line: t.line,
      columns: Array.isArray(cols) ? cols.length : 0,
      accessedBy: access.get(t.id) ?? zero(),
    };
  });

  const integrations = (
    db
      .prepare(
        `SELECT e.kind, d.name AS target, e.evidence_path AS path, e.evidence_line AS line,
           e.confidence, e.method
         FROM edges e JOIN nodes d ON d.id = e.dst
         WHERE e.repo_id = ? AND e.kind IN ('reads_config','writes_config','calls_service','accesses_db')
         ORDER BY e.kind, d.name, e.evidence_path, e.evidence_line`,
      )
      .all(repoId) as {
      kind: string;
      target: string;
      path: string | null;
      line: number | null;
      confidence: Conf;
      method: string | null;
    }[]
  ).map((r) => ({
    kind: r.kind,
    target: r.target,
    path: r.path ?? '',
    line: r.line,
    evidence: r.confidence,
    method: r.method,
  }));

  const unresolvedByKind = db
    .prepare(
      'SELECT kind, COUNT(*) AS count FROM unresolved WHERE repo_id = ? GROUP BY kind ORDER BY count DESC',
    )
    .all(repoId) as { kind: string; count: number }[];
  // Runs indexed before per-kind caps have no breakdown of what was dropped.
  const droppedByKind = c.unresolvedDroppedByKind ?? {};
  const unresolvedKinds = [
    ...unresolvedByKind.map((k) => ({ ...k, dropped: droppedByKind[k.kind] ?? 0 })),
    ...Object.entries(droppedByKind)
      .filter(([kind]) => !unresolvedByKind.some((k) => k.kind === kind))
      .map(([kind, dropped]) => ({ kind, count: 0, dropped: dropped ?? 0 })),
  ];

  const inv = c.inventory;
  const model: AssessmentModel = {
    modelVersion: ASSESSMENT_MODEL_VERSION,
    generatedAt: now.toISOString(),
    run: { ...meta, indexedAt: c.indexedAt, durationMs: c.durationMs },
    scope: {
      repository: repo.name,
      head: repo.head_commit,
      branch: repo.branch,
      uncommittedFiles: c.git.dirtyFiles ?? null,
    },
    coverage: {
      summary: inv.summary,
      filesInRepository: inv.total,
      filesRead: c.fileLimit?.filesRead ?? c.files.discovered,
      analysed: inv.analysed,
      readable: inv.readable,
      coverage: inv.coverage,
      fullCoverage: inv.fullCoverage,
      fileLimitReached: c.fileLimit?.reached ?? false,
      languages: inv.languages.map((l) => ({
        language: l.language,
        files: l.files,
        analysed: l.analysed,
      })),
      exclusions: inv.reasons
        .filter((r) => r.status === 'excluded')
        .map((r) => ({ reason: r.reason, files: r.files })),
      limitations: c.limitations,
    },
    evidence: {
      total,
      byKind: [...byKind]
        .map(([kind, n]) => ({ kind, ...n }))
        .sort((a, b) => a.kind.localeCompare(b.kind)),
      byRule: [...byRule]
        .map(([method, n]) => ({ method, ...n }))
        .sort((a, b) => a.method.localeCompare(b.method)),
      withoutRule,
    },
    architecture: {
      modules: [...modules]
        .map(([name, m]) => ({ name, ...m }))
        .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name)),
      entryPoints,
      routes,
      tables,
      integrations,
    },
    unresolved: {
      recorded: c.unresolvedRecorded,
      dropped: c.unresolvedDropped,
      capped: c.unresolvedDropped > 0,
      byKind: unresolvedKinds,
    },
  };
  return assessmentModelSchema.parse(model);
}
