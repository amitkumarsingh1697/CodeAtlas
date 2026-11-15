import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { indexRepository, openDb, type Db } from '../src/index';
import {
  jpaQuerySites,
  pathTargets,
  queryTargets,
  stringValue,
} from '../src/indexer/extract/jpa-query';

/** JPA queries → tables (JV-004, rules orm.jpa-query and orm.jpa-named-query). */
const P = 'src/main/java/app';
const OWNER = [
  'package app;',
  'import jakarta.persistence.*;',
  '@Entity',
  '@Table(name = "owners")',
  '@NamedQuery(name = "ownersByCity", query = "SELECT o FROM Owner o WHERE o.city = :city")',
  'public class Owner {',
  '  @Id private Integer id;',
  '  private String city;',
  '}',
  '',
].join('\n');
const VET = [
  'package app;',
  'import jakarta.persistence.*;',
  '@Entity(name = "Vet")',
  '@Table(name = "vets")',
  'public class VetEntity {',
  '  @Id private Integer id;',
  '}',
  '',
].join('\n');
const PET_TYPE = [
  'package app;',
  'import jakarta.persistence.*;',
  '@Entity',
  'public class PetType {',
  '  @Id private Integer id;',
  '}',
  '',
].join('\n');
const REPO = [
  'package app;',
  'import org.springframework.data.jpa.repository.Query;',
  'import org.springframework.data.jpa.repository.Modifying;',
  'import org.springframework.data.repository.Repository;',
  'public interface OwnerRepository extends Repository<Owner, Integer> {',
  '  @Query("SELECT DISTINCT o FROM Owner o left join fetch o.pets WHERE o.city = :c")',
  '  java.util.List<Owner> byCity(String c);',
  '',
  '  @Modifying',
  '  @Query(value = "UPDATE owners SET city = NULL", nativeQuery = true)',
  '  void clearCities();',
  '',
  '  @Query(name = "ownersByCity")',
  '  java.util.List<Owner> named(String city);',
  '',
  '  // @Query("SELECT v FROM Vet v") is a comment',
  '  @Query("SELECT p FROM PetType p, Vet v ORDER BY p.id")',
  '  java.util.List<PetType> types();',
  '}',
  '',
].join('\n');
const DAO = [
  'package app;',
  'import jakarta.persistence.EntityManager;',
  'public class VetDao {',
  '  private EntityManager em;',
  '  public long count() {',
  '    return (Long) em.createQuery("select count(v) from Vet v " +',
  '        "where v.id > 0").getSingleResult();',
  '  }',
  '  public void purge(String table) {',
  '    em.createNativeQuery("DELETE FROM " + table).executeUpdate();',
  '  }',
  '  public Object city(String c) {',
  '    return em.createNamedQuery("ownersByCity").setParameter("city", c).getResultList();',
  '  }',
  '  public Object missing() {',
  '    return em.createQuery("SELECT x FROM Unknown x").getResultList();',
  '  }',
  '  public Object gone() {',
  '    return em.createNamedQuery("noSuchQuery").getResultList();',
  '  }',
  '}',
  '',
].join('\n');
/** Same calls without a JPA import: nothing is read. */
const NOT_JPA = [
  'package app;',
  'public class Events {',
  '  Object q(Store s) { return s.createQuery("SELECT o FROM Owner o"); }',
  '}',
  '',
].join('\n');

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function index(files: Record<string, string>): { db: Db; repoId: number } {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-jpa-'));
  roots.push(root);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  const db = openDb(':memory:');
  return { db, repoId: indexRepository(db, root).repoId };
}

function queryLinks(db: Db, repoId: number) {
  return (
    db
      .prepare(
        `SELECT e.kind, e.confidence, e.method, e.evidence_line AS line, s.key AS src, d.key AS dst
           FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
          WHERE e.repo_id = ? AND e.method IN ('orm.jpa-query', 'orm.jpa-named-query')`,
      )
      .all(repoId) as {
      kind: string;
      confidence: string;
      method: string;
      line: number;
      src: string;
      dst: string;
    }[]
  )
    .map(
      (r) =>
        `${r.src.replace(/^.*#/u, '')} ${r.kind} ${r.dst} ${r.confidence} ${r.method} :${r.line}`,
    )
    .sort();
}

