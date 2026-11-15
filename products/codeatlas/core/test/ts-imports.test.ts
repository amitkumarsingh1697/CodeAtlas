import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { indexRepository, openDb, type Db } from '../src/index';

/**
 * TypeScript import resolution on a monorepo clone with no `node_modules` (TS-001): workspace
 * packages, package.json `imports` (`#lib/*`), tsconfig paths and SvelteKit's `$app/*` modules.
 */
const json = (o: unknown) => JSON.stringify(o, null, 2);
const FILES: Record<string, string> = {
  'package.json': json({ name: 'mono', private: true }),
  'pnpm-workspace.yaml': 'packages:\n  - packages/*\n  - web\n  - server\n',
  // Built entry not in the clone: its source is under src/.
  'packages/sdk/package.json': json({
    name: '@acme/sdk',
    main: './build/index.js',
    types: './build/index.d.ts',
  }),
  'packages/sdk/src/index.ts': 'export const getAlbum = () => 1;\n',
  // Entry that exists as written.
  'packages/util/package.json': json({ name: '@acme/util', exports: { '.': './src/main.ts' } }),
  'packages/util/src/main.ts': 'export const util = 1;\n',
  'packages/util/src/extra.ts': 'export const extra = 1;\n',
  // Nothing to point at but the manifest.
  'packages/bare/package.json': json({ name: '@acme/bare', main: './dist/index.js' }),
  'web/package.json': json({
    name: 'web',
    imports: { '#lib': './src/lib/index.ts', '#lib/*': './src/lib/*' },
    devDependencies: { '@sveltejs/kit': '2.0.0' },
  }),
  'web/tsconfig.json': json({ compilerOptions: { strict: true, paths: { '~/*': ['./src/*'] } } }),
  'web/src/lib/index.ts': 'export const lib = 1;\n',
  'web/src/lib/utils.ts': 'export const u = 1;\n',
  'web/src/lib/other.ts': 'export const a = 1;\n',
  'web/src/lib/font.ttf': 'x',
  'web/src/lib/Button.svelte':
    '<script lang="ts">export let label = "";</script>\n<button>{label}</button>\n',
  'web/src/routes/page.ts': [
    "import { getAlbum } from '@acme/sdk';",
    "import { util } from '@acme/util';",
    "import { extra } from '@acme/util/src/extra';",
    "import * as bare from '@acme/bare';",
    "import { lib } from '#lib';",
    "import { u } from '#lib/utils';",
    "import Button from '#lib/Button.svelte';",
    "import { goto } from '$app/navigation';",
    "import { a } from '~/lib/other';",
    "import { missing } from '#lib/missing';",
    "import fontUrl from '#lib/font.ttf?url';",
    'export const all = [getAlbum, util, extra, bare, lib, u, Button, goto, a, missing, fontUrl];',
    '',
  ].join('\n'),
};

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});
function index(files: Record<string, string>): { db: Db; repoId: number } {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-imports-'));
  roots.push(root);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  const db = openDb(':memory:');
  return { db, repoId: indexRepository(db, root).repoId };
}

describe('TypeScript imports in a monorepo clone (TS-001)', () => {
  const { db, repoId } = index(FILES);
  const edges = (
    db
      .prepare(
        `SELECT d.key, d.kind, e.method, e.confidence, e.evidence_line line FROM edges e
           JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
          WHERE e.repo_id = ? AND e.kind = 'imports' AND s.key = 'web/src/routes/page.ts'
          ORDER BY e.evidence_line`,
      )
      .all(repoId) as {
      key: string;
      kind: string;
      method: string;
      confidence: string;
      line: number;
    }[]
  ).map((e) => `${e.line} ${e.kind}:${e.key} ${e.method} ${e.confidence}`);

  it('links workspace packages to their source, not to an uninstalled package', () => {
    expect(edges.slice(0, 4)).toEqual([
      '1 file:packages/sdk/src/index.ts typescript.import-workspace inferred',
      '2 file:packages/util/src/main.ts typescript.import-workspace observed',
      '3 file:packages/util/src/extra.ts typescript.import-workspace observed',
      '4 file:packages/bare/package.json typescript.import-workspace inferred',
    ]);
  });

  it('resolves package.json imports, tsconfig paths and SvelteKit modules', () => {
    expect(edges.slice(4)).toEqual([
      '5 file:web/src/lib/index.ts typescript.import-resolved observed',
      '6 file:web/src/lib/utils.ts typescript.import-subpath inferred',
      '7 file:web/src/lib/Button.svelte typescript.import-subpath inferred',
      '8 external:@sveltejs/kit typescript.import-framework-module observed',
      '9 file:web/src/lib/other.ts typescript.import-resolved observed',
      '11 file:web/src/lib/font.ttf typescript.import-subpath inferred',
    ]);
    const gaps = db
      .prepare(
        "SELECT line, text, reason FROM unresolved WHERE repo_id = ? AND kind = 'import' AND file_path = 'web/src/routes/page.ts'",
      )
      .all(repoId);
    expect(gaps).toEqual([
      {
        line: 10,
        text: '#lib/missing',
        reason: 'package.json imports entry matched, but no file was found',
      },
    ]);
  });
});

describe('a workspace package beyond the file limit (TS-001)', () => {
  it('records the import as a gap, not as an outside package', () => {
    const root = mkdtempSync(join(tmpdir(), 'codeatlas-imports-'));
    roots.push(root);
    const files: Record<string, string> = {
      'a/package.json': json({ name: 'a' }),
      'a/src/main.ts': "import { z } from 'zz-lib';\nexport const m = z;\n",
      'zz/package.json': json({ name: 'zz-lib', main: './dist/index.js' }),
      'zz/src/index.ts': 'export const z = 1;\n',
    };
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      writeFileSync(join(root, p), c);
    }
    const db = openDb(':memory:');
    const { repoId } = indexRepository(db, root, { limits: { maxFiles: 2 } });
    const gaps = db
      .prepare("SELECT text, reason FROM unresolved WHERE repo_id = ? AND kind = 'import'")
      .all(repoId);
    expect(gaps).toEqual([
      {
        text: 'zz-lib',
        reason: 'a workspace package of this repository whose files were not read (file limit)',
      },
    ]);
    const ext = db
      .prepare(
        "SELECT COUNT(*) n FROM nodes WHERE repo_id = ? AND kind = 'external' AND key = 'zz-lib'",
      )
      .get(repoId) as { n: number };
    expect(ext.n).toBe(0);
  });
});
