/**
 * Maven and Gradle module model (JV-001): which modules a JVM repository builds, which folder each
 * owns, and which modules each one declares a dependency on. Read from `pom.xml`, `settings.gradle`
 * and `build.gradle` (Groovy or Kotlin DSL) as text: no build tool is run.
 *
 * Maven: a POM with an `artifactId` is a module of that folder. A `<dependency>` (directly under
 * `<project>`, any scope) on a module built here links the two: observed when `groupId:artifactId`
 * match exactly (`${project.groupId}` is the POM's own group), inferred when only the artifactId
 * matches one module and the groupId is another property. Dependencies inherited from a parent
 * POM in the repository count for the child. Profiles and `dependencyManagement` are not read.
 *
 * Gradle: `settings.gradle` names the projects (`include 'a', 'b:c'`), each in the folder its
 * path names unless `project(':p').projectDir = file('d')` moves it. The idiom
 * `rootProject.children.each { it.name = "x-${it.name}" }` renames them (inferred). A folder with
 * a build file and no settings is a single-project build. `project(':p')` and type-safe
 * `projects.p` dependencies link the modules; a dependency inside `subprojects {}` or
 * `allprojects {}` applies to every project of the build (inferred). Dependencies added by code
 * (loops, helper functions, convention plugins in `buildSrc`) are not seen.
 */
import { basename, dirname } from 'node:path';
import { blocksNamed, scanXml, type XmlEl } from './extract/structured';

export type BuildTool = 'maven' | 'gradle';

export interface BuildModule {
  /** Folder the module owns, relative to the repository root ('' for the root). */
  dir: string;
  /** Display name: the Maven artifactId or the Gradle project name. */
  name: string;
  build: BuildTool;
  /** The POM or build script (for Gradle, the settings file when the project has no build file). */
  file: string;
  /** Maven `groupId:artifactId`. */
  coords?: string;
  /** Gradle project path (`:core`), `:` for the root project. */
  gradlePath?: string;
  /** Inferred when the name or folder came from a recognised idiom rather than a literal. */
  confidence: 'observed' | 'inferred';
}

export interface BuildDependency {
  /** Module folders. */
  from: string;
  to: string;
  /** Maven scope or Gradle configuration (`compile`, `test`, `implementation`…). */
  scope: string;
  path: string;
  line: number;
  confidence: 'observed' | 'inferred';
}

export interface BuildModel {
  modules: BuildModule[];
  dependencies: BuildDependency[];
  /** Folder → the parent POM's folder, when the parent is built in this repository. */
  parents: Map<string, string>;
  /** Project dependencies that name no module of the build. */
  unresolved: { path: string; line: number; text: string; reason: string }[];
}

const POM = /(^|\/)pom\.xml$/u;
const SETTINGS = /(^|\/)settings\.gradle(\.kts)?$/u;
const BUILD = /(^|\/)build\.gradle(\.kts)?$/u;

const dirOf = (p: string) => (p.includes('/') ? dirname(p) : '');
const join = (a: string, b: string) => {
  const parts = (a ? `${a}/${b}` : b).split('/');
  const out: string[] = [];
  for (const s of parts) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out.join('/');
};
const local = (n: string) => n.slice(n.indexOf(':') + 1);
const kids = (el: XmlEl | undefined, name: string) =>
  el ? el.children.filter((c) => local(c.name) === name) : [];
