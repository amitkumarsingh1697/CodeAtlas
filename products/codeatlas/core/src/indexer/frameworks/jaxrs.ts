/**
 * JAX-RS resources (JX-001), `jakarta.ws.rs` and `javax.ws.rs`: root resource classes with a
 * class-level `@Path`, resource methods with `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`,
 * `@HEAD` or `@OPTIONS` and an optional method `@Path`, and sub-resource locators (a method
 * with `@Path` and no verb) whose declared return type is another resource class, followed
 * across files.
 *
 * A route on a root resource is observed. A route reached through one or more locators is
 * inferred: the locator's declared return type is read, but at run time it may return a
 * subclass or a different object. Not read: `@ApplicationPath` and servlet prefixes, annotations
 * inherited from interfaces or superclasses, custom `@HttpMethod` annotations, and locators that
 * return `Object`, a generic type or a class that is not a resource in this repository.
 */
import { annotationsAt, joinPath, pathsOf } from './annotations';
import type { AdapterFile, RepositoryRouteAdapter, RouteFinding, RouteGap } from './types';

const VERBS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);
const IMPORT = /^\s*import\s+(jakarta|javax)\.ws\.rs\./m;
/** Most locators a route may pass through; deeper chains are reported, not followed. */
const MAX_DEPTH = 12;
/** Most distinct prefixes kept per resource class, so a class mounted in many places stays bounded. */
const MAX_PREFIXES = 64;

interface Endpoint {
  cls: string;
  file: string;
  verb: string;
  path: string;
  handlerKey: string;
  handler: string;
  line: number;
  viaConstant: boolean;
}
interface Locator {
  cls: string;
  file: string;
  path: string;
  returns: string | null;
  name: string;
  line: number;
}
interface Resource {
  /** Simple class name. */
  name: string;
  file: string;
  /** Class-level @Path, when the class is a root resource. */
  root: string[] | null;
  rootViaConstant: boolean;
}

/** `{id: [^/]+}` → `{id}`, so a template's regular expression does not split the route key. */
const template = (p: string) => p.replace(/\{\s*([\w.-]+)\s*:[^}]*\}/g, '{$1}');

/** The declared return type of method `name` at `line`, as a simple class name, or null. */
function returnTypeOf(text: string, line: number, name: string): string | null {
  let off = 0;
  for (let l = 1; l < line && off >= 0; l++) off = text.indexOf('\n', off) + 1;
  const at = text.slice(off, off + 4000);
  const m = new RegExp(`\\b${name}\\s*\\(`).exec(at);
  if (!m) return null;
  // Drop annotations (with their arguments) before the name; what is left ends in the type.
  const before = at
    .slice(0, m.index)
    .replace(/@[\w.]+\s*(\((?:[^()]|\([^()]*\))*\))?/g, ' ')
    .trim();
  const t = /([\w.$]+)\s*(<[^<>]*(<[^<>]*>[^<>]*)*>)?\s*(\[\s*\])?$/.exec(before);
  if (!t || t[2] || t[4]) return null; // generic or array return types are not followed
  const simple = t[1]!.split('.').pop()!;
  return /^[A-Z]/.test(simple) && simple !== 'Object' && simple !== 'Response' ? simple : null;
}

