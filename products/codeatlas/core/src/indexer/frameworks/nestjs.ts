/**
 * NestJS controllers (TS-002): `@Controller(prefix)` classes and `@Get`, `@Post`, `@Put`,
 * `@Patch`, `@Delete`, `@Options`, `@Head` and `@All` methods, with paths as string literals.
 * Not read: `app.setGlobalPrefix()`, `RouterModule` paths, URI versioning and `host` options,
 * so a route's full URL may carry a prefix the source sets elsewhere.
 */
import { annotationsAt, joinPath, pathsOf } from './annotations';
import type { RouteAdapter, RouteFinding, RouteGap } from './types';

const VERBS: Record<string, string> = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
  Options: 'OPTIONS',
  Head: 'HEAD',
  All: 'ANY',
};

export const nestAdapter: RouteAdapter = {
  id: 'nestjs',
  name: 'NestJS controller decorators',
  languages: ['TypeScript'],
  applies: (text) => /['"]@nestjs\/common['"]/.test(text) && /@Controller\s*\(/.test(text),
  routes({ text, declarations, constants }) {
    const routes: RouteFinding[] = [];
    const gaps: RouteGap[] = [];
    const prefixes = new Map<string, string[] | null>();
    const constantPrefix = new Set<string>();
    for (const d of declarations) {
      if (d.kind !== 'class') continue;
      const c = annotationsAt(text, d.line).find((a) => a.name === 'Controller');
      if (!c) continue;
      const viaPrefix = { constant: false };
      const p = pathsOf(c.args, ['path'], constants, viaPrefix);
      if (p === null)
        gaps.push({
          line: c.line,
          text: `@Controller(${c.args ?? ''})`.slice(0, 200),
          reason: 'controller path is not a string literal',
        });
      prefixes.set(d.name, p);
      if (viaPrefix.constant) constantPrefix.add(d.name);
    }
    for (const d of declarations) {
      if (d.kind !== 'method') continue;
      const owner = d.name.slice(0, d.name.lastIndexOf('.'));
      const prefix = prefixes.get(owner);
      if (prefix === undefined) continue;
      for (const a of annotationsAt(text, d.line)) {
        const verb = VERBS[a.name];
        if (!verb) continue;
        const via = { constant: constantPrefix.has(owner) };
        const paths = pathsOf(a.args, ['path'], constants, via);
        if (paths === null || prefix === null) {
          gaps.push({
            line: a.line,
            text: `@${a.name}(${a.args ?? ''})`.slice(0, 200),
            reason:
              paths === null
                ? 'route path is not a string literal'
                : 'controller path is not a string literal',
          });
          continue;
        }
        for (const pre of prefix)
          for (const p of paths)
            routes.push({
              verb,
              path: joinPath(pre, p),
              handlerKey: d.key,
              line: a.line,
              confidence: via.constant ? 'inferred' : 'observed',
              rule: 'nestjs.controller-route',
              detail: `@${a.name} on ${d.name}${pre ? ` in @Controller('${pre}')` : ''}${via.constant ? '; path read from a constant' : ''}; a global prefix set elsewhere is not included`,
            });
      }
    }
    return { routes, gaps };
  },
};
