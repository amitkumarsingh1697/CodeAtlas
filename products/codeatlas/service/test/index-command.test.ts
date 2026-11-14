// `cli index` arguments and its file-limit notice (ACC-009), including one real CLI run.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { limitNotice, parseIndexArgs } from '../src/index-command';

const service = fileURLToPath(new URL('..', import.meta.url));

describe('parseIndexArgs', () => {
  it('keeps the default limit when no flag is given', () => {
    expect(parseIndexArgs(['/repo'])).toEqual({ root: '/repo', scip: { files: [], run: false } });
  });

  it('reads --max-files as a number or "all", wherever it appears', () => {
    expect(parseIndexArgs(['--max-files', '50000', '/repo']).maxFiles).toBe(50000);
    expect(parseIndexArgs(['/repo', '--max-files', 'all']).maxFiles).toBe(Infinity);
    expect(parseIndexArgs(['/repo', '--max-files', '10', '--run-indexers'])).toMatchObject({
      root: '/repo',
      maxFiles: 10,
      scip: { run: true },
    });
  });

  it('rejects a limit that is not a positive whole number, and a missing path', () => {
    for (const bad of ['0', '-5', '2.5', 'lots'])
      expect(() => parseIndexArgs(['/repo', '--max-files', bad])).toThrow(/positive whole number/);
    expect(() => parseIndexArgs(['/repo', '--max-files'])).toThrow(/needs a value/);
    expect(() => parseIndexArgs([])).toThrow(/usage/);
  });
});

describe('limitNotice', () => {
  it('is empty when every file was read', () => {
    expect(limitNotice({ reached: false, filesRead: 5, filesInRepository: 5 })).toBe('');
  });
  it('names both numbers when the limit applied', () => {
    expect(limitNotice({ reached: true, filesRead: 20000, filesInRepository: 44522 })).toMatch(
      /^WARNING: only 20,000 of 44,522 files were read/,
    );
  });
});

describe('codeatlas index --max-files (real run)', () => {
  it('prints both numbers and the warning when the limit cuts the run', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-limit-'));
    mkdirSync(join(root, 'src'));
    for (let i = 0; i < 5; i++)
      writeFileSync(join(root, 'src', `f${i}.ts`), `export const v = ${i};\n`);
    execFileSync('git', ['init', '-q', root]);
    const home = mkdtempSync(join(tmpdir(), 'cli-limit-home-'));
    const run = spawnSync(
      process.execPath,
      ['--no-warnings', '--import', 'tsx', 'src/cli.ts', 'index', root, '--max-files', '3'],
      { cwd: service, env: { ...process.env, CODEATLAS_HOME: home }, encoding: 'utf8' },
    );
    expect(run.status, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout) as {
      fileLimit: { filesRead: number; filesInRepository: number; reached: boolean };
      inventory: { summary: string };
    };
    expect(report.fileLimit).toMatchObject({ filesRead: 3, filesInRepository: 5, reached: true });
    expect(report.inventory.summary).toMatch(/^Warning: the 3-file limit stopped this run/);
    expect(run.stderr).toMatch(/WARNING: only 3 of 5 files were read/);
  }, 60_000);
});
