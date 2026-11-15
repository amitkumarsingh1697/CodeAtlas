import { describe, expect, it } from 'vitest';
import { dependencyClosure, readBuildModel } from '../src/indexer/build-modules';

/** Maven and Gradle module model (JV-001). */
const model = (files: Record<string, string>) =>
  readBuildModel(
    Object.keys(files).map((path) => ({ path })),
    new Map(Object.entries(files)),
  );
const pom = (body: string) =>
  `<?xml version="1.0"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n${body}\n</project>\n`;

describe('Maven modules', () => {
  const m = model({
    'pom.xml': pom(
      '<groupId>org.acme</groupId><artifactId>shop</artifactId><packaging>pom</packaging>\n<modules><module>core</module><module>web</module></modules>\n<dependencies><dependency><groupId>org.acme</groupId><artifactId>shared</artifactId></dependency></dependencies>\n<dependencyManagement><dependencies><dependency><groupId>org.acme</groupId><artifactId>web</artifactId></dependency></dependencies></dependencyManagement>',
    ),
    'core/pom.xml': pom(
      '<parent><groupId>org.acme</groupId><artifactId>shop</artifactId><version>1</version></parent>\n<artifactId>core</artifactId>',
    ),
    'web/pom.xml': pom(
      '<parent><groupId>org.acme</groupId><artifactId>shop</artifactId><version>1</version></parent>\n<artifactId>web</artifactId>\n<dependencies>\n<dependency><groupId>${project.groupId}</groupId><artifactId>core</artifactId></dependency>\n<dependency><groupId>${acme.group}</groupId><artifactId>tools</artifactId><scope>test</scope></dependency>\n<dependency><groupId>org.other</groupId><artifactId>core</artifactId></dependency>\n</dependencies>',
    ),
    'shared/pom.xml': pom('<groupId>org.acme</groupId><artifactId>shared</artifactId>'),
    'tools/pom.xml': pom('<groupId>org.acme.tools</groupId><artifactId>tools</artifactId>'),
    'web/src/test/resources/fixture/pom.xml': pom(
      '<groupId>x</groupId><artifactId>fixture</artifactId>',
    ),
  });

  it('reads one module per POM folder, skipping POMs under src/', () => {
    expect(m.modules.map((x) => `${x.dir || '.'} ${x.name} ${x.coords}`)).toEqual([
      '. shop org.acme:shop',
      'core core org.acme:core',
      'web web org.acme:web',
      'shared shared org.acme:shared',
      'tools tools org.acme.tools:tools',
    ]);
  });

  it('links dependencies on modules built here, by exact coordinates or a unique artifactId', () => {
    expect(
      m.dependencies.map((d) => `${d.from || '.'} -> ${d.to} ${d.scope} ${d.confidence}`),
    ).toEqual([
      // Declared in the parent: dependencyManagement is not a dependency.
      '. -> shared compile observed',
      // ${project.groupId} is the POM's own (inherited) group.
      'web -> core compile observed',
      // A property groupId matched by its unique artifactId; org.other:core is not built here.
      'web -> tools test inferred',
    ]);
    expect(m.parents.get('web')).toBe('');
  });

  it('gives a child the dependencies of its parent POM, transitively', () => {
    const c = dependencyClosure(m);
    expect([...c.get('web')!].sort()).toEqual(['core', 'shared', 'tools']);
    expect([...c.get('core')!]).toEqual(['shared']);
  });
});

