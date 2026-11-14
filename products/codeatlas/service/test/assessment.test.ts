// REP-001 over HTTP and the CLI: GET /api/repos/:id/assessment and `codeatlas assessment`.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessmentModelSchema, indexRepository, openDb } from '@nexora/codeatlas-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeFixtureRepo } from '../../core/test/fixture';
import { startService, type TestService } from './helpers';

const service = fileURLToPath(new URL('..', import.meta.url));
let svc: TestService;
let root: string;

beforeAll(async () => {
  root = makeFixtureRepo();
  svc = await startService();
});
afterAll(async () => {
  await svc.close();
  rmSync(root, { recursive: true, force: true });
});

describe('GET /api/repos/:id/assessment', () => {
  it('answers the validated model, 409 without a successful index, 404 for no repository', async () => {
    const reg = await svc.api<{ repo: { id: number }; job: { id: string } }>('/api/repos', {
      method: 'POST',
      body: { path: root },
    });
    const id = reg.body.repo.id;
    await svc.waitForJob(reg.body.job.id);
    const ok = await svc.api('/api/repos/' + id + '/assessment');
    expect(ok.status).toBe(200);
    expect(assessmentModelSchema.parse(ok.body).modelVersion).toBe(1);
    expect(JSON.stringify(ok.body)).not.toContain(root);
    svc.ctx.db.prepare("UPDATE index_runs SET status = 'failed' WHERE repo_id = ?").run(id);
    const none = await svc.api<{ error: { code: string } }>('/api/repos/' + id + '/assessment');
    expect(none.status).toBe(409);
    expect(none.body.error.code).toBe('NO_ASSESSMENT');
    expect((await svc.api('/api/repos/99999/assessment')).status).toBe(404);
  });
});

describe('codeatlas assessment (real run)', () => {
  it('indexes the repository and writes the model as JSON', () => {
    const repo = makeFixtureRepo();
    const home = mkdtempSync(join(tmpdir(), 'cli-assess-home-'));
    const out = join(mkdtempSync(join(tmpdir(), 'cli-assess-out-')), 'model.json');
    const run = spawnSync(
      process.execPath,
      ['--no-warnings', '--import', 'tsx', 'src/cli.ts', 'assessment', repo, '--out', out],
      { cwd: service, env: { ...process.env, CODEATLAS_HOME: home }, encoding: 'utf8' },
    );
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^Assessment data model v1: \d+ of \d+ files analysed/);
    const model = assessmentModelSchema.parse(JSON.parse(readFileSync(out, 'utf8')));
    // Same figures as a direct index of the same tree.
    const direct = indexRepository(openDb(':memory:'), repo);
    expect(model.coverage.filesInRepository).toBe(direct.inventory.total);
  }, 120_000);
});
