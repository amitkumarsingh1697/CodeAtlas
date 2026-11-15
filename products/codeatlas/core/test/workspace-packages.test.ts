import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildAssessment, indexRepository, openDb } from '../src/index';

/** npm/pnpm workspace packages as modules with declared dependencies, checked against imports (TS-005). */
const json = (o: unknown) => JSON.stringify(o, null, 2) + '\n';
const FILES: Record<string, string> = {
  'package.json': json({ name: 'mono', private: true }),
  'packages/shared/package.json': json({ name: '@acme/shared', main: './src/index.ts' }),
  'packages/shared/src/index.ts': 'export const shared = 1;\n',
  'packages/ui/package.json': json({
    name: '@acme/ui',
    main: './src/index.ts',
    dependencies: { '@acme/shared': 'workspace:*', react: '18.3.1' },
  }),
  'packages/ui/src/index.ts': "import { shared } from '@acme/shared';\nexport const ui = shared;\n",
  'apps/web/package.json': json({
    name: '@acme/web',
    devDependencies: { '@acme/ui': 'workspace:^' },
  }),
  // ui is declared; shared is not (it only reaches web through ui).
  'apps/web/src/main.ts':
    "import { ui } from '@acme/ui';\nimport { shared } from '@acme/shared';\nimport { x } from '../../../packages/shared/src/index';\nexport const all = [ui, shared, x];\n",
};

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe('workspace packages (TS-005)', () => {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-ws-'));
  roots.push(root);
  for (const [p, c] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  const db = openDb(':memory:');
  const coverage = indexRepository(db, root);
  const { repoId } = coverage;

  it('links each package to the workspace packages its package.json depends on', () => {
    const deps = db
      .prepare(
        `SELECT s.key s, d.key d, e.method m, e.confidence c, e.evidence_path p, e.evidence_line l, e.detail
           FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
          WHERE e.repo_id = ? AND e.kind = 'depends_on' ORDER BY s.key`,
      )
      .all(repoId);
    expect(deps.map((d) => `${d.s} -> ${d.d} ${d.m} ${d.c} ${d.p}:${d.l} ${d.detail}`)).toEqual([
      '@acme/ui -> @acme/shared npm.workspace-dependency observed packages/ui/package.json:5 dependencies: workspace:*',
      '@acme/web -> @acme/ui npm.workspace-dependency observed apps/web/package.json:4 devDependencies: workspace:^',
    ]);
  });

  it('counts imports between packages that their package.json does not declare', () => {
    expect(coverage.workspacePackages).toEqual({
      packages: 4,
      dependencies: 2,
      crossPackageImports: 3,
      undeclaredImports: 1,
      undeclared: [
        {
          from: '@acme/web',
          to: '@acme/shared',
          imports: 1,
          example: { path: 'apps/web/src/main.ts', line: 2 },
        },
      ],
    });
  });

  it('shows packages, their folders and dependencies in the assessment', () => {
    const a = buildAssessment(db, repoId);
    const mods = a.architecture.modules.map((m) => [m.name, m.kind, m.dir, m.dependsOn]);
    expect(mods).toEqual(
      expect.arrayContaining([
        ['@acme/ui', 'npm', 'packages/ui', ['@acme/shared']],
        ['@acme/web', 'npm', 'apps/web', ['@acme/ui']],
        ['@acme/shared', 'npm', 'packages/shared', []],
        ['mono', 'npm', '', []],
      ]),
    );
  });
});
