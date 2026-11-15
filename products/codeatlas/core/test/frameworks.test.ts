// FW-001, JV-003, TS-002: framework route adapters (Spring MVC, NestJS).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexRepository, openDb } from '../src';
import {
  annotationsAt,
  joinPath,
  pathsOf,
  stringConstants,
} from '../src/indexer/frameworks/annotations';

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'codeatlas-routes-'));
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  }
  return root;
}

function routesOf(files: Record<string, string>) {
  const db = openDb(':memory:');
  const report = indexRepository(db, repo(files));
  const routes = db
    .prepare(
      `SELECT r.name AS route, h.name AS handler, e.confidence, e.method, e.evidence_line AS line
       FROM nodes r JOIN edges e ON e.src = r.id AND e.kind = 'handled_by' JOIN nodes h ON h.id = e.dst
       WHERE r.kind = 'route' ORDER BY r.name`,
    )
    .all() as {
    route: string;
    handler: string;
    confidence: string;
    method: string;
    line: number;
  }[];
  const gaps = db
    .prepare("SELECT line, reason FROM unresolved WHERE kind = 'route_handler' ORDER BY line")
    .all() as { line: number; reason: string }[];
  return { report, routes, gaps };
}

describe('annotation reader', () => {
  it('reads every annotation above a declaration, across lines, comments and modifiers', () => {
    const text = [
      'class A {',
      '  /** doc */',
      '  @Operation(summary = "x (y)",',
      '      description = "has ) inside")',
      '  // a comment',
      '  @GetMapping({ "/a", "/b" })',
      '  public @ResponseBody String m() { return ""; }',
      '}',
    ].join('\n');
    expect(annotationsAt(text, 3).map((a) => `${a.name}@${a.line}`)).toEqual([
      'Operation@3',
      'GetMapping@6',
      'ResponseBody@7',
    ]);
  });

  it('reads literal paths, arrays, named attributes and options objects', () => {
    expect(pathsOf('"/x"', ['value', 'path'])).toEqual(['/x']);
    expect(pathsOf('{ "/a", "/b" }', ['value', 'path'])).toEqual(['/a', '/b']);
    expect(pathsOf('value = "/v", method = RequestMethod.POST', ['value', 'path'])).toEqual(['/v']);
    expect(pathsOf('method = RequestMethod.GET', ['value', 'path'])).toEqual(['']);
    expect(pathsOf(null, ['path'])).toEqual(['']);
    expect(pathsOf("{ path: 'users', host: 'h' }", ['path'])).toEqual(['users']);
    expect(pathsOf("['a', 'b']", ['path'])).toEqual(['a', 'b']);
  });

  it('resolves a constant declared once, and refuses anything else that is not a literal', () => {
    const constants = stringConstants([
      {
        path: 'enum.ts',
        language: 'TypeScript',
        text: "export enum RouteKey { Asset = 'assets', User = 'users' }",
      },
      {
        path: 'Paths.java',
        language: 'Java',
        text: 'class Paths { public static final String API = "/api"; }',
      },
      { path: 'a.ts', language: 'TypeScript', text: "const DUP = 'one';" },
      { path: 'b.ts', language: 'TypeScript', text: "const DUP = 'two';" },
    ]);
    const used = { constant: false };
    expect(pathsOf('RouteKey.Asset', ['path'], constants, used)).toEqual(['assets']);
    expect(used.constant).toBe(true);
    expect(pathsOf('Paths.API', ['value'], constants)).toEqual(['/api']);
    expect(pathsOf('DUP', ['path'], constants)).toBeNull();
    expect(pathsOf('"/a" + SUFFIX', ['value'], constants)).toBeNull();
  });

  it('joins prefixes and paths with one slash', () => {
    expect(joinPath('/owners/{id}', '/pets/new')).toBe('/owners/{id}/pets/new');
    expect(joinPath('users', ':id')).toBe('/users/:id');
    expect(joinPath('', '')).toBe('/');
  });
});

