import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAssessment, buildBrain, indexRepository, openDb, type Db } from '../src/index';

/**
 * PKG-003: the threat-model exercises of package doc 06 §5, run against one hostile repository.
 * Every check looks at everything CodeAtlas stores or exports: the database rows, the
 * assessment model and the brain model.
 */
const OUTSIDE_MARKER = 'OUTSIDE-SENSITIVE-8f3a1c';
const ENV_SECRET = 'ENVFILE-SECRET-77b2e9';
const AWS_KEY = 'AKIAQ3EXAMPLE7ZK4M2P';
const SCRIPT_MARKER = 'script-ran.txt';

let base: string;
let root: string;
let outside: string;
let db: Db;
let repoId: number;
let dump: string;

function put(p: string, content: string | Buffer) {
  mkdirSync(dirname(join(root, p)), { recursive: true });
  writeFileSync(join(root, p), content);
}

/** Everything CodeAtlas persisted for the repository, as one string. */
function everything(): string {
  const tables = [
    'repos',
    'nodes',
    'edges',
    'unresolved',
    'file_inventory',
    'chunks',
    'index_runs',
    'meta',
  ];
  const rows = tables.flatMap((t) => db.prepare(`SELECT * FROM ${t}`).all());
  return JSON.stringify(rows);
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'codeatlas-hostile-'));
  root = join(base, 'repo');
  outside = join(base, 'outside');
  mkdirSync(root);
  mkdirSync(outside);
  writeFileSync(join(outside, 'secret.ts'), `export const leaked = '${OUTSIDE_MARKER}';\n`);
  writeFileSync(join(outside, 'notes.md'), `# ${OUTSIDE_MARKER}\n`);

  put(
    'package.json',
    JSON.stringify({
      name: 'hostile',
      scripts: {
        preinstall: `node -e "require('fs').writeFileSync('${SCRIPT_MARKER}','x')"`,
        postinstall: `node -e "require('fs').writeFileSync('${SCRIPT_MARKER}','x')"`,
        prepare: `node -e "require('fs').writeFileSync('${SCRIPT_MARKER}','x')"`,
        test: `node -e "require('fs').writeFileSync('${SCRIPT_MARKER}','x')"`,
      },
    }),
  );
  put('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }));
  put(
    'src/index.ts',
    [
      "import { leaked } from './linked/secret';",
      "import { other } from './file-link';",
      `export const awsKey = '${AWS_KEY}';`,
      'export function main() { return [leaked, other]; }',
      '',
    ].join('\n'),
  );
  // 1. Symbolic links to a directory and to a file outside the repository.
  symlinkSync(outside, join(root, 'src/linked'));
  symlinkSync(join(outside, 'secret.ts'), join(root, 'src/file-link.ts'));
  symlinkSync(outside, join(root, 'docs-outside'));
  // 2. Secret files and a secret in ordinary config.
  put('.env', `API_TOKEN=${ENV_SECRET}\n`);
  put(
    'config/id_rsa',
    `-----BEGIN OPENSSH PRIVATE KEY-----\n${ENV_SECRET}\n-----END OPENSSH PRIVATE KEY-----\n`,
  );
  // 3. Oversized and deeply nested input.
  put('src/huge.ts', `export const big = '${'x'.repeat(5 * 1024 * 1024)}';\n`);
  put('src/nested.ts', `export const deep = ${'['.repeat(3000)}1${']'.repeat(3000)};\n`);
  put('data/nested.json', `${'['.repeat(3000)}1${']'.repeat(3000)}`);
  put('src/nested-ok.ts', `export const ok = ${'['.repeat(256)}1${']'.repeat(256)};\n`);
  let deepDir = 'deep';
  for (let i = 0; i < 60; i++) deepDir += `/d${i}`;
  put(`${deepDir}/leaf.ts`, 'export const leaf = 1;\n');
  // 4. Malformed files.
  put('src/broken.ts', 'export function ( { class ;;; <<<\n');
  put('src/binary.ts', Buffer.from([0x00, 0xff, 0xfe, 0x00, 0x01, 0x02, 0x00, 0x7f]));
  put(
    'src/bad-utf8.ts',
    Buffer.concat([
      Buffer.from('export const s = "'),
      Buffer.from([0xc3, 0x28, 0xa0, 0xa1]),
      Buffer.from('";\n'),
    ]),
  );
  put('config/broken.json', '{ "a": [1, 2, ');
  put('config/broken.yaml', 'a: [1, 2\n  b: : :\n');
  put('migrations/0001.sql', 'CREATE TABLE ok (id int);\nCREATE TABLE (((;\n');
  // 5. A git hook that would leave a marker if anything ran it.
  execFileSync('git', ['init', '-q'], { cwd: root });
  writeFileSync(join(root, '.git/hooks/post-checkout'), `#!/bin/sh\ntouch ${SCRIPT_MARKER}\n`, {
    mode: 0o755,
  });

  db = openDb(':memory:');
  repoId = indexRepository(db, root).repoId;
  dump =
    everything() +
    JSON.stringify(buildAssessment(db, repoId)) +
    JSON.stringify(buildBrain(db, repoId));
}, 120_000);