describe('JPA queries → tables (JV-004)', () => {
  const { db, repoId } = index({
    [`${P}/Owner.java`]: OWNER,
    [`${P}/VetEntity.java`]: VET,
    [`${P}/PetType.java`]: PET_TYPE,
    [`${P}/OwnerRepository.java`]: REPO,
    [`${P}/VetDao.java`]: DAO,
    [`${P}/Events.java`]: NOT_JPA,
  });

  it('links each method to the tables its literal and named queries read and write', () => {
    expect(queryLinks(db, repoId)).toEqual([
      'OwnerRepository.byCity reads_table table:owners observed orm.jpa-query :6',
      'OwnerRepository.clearCities writes_table table:owners observed orm.jpa-query :10',
      'OwnerRepository.named reads_table table:owners inferred orm.jpa-named-query :13',
      'OwnerRepository.types reads_table table:pettype inferred orm.jpa-query :17',
      // A comma-separated FROM list: both entities, each labelled by its own mapping.
      'OwnerRepository.types reads_table table:vets observed orm.jpa-query :17',
      'VetDao.city reads_table table:owners inferred orm.jpa-named-query :13',
      'VetDao.count reads_table table:vets observed orm.jpa-query :6',
    ]);
  });

  it('records dynamic text, unknown named queries and unmapped entities as gaps', () => {
    const gaps = db
      .prepare(
        "SELECT file_path, line, text, reason FROM unresolved WHERE repo_id = ? AND kind = 'query'",
      )
      .all(repoId) as { file_path: string; line: number; text: string; reason: string }[];
    expect(
      gaps.map((g) => `${g.file_path.replace(`${P}/`, '')}:${g.line} ${g.text}`).sort(),
    ).toEqual([
      'VetDao.java:10 createNativeQuery',
      'VetDao.java:16 createQuery Unknown',
      'VetDao.java:19 createNamedQuery noSuchQuery',
    ]);
  });
});

/** Path joins and entity graphs (rules orm.jpa-path-join, orm.entity-graph). */
const J = 'src/main/java/clinic';
const java = (...lines: string[]) => [`package clinic;`, ...lines, ''].join('\n');
const PATH_FILES = {
  [`${J}/BaseEntity.java`]: java(
    'import jakarta.persistence.*;',
    '@MappedSuperclass',
    'public abstract class BaseEntity {',
    '  @Id private Integer id;',
    '  @ManyToOne private Clinic clinic;',
    '}',
  ),
  [`${J}/Clinic.java`]: java(
    'import jakarta.persistence.*;',
    '@Entity @Table(name = "clinics")',
    'public class Clinic { @Id private Integer id; }',
  ),
  [`${J}/Owner.java`]: java(
    'import jakarta.persistence.*;',
    'import java.util.Set;',
    '@Entity @Table(name = "owners")',
    '@NamedEntityGraph(name = "Owner.detail", attributeNodes = @NamedAttributeNode("pets"))',
    'public class Owner {',
    '  @Id private Integer id;',
    '  private String city;',
    '  @OneToMany(mappedBy = "owner") private Set<Pet> pets;',
    '}',
  ),
  [`${J}/Pet.java`]: java(
    'import jakarta.persistence.*;',
    '@Entity @Table(name = "pets")',
    'public class Pet extends BaseEntity {',
    '  @ManyToOne private Owner owner;',
    '  @ManyToOne private PetType type;',
    '}',
  ),
  [`${J}/PetType.java`]: java(
    'import jakarta.persistence.*;',
    '@Entity @Table(name = "types")',
    'public class PetType { @Id private Integer id; }',
  ),
  [`${J}/OwnerRepository.java`]: java(
    'import java.util.*;',
    'import org.springframework.data.jpa.repository.*;',
    'public interface OwnerRepository extends JpaRepository<Owner, Integer> {',
    '  @Query("select distinct o from Owner o left join fetch o.pets p left join fetch p.type")',
    '  List<Owner> withPets();',
    '  @EntityGraph(attributePaths = { "pets", "pets.type" })',
    '  Optional<Owner> findWithPetsById(Integer id);',
    '  @EntityGraph(attributePaths = "city")',
    '  List<Owner> findByCity(String city);',
    '  @EntityGraph(value = "Owner.detail")',
    '  List<Owner> findAllByCity(String city);',
    '  @Query(value = "select * from owners o where o.pets = 1", nativeQuery = true)',
    '  List<Owner> nativeOnly();',
    '}',
  ),
  [`${J}/PetRepository.java`]: java(
    'import java.util.*;',
    'import org.springframework.data.jpa.repository.*;',
    'public interface PetRepository extends JpaRepository<Pet, Integer> {',
    '  @Query("select p from Pet p where p.owner.city = :c and p.type.id <> \'x.y\' and p.clinic = :k")',
    '  List<Pet> inCity(String c);',
    '  @Query("select c from Pet p join p.clinic c where p.nickname.length > 0")',
    '  List<Clinic> clinics();',
    '}',
  ),
};

