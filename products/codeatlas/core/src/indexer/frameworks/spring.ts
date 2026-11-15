/**
 * Spring MVC and WebFlux annotated controllers (JV-003): `@Controller`/`@RestController`
 * classes, a class-level `@RequestMapping` prefix, and method-level `@GetMapping`,
 * `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping` and `@RequestMapping`.
 * Paths must be string literals; a constant or expression is reported as a gap.
 * Not read: functional `RouterFunction` routes, `server.servlet.context-path` and
 * `spring.mvc.servlet.path` prefixes, and mappings inherited from interfaces.
 */
import { annotationsAt, attribute, joinPath, pathsOf, type Annotation } from './annotations';
import type { RouteAdapter, RouteFinding, RouteGap } from './types';

const VERB_ANNOTATIONS: Record<string, string> = {
  GetMapping: 'GET',
  PostMapping: 'POST',
  PutMapping: 'PUT',
  DeleteMapping: 'DELETE',
  PatchMapping: 'PATCH',
};
const CONTROLLER = new Set(['Controller', 'RestController']);
const PATH_ATTRS = ['value', 'path'];

function verbsOf(a: Annotation): string[] {
  const fixed = VERB_ANNOTATIONS[a.name];
  if (fixed) return [fixed];
  const m = attribute(a.args, 'method');
  if (!m) return ['ANY'];
  const verbs = [...m.matchAll(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\b/g)].map(
    (x) => x[1]!,
  );
  return verbs.length ? verbs : ['ANY'];
}

export const springAdapter: RouteAdapter = {
  id: 'spring-mvc',
  name: 'Spring MVC / WebFlux annotations',
  languages: ['Java', 'Kotlin'],
  applies: (text) =>
    /\borg\.springframework\.(web\.bind\.annotation|stereotype)\b/.test(text) &&
    /@(Rest)?Controller\b/.test(text),
  routes({ text, declarations, constants }) {
    const routes: RouteFinding[] = [];
    const gaps: RouteGap[] = [];
    const byName = new Map(declarations.map((d) => [d.name, d]));
    const prefixes = new Map<string, string[] | null>();
    const constantPrefix = new Set<string>();
    for (const d of declarations) {
      if (d.kind !== 'class') continue;
      const anns = annotationsAt(text, d.line);
      if (!anns.some((a) => CONTROLLER.has(a.name))) continue;
      const rm = anns.find((a) => a.name === 'RequestMapping');
      const viaPrefix = { constant: false };
      const p = rm ? pathsOf(rm.args, PATH_ATTRS, constants, viaPrefix) : [''];
      if (p === null && rm)
        gaps.push({
          line: rm.line,
          text: `@RequestMapping(${rm.args ?? ''})`.slice(0, 200),
          reason: 'controller path prefix is not a string literal',
        });
      prefixes.set(d.name, p);
      if (viaPrefix.constant) constantPrefix.add(d.name);
    }
    for (const d of declarations) {
      if (d.kind !== 'method' && d.kind !== 'function') continue;
      const owner = d.name.slice(0, d.name.lastIndexOf('.'));
      const prefix = prefixes.get(owner);
      if (prefix === undefined || !byName.has(owner)) continue;
      for (const a of annotationsAt(text, d.line)) {
        if (!(a.name in VERB_ANNOTATIONS) && a.name !== 'RequestMapping') continue;
        const via = { constant: constantPrefix.has(owner) };
        const paths = pathsOf(a.args, PATH_ATTRS, constants, via);
        if (paths === null || prefix === null) {
          gaps.push({
            line: a.line,
            text: `@${a.name}(${a.args ?? ''})`.slice(0, 200),
            reason:
              paths === null
                ? 'mapping path is not a string literal'
                : 'controller path prefix is not a string literal',
          });
          continue;
        }
        for (const pre of prefix)
          for (const p of paths)
            for (const verb of verbsOf(a))
              routes.push({
                verb,
                path: joinPath(pre, p),
                handlerKey: d.key,
                line: a.line,
                // The mapping is written on the handler itself; a path taken from a constant
                // declared elsewhere is matched by name.
                confidence: via.constant ? 'inferred' : 'observed',
                rule: 'spring.request-mapping',
                detail: `@${a.name} on ${d.name}${pre ? ` under @RequestMapping("${pre}")` : ''}${via.constant ? '; path read from a constant' : ''}`,
              });
      }
    }
    return { routes, gaps };
  },
};