describe('Gradle projects', () => {
  const m = model({
    'settings.gradle':
      "rootProject.name = 'conductor'\n// include 'commented'\ninclude 'common', 'core'\ninclude 'scheduler-core'\ninclude 'tools:cli'\nrootProject.children.each { it.name = \"conductor-${it.name}\" }\nproject(':conductor-scheduler-core').projectDir = file('scheduler/core')\n",
    'build.gradle':
      "subprojects {\n  dependencies {\n    testImplementation project(':conductor-common')\n  }\n}\n",
    'common/build.gradle': 'dependencies { implementation "com.google.guava:guava:33" }\n',
    'core/build.gradle':
      "dependencies {\n    implementation project(':conductor-common')\n    api(project(path: ':conductor-scheduler-core'))\n    testImplementation rootProject.project(':conductor-common').sourceSets.test.output\n    implementation project(':missing')\n}\n",
    'scheduler/core/build.gradle.kts':
      'dependencies {\n    implementation(projects.conductorCommon)\n}\n',
    'standalone/build.gradle.kts': 'plugins { java }\n',
    'core/src/test/resources/build.gradle': "dependencies { implementation project(':x') }\n",
  });

  it('reads projects from settings, with projectDir overrides and the rename idiom', () => {
    expect(
      m.modules.map((x) => `${x.dir || '.'} ${x.gradlePath} ${x.name} ${x.confidence}`),
    ).toEqual([
      '. : conductor observed',
      'common :conductor-common conductor-common inferred',
      'core :conductor-core conductor-core inferred',
      'scheduler/core :conductor-scheduler-core conductor-scheduler-core inferred',
      // A nested path is not renamed by rootProject.children.
      'tools/cli :tools:cli cli observed',
      'standalone : standalone observed',
    ]);
  });

  it('links project dependencies, applies subprojects {} to every subproject, and records unknown ones', () => {
    expect(
      m.dependencies.map((d) => `${d.from || '.'} -> ${d.to} ${d.scope} ${d.confidence}`).sort(),
    ).toEqual([
      'core -> common implementation inferred',
      'core -> common testImplementation inferred',
      'core -> common testImplementation inferred',
      'core -> scheduler/core api inferred',
      'scheduler/core -> common implementation inferred',
      'scheduler/core -> common testImplementation inferred',
      'tools/cli -> common testImplementation inferred',
    ]);
    expect(m.unresolved.map((u) => `${u.path}:${u.line} ${u.text}`)).toEqual([
      'core/build.gradle:5 project :missing',
    ]);
  });

  it('labels a dependency observed when the project path is written as declared', () => {
    const plain = model({
      'settings.gradle': "include 'library', 'application', 'tools:some-lib'\n",
      'application/build.gradle':
        "dependencies {\n  implementation project(':library')\n  testImplementation(projects.tools.someLib)\n}\n",
      'tools/some-lib/build.gradle': '',
      'library/build.gradle': '',
      // A nested settings file makes the folder a build of its own when Gradle runs there; from
      // the outer build it is still the outer build's project.
      'application/settings.gradle': "rootProject.name = 'application'\n",
      'library/settings.gradle': '',
    });
    expect(plain.unresolved).toEqual([]);
    expect(plain.dependencies).toMatchObject([
      { from: 'application', to: 'library', confidence: 'observed', line: 2 },
      // A type-safe accessor follows the path, each segment in camelCase.
      { from: 'application', to: 'tools/some-lib', confidence: 'inferred', line: 3 },
    ]);
  });
});