describe('JPQL path joins and @EntityGraph → tables', () => {
  const { db, repoId } = index(PATH_FILES);
  const links = () =>
    (
      db
        .prepare(
          `SELECT e.kind, e.confidence, e.method, s.key AS src, d.key AS dst
             FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
            WHERE e.repo_id = ? AND e.method IN ('orm.jpa-path-join', 'orm.entity-graph')`,
        )
        .all(repoId) as {
        kind: string;
        confidence: string;
        method: string;
        src: string;
        dst: string;
      }[]
    )
      .map((r) => `${r.src.replace(/^.*#/u, '')} ${r.kind} ${r.dst} ${r.confidence} ${r.method}`)
      .sort();

  it('follows association paths from aliases, through joins, implicit paths and inherited fields', () => {
    expect(links()).toEqual([
      'OwnerRepository.findWithPetsById reads_table table:pets inferred orm.entity-graph',
      'OwnerRepository.findWithPetsById reads_table table:types inferred orm.entity-graph',
      'OwnerRepository.withPets reads_table table:pets inferred orm.jpa-path-join',
      'OwnerRepository.withPets reads_table table:types inferred orm.jpa-path-join',
      // The association comes from the @MappedSuperclass; `p.nickname` is no association.
      'PetRepository.clinics reads_table table:clinics inferred orm.jpa-path-join',
      // `p.owner.city` joins the owner. `p.type.id` and `p.clinic = :k` compare key columns
      // and join nothing; `'x.y'` is a string, not a path.
      'PetRepository.inCity reads_table table:owners inferred orm.jpa-path-join',
    ]);
  });

  it('leaves basic attributes, named entity graphs and native SQL alone, without gaps', () => {
    const gaps = db
      .prepare("SELECT text FROM unresolved WHERE repo_id = ? AND kind = 'query'")
      .all(repoId);
    expect(gaps).toEqual([]);
    expect(links().some((l) => /findByCity|findAllByCity|nativeOnly/u.test(l))).toBe(false);
  });
});

describe('JPA query reading', () => {
  it('joins an association on a JOIN path, or on a path that reads past it to a non-id attribute', () => {
    const entity = (n: string) => (['Pet', 'Owner'].includes(n) ? n : undefined);
    const links: Record<string, string> = {
      'Pet.owner': 'Owner',
      'Owner.city': 'City',
      'Pet.toys': 'Toy',
    };
    const assoc = (c: string, a: string) => links[`${c}.${a}`];
    const t = (q: string) => pathTargets(q, entity, assoc).sort();
    expect(t('select p.owner.name, p from Pet p')).toEqual(['Owner']);
    expect(t('select distinct(p.owner.id) from Pet p where p.owner = :o')).toEqual([]);
    expect(t('select p from Pet p join p.owner.city c')).toEqual(['City', 'Owner']);
    expect(t('select t from Pet p left join fetch p.toys t where :p.owner.x = 1')).toEqual(['Toy']);
    expect(t('SELECT P FROM Pet AS P WHERE P.owner.city.name = ?1')).toEqual(['City', 'Owner']);
  });

  it('joins literal parts and rejects anything built at run time', () => {
    expect(stringValue('"a " + "b"')).toBe('a b');
    expect(stringValue('"""\n  select x\n  from Y\n"""')).toContain('from Y');
    expect(stringValue('"a" + b')).toBeUndefined();
    expect(stringValue('QUERY')).toBeUndefined();
    expect(stringValue('"from ${t}"', true)).toBeUndefined();
    expect(stringValue('"from ${t}"', false)).toBe('from ${t}');
  });

  it('takes entities from JPQL, ignoring path joins and FETCH, and tables from SQL', () => {
    const j = queryTargets(
      'select o from Owner o join fetch o.pets p join Visit v on v.x = o',
      false,
    );
    expect(j.reads.map((r) => r.name)).toEqual(['Owner', 'Visit']);
    const d = queryTargets('delete from Owner o where o.id in (select v.id from Visit v)', false);
    expect([d.writes.map((r) => r.name), d.reads.map((r) => r.name)]).toEqual([
      ['Owner'],
      ['Visit'],
    ]);
    const n = queryTargets('UPDATE public.owners SET a = 1', true);
    expect(n.writes.map((r) => r.name)).toEqual(['owners']);
  });

  it('skips CriteriaBuilder.createQuery(Foo.class) and records the query it builds when run', () => {
    const sites = jpaQuerySites(
      'import jakarta.persistence.*;\nclass A { Object f() { var q = cb.createQuery(Foo.class);\n return em.createQuery(q); } }\n',
    );
    expect(sites).toEqual([{ kind: 'dynamic', line: 3, via: 'createQuery' }]);
  });

  it('reads nothing from a file without a JPA import, or inside comments', () => {
    expect(jpaQuerySites(NOT_JPA)).toEqual([]);
    expect(
      jpaQuerySites(
        'import jakarta.persistence.*;\n/* em.createQuery("from A a") */\n// em.createQuery("from B b")\n',
      ),
    ).toEqual([]);
  });
});
