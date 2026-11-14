import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexRepository, openDb } from '../src';
import { symbolCategory } from '../src/indexer/symbol-category';

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-counts-'));
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  }
  return root;
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
${Array.from({ length: 40 }, (_, i) => `  <g id="g${i}"><path d="M0 0L${i} ${i}"/></g>`).join('\n')}
</svg>
`;

const JAVA = `package com.acme;

public class OwnerService {
    private final OwnerRepository repo;

    public OwnerService(OwnerRepository repo) {
        this.repo = repo;
    }

    public Owner find(int id) {
        return repo.findById(id);
    }
}
`;

describe('code symbols exclude markup, documents and configuration (ACC-007)', () => {
  it('classifies symbol kinds', () => {
    expect(symbolCategory('method')).toBe('code');
    expect(symbolCategory('class')).toBe('code');
    expect(symbolCategory('element')).toBe('markup');
    expect(symbolCategory('key')).toBe('configuration');
    expect(symbolCategory('ci-job')).toBe('configuration');
    expect(symbolCategory('android-activity')).toBe('configuration');
    expect(symbolCategory('heading')).toBe('documentation');
  });

  it('counts Java declarations as code and SVG elements as markup', () => {
    const root = repo({
      'src/main/java/com/acme/OwnerService.java': JAVA,
      'src/main/resources/static/logo.svg': SVG,
      'config/app.yml': 'server:\n  port: 8080\nspring:\n  profiles: dev\n',
      'README.md': '# Demo\n\n## Run\n',
    });
    const db = openDb(':memory:');
    const r = indexRepository(db, root);
    const stored = db.prepare("SELECT symbol_kind AS k FROM nodes WHERE kind = 'symbol'").all() as {
      k: string;
    }[];
    const kinds = (cat: string) => stored.filter((s) => symbolCategory(s.k) === cat).length;

    // Java declarations are code even though no adapter in DEFAULT_ADAPTERS reads Java.
    expect(r.symbols).toBe(kinds('code'));
    expect(r.symbols).toBeGreaterThanOrEqual(3); // class, constructor, method
    expect(r.symbolsByCategory.markup).toBe(kinds('markup'));
    expect(r.symbolsByCategory.markup).toBeGreaterThan(r.symbols);
    expect(r.symbolsByCategory.configuration).toBe(kinds('configuration'));
    expect(r.symbolsByCategory.documentation).toBe(kinds('documentation'));
    const all = Object.values(r.symbolsByCategory).reduce((a, b) => a + b, 0);
    expect(all).toBe(stored.length);
  });

  it('gives one analysed-file number: the files block agrees with the inventory', () => {
    const root = repo({
      'src/main/java/com/acme/OwnerService.java': JAVA,
      'src/index.ts': 'export const x = 1;\n',
    });
    const r = indexRepository(openDb(':memory:'), root);
    expect(r.files.structurallyAnalysed).toBe(r.inventory.analysed);
    expect(r.files.byLang.Java).toBe(1);
    expect(r.files.byLang.text).toBeUndefined();
    expect(r.files.textOnlyByExtension['.java']).toBeUndefined();
  });
});

describe('file-count limit is visible (ACC-009)', () => {
  const files = Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [`src/f${i}.ts`, `export const v${i} = ${i};\n`]),
  );

  it('reports files read against files in the repository and warns when the limit applied', () => {
    const r = indexRepository(openDb(':memory:'), repo(files), { limits: { maxFiles: 4 } });
    expect(r.fileLimit).toEqual({
      maxFiles: 4,
      filesRead: 4,
      filesInRepository: 6,
      filesBeyondLimit: 2,
      reached: true,
    });
    expect(r.inventory.summary).toMatch(
      /^Warning: the 4-file limit stopped this run\. Only 4 of 6 files in the repository were read/,
    );
    expect(r.limitations[0]).toMatch(/^Warning: the 4-file limit/);
  });

  it('stays quiet when every file was read, and accepts no limit at all', () => {
    const r = indexRepository(openDb(':memory:'), repo(files), {
      limits: { maxFiles: Infinity },
    });
    expect(r.fileLimit).toMatchObject({ maxFiles: null, filesRead: 6, reached: false });
    expect(r.inventory.summary).not.toMatch(/Warning/);
  });
});
