import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { indexRepository, openDb, type Db } from '../src/index';
import { injectedType } from '../src/indexer/frameworks/spring-beans';

/** Spring bean wiring → `injects` edges (JV-002, rule spring.injection). */
const P = 'src/main/java/app';
const j = (...lines: string[]) => lines.join('\n') + '\n';
const FILES: Record<string, string> = {
  [`${P}/OwnerRepository.java`]: j(
    'package app;',
    'import org.springframework.data.repository.CrudRepository;',
    'public interface OwnerRepository extends CrudRepository<Owner, Integer> {}',
  ),
  [`${P}/Notifier.java`]: j('package app;', 'public interface Notifier { void send(String m); }'),
  [`${P}/MailNotifier.java`]: j(
    'package app;',
    'import org.springframework.stereotype.Component;',
    'import org.springframework.context.annotation.Primary;',
    '@Component @Primary',
    'public class MailNotifier implements Notifier { public void send(String m) {} }',
  ),
  [`${P}/SmsNotifier.java`]: j(
    'package app;',
    'import org.springframework.stereotype.Component;',
    '@Component("sms")',
    'public class SmsNotifier implements Notifier { public void send(String m) {} }',
  ),
  [`${P}/Clock.java`]: j('package app;', 'public interface Clock { long now(); }'),
  [`${P}/AppConfig.java`]: j(
    'package app;',
    'import org.springframework.context.annotation.*;',
    '@Configuration',
    'public class AppConfig {',
    '  @Bean',
    '  public Clock systemClock() { return System::currentTimeMillis; }',
    '  @Bean',
    '  public Clock fixedClock() { return () -> 0L; }',
    '  @Bean',
    '  public Auditor auditor(Notifier notifier) { return new Auditor(notifier); }',
    '}',
  ),
  [`${P}/Auditor.java`]: j('package app;', 'public class Auditor { Auditor(Notifier n) {} }'),
  [`${P}/OwnerService.java`]: j(
    'package app;',
    'import java.util.List;',
    'import org.springframework.beans.factory.annotation.*;',
    'import org.springframework.stereotype.Service;',
    '@Service',
    'public class OwnerService {',
    '  private final OwnerRepository owners;',
    '  @Autowired private List<Notifier> all;',
    '  @Autowired @Qualifier("sms") private Notifier sms;',
    '  @Autowired private Clock clock;',
    '  @Autowired private Clock fixedClock;',
    '  @Value("${x}") private String notInjected;',
    '  public OwnerService(OwnerRepository owners, Notifier notifier, String name) {',
    '    this.owners = owners;',
    '  }',
    '  @Autowired void setAuditor(Auditor a) {}',
    '}',
  ),
  [`${P}/OwnerController.java`]: j(
    'package app;',
    'import org.springframework.stereotype.Controller;',
    '@Controller',
    'class OwnerController {',
    '  OwnerController(OwnerService service) {}',
    '  OwnerController() {}',
    '}',
  ),
  [`${P}/AppProps.java`]: j(
    'package app;',
    'import org.springframework.boot.context.properties.ConfigurationProperties;',
    '@ConfigurationProperties(prefix = "app")',
    'public class AppProps {}',
  ),
  [`${P}/PropsUser.java`]: j(
    'package app;',
    'import org.springframework.stereotype.Component;',
    '@Component',
    'class PropsUser { PropsUser(AppProps props) {} }',
  ),
  [`${P}/Plain.java`]: j('package app;', 'public class Plain { Plain(OwnerService s) {} }'),
};

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function index(files: Record<string, string>): { db: Db; repoId: number } {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-beans-'));
  roots.push(root);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  const db = openDb(':memory:');
  return { db, repoId: indexRepository(db, root).repoId };
}

describe('Spring bean wiring (JV-002)', () => {
  const { db, repoId } = index(FILES);
  const short = (k: string) => k.replace(/^.*#/u, '');

  it('links each injection point to the bean that provides it, all inferred', () => {
    const rows = db
      .prepare(
        `SELECT s.key AS src, d.key AS dst, e.confidence, e.evidence_line AS line
           FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
          WHERE e.repo_id = ? AND e.kind = 'injects'`,
      )
      .all(repoId) as { src: string; dst: string; confidence: string; line: number }[];
    expect(new Set(rows.map((r) => r.confidence))).toEqual(new Set(['inferred']));
    expect(rows.map((r) => `${short(r.src)} -> ${short(r.dst)} :${r.line}`).sort()).toEqual([
      // @Bean parameter: two Notifiers, MailNotifier is @Primary.
      'AppConfig.auditor -> MailNotifier :10',
      // The only constructor; no Notifier qualifier, so @Primary picks; String is not a bean.
      'OwnerService -> AppConfig.auditor :16', // setter injection of a @Bean
      'OwnerService -> AppConfig.fixedClock :11', // two Clock beans; the field name picks one
      // One edge per pair: List<Notifier> (line 8) also gives MailNotifier, and @Qualifier("sms")
      // (line 9) also gives SmsNotifier; the graph keeps the pair once and counts the repeat.
      'OwnerService -> MailNotifier :13',
      'OwnerService -> OwnerRepository :13',
      'OwnerService -> SmsNotifier :8', // List<Notifier>: every bean
      'PropsUser -> AppProps :4', // a @ConfigurationProperties class is a bean
    ]);
  });

  it('records an ambiguous point as a gap and leaves a class with two constructors alone', () => {
    const gaps = db
      .prepare("SELECT line, text, reason FROM unresolved WHERE repo_id = ? AND kind = 'injection'")
      .all(repoId) as { line: number; text: string; reason: string }[];
    expect(gaps.map((g) => `${g.line} ${g.text}`)).toEqual(['10 OwnerService field clock: Clock']);
    expect(gaps[0]!.reason).toContain('more than one bean');
    const fromController = db
      .prepare(
        "SELECT COUNT(*) AS n FROM edges e JOIN nodes s ON s.id = e.src WHERE e.repo_id = ? AND e.kind = 'injects' AND s.file_path LIKE '%OwnerController.java'",
      )
      .get(repoId) as { n: number };
    expect(fromController.n).toBe(0); // two constructors, neither @Autowired
  });

  it('reads the injected type through collections, providers and qualified names', () => {
    expect(injectedType('List<Notifier>')).toEqual({ type: 'Notifier', many: true });
    expect(injectedType('Map<String, a.b.Notifier>')).toEqual({ type: 'Notifier', many: true });
    expect(injectedType('ObjectProvider<Clock>')).toEqual({ type: 'Clock', many: false });
    expect(injectedType('final app.OwnerRepository')).toEqual({
      type: 'OwnerRepository',
      many: false,
    });
  });
});
