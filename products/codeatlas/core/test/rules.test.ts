// GRAPH-001: every stored relationship names the rule that produced it, and the rule
// catalogue document is generated from the rule table.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { indexRepository, openDb } from '../src';
import { RULES, ruleCatalogueMarkdown, type RuleId } from '../src/indexer/rules';
import { makeFixtureRepo } from './fixture';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-rules-'));
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  }
  return root;
}

const MIXED = {
  'pom.xml':
    '<project><groupId>com.acme</groupId><artifactId>app</artifactId><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency></dependencies></project>\n',
  'src/main/java/com/acme/Owner.java':
    'package com.acme;\n\nimport jakarta.persistence.Entity;\nimport jakarta.persistence.Table;\n\n@Entity\n@Table(name = "owners")\npublic class Owner {\n    private Integer id;\n    public Integer getId() { return id; }\n}\n',
  'src/main/java/com/acme/OwnerRepository.java':
    'package com.acme;\n\nimport org.springframework.data.repository.Repository;\n\npublic interface OwnerRepository extends Repository<Owner, Integer> {\n    Owner findById(Integer id);\n}\n',
  'src/main/java/com/acme/OwnerService.java':
    'package com.acme;\n\npublic class OwnerService extends Base {\n    private final OwnerRepository repo;\n    public OwnerService(OwnerRepository repo) { this.repo = repo; }\n    public Owner find(int id) { return helper(repo.findById(id)); }\n    private Owner helper(Owner o) { return o; }\n}\nclass Base {}\n',
  'tools/report.py':
    'from tools import util\n\ndef report():\n    return util.total()\n\nclass Job:\n    def run(self):\n        return self.step()\n    def step(self):\n        return report()\n',
  'tools/util.py': 'def total():\n    return 1\n',
  'db/schema.sql':
    'CREATE TABLE owners (id int primary key);\nCREATE TABLE pets (id int primary key, owner_id int references owners(id));\nCREATE INDEX pets_owner ON pets(owner_id);\nCREATE FUNCTION count_pets() RETURNS int AS $$ SELECT count(*) FROM pets; $$ LANGUAGE sql;\n',
  'config/app.yml': 'server:\n  port: 8080\n',
  'README.md': '# Demo\n\nSee `tools/report.py`.\n\n## Run\n',
};

function edgesOf(db: ReturnType<typeof openDb>) {
  return db.prepare('SELECT kind, confidence, method, adapter FROM edges').all() as {
    kind: string;
    confidence: string;
    method: string | null;
    adapter: string | null;
  }[];
}

describe('every relationship names its rule (GRAPH-001)', () => {
  for (const [name, root] of [
    ['TypeScript fixture', () => makeFixtureRepo()],
    ['Java, Python, SQL, YAML and Markdown', () => repo(MIXED)],
  ] as const)
    it(`${name}: method is a catalogue rule, adapter matches, label is one the rule can give`, () => {
      const db = openDb(':memory:');
      indexRepository(db, root());
      const edges = edgesOf(db);
      expect(edges.length).toBeGreaterThan(10);
      for (const e of edges) {
        expect(e.method, `${e.kind} edge without a method`).not.toBeNull();
        const rule = RULES[e.method as RuleId];
        expect(rule, `unknown rule ${e.method}`).toBeDefined();
        expect(e.adapter).toBe(rule.adapter);
        expect(rule.labels as readonly string[], `${e.method} gave ${e.confidence}`).toContain(
          e.confidence,
        );
      }
    });

  it('names the expected rules on the mixed repository', () => {
    const db = openDb(':memory:');
    indexRepository(db, repo(MIXED));
    const methods = new Set(edgesOf(db).map((e) => e.method));
    for (const m of [
      'core.module-contains-file',
      'syntax.declaration-nesting',
      'syntax.call.self-member',
      'syntax.base.same-file',
      'orm.entity-table',
      'orm.repository-table',
      'sql.table-attachment',
      'schema.foreign-key',
      'docs.section-nesting',
      'docs.path-mention',
      'structured.nesting',
    ])
      expect(methods, m).toContain(m);
  });
});

describe('rule catalogue', () => {
  it('the committed document is generated from the rule table', () => {
    const doc = readFileSync(
      join(repoRoot, 'documentation/architecture/RULE_CATALOGUE.md'),
      'utf8',
    );
    // Prettier may realign the table; compare the rows' content, not their padding.
    const norm = (s: string) =>
      s
        .split('\n')
        .map((l) =>
          l
            .replace(/\s*\|\s*/g, '|')
            .replace(/\|-+/g, '|-')
            .trim(),
        )
        .filter(Boolean)
        .join('\n');
    expect(norm(doc)).toBe(norm(ruleCatalogueMarkdown()));
  });
});

describe('schema v9 migration', () => {
  it('adds method and adapter to an existing edges table', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'codeatlas-v8-')), 'old.db');
    const old = new DatabaseSync(file);
    old.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO meta VALUES ('schema_version', '8');
      CREATE TABLE edges (id INTEGER PRIMARY KEY, repo_id INTEGER NOT NULL, src INTEGER NOT NULL,
        dst INTEGER NOT NULL, kind TEXT NOT NULL, confidence TEXT NOT NULL, evidence_path TEXT,
        evidence_line INTEGER, detail TEXT);
      INSERT INTO edges (repo_id, src, dst, kind, confidence) VALUES (1, 1, 2, 'calls', 'observed');`);
    old.close();
    const db = openDb(file);
    const cols = (db.prepare('PRAGMA table_info(edges)').all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(cols).toEqual(expect.arrayContaining(['method', 'adapter']));
    expect(db.prepare('SELECT method FROM edges').get()).toEqual({ method: null });
  });
});
