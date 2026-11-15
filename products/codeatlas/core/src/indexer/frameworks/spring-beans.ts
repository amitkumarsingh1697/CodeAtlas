/**
 * Spring bean wiring (JV-002): which bean each Spring bean is given, read from Java source.
 *
 * Beans: classes annotated `@Component`, `@Service`, `@Repository`, `@Controller`,
 * `@RestController`, `@Configuration` or `@ConfigurationProperties`; interfaces that extend a Spring Data repository type; and
 * `@Bean` methods in `@Configuration` or `@Component` classes (the bean is the method's return
 * type).
 *
 * Injection points of a bean: the parameters of its only constructor, or of the constructor
 * annotated `@Autowired` or `@Inject`; fields annotated `@Autowired`, `@Inject` or `@Resource`;
 * parameters of methods annotated `@Autowired` or `@Inject`; and the parameters of `@Bean` methods.
 * `List<T>`, `Set<T>`, `Collection<T>` and `Map<String, T>` take every bean of T; `Optional<T>`,
 * `ObjectProvider<T>` and `Provider<T>` take one.
 *
 * A point is resolved to the beans whose class (or `@Bean` return type) is T or has T among its
 * supertypes, read by simple name across the repository. With more than one candidate,
 * `@Qualifier("name")` or `@Resource(name = "name")` picks by bean name and `@Primary` picks the
 * primary one; otherwise the point is a gap. A type no bean provides (String, framework beans,
 * values) is not linked and not a gap: Spring or a library supplies it.
 *
 * Every link is inferred (rule `spring.injection`): Spring decides at run time, and profiles,
 * `@Conditional` beans, component-scan limits and beans defined in XML or by libraries are not read.
 * Kotlin and custom stereotype annotations are not read.
 */
import { parseTree, type SyntaxNode as N } from '@nexora/syntax';
import type { GraphBuilder, NodeRec, NodeRef } from '../model';
import { isTestSupportPath } from '../test-paths';

export interface BeanClass {
  path: string;
  pkg: string;
  name: string;
  line: number;
  imports: string[];
  /** Simple names of the supertypes as written. */
  bases: string[];
  /** Stereotype annotation, `spring-data` for a repository interface, or undefined (not a bean). */
  stereotype?: string;
  /** Bean name from `@Component("name")` and its relatives. */
  beanName?: string;
  primary: boolean;
  points: InjectionPoint[];
  beanMethods: BeanMethod[];
}

export interface BeanMethod {
  name: string;
  line: number;
  returnType: string;
  beanNames: string[];
  primary: boolean;
  points: InjectionPoint[];
}

export interface InjectionPoint {
  /** constructor, field, setter or bean-method parameter. */
  via: 'constructor' | 'field' | 'method' | 'bean-method';
  /** Field or parameter name. */
  name: string;
  /** The type injected (generics stripped), and whether every bean of it is wanted. */
  type: string;
  many: boolean;
  qualifier?: string;
  line: number;
}

const STEREOTYPES = new Set([
  'Component',
  'Service',
  'Repository',
  'Controller',
  'RestController',
  'Configuration',
  // Registered by @EnableConfigurationProperties or @ConfigurationPropertiesScan.
  'ConfigurationProperties',
]);
const SPRING_DATA =
  /^(Jpa|Crud|ListCrud|PagingAndSorting|ListPagingAndSorting|Reactive|ReactiveCrud|Mongo|Elasticsearch)?Repository$/u;
const INJECT_ANN = new Set(['Autowired', 'Inject']);
const MANY = new Set(['List', 'Set', 'Collection', 'Iterable', 'Map']);
const ONE_OF = new Set(['Optional', 'ObjectProvider', 'Provider', 'Lazy']);
const SPRING_IMPORT = /\bimport\s+(org\.springframework|jakarta\.inject|javax\.inject)\./u;

function named(n: N | null | undefined): N[] {
  const out: N[] = [];
  if (!n) return out;
  for (let i = 0; i < n.namedChildCount; i++) {
    const c = n.namedChild(i);
    if (c) out.push(c);
  }
  return out;
}
const field = (n: N | null | undefined, f: string) => (n ? n.childForFieldName(f) : null);
const lineOf = (n: N) => n.startPosition.row + 1;

interface Ann {
  name: string;
  /** The single string argument, `value = "…"` or `name = "…"`. */
  value?: string;
  /** `@Bean(name = {"a", "b"})` and `@Bean({"a", "b"})`. */
  values: string[];
}