afterAll(() => rmSync(base, { recursive: true, force: true }));

function inventory(path: string) {
  return db
    .prepare('SELECT status, reason FROM file_inventory WHERE repo_id = ? AND path = ?')
    .get(repoId, path) as { status: string; reason: string | null } | undefined;
}

describe('hostile repository (PKG-003, doc 06 §5)', () => {
  it('does not follow symbolic links out of the repository, by import or by walking', () => {
    expect(dump).not.toContain(OUTSIDE_MARKER);
    expect(dump).not.toContain(outside);
    for (const p of ['src/linked', 'src/file-link.ts', 'docs-outside']) {
      expect(inventory(p)?.status).toBe('excluded');
      expect(inventory(p)?.reason).toMatch(/symbolic link/);
    }
  });

  it('runs no package script and no git hook', () => {
    expect(existsSync(join(root, SCRIPT_MARKER))).toBe(false);
  });

  it('never reads secret files, and keeps a secret in code out of the assessment and the brain', () => {
    expect(dump).not.toContain(ENV_SECRET);
    expect(JSON.stringify(buildAssessment(db, repoId))).not.toContain(AWS_KEY);
    expect(JSON.stringify(buildBrain(db, repoId))).not.toContain(AWS_KEY);
  });

  it('skips oversized files and survives deep nesting', () => {
    expect(inventory('src/huge.ts')?.reason).toMatch(/per-file limit/);
    expect(
      inventory(`deep/${Array.from({ length: 60 }, (_, i) => `d${i}`).join('/')}/leaf.ts`)?.status,
    ).toBe('full');
    for (const p of ['src/nested.ts', 'data/nested.json']) {
      expect(inventory(p)?.status).toBe('excluded');
      expect(inventory(p)?.reason).toMatch(/nested deeper than 256 levels/);
    }
    expect(inventory('src/nested-ok.ts')?.status).toBe('full');
  });

  it('records malformed files without failing the run', () => {
    for (const p of [
      'src/broken.ts',
      'src/binary.ts',
      'src/bad-utf8.ts',
      'config/broken.json',
      'config/broken.yaml',
      'migrations/0001.sql',
    ])
      expect(inventory(p), p).toBeDefined();
    expect(inventory('src/binary.ts')?.status).toBe('binary');
  });

  it('puts no absolute path in the assessment or the brain, and no path outside the checkout anywhere', () => {
    const exports =
      JSON.stringify(buildAssessment(db, repoId)) + JSON.stringify(buildBrain(db, repoId));
    expect(exports).not.toContain(base);
    // The repository record and the run's coverage report keep the root, so the local service
    // can find the checkout again; no other row may hold an absolute path of the machine.
    const rows = everything().replaceAll(JSON.stringify(root).slice(1, -1), '<root>');
    const at = rows.indexOf(base);
    expect(at === -1 ? '' : rows.slice(Math.max(0, at - 200), at + 120)).toBe('');
  });
});