const kid = (el: XmlEl | undefined, name: string) => kids(el, name)[0];
const lineAt = (text: string, offset: number) => {
  let n = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
};
/** Comments blanked, lines and offsets kept. */
const blankComments = (t: string) =>
  t
    .replace(/\/\*[\s\S]*?\*\//gu, (c) => c.replace(/[^\n]/gu, ' '))
    .replace(/(^|[^:"'])\/\/[^\n]*/gu, (c, p: string) => p + ' '.repeat(c.length - p.length));
/** `common-persistence`, `commonPersistence` and `common_persistence` compare equal. */
const loose = (s: string) => s.replace(/[-_.]/gu, '').toLowerCase();

/** A POM under `src/` is a test fixture or a resource, not a module of the build. */
const isBuildFile = (p: string) => !/(^|\/)src\//u.test(p);

export function readBuildModel(files: { path: string }[], texts: Map<string, string>): BuildModel {
  const modules: BuildModule[] = [];
  const dependencies: BuildDependency[] = [];
  const parents = new Map<string, string>();
  const unresolved: BuildModel['unresolved'] = [];
  readMaven(files, texts, modules, dependencies, parents);
  readGradleBuilds(files, texts, modules, dependencies, unresolved);
  return { modules, dependencies, parents, unresolved };
}

// ------------------------------------------------------------------------------------- Maven

function readMaven(
  files: { path: string }[],
  texts: Map<string, string>,
  modules: BuildModule[],
  dependencies: BuildDependency[],
  parents: Map<string, string>,
) {
  const poms: { path: string; dir: string; root: XmlEl; group?: string; artifact: string }[] = [];
  for (const f of files) {
    if (!POM.test(f.path) || !isBuildFile(f.path)) continue;
    const text = texts.get(f.path);
    if (!text) continue;
    const { root } = scanXml(text);
    if (!root || local(root.name) !== 'project') continue;
    const artifact = kid(root, 'artifactId')?.text.trim();
    if (!artifact) continue;
    const group =
      kid(root, 'groupId')?.text.trim() || kid(kid(root, 'parent'), 'groupId')?.text.trim();
    poms.push({ path: f.path, dir: dirOf(f.path), root, group, artifact });
  }
  const byCoord = new Map<string, string>();
  const byArtifact = new Map<string, string[]>();
  for (const p of poms) {
    if (p.group) byCoord.set(`${p.group}:${p.artifact}`, p.dir);
    byArtifact.set(p.artifact, [...(byArtifact.get(p.artifact) ?? []), p.dir]);
    modules.push({
      dir: p.dir,
      name: p.artifact,
      build: 'maven',
      file: p.path,
      ...(p.group ? { coords: `${p.group}:${p.artifact}` } : {}),
      confidence: 'observed',
    });
  }
  const resolve = (g: string | undefined, a: string, own?: string) => {
    const group = g && /^\$\{(project\.)?groupId\}$/u.test(g) ? own : g;
    const exact = group && !group.includes('${') ? byCoord.get(`${group}:${a}`) : undefined;
    if (exact !== undefined) return { dir: exact, confidence: 'observed' as const };
    const only = byArtifact.get(a);
    if (only?.length === 1 && (!group || group.includes('${')))
      return { dir: only[0]!, confidence: 'inferred' as const };
    return undefined;
  };
  for (const p of poms) {
    const parent = kid(p.root, 'parent');
    if (parent) {
      const rel = kid(parent, 'relativePath')?.text.trim();
      const a = kid(parent, 'artifactId')?.text.trim();
      const viaCoords = a ? resolve(kid(parent, 'groupId')?.text.trim(), a)?.dir : undefined;
      const viaPath =
        rel !== undefined && rel !== '' ? join(p.dir, rel.replace(/\/?pom\.xml$/u, '')) : undefined;
      const dir =
        viaCoords ??
        (viaPath !== undefined && poms.some((q) => q.dir === viaPath) ? viaPath : undefined);
      if (dir !== undefined && dir !== p.dir) parents.set(p.dir, dir);
    }
    for (const d of kids(kid(p.root, 'dependencies'), 'dependency')) {
      const a = kid(d, 'artifactId')?.text.trim();
      if (!a) continue;
      const t = resolve(kid(d, 'groupId')?.text.trim(), a, p.group);
      if (!t || t.dir === p.dir) continue;
      dependencies.push({
        from: p.dir,
        to: t.dir,
        scope: kid(d, 'scope')?.text.trim() || 'compile',
        path: p.path,
        line: d.line,
        confidence: t.confidence,
      });
    }
  }
}

// ------------------------------------------------------------------------------------ Gradle

interface GradleBuild {
  /** Folder of the settings file. */
  dir: string;
  settings?: string;
  /** Project path → its module. */
  projects: Map<string, BuildModule>;
}

function readGradleBuilds(
  files: { path: string }[],
  texts: Map<string, string>,
  modules: BuildModule[],
  dependencies: BuildDependency[],
  unresolved: BuildModel['unresolved'],
) {
  const buildFiles = files.filter((f) => BUILD.test(f.path) && isBuildFile(f.path));
  const builds: GradleBuild[] = [];
  const owned = new Set<string>();
  const taken = new Set(modules.map((m) => m.dir));

  // Outer settings first: a project an outer build includes belongs to it, even when its folder
  // has a settings file of its own (used only when Gradle runs from that folder).
  const settingsFiles = files
    .filter((f) => SETTINGS.test(f.path) && isBuildFile(f.path))
    .sort(
      (a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path),
    );
  for (const f of settingsFiles) {
    if (owned.has(dirOf(f.path))) continue;
    const raw = texts.get(f.path);
    if (raw === undefined) continue;
    const text = blankComments(raw);
    const dir = dirOf(f.path);
    const b: GradleBuild = { dir, settings: f.path, projects: new Map() };
    const buildFileIn = (d: string) => buildFiles.find((x) => dirOf(x.path) === d)?.path ?? f.path;
    const rootName = /\brootProject\.name\s*=\s*["']([^"']+)["']/u.exec(text)?.[1];
    b.projects.set(':', {
      dir,
      name: rootName ?? (basename(dir) || 'root'),
      build: 'gradle',
      file: buildFileIn(dir),
      gradlePath: ':',
      confidence: 'observed',
    });
    // Included projects, in their default folders.
    const included: string[] = [];
    for (const m of text.matchAll(/\binclude\s*\(?([^\n)]*)/gu))
      for (const q of (m[1] ?? '').matchAll(/["'](:?[^"'$]+)["']/gu)) {
        const p = q[1]!.startsWith(':') ? q[1]! : `:${q[1]}`;
        included.push(p);
      }
    // rootProject.children.each { it.name = "prefix-${it.name}" }: every child is renamed.
    const rename =
      /\brootProject\.children\.each\s*\{\s*(?:(\w+)\s*->)?[^}]*?\b(\w+)\.name\s*=\s*["']([^"'$]*)\$\{\s*\w+\.name\s*\}([^"'$]*)["']/u.exec(
        text,
      );
    for (const p of included) {
      const segs = p.slice(1).split(':');
      let name = segs[segs.length - 1]!;
      let path = p;
      let confidence: 'observed' | 'inferred' = 'observed';
      if (rename && segs.length === 1) {
        name = `${rename[3]}${name}${rename[4]}`;
        path = `:${name}`;
        confidence = 'inferred';
      }
      b.projects.set(path, {
        dir: join(dir, segs.join('/')),
        name,
        build: 'gradle',
        file: '',
        gradlePath: path,
        confidence,
      });
    }
    // project(':p').projectDir = file('d') (or new File(settingsDir, 'd')).
    for (const m of text.matchAll(
      /\bproject\s*\(\s*["'](:[^"']+)["']\s*\)\s*\.projectDir\s*=\s*(?:file\s*\(|new\s+File\s*\(\s*(?:settingsDir|rootDir)\s*,)\s*["']([^"'$]+)["']/gu,
    )) {
      const mod = b.projects.get(m[1]!);
      if (mod) mod.dir = join(dir, m[2]!);
    }
    for (const mod of b.projects.values()) {
      if (mod.gradlePath !== ':') mod.file = buildFileIn(mod.dir);
      owned.add(mod.dir);
    }
    builds.push(b);
  }
  // A build file outside every settings file's projects is a single-project build.
  for (const f of buildFiles) {
    const d = dirOf(f.path);
    if (owned.has(d)) continue;
    owned.add(d);
    builds.push({
      dir: d,
      projects: new Map([
        [
          ':',
          {
            dir: d,
            name: basename(d) || 'root',
            build: 'gradle',
            file: f.path,
            gradlePath: ':',
            confidence: 'observed',
          },
        ],
      ]),
    });
  }
  for (const b of builds)
    for (const m of b.projects.values())
      if (!taken.has(m.dir)) {
        taken.add(m.dir);
        modules.push(m);
      }

  // Project dependencies, resolved within the build that declares them.
  for (const b of builds) {
    // Accessors follow the project path, each segment in camelCase (`:commons:some-lib` →
    // `projects.commons.someLib`).
    const byLoose = new Map<string, BuildModule[]>();
    for (const [p, m] of b.projects)
      if (p !== ':') {
        const k = p.slice(1).split(':').map(loose).join('.');
        byLoose.set(k, [...(byLoose.get(k) ?? []), m]);
      }
    const subprojects = [...b.projects.entries()].filter(([p]) => p !== ':').map(([, m]) => m);
    for (const owner of b.projects.values()) {
      if (!BUILD.test(owner.file)) continue;
      const raw = texts.get(owner.file);
      if (raw === undefined) continue;
      const text = blankComments(raw);
      const shared = [
        ...blocksNamed(text, 'subprojects').map((r) => ({ ...r, all: false })),
        ...blocksNamed(text, 'allprojects').map((r) => ({ ...r, all: true })),
      ];
      for (const block of blocksNamed(text, 'dependencies')) {
        const body = text.slice(block.start, block.end);
        const around =
          owner.gradlePath === ':'
            ? shared.find((s) => s.start <= block.start && block.end <= s.end)
            : undefined;
        const froms = around ? (around.all ? [owner, ...subprojects] : subprojects) : [owner];
        const add = (
          conf: string,
          target: BuildModule | undefined,
          text: string,
          at: number,
          confidence: 'observed' | 'inferred',
        ) => {
          const line = lineAt(raw, block.start + at);
          if (!target) {
            unresolved.push({
              path: owner.file,
              line,
              text,
              reason: 'no project of this name in the build',
            });
            return;
          }
          for (const from of froms)
            if (from.dir !== target.dir)
              dependencies.push({
                from: from.dir,
                to: target.dir,
                scope: conf,
                path: owner.file,
                line,
                confidence: around ? 'inferred' : confidence,
              });
        };
        for (const m of body.matchAll(
          /^\s*(\w+)\s*\(?\s*(?:platform\s*\(|enforcedPlatform\s*\(|testFixtures\s*\()?\s*(?:rootProject\s*\.\s*)?project\s*\(\s*(?:path\s*[:=]\s*)?["'](:[^"']*)["']/gmu,
        )) {
          const target = b.projects.get(m[2]!);
          add(
            m[1]!,
            target,
            `project ${m[2]}`,
            m.index + m[0].length - m[0].trimStart().length,
            target?.confidence ?? 'observed',
          );
        }
        // Type-safe project accessors: projects.commonPersistence → :common-persistence.
        for (const m of body.matchAll(
          /^\s*(\w+)\s*\(?\s*(?:platform\s*\()?\s*projects\.([\w.]+)/gmu,
        )) {
          const hits = byLoose.get(m[2]!.split('.').map(loose).join('.')) ?? [];
          add(
            m[1]!,
            hits.length === 1 ? hits[0] : undefined,
            `projects.${m[2]}`,
            m.index + m[0].length - m[0].trimStart().length,
            'inferred',
          );
        }
      }
    }
  }
}

/** Every module a module reaches through declared dependencies and parent POMs (itself excluded). */
export function dependencyClosure(model: BuildModel): Map<string, Set<string>> {
  const direct = new Map<string, Set<string>>();
  for (const d of model.dependencies)
    direct.set(d.from, new Set([...(direct.get(d.from) ?? []), d.to]));
  // A child POM inherits its parent's dependencies.
  const own = (dir: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(dir)) return new Set();
    seen.add(dir);
    const out = new Set(direct.get(dir) ?? []);
    const p = model.parents.get(dir);
    if (p !== undefined) for (const x of own(p, seen)) out.add(x);
    return out;
  };
  const out = new Map<string, Set<string>>();
  for (const m of model.modules) {
    const seen = new Set<string>();
    const stack = [...own(m.dir)];
    while (stack.length) {
      const d = stack.pop()!;
      if (seen.has(d) || d === m.dir) continue;
      seen.add(d);
      stack.push(...own(d));
    }
    out.set(m.dir, seen);
  }
  return out;
}
