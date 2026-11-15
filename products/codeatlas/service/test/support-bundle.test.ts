// PKG-007: the support bundle holds versions, settings and counts, never source, paths or secrets.
import { indexRepository, openDb } from '@nexora/codeatlas-core';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeFixtureRepo } from '../../core/test/fixture';
import { loadServiceConfig } from '../src/config';
import { createSessionToken } from '../src/server';
import { redactDiagnostic, supportBundle } from '../src/support-bundle';

let root: string;
let home: string;
let token: string;
const KEY = 'sk-test-0123456789abcdef0123456789';

beforeAll(() => {
  root = makeFixtureRepo();
  home = mkdtempSync(join(tmpdir(), 'ca-support-'));
  token = createSessionToken(home);
  const db = openDb(join(home, 'codeatlas.db'));
  indexRepository(db, root);
  // A failed run whose message names the repository and carries a secret-looking value.
  db.prepare(
    "INSERT INTO index_runs (repo_id, started_at, finished_at, status, error) VALUES (1, '2026-11-15T00:00:00Z', '2026-11-15T00:00:01Z', 'failed', ?)",
  ).run(`ENOENT: no such file ${join(root, 'src/secret.ts')} password=hunter2\nsecond line`);
  db.close();
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

const cfgFor = (env: Record<string, string> = {}) =>
  loadServiceConfig({ CODEATLAS_HOME: home, AI_PROVIDER: 'disabled', ...env });

describe('support bundle', () => {
  it('reports versions, settings, the data folder and per-repository counts', () => {
    const b = supportBundle(cfgFor());
    expect(b.format).toBe('codeatlas-support-bundle');
    expect(b.engine.schemaVersion).toBeGreaterThan(0);
    expect(b.environment.node).toBe(process.version);
    expect(b.dataFolder).toMatchObject({ mode: '0700', database: true, tokenFile: true });
    expect(b.repositories).toHaveLength(1);
    const r = b.repositories[0]!;
    expect(r.counts.files).toBeGreaterThan(0);
    expect(r.counts.symbols).toBeGreaterThan(0);
    expect(r.runs.map((x) => x.status)).toEqual(expect.arrayContaining(['succeeded', 'failed']));
  });

  it('contains no source text, repository names, paths, token or API key', () => {
    const text = JSON.stringify(
      supportBundle(
        cfgFor({
          AI_PROVIDER: 'openai-compatible',
          OPENAI_COMPAT_BASE_URL: 'https://models.internal.example/v1',
          OPENAI_COMPAT_MODEL: 'm',
          OPENAI_COMPAT_API_KEY: KEY,
        }),
      ),
    );
    for (const s of [
      root,
      basename(root),
      home,
      homedir(),
      token,
      KEY,
      'hunter2',
      'models.internal.example',
      'listUsers', // a function name in the fixture's source
      'second line',
    ])
      expect(text, s).not.toContain(s);
    expect(text).toContain('"apiKeySet":true');
    expect(text).toContain('"endpoint":"remote"');
  });

  it('keeps the first line of an error, with paths and secret-looking values removed', () => {
    const err = supportBundle(cfgFor()).repositories[0]!.runs.find((x) => x.status === 'failed')!;
    expect(err.error).toBe('ENOENT: no such file <path> password=<redacted>');
  });

  it('redacts Windows paths, home-relative paths and long messages', () => {
    expect(redactDiagnostic('open C:\\Users\\a\\x.ts failed', [])).toBe('open <path> failed');
    expect(redactDiagnostic('read ~/work/app/x.ts', [])).toBe('read <path>');
    expect(redactDiagnostic('token: abc.def-ghi', [])).toBe('token: <redacted>');
    expect(redactDiagnostic('x'.repeat(500), [])).toHaveLength(201);
  });

  it('works on an empty data folder', () => {
    const empty = mkdtempSync(join(tmpdir(), 'ca-support-empty-'));
    const b = supportBundle(loadServiceConfig({ CODEATLAS_HOME: empty, AI_PROVIDER: 'disabled' }));
    expect(b.repositories).toEqual([]);
    expect(b.dataFolder.database).toBe(false);
    rmSync(empty, { recursive: true, force: true });
  });

  it('is written by the CLI to the given file', () => {
    const out = join(home, 'bundle.json');
    const r = spawnSync(
      process.execPath,
      ['--no-warnings', '--import', 'tsx', 'src/cli.ts', 'support-bundle', '--out', out],
      { env: { ...process.env, CODEATLAS_HOME: home, AI_PROVIDER: 'disabled' }, encoding: 'utf8' },
    );
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(readFileSync(out, 'utf8')).format).toBe('codeatlas-support-bundle');
    expect(r.stdout).toContain('Read it before sending it');
  });
});
