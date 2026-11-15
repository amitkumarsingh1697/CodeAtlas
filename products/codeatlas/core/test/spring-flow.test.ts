import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { flowView, indexRepository, openDb, type Db } from '../src/index';

/** JV-005: a route's flow reaches the tables through controller → service → repository. */
const P = 'src/main/java/app';
const j = (...lines: string[]) => lines.join('\n') + '\n';
const FILES: Record<string, string> = {
  [`${P}/Owner.java`]: j(
    'package app;',
    'import jakarta.persistence.*;',
    '@Entity @Table(name = "owners")',
    'public class Owner { @Id Integer id; String lastName; }',
  ),
  [`${P}/OwnerRepository.java`]: j(
    'package app;',
    'import java.util.List;',
    'import org.springframework.data.jpa.repository.JpaRepository;',
    'import org.springframework.data.jpa.repository.Query;',
    'public interface OwnerRepository extends JpaRepository<Owner, Integer> {',
    '  List<Owner> findByLastName(String lastName);',
    '  long deleteByLastName(String lastName);',
    '  @Query("SELECT o FROM Owner o")',
    '  List<Owner> everyone();',
    '  default void helper() {}',
    '}',
  ),
  [`${P}/OwnerService.java`]: j(
    'package app;',
    'import java.util.List;',
    'import org.springframework.stereotype.Service;',
    '@Service',
    'public class OwnerService {',
    '  private final OwnerRepository owners;',
    '  public OwnerService(OwnerRepository owners) { this.owners = owners; }',
    '  public List<Owner> find(String n) { return this.owners.findByLastName(n); }',
    '  public void add(Owner o) { this.owners.save(o); }',
    '}',
  ),
  [`${P}/OwnerController.java`]: j(
    'package app;',
    'import java.util.List;',
    'import org.springframework.web.bind.annotation.*;',
    '@RestController',
    '@RequestMapping("/owners")',
    'public class OwnerController {',
    '  private final OwnerService service;',
    '  public OwnerController(OwnerService service) { this.service = service; }',
    '  @GetMapping public List<Owner> list(@RequestParam String n) { return this.service.find(n); }',
    '  @PostMapping public void add(@RequestBody Owner o) { this.service.add(o); }',
    '}',
  ),
};

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function index(files: Record<string, string>): { db: Db; repoId: number } {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-flow-'));
  roots.push(root);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  const db = openDb(':memory:');
  return { db, repoId: indexRepository(db, root).repoId };
}

describe('Spring controller → service → repository → table flows (JV-005)', () => {
  const { db, repoId } = index(FILES);
  const flow = (route: string) => {
    const start = db
      .prepare("SELECT id FROM nodes WHERE repo_id = ? AND kind = 'route' AND key = ?")
      .get(repoId, route) as { id: number };
    const v = flowView(db, repoId, start.id, { depth: 6 });
    const label = new Map(v.nodes.map((n) => [n.id, n.label]));
    return v.edges.map((e) => `${label.get(e.source)} -${e.kind}-> ${label.get(e.target)}`).sort();
  };

  it('a read route ends at the table through a derived finder', () => {
    expect(flow('GET /owners')).toEqual([
      'GET /owners -handled_by-> OwnerController.list',
      'OwnerController.list -calls-> OwnerService.find',
      'OwnerRepository.findByLastName -reads_table-> table:owners',
      'OwnerService.find -calls-> OwnerRepository.findByLastName',
    ]);
  });

  it('a write route ends at the table through an inherited save', () => {
    expect(flow('POST /owners')).toEqual([
      'OwnerController.add -calls-> OwnerService.add',
      'OwnerRepository -reads_table-> table:owners',
      'OwnerRepository -writes_table-> table:owners',
      'OwnerService.add -calls-> OwnerRepository', // save is inherited from JpaRepository
      'POST /owners -handled_by-> OwnerController.add',
    ]);
  });

  it('derived queries link by name; @Query methods and other methods do not', () => {
    const rows = db
      .prepare(
        `SELECT s.name, e.kind FROM edges e JOIN nodes s ON s.id = e.src
          WHERE e.repo_id = ? AND e.method = 'spring-data.derived-query'`,
      )
      .all(repoId) as { name: string; kind: string }[];
    expect(rows.map((r) => `${r.name} ${r.kind}`).sort()).toEqual([
      'OwnerRepository.deleteByLastName reads_table',
      'OwnerRepository.deleteByLastName writes_table',
      'OwnerRepository.findByLastName reads_table',
    ]);
  });
});
