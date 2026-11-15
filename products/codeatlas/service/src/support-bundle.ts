/**
 * PKG-007: a support bundle with safe diagnostics. It holds versions, settings, the state of the
 * data folder and, per repository, counts and index-run outcomes. It never holds source text,
 * repository names or paths, file paths, the session token, API keys or model endpoints. Error
 * messages keep their first line only, with paths and secret-looking values removed.
 */
import { ENGINE_VERSION } from '@nexora/codeatlas-core';
import { existsSync, statSync } from 'node:fs';
import { arch, cpus, homedir, platform, totalmem } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ServiceConfig } from './config';

const MAX_ERROR = 200;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * One line of a diagnostic message, safe to send: the known strings (repository roots and names,
 * the data folder) and anything shaped like a path become `<path>`, and values after words such as
 * password or token become `<redacted>`.
 */
export function redactDiagnostic(text: string, known: string[]): string {
  let s = text.split(/\r?\n/u)[0] ?? '';
  for (const k of [...known].filter(Boolean).sort((a, b) => b.length - a.length))
    s = s.split(k).join('<path>');
  s = s
    .replace(/(?<=^|[\s'"(=])(?:[A-Za-z]:\\|~\/|\/)[^\s'"(),;]*/gu, '<path>')
    .replace(/<path>(?:[\\/][^\s'"(),;]*)?/gu, '<path>')
    .replace(
      /(\b(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|bearer)\b\s*[=:]?\s*)(?!<)\S+/giu,
      '$1<redacted>',
    )
    .replace(/\b(?:sk|ghp|gho|github_pat|xox[abp])[-_][A-Za-z0-9_-]{12,}/gu, '<redacted>');
  return s.length > MAX_ERROR ? `${s.slice(0, MAX_ERROR)}…` : s;
}

function endpointKind(url: string | undefined): 'loopback' | 'remote' | 'none' {
  if (!url) return 'none';
  try {
    return LOOPBACK.has(new URL(url).hostname) ? 'loopback' : 'remote';
  } catch {
    return 'remote';
  }
}

interface RunRow {
  status: string;
  started_at: string;
  duration_ms: number | null;
  engine_version: string | null;
  schema_version: number | null;
  scan_policy_hash: string | null;
  error: string | null;
}

export function supportBundle(cfg: ServiceConfig) {
  const dbFile = join(cfg.home, 'codeatlas.db');
  const homeExists = existsSync(cfg.home);
  const repositories: {
    id: number;
    lastIndexedAt: string | null;
    counts: { files: number; symbols: number; relationships: number; unresolved: number };
    runs: {
      status: string;
      startedAt: string;
      durationMs: number | null;
      engineVersion: string | null;
      schemaVersion: number | null;
      scanPolicyHash: string | null;
      error: string | null;
    }[];
  }[] = [];
  let schemaVersion: number | null = null;
  if (existsSync(dbFile)) {
    // Read-only: collecting diagnostics must not migrate or change the user's index.
    const db = new DatabaseSync(dbFile, { readOnly: true });
    try {
      const v = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
        { value: string } | undefined;
      schemaVersion = v ? Number(v.value) : null;
      const repos = db
        .prepare('SELECT id, root, name, last_indexed_at FROM repos ORDER BY id')
        .all() as { id: number; root: string; name: string; last_indexed_at: string | null }[];
      const known = [...repos.flatMap((r) => [r.root, r.name]), cfg.home, homedir()];
      const count = (sql: string, id: number) =>
        Number((db.prepare(sql).get(id) as { n: number }).n);
      for (const r of repos) {
        const runs = db
          .prepare(
            'SELECT status, started_at, duration_ms, engine_version, schema_version, scan_policy_hash, error FROM index_runs WHERE repo_id = ? ORDER BY id DESC LIMIT 10',
          )
          .all(r.id) as unknown as RunRow[];
        repositories.push({
          id: r.id,
          lastIndexedAt: r.last_indexed_at,
          counts: {
            files: count('SELECT COUNT(*) AS n FROM file_inventory WHERE repo_id = ?', r.id),
            symbols: count(
              "SELECT COUNT(*) AS n FROM nodes WHERE repo_id = ? AND kind = 'symbol'",
              r.id,
            ),
            relationships: count('SELECT COUNT(*) AS n FROM edges WHERE repo_id = ?', r.id),
            unresolved: count('SELECT COUNT(*) AS n FROM unresolved WHERE repo_id = ?', r.id),
          },
          runs: runs.map((x) => ({
            status: x.status,
            startedAt: x.started_at,
            durationMs: x.duration_ms,
            engineVersion: x.engine_version,
            schemaVersion: x.schema_version,
            scanPolicyHash: x.scan_policy_hash,
            error: x.error === null ? null : redactDiagnostic(x.error, known),
          })),
        });
      }
    } finally {
      db.close();
    }
  }
  const ai = cfg.ai;
  return {
    format: 'codeatlas-support-bundle' as const,
    version: 1,
    generatedAt: new Date().toISOString(),
    engine: { engineVersion: ENGINE_VERSION, schemaVersion },
    environment: {
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpus: cpus().length,
      memoryMiB: Math.round(totalmem() / 2 ** 20),
    },
    config: {
      port: cfg.port,
      allowedRoots: cfg.allowedRoots.length,
      packaged: process.env.CODEATLAS_PACKAGED === '1',
      ai: {
        provider: ai.AI_PROVIDER,
        model: ai.AI_PROVIDER === 'ollama' ? ai.OLLAMA_MODEL : (ai.OPENAI_COMPAT_MODEL ?? null),
        endpoint:
          ai.AI_PROVIDER === 'disabled'
            ? 'none'
            : endpointKind(
                ai.AI_PROVIDER === 'ollama' ? ai.OLLAMA_BASE_URL : ai.OPENAI_COMPAT_BASE_URL,
              ),
        apiKeySet: Boolean(ai.OPENAI_COMPAT_API_KEY),
        remoteConsent: ai.AI_REMOTE_CONSENT === 'true',
      },
    },
    dataFolder: {
      exists: homeExists,
      mode: homeExists ? (statSync(cfg.home).mode & 0o777).toString(8).padStart(4, '0') : null,
      database: existsSync(dbFile),
      databaseMiB: existsSync(dbFile) ? Math.round(statSync(dbFile).size / 2 ** 20) : 0,
      tokenFile: existsSync(join(cfg.home, 'token')),
    },
    repositories,
    leftOut:
      'Source text, repository names and paths, file paths, the session token, API keys and model endpoints are never included. Errors keep their first line, with paths and secret-looking values removed.',
  };
}