describe('build modules in the index', () => {
  it('assigns files to their module, links declared dependencies and flags undeclared imports', async () => {
    const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { dirname: dn, join: jn } = await import('node:path');
    const { indexRepository, openDb } = await import('../src/index');
    const root = mkdtempSync(jn(tmpdir(), 'codeatlas-build-'));
    const files: Record<string, string> = {
      'settings.gradle': "rootProject.name = 'demo'\ninclude 'library', 'application'\n",
      'library/build.gradle': 'plugins { id "java" }\n',
      'application/build.gradle': "dependencies {\n  implementation project(':library')\n}\n",
      'library/src/main/java/com/example/lib/Greeter.java':
        'package com.example.lib;\nimport com.example.app.App;\npublic class Greeter { App app; }\n',
      'application/src/main/java/com/example/app/App.java':
        'package com.example.app;\nimport com.example.lib.Greeter;\npublic class App { Greeter g; }\n',
    };
    try {
      for (const [p, c] of Object.entries(files)) {
        mkdirSync(dn(jn(root, p)), { recursive: true });
        writeFileSync(jn(root, p), c);
      }
      const db = openDb(':memory:');
      const coverage = indexRepository(db, root);
      const { repoId } = coverage;
      const mods = db
        .prepare(
          "SELECT key, json_extract(data, '$.build') b FROM nodes WHERE repo_id = ? AND kind = 'module' ORDER BY key",
        )
        .all(repoId);
      expect(mods.map((m) => `${m.key} ${m.b}`)).toEqual([
        'application gradle',
        'demo gradle',
        'library gradle',
      ]);
      const fileMod = db
        .prepare(
          "SELECT key, module FROM nodes WHERE repo_id = ? AND kind = 'file' AND key LIKE '%.java' ORDER BY key",
        )
        .all(repoId);
      expect(fileMod.map((f) => `${f.module}`)).toEqual(['application', 'library']);
      const deps = db
        .prepare(
          `SELECT s.key s, d.key d, e.confidence c, e.evidence_line l FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
            WHERE e.repo_id = ? AND e.kind = 'depends_on'`,
        )
        .all(repoId);
      expect(deps.map((d) => `${d.s} -> ${d.d} ${d.c} :${d.l}`)).toEqual([
        'application -> library observed :2',
      ]);
      expect(coverage.buildModules).toMatchObject({
        gradle: 3,
        maven: 0,
        dependencies: 1,
        crossModuleImports: 2,
        undeclaredImports: 1,
        undeclared: [{ from: 'library', to: 'application', imports: 1 }],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the Maven dependencies of a folder that is also an npm package, under the package name', async () => {
    const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { dirname: dn, join: jn } = await import('node:path');
    const { indexRepository, openDb } = await import('../src/index');
    const root = mkdtempSync(jn(tmpdir(), 'codeatlas-build-'));
    const files: Record<string, string> = {
      'pom.xml': pom(
        '<groupId>org.acme</groupId><artifactId>shop</artifactId><packaging>pom</packaging><modules><module>ui</module><module>server</module><module>api</module></modules>\n<dependencies>\n<dependency><groupId>org.acme</groupId><artifactId>api</artifactId></dependency>\n</dependencies>',
      ),
      'api/pom.xml': pom(
        '<parent><groupId>org.acme</groupId><artifactId>shop</artifactId><version>1</version></parent><artifactId>api</artifactId>',
      ),
      // ui is built by Maven (frontend plugin) and is also an npm package.
      'ui/pom.xml': pom(
        '<parent><groupId>org.acme</groupId><artifactId>shop</artifactId><version>1</version></parent><artifactId>shop-ui</artifactId>\n<dependencies>\n<dependency><groupId>org.acme</groupId><artifactId>api</artifactId><scope>provided</scope></dependency>\n</dependencies>',
      ),
      'ui/package.json': JSON.stringify({ name: '@acme/shop-ui' }),
      'server/pom.xml': pom(
        '<parent><groupId>org.acme</groupId><artifactId>shop</artifactId><version>1</version></parent><artifactId>server</artifactId>\n<dependencies>\n<dependency><groupId>org.acme</groupId><artifactId>shop-ui</artifactId></dependency>\n</dependencies>',
      ),
    };
    try {
      for (const [p, c] of Object.entries(files)) {
        mkdirSync(dn(jn(root, p)), { recursive: true });
        writeFileSync(jn(root, p), c);
      }
      const db = openDb(':memory:');
      const { repoId } = indexRepository(db, root);
      const mods = db
        .prepare("SELECT key FROM nodes WHERE repo_id = ? AND kind = 'module' ORDER BY key")
        .all(repoId)
        .map((m) => m.key);
      // One module for the ui folder, named by its package.json.
      expect(mods).toEqual(['@acme/shop-ui', 'api', 'server', 'shop']);
      const deps = db
        .prepare(
          `SELECT s.key s, d.key d FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
            WHERE e.repo_id = ? AND e.kind = 'depends_on' ORDER BY s.key`,
        )
        .all(repoId)
        .map((d) => `${d.s} -> ${d.d}`);
      // The parent's dependency on api is inherited by server (ui declares it itself; api is the target).
      expect(deps).toEqual([
        '@acme/shop-ui -> api',
        'server -> @acme/shop-ui',
        'server -> api',
        'shop -> api',
      ]);
      const inherited = db
        .prepare(
          `SELECT e.detail, e.evidence_path p, e.evidence_line l FROM edges e JOIN nodes s ON s.id = e.src JOIN nodes d ON d.id = e.dst
            WHERE e.repo_id = ? AND e.kind = 'depends_on' AND s.key = 'server' AND d.key = 'api'`,
        )
        .get(repoId);
      expect(inherited).toEqual({
        detail: 'compile dependency on api, inherited from the parent POM shop',
        p: 'pom.xml',
        l: 5,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
