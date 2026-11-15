// REP-001: assessment data model v1 and run metadata.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AssessmentUnavailable,
  assessmentModelSchema,
  buildAssessment,
  ENGINE_VERSION,
  indexRepository,
  openDb,
} from '../src';
import { makeFixtureRepo } from './fixture';

describe('run metadata on every index run', () => {
  it('records engine and schema versions, scan policy hash and environment', () => {
    const db = openDb(':memory:');
    const r = indexRepository(db, makeFixtureRepo());
    expect(r.run).toMatchObject({
      engineVersion: ENGINE_VERSION,
      schemaVersion: 9,
      scanPolicy: { maxFiles: 20000, incremental: true, adapters: ['typescript'] },
      environment: { node: process.version, platform: process.platform },
    });
    expect(r.run?.scanPolicyHash).toMatch(/^[0-9a-f]{64}$/);
    const row = db
      .prepare('SELECT engine_version, schema_version, scan_policy_hash, metadata FROM index_runs')
      .get() as Record<string, unknown>;
    expect(row).toMatchObject({
      engine_version: ENGINE_VERSION,
      schema_version: 9,
      scan_policy_hash: r.run?.scanPolicyHash,
    });
    expect(JSON.parse(row.metadata as string)).toEqual(r.run);
  });

  it('a different scan policy gives a different hash', () => {
    const root = makeFixtureRepo();
    const a = indexRepository(openDb(':memory:'), root).run!.scanPolicyHash;
    const b = indexRepository(openDb(':memory:'), root, { limits: { maxFiles: 5 } }).run!
      .scanPolicyHash;
    expect(a).not.toBe(b);
  });

  it('the engine version matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(ENGINE_VERSION).toBe(pkg.version);
  });
});

describe('assessment data model v1', () => {
  const root = makeFixtureRepo();
  const db = openDb(':memory:');
  const report = indexRepository(db, root);
  const m = buildAssessment(db, report.repoId, new Date('2026-11-15T00:00:00Z'));

  it('validates against the schema and carries the run', () => {
    expect(assessmentModelSchema.parse(m)).toEqual(m);
    expect(m.modelVersion).toBe(1);
    expect(m.generatedAt).toBe('2026-11-15T00:00:00.000Z');
    expect(m.run.scanPolicyHash).toBe(report.run?.scanPolicyHash);
    expect(m.scope.repository).toBe(report.root.split('/').pop());
  });

  it('evidence counts match the database', () => {
    const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    expect(m.evidence.total).toBe(n('SELECT COUNT(*) AS n FROM edges'));
    const sum = (rows: { observed: number; inferred: number; unknown: number }[]) =>
      rows.reduce((t, r) => t + r.observed + r.inferred + r.unknown, 0);
    expect(sum(m.evidence.byKind)).toBe(m.evidence.total);
    expect(sum(m.evidence.byRule) + m.evidence.withoutRule).toBe(m.evidence.total);
    expect(m.evidence.withoutRule).toBe(0);
    const calls = m.evidence.byKind.find((k) => k.kind === 'calls');
    expect(calls?.observed).toBe(
      n("SELECT COUNT(*) AS n FROM edges WHERE kind = 'calls' AND confidence = 'observed'"),
    );
  });

  it('routes carry their handler, location and evidence class', () => {
    expect(m.architecture.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          route: '/users',
          handler: 'handleUsers',
          evidence: 'inferred',
          path: 'src/server.ts',
          line: expect.any(Number),
        }),
      ]),
    );
  });

  it('coverage agrees with the coverage report and repeats its limitations', () => {
    expect(m.coverage.filesInRepository).toBe(report.inventory.total);
    expect(m.coverage.analysed).toBe(report.files.structurallyAnalysed);
    expect(m.coverage.limitations).toEqual(report.limitations);
    expect(m.unresolved.recorded).toBe(report.unresolvedRecorded);
    expect(m.unresolved.capped).toBe(false);
    expect(m.unresolved.byKind.every((k) => k.dropped === 0)).toBe(true);
  });

  it('never includes the absolute path of the checkout', () => {
    expect(JSON.stringify(m)).not.toContain(report.root);
  });

  it('refuses when there is no usable index', () => {
    const empty = openDb(':memory:');
    expect(() => buildAssessment(empty, 1)).toThrow(AssessmentUnavailable);
    const old = openDb(':memory:');
    const r = indexRepository(old, root);
    old.prepare('UPDATE index_runs SET metadata = NULL').run();
    expect(() => buildAssessment(old, r.repoId)).toThrow(/older CodeAtlas/);
  });
});

describe('assessment tables', () => {
  it('lists each table with its columns and the code that accesses it, by evidence class', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'codeatlas-assess-'));
    const put = (p: string, s: string) => {
      mkdirSync(join(root, p, '..'), { recursive: true });
      writeFileSync(join(root, p), s);
    };
    put('db/schema.sql', 'CREATE TABLE owners (id int primary key, name text);\n');
    put(
      'src/main/java/com/acme/Owner.java',
      'package com.acme;\n\nimport jakarta.persistence.Entity;\nimport jakarta.persistence.Table;\n\n@Entity\n@Table(name = "owners")\npublic class Owner {\n    private Integer id;\n}\n',
    );
    put(
      'src/main/java/com/acme/OwnerRepository.java',
      'package com.acme;\n\nimport org.springframework.data.repository.Repository;\n\npublic interface OwnerRepository extends Repository<Owner, Integer> {\n}\n',
    );
    const db = openDb(':memory:');
    const r = indexRepository(db, root);
    const owners = buildAssessment(db, r.repoId).architecture.tables.find(
      (t) => t.name === 'owners',
    );
    // A bare Repository<T, ID> with no write methods only reads its table (TS-006), so one link.
    expect(owners).toMatchObject({ columns: 2, accessedBy: { observed: 0, inferred: 1 } });
    expect(owners?.path).toMatch(/^(db\/schema\.sql|src\/main\/java\/com\/acme\/Owner\.java)$/);
  });
});