function annotations(mods: N | null | undefined): Ann[] {
  return named(mods)
    .filter((a) => a.type === 'annotation' || a.type === 'marker_annotation')
    .map((a) => {
      const name = (field(a, 'name')?.text ?? '').split('.').pop()!;
      const args = field(a, 'arguments')?.text ?? '';
      const values = [...args.matchAll(/"((?:[^"\\]|\\.)*)"/gu)].map((m) => m[1]!);
      // Only the value or name element names the bean; other elements (required = false) do not.
      const named = /^\(\s*(?:(?:value|name)\s*=\s*)?(\{[^}]*\}|"[^"]*")/u.exec(args);
      return { name, value: named ? values[0] : undefined, values: named ? values : [] };
    });
}

const modsOf = (n: N) => named(n).find((c) => c.type === 'modifiers');

/** `Map<String, Foo>` → { type: 'Foo', many: true }; `Optional<Foo>` → Foo; `a.b.Foo` → Foo. */
export function injectedType(t: string): { type: string; many: boolean } {
  const s = t.replace(/@\w+(\([^)]*\))?\s*/gu, '').trim();
  const m = /^([\w.]+)\s*<(.*)>$/su.exec(s);
  if (m) {
    const outer = m[1]!.split('.').pop()!;
    const args = m[2]!.split(',').map((x) => x.trim());
    if (MANY.has(outer)) return { type: injectedType(args[args.length - 1]!).type, many: true };
    if (ONE_OF.has(outer)) return injectedType(args[0]!);
    return { type: outer, many: false };
  }
  return { type: s.replace(/\[\]$/u, '').split('.').pop()!, many: false };
}

function params(decl: N, via: InjectionPoint['via']): InjectionPoint[] {
  const out: InjectionPoint[] = [];
  for (const p of named(field(decl, 'parameters'))) {
    if (p.type !== 'formal_parameter' && p.type !== 'spread_parameter') continue;
    const type = field(p, 'type')?.text;
    const name = field(p, 'name')?.text ?? '';
    if (!type) continue;
    const anns = annotations(modsOf(p));
    const q = anns.find((a) => a.name === 'Qualifier' || a.name === 'Named')?.value;
    out.push({ via, name, ...injectedType(type), ...(q ? { qualifier: q } : {}), line: lineOf(p) });
  }
  return out;
}

function baseNames(c: N): string[] {
  const out: string[] = [];
  const add = (n: N | null) => {
    if (!n) return;
    for (const t of n.descendantsOfType([
      'type_identifier',
      'scoped_type_identifier',
      'generic_type',
    ])) {
      if (
        t.parent &&
        (t.parent.type === 'type_arguments' || t.parent.type === 'scoped_type_identifier')
      )
        continue;
      const raw = t.type === 'generic_type' ? (named(t)[0]?.text ?? t.text) : t.text;
      out.push(raw.split('.').pop()!);
    }
  };
  add(field(c, 'superclass'));
  add(field(c, 'interfaces'));
  add(named(c).find((x) => x.type === 'extends_interfaces') ?? null);
  return [...new Set(out)];
}

/** Bean classes, bean methods and their injection points in one Java file. */
export function readSpringBeans(path: string, source: string): BeanClass[] {
  if (!SPRING_IMPORT.test(source)) return [];
  const tree = parseTree('java', source);
  if (tree instanceof Error) return [];
  try {
    const root = tree.rootNode;
    const pkg =
      named(root)
        .find((n) => n.type === 'package_declaration')
        ?.text.replace(/^package\s+|\s*;$/gu, '') ?? '';
    const imports = named(root)
      .filter((n) => n.type === 'import_declaration')
      .map((n) => n.text.replace(/^import\s+(static\s+)?|\s*;$/gu, ''));
    const out: BeanClass[] = [];
    for (const c of root.descendantsOfType([
      'class_declaration',
      'interface_declaration',
      'record_declaration',
    ])) {
      const name = field(c, 'name')?.text;
      if (!name) continue;
      const anns = annotations(modsOf(c));
      const bases = baseNames(c);
      const st = anns.find((a) => STEREOTYPES.has(a.name));
      const stereotype =
        st?.name ??
        (c.type === 'interface_declaration' && bases.some((b) => SPRING_DATA.test(b))
          ? 'spring-data'
          : undefined);
      const body = field(c, 'body');
      const members = named(body);
      const k: BeanClass = {
        path,
        pkg,
        name,
        line: lineOf(c),
        imports,
        bases,
        ...(stereotype ? { stereotype } : {}),
        ...(st?.value ? { beanName: st.value } : {}),
        primary: anns.some((a) => a.name === 'Primary'),
        points: [],
        beanMethods: [],
      };
      if (stereotype && stereotype !== 'spring-data') {
        const ctors = members.filter((m) => m.type === 'constructor_declaration');
        const marked = ctors.filter((m) =>
          annotations(modsOf(m)).some((a) => INJECT_ANN.has(a.name)),
        );
        const ctor = marked.length === 1 ? marked[0] : ctors.length === 1 ? ctors[0] : undefined;
        if (ctor) k.points.push(...params(ctor, 'constructor'));
        for (const f of members.filter((m) => m.type === 'field_declaration')) {
          const fa = annotations(modsOf(f));
          const inj = fa.find((a) => INJECT_ANN.has(a.name) || a.name === 'Resource');
          if (!inj) continue;
          const type = field(f, 'type')?.text;
          if (!type) continue;
          const q =
            fa.find((a) => a.name === 'Qualifier' || a.name === 'Named')?.value ??
            (inj.name === 'Resource' ? inj.value : undefined);
          for (const d of named(f).filter((x) => x.type === 'variable_declarator'))
            k.points.push({
              via: 'field',
              name: field(d, 'name')?.text ?? '',
              ...injectedType(type),
              ...(q ? { qualifier: q } : {}),
              line: lineOf(f),
            });
        }
        for (const m of members.filter((x) => x.type === 'method_declaration')) {
          const ma = annotations(modsOf(m));
          if (ma.some((a) => INJECT_ANN.has(a.name))) k.points.push(...params(m, 'method'));
          const bean = ma.find((a) => a.name === 'Bean');
          if (bean && (stereotype === 'Configuration' || stereotype === 'Component')) {
            const mname = field(m, 'name')?.text ?? '';
            const rt = field(m, 'type')?.text ?? 'void';
            k.beanMethods.push({
              name: mname,
              line: lineOf(m),
              returnType: injectedType(rt).type,
              beanNames: bean.values.length ? bean.values : [mname],
              primary: ma.some((a) => a.name === 'Primary'),
              points: params(m, 'bean-method'),
            });
          }
        }
      }
      out.push(k);
    }
    return out;
  } finally {
    tree.delete();
  }
}