export const jaxrsAdapter: RepositoryRouteAdapter = {
  id: 'jax-rs',
  name: 'JAX-RS resources',
  languages: ['Java', 'Kotlin'],
  applies: (text) => IMPORT.test(text) && /@Path\s*\(|@(GET|POST|PUT|DELETE|PATCH)\b/.test(text),
  repositoryRoutes(files: AdapterFile[], constants: Map<string, string>) {
    const gaps: (RouteGap & { file: string })[] = [];
    const resources = new Map<string, Resource[]>();
    const endpoints: Endpoint[] = [];
    const locators: Locator[] = [];
    const imports = new Map<string, string>();
    for (const f of files) {
      imports.set(f.path, f.text);
      const classes = new Set<string>();
      for (const d of f.declarations) {
        if (d.kind !== 'class') continue;
        classes.add(d.name);
        const simple = d.name.split('.').pop()!;
        const path = annotationsAt(f.text, d.line).find((a) => a.name === 'Path');
        const via = { constant: false };
        const root = path ? pathsOf(path.args, ['value'], constants, via) : null;
        if (path && root === null)
          gaps.push({
            file: f.path,
            line: path.line,
            text: `@Path(${path.args ?? ''})`.slice(0, 200),
            reason: 'resource path is not a string literal',
          });
        const list = resources.get(simple) ?? [];
        list.push({ name: simple, file: f.path, root, rootViaConstant: via.constant });
        resources.set(simple, list);
      }
      for (const d of f.declarations) {
        if (d.kind !== 'method') continue;
        const cls = d.name.slice(0, d.name.lastIndexOf('.'));
        if (!classes.has(cls)) continue;
        const anns = annotationsAt(f.text, d.line);
        const verbs = anns.filter((a) => VERBS.has(a.name) && a.args === null);
        const pathAnn = anns.find((a) => a.name === 'Path');
        const via = { constant: false };
        const paths = pathAnn ? pathsOf(pathAnn.args, ['value'], constants, via) : [''];
        if (paths === null) {
          gaps.push({
            file: f.path,
            line: pathAnn!.line,
            text: `@Path(${pathAnn!.args ?? ''})`.slice(0, 200),
            reason: 'method path is not a string literal',
          });
          continue;
        }
        const method = d.name.slice(cls.length + 1);
        const simpleCls = cls.split('.').pop()!;
        if (verbs.length)
          for (const v of verbs)
            for (const p of paths)
              endpoints.push({
                cls: simpleCls,
                file: f.path,
                verb: v.name,
                path: template(p),
                handlerKey: d.key,
                handler: d.name,
                line: v.line,
                viaConstant: via.constant,
              });
        else if (pathAnn)
          for (const p of paths)
            locators.push({
              cls: simpleCls,
              file: f.path,
              path: template(p),
              returns: returnTypeOf(f.text, d.line, method),
              name: d.name,
              line: pathAnn.line,
            });
      }
    }

    /** The resource class a locator in `file` returns: unique by name, or chosen by import or package. */
    const resolve = (file: string, name: string): Resource | null => {
      const all = resources.get(name) ?? [];
      if (all.length <= 1) return all[0] ?? null;
      const text = imports.get(file) ?? '';
      const imported = all.filter((r) => {
        const m = new RegExp(`^\\s*import\\s+([\\w.]+)\\.${name}\\s*;`, 'm').exec(text);
        return m && r.file.endsWith(`${m[1]!.replace(/\./g, '/')}/${name}.java`);
      });
      if (imported.length === 1) return imported[0]!;
      const dir = file.slice(0, file.lastIndexOf('/'));
      const local = all.filter((r) => r.file.slice(0, r.file.lastIndexOf('/')) === dir);
      return local.length === 1 ? local[0]! : null;
    };

    // Prefixes per resource (file + class), breadth-first from the root resources.
    type Prefix = { path: string; depth: number; via: string; constant: boolean };
    const id = (r: Resource) => `${r.file}#${r.name}`;
    const prefixes = new Map<string, Prefix[]>();
    const queue: Resource[] = [];
    for (const list of resources.values())
      for (const r of list)
        if (r.root) {
          prefixes.set(
            id(r),
            r.root.map((p) => ({
              path: template(joinPath('', p)),
              depth: 0,
              via: '',
              constant: r.rootViaConstant,
            })),
          );
          queue.push(r);
        }
    const byClass = new Map<string, Locator[]>();
    for (const l of locators)
      byClass.set(`${l.file}#${l.cls}`, [...(byClass.get(`${l.file}#${l.cls}`) ?? []), l]);
    const reported = new Set<Locator>();
    for (let qi = 0; qi < queue.length; qi++) {
      const r = queue[qi]!;
      for (const l of byClass.get(id(r)) ?? []) {
        const target = l.returns ? resolve(l.file, l.returns) : null;
        if (!target) {
          if (!reported.has(l)) {
            reported.add(l);
            gaps.push({
              file: l.file,
              line: l.line,
              text: `${l.name}() @Path("${l.path}")`,
              reason: l.returns
                ? `sub-resource locator returns ${l.returns}, which is not one resource class in this repository`
                : 'sub-resource locator returns Object, a generic type or a type that cannot be read',
            });
          }
          continue;
        }
        const have = prefixes.get(id(target)) ?? [];
        let added = false;
        for (const p of prefixes.get(id(r)) ?? []) {
          if (p.depth >= MAX_DEPTH || have.length >= MAX_PREFIXES) continue;
          const path = joinPath(p.path, l.path);
          if (have.some((h) => h.path === path)) continue;
          have.push({
            path,
            depth: p.depth + 1,
            via: p.via ? `${p.via} → ${l.name}` : l.name,
            constant: p.constant,
          });
          added = true;
        }
        prefixes.set(id(target), have);
        if (added) queue.push(target);
      }
    }

    const routes: (RouteFinding & { file: string })[] = [];
    const unreachable = new Set<string>();
    for (const e of endpoints) {
      const list = prefixes.get(`${e.file}#${e.cls}`);
      if (!list?.length) {
        if (!unreachable.has(`${e.file}#${e.cls}`)) {
          unreachable.add(`${e.file}#${e.cls}`);
          gaps.push({
            file: e.file,
            line: e.line,
            text: `${e.cls}`,
            reason:
              'resource methods in a class with no @Path that no followed sub-resource locator returns; its URL is unknown',
          });
        }
        continue;
      }
      for (const p of list) {
        const inferred = p.depth > 0 || p.constant || e.viaConstant;
        routes.push({
          file: e.file,
          verb: e.verb,
          path: joinPath(p.path, e.path),
          handlerKey: e.handlerKey,
          line: e.line,
          confidence: inferred ? 'inferred' : 'observed',
          rule: p.depth > 0 ? 'jaxrs.sub-resource' : 'jaxrs.resource-method',
          detail: `@${e.verb} on ${e.handler}${p.via ? `, reached through ${p.via}` : ''}${p.constant || e.viaConstant ? '; path read from a constant' : ''}`,
        });
      }
    }
    return { routes, gaps };
  },
};
