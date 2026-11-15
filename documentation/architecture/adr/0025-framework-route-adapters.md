# ADR 0025: Framework route adapters

- Status: accepted
- Date: 2026-11-15
- Roadmap: FW-001 (partial), TS-002, JV-003 (Sprint 2)

## Context

The audit found 0 of 17 Spring PetClinic endpoints and 0 of about 317 Immich NestJS endpoints (risks T-01, T-02). Routes were read only for Next.js and Express, inside the TypeScript indexer. Java and NestJS routes are declared with annotations or decorators whose path may be a string literal, a TypeScript enum member or const, or a Java `static final String`.

## Decision

1. `products/codeatlas/core/src/indexer/frameworks/` holds a `RouteAdapter` interface (`id`, `name`, `languages`, `applies(text)`, `routes({path, text, declarations, constants})`). Adapters read annotations from the source text at each declaration line that the existing symbol pass already found; they do not parse a second time.
2. Two adapters ship: `spring-mvc` (Java and Kotlin `@Controller`/`@RestController`, the class `@RequestMapping` prefix, `@Get/Post/Put/Delete/PatchMapping` and `@RequestMapping(method = …)`) and `nestjs` (TypeScript files that import `@nestjs/common` and use `@Controller(`, with `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Options`, `@Head` and `@All`).
3. A path written as a literal is **observed**. A path taken from a constant resolved repository-wide is **inferred**; a constant name defined more than once with different values is not used. A path that is neither is recorded as an unresolved `route_handler` gap, never guessed.
4. Each route is a `route` node keyed `VERB /path` and linked to its handler method with a `handled_by` edge that carries the catalogued rule (`spring.request-mapping`, `nestjs.controller-route`).
5. The NestJS global prefix (`app.setGlobalPrefix`) and Spring `server.servlet.context-path` are not added to paths. The assessment states paths are relative to the application root.
6. Next.js and Express stay in the TypeScript indexer for now. Moving them behind the interface is left open, so FW-001 is partial; their existing tests are unchanged.

## Consequences

- Measured on 2026-11-15: Spring PetClinic 17 of 17 method mappings with the right prefix and handler; Immich 315 routes against 317 decorators in `server/src`, the other 2 inside a class in a `.spec.ts` file. Immich paths have not been checked by hand; that waits for the benchmark ground truth (D-9).
- JAX-RS (JX-001, Keycloak) and WebFlux functional routes are not covered yet.
- Adding a framework means adding an adapter and a catalogue rule, with a fixture test.