const SPRING_IMPORTS =
  'package com.acme;\n\nimport org.springframework.stereotype.Controller;\nimport org.springframework.web.bind.annotation.*;\n\n';

describe('Spring MVC adapter (JV-003)', () => {
  const { report, routes, gaps } = routesOf({
    'src/main/java/com/acme/Paths.java':
      'package com.acme;\n\npublic class Paths {\n    public static final String VISITS = "/visits";\n}\n',
    'src/main/java/com/acme/OwnerController.java':
      SPRING_IMPORTS +
      '@Controller\n@RequestMapping("/owners/{ownerId}")\nclass OwnerController {\n' +
      '    @GetMapping({ "/pets", "/animals" })\n    public String list() { return "x"; }\n\n' +
      '    @RequestMapping(value = "/pets/new", method = RequestMethod.POST)\n    public String create() { return "x"; }\n\n' +
      '    @PostMapping(Paths.VISITS)\n    public String visit() { return "x"; }\n\n' +
      '    @GetMapping(BASE + "/x")\n    public String dynamic() { return "x"; }\n\n' +
      '    public String notMapped() { return "x"; }\n}\n',
    'src/main/java/com/acme/HelperNotController.java':
      SPRING_IMPORTS +
      'class HelperNotController {\n    @GetMapping("/never")\n    public String m() { return "x"; }\n}\n',
  });

  it('finds each mapping with the class prefix, verb and handler', () => {
    expect(routes.map((r) => `${r.route} -> ${r.handler} (${r.confidence})`)).toEqual([
      'GET /owners/{ownerId}/animals -> OwnerController.list (observed)',
      'GET /owners/{ownerId}/pets -> OwnerController.list (observed)',
      'POST /owners/{ownerId}/pets/new -> OwnerController.create (observed)',
      'POST /owners/{ownerId}/visits -> OwnerController.visit (inferred)',
    ]);
    expect(new Set(routes.map((r) => r.method))).toEqual(new Set(['spring.request-mapping']));
    expect(report.routeAdapters.find((a) => a.id === 'spring-mvc')).toMatchObject({
      routes: 4,
      gaps: 1,
    });
    expect(report.routes).toBe(4);
  });

  it('records a mapping it cannot read instead of guessing', () => {
    expect(gaps).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/not a string literal/) }),
    ]);
  });
});

describe('NestJS adapter (TS-002)', () => {
  const { routes, report } = routesOf({
    'package.json': JSON.stringify({ name: 'api', dependencies: { '@nestjs/common': '10.0.0' } }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { experimentalDecorators: true } }),
    'src/enum.ts': "export enum RouteKey {\n  Asset = 'assets',\n}\n",
    'src/users.controller.ts': [
      "import { Controller, Get, Post, Param } from '@nestjs/common';",
      "import { RouteKey } from './enum';",
      '',
      "@Controller('users')",
      'export class UsersController {',
      "  @Get(':id')",
      "  findOne(@Param('id') id: string) {",
      '    return id;',
      '  }',
      '',
      '  @Post()',
      '  create() {',
      '    return 1;',
      '  }',
      '}',
      '',
      '@Controller(RouteKey.Asset)',
      'export class AssetController {',
      "  @Get('stats')",
      '  stats() {',
      '    return 0;',
      '  }',
      '}',
      '',
    ].join('\n'),
    'src/other.ts':
      "function Controller(_p: string) { return (_c: unknown) => undefined; }\n@Controller('nope')\nexport class NotNest {}\n",
  });

  it('finds controller routes with prefixes and handlers, enum prefixes as inferred', () => {
    expect(routes.map((r) => `${r.route} -> ${r.handler} (${r.confidence})`)).toEqual([
      'GET /assets/stats -> AssetController.stats (inferred)',
      'GET /users/:id -> UsersController.findOne (observed)',
      'POST /users -> UsersController.create (observed)',
    ]);
    expect(routes.every((r) => r.method === 'nestjs.controller-route')).toBe(true);
    expect(report.routeAdapters.find((a) => a.id === 'nestjs')).toMatchObject({
      files: 1,
      routes: 3,
    });
  });
});
