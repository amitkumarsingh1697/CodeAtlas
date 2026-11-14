/** `assessment <path>`: index a repository and write assessment data model v1 as JSON (REP-001). */
import { buildAssessment, indexRepository, type Db } from '@nexora/codeatlas-core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { takeFlag } from './brain-command';
import { parseIndexArgs } from './index-command';

export const ASSESSMENT_USAGE = 'assessment <path> [--out model.json] [--max-files n|all]';

export function writeAssessment(db: Db, argv: string[], print: (t: string) => void): string {
  const args = [...argv];
  const out = takeFlag(args, '--out');
  const { root, scip, maxFiles } = parseIndexArgs(args);
  const report = indexRepository(db, root, {
    onProgress: (m) => process.stderr.write(`… ${m}\n`),
    scip,
    ...(maxFiles === undefined ? {} : { limits: { maxFiles } }),
  });
  const model = buildAssessment(db, report.repoId);
  const file = resolve(out ?? `${model.scope.repository || 'repository'}-assessment.json`);
  writeFileSync(file, `${JSON.stringify(model, null, 2)}\n`);
  print(
    `Assessment data model v${model.modelVersion}: ${model.coverage.analysed} of ${model.coverage.filesInRepository} files analysed, ${model.evidence.total} relationships, ${model.architecture.routes.length} routes, ${model.architecture.tables.length} tables.\nWritten to ${file}\n`,
  );
  return file;
}