export interface Provider {
  kind: 'class' | 'bean-method';
  cls: BeanClass;
  method?: BeanMethod;
  names: string[];
  primary: boolean;
}

export interface Injection {
  consumer: { cls: BeanClass; method?: BeanMethod };
  point: InjectionPoint;
  providers: Provider[];
}

export interface InjectionGap {
  cls: BeanClass;
  point: InjectionPoint;
  reason: string;
  candidates: number;
}

const decap = (s: string) => (/^[A-Z]{2}/u.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** Resolves every injection point against the beans of the repository. */
export function resolveSpringBeans(classes: BeanClass[]): {
  injections: Injection[];
  gaps: InjectionGap[];
} {
  const byName = new Map<string, BeanClass[]>();
  for (const c of classes) byName.set(c.name, [...(byName.get(c.name) ?? []), c]);
  /** The class a simple type name means from `from`: same package, explicit import, else the only one. */
  const classFor = (type: string, from: BeanClass): BeanClass | undefined => {
    const cands = byName.get(type) ?? [];
    if (cands.length <= 1) return cands[0];
    const imported = cands.filter((c) => from.imports.includes(`${c.pkg}.${c.name}`));
    if (imported.length === 1) return imported[0];
    const same = cands.filter((c) => c.pkg === from.pkg);
    return same.length === 1 ? same[0] : undefined;
  };
  /** All supertypes by simple name, transitively, through classes of the repository. */
  const supers = new Map<BeanClass, Set<string>>();
  const supersOf = (c: BeanClass, seen = new Set<BeanClass>()): Set<string> => {
    const hit = supers.get(c);
    if (hit) return hit;
    const out = new Set<string>([c.name]);
    if (seen.has(c)) return out;
    seen.add(c);
    for (const b of c.bases) {
      out.add(b);
      const bc = classFor(b, c);
      if (bc) for (const s of supersOf(bc, seen)) out.add(s);
    }
    supers.set(c, out);
    return out;
  };

  const providers: Provider[] = [];
  for (const c of classes) {
    if (c.stereotype)
      providers.push({
        kind: 'class',
        cls: c,
        names: [c.beanName ?? decap(c.name)],
        primary: c.primary,
      });
    for (const m of c.beanMethods)
      providers.push({
        kind: 'bean-method',
        cls: c,
        method: m,
        names: m.beanNames,
        primary: m.primary,
      });
  }
  const provides = (p: Provider, type: string): boolean => {
    if (p.kind === 'class') return supersOf(p.cls).has(type);
    const rt = p.method!.returnType;
    if (rt === type) return true;
    const rc = classFor(rt, p.cls);
    return !!rc && supersOf(rc).has(type);
  };

  const injections: Injection[] = [];
  const gaps: InjectionGap[] = [];
  const resolve = (cls: BeanClass, point: InjectionPoint, method?: BeanMethod) => {
    let cands = providers.filter((p) => provides(p, point.type));
    // A bean is not injected into itself (a decorator taking the interface it implements).
    cands = cands.filter((p) => !(p.kind === 'class' && p.cls === cls && !method));
    if (!cands.length) return; // supplied by Spring, a library, or configuration
    if (point.qualifier) {
      const q = cands.filter((p) => p.names.includes(point.qualifier!));
      if (q.length !== 1) {
        gaps.push({
          cls,
          point,
          reason: `no single bean named "${point.qualifier}" of this type`,
          candidates: cands.length,
        });
        return;
      }
      cands = q;
    } else if (!point.many && cands.length > 1) {
      const primary = cands.filter((p) => p.primary);
      // Spring also matches a field or parameter name to a bean name.
      const byParam = cands.filter((p) => p.names.includes(point.name));
      if (primary.length === 1) cands = primary;
      else if (byParam.length === 1) cands = byParam;
      else {
        gaps.push({
          cls,
          point,
          reason: 'more than one bean of this type, and none is primary or qualified',
          candidates: cands.length,
        });
        return;
      }
    }
    injections.push({ consumer: { cls, ...(method ? { method } : {}) }, point, providers: cands });
  };
  for (const c of classes) {
    if (!c.stereotype || c.stereotype === 'spring-data') continue;
    for (const p of c.points) resolve(c, p);
    for (const m of c.beanMethods) for (const p of m.points) resolve(c, p, m);
  }
  return { injections, gaps };
}

export interface SpringBeanStats {
  beans: number;
  points: number;
  linked: number;
  gaps: number;
}

/** Adds `injects` edges from each Spring bean to the beans it is given. */
export function addSpringBeans(
  graph: GraphBuilder,
  files: { path: string; language: string }[],
  texts: Map<string, string>,
): SpringBeanStats {
  const classes: BeanClass[] = [];
  for (const f of files) {
    if (f.language !== 'Java' || isTestSupportPath(f.path)) continue;
    const text = texts.get(f.path);
    if (text !== undefined) classes.push(...readSpringBeans(f.path, text));
  }
  const stats: SpringBeanStats = { beans: 0, points: 0, linked: 0, gaps: 0 };
  for (const c of classes) {
    if (c.stereotype) stats.beans++;
    stats.beans += c.beanMethods.length;
    if (c.stereotype && c.stereotype !== 'spring-data')
      stats.points += c.points.length + c.beanMethods.reduce((n, m) => n + m.points.length, 0);
  }
  if (!stats.beans) return stats;
  const { injections, gaps } = resolveSpringBeans(classes);

  const byFile = new Map<string, NodeRec[]>();
  for (const n of graph.nodes.values())
    if (n.kind === 'symbol' && n.filePath)
      byFile.set(n.filePath, [...(byFile.get(n.filePath) ?? []), n]);
  /** The symbol of this name in the file nearest the line (classes may be nested, methods overloaded). */
  const symbol = (path: string, name: string, line: number): NodeRef => {
    const cands = (byFile.get(path) ?? []).filter(
      (n) => n.name === name || n.name.endsWith(`.${name}`),
    );
    cands.sort((a, b) => Math.abs((a.startLine ?? 0) - line) - Math.abs((b.startLine ?? 0) - line));
    const n = cands[0];
    return n ? { kind: n.kind, key: n.key } : { kind: 'file', key: path };
  };
  const nodeOf = (cls: BeanClass, method?: BeanMethod) =>
    method
      ? symbol(cls.path, `${cls.name}.${method.name}`, method.line)
      : symbol(cls.path, cls.name, cls.line);

  for (const inj of injections) {
    const src = nodeOf(inj.consumer.cls, inj.consumer.method);
    for (const p of inj.providers) {
      const dst = nodeOf(p.cls, p.method);
      graph.addEdge({
        kind: 'injects',
        method: 'spring.injection',
        src,
        dst,
        confidence: 'inferred',
        evidencePath: inj.consumer.cls.path,
        evidenceLine: inj.point.line,
        detail: `${inj.consumer.method ? `@Bean ${inj.consumer.method.name}` : inj.consumer.cls.name} is given ${p.method ? `@Bean ${p.method.name}` : p.cls.name} (${inj.point.via} ${inj.point.name}: ${inj.point.many ? 'every ' : ''}${inj.point.type})`,
      });
    }
    stats.linked++;
  }
  for (const g of gaps) {
    stats.gaps++;
    graph.addUnresolved({
      filePath: g.cls.path,
      line: g.point.line,
      kind: 'injection',
      text: `${g.cls.name} ${g.point.via} ${g.point.name}: ${g.point.type}`,
      reason: `${g.reason} (${g.candidates} candidates)`,
    });
  }
  return stats;
}
