# Java / Spring capability sheet (JV-007)

What CodeAtlas reads in a Java repository, how well, and what it cannot see. The roadmap's Java gate says to sell only the scope that passed (`docs/audit/IMPLEMENTATION_ROADMAP.md`, Sprint 4 exit).

Every figure below was measured on 2026-11-15 by running CodeAtlas with default options: no SCIP index, no model, no build tool. The ground truth is **claude-labelled**, meaning Claude labelled it and no human has reviewed it (decision D-9 is open). These figures are for engineering use only and must not be quoted externally until a ground-truth file is `adjudicated` (see [benchmark/README.md](../benchmark/README.md)).

## 1. Measured accuracy

| Relationship                                | spring-petclinic `500158f` (P / R) | jhipster-sample-app `6b000b5` (P / R) | Evidence class |
| ------------------------------------------- | ---------------------------------- | ------------------------------------- | -------------- |
| `handled_by` (HTTP route → handler method)  | 100% / 100% (17)                   | 100% / 100% (38)                      | observed       |
| `maps_to` (entity → table)                  | 100% / 100% (6)                    | 100% / 100% (5)                       | observed       |
| `reads_table` (repository or query → table) | 100% / 100% (7)                    | 100% / 100% (27)*                     | mixed          |
| `writes_table` (repository → table)         | 100% / 100% (2)                    | 100% / 100% (5)                       | inferred       |
| `injects` (Spring bean → bean it is given)  | 100% / 100% (6)                    | 100% / 100% (20)                      | inferred       |

Both repositories are small, single-module Spring Boot applications, and the route, ORM and bean readers were written with PetClinic open. These figures do not predict accuracy on a large or unusual codebase. A multi-module Maven or Gradle repository has not been benchmarked yet (JV-001).

\* The first JHipster run found 19 of 27 table reads. The 8 misses were JPQL association paths (6, such as `left join fetch bankAccount.user`) and `@EntityGraph` fetches (2). Rules `orm.jpa-path-join` and `orm.entity-graph` were then added and now find all 27. Because the fix was written against this benchmark, the 100% no longer measures them independently. On Keycloak, 10 of 10 sampled path-join links were correct when checked by hand against the named query text.

The details and the per-run history are in [BENCHMARK_HISTORY.md](../benchmark/BENCHMARK_HISTORY.md).

Not benchmarked yet:

- Calls (`calls`). 24 of 24 sampled edges were correct in the audit, but that sample is not a benchmark.
- Flows from routes to tables (PetClinic: 9 of 17 routes reach a table; JHipster: 34 of 48).
- JAX-RS routes (Keycloak: 485 routes).
- Keycloak as a whole.

## 2. What is read

| Area                    | Read                                                                                                                                                      | Rule ids                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Declarations and calls  | Classes, interfaces, methods and fields by tree-sitter. Calls are resolved through declared field, parameter and local types, imports and inheritance.    | `syntax.call.*`                                                                 |
| Spring MVC routes       | `@RequestMapping` and its verb shortcuts, class prefix joined, several paths per mapping                                                                  | `spring.request-mapping`                                                        |
| JAX-RS routes           | `@Path` resources and sub-resource locators across files                                                                                                  | `jaxrs.resource-method`, `jaxrs.sub-resource`                                   |
| JPA entities            | `@Entity`, `@Table`, `@MappedSuperclass`, field-access columns and associations                                                                           | `orm.*`                                                                         |
| Spring Data             | Repository interfaces (including a bare `Repository<T, ID>`) → aggregate table; declared finders → table                                                  | `orm.repository-table`, `spring-data.derived-query`                             |
| JPA queries             | Literal JPQL or SQL in `@Query`, `@NamedQuery`, `createQuery`, `createNativeQuery`, `createNamedQuery`; association paths; `@EntityGraph(attributePaths)` | `orm.jpa-query`, `orm.jpa-named-query`, `orm.jpa-path-join`, `orm.entity-graph` |
| Spring beans            | Stereotype classes, `@ConfigurationProperties`, `@Bean` methods; constructor, field, setter and `@Bean` parameter injection; `@Qualifier`, `@Primary`     | `spring.injection`                                                              |
| Inherited CRUD calls    | `repo.save(x)` on a Spring Data repository links to the repository class                                                                                  | `syntax.call.library-member`                                                    |
| Build and configuration | Maven `pom.xml` and Gradle files as structured keys (values never stored); Spring XML bean classes                                                        | see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)                                |

## 3. Constructs CodeAtlas cannot resolve

CodeAtlas reads source only. It never runs the build or the application, so anything Spring, the JVM or a library decides at run time is invisible. For each such construct, the table gives how often it occurs in the three Java corpora and what a reader sees. The counts come from a grep of `src/main/java` (PetClinic, JHipster) or of every `src/main/java` tree (Keycloak), each file counted once.

| Construct                                                                                               | PetClinic (30 files) | JHipster (81) |           Keycloak `a29205c` (6,479) | What CodeAtlas does                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | -------------------: | ------------: | -----------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spring profiles (`@Profile`)                                                                            |                    0 |       4 files |                                    0 | Ignored: every bean is treated as active, so a link can hold only in some profiles. Every `injects` link is labelled inferred for this reason.                                                                                                                     |
| Conditional beans (`@Conditional…`)                                                                     |                    0 |        1 file |                                    0 | Ignored, as for profiles.                                                                                                                                                                                                                                          |
| AOP and proxies (`@Aspect`; `@Transactional`, `@Cacheable`, `@Async`, `@PreAuthorize` and similar)      |               1 file |      10 files |                                    0 | Not modelled. A call goes to the target method, and advice or a proxy that runs around it (transactions, caching, security checks, logging) does not appear in flows or impact.                                                                                    |
| Scheduled jobs (`@Scheduled`)                                                                           |                    0 |        1 file |                                    0 | The method is a symbol, not an entry point. Flows do not start from it.                                                                                                                                                                                            |
| Reflection (`Class.forName`, `getMethod`, `getDeclaredMethod`, `newInstance`, `Proxy.newProxyInstance`) |                    0 |             0 |                             86 files | Not followed. The call is to the reflection API, not to the class or method it reaches.                                                                                                                                                                            |
| `ServiceLoader` and Keycloak's provider lookup (`session.getProvider(X.class)`)                         |                    0 |             0 | 18 files; 1,047 `getProvider(` calls | Not followed. A provider interface is linked to its callers, and its implementations are reached only through inheritance (`implements`), not as call targets.                                                                                                     |
| CDI (`@Inject`, `@Produces` outside Spring stereotype classes)                                          |                    0 |             0 |                            243 files | Not read as injection. Bean wiring covers Spring only.                                                                                                                                                                                                             |
| Method references (`repo::findById`; lambdas `x -> …` not counted)                                      |               1 file |      16 files |                            866 files | Method references are not resolved to the method. Calls inside a lambda belong to the enclosing method, and a call on an untyped lambda parameter (`user -> user.setActivated(true)`) stays unresolved. Checked on `UserService.activateRegistration` in JHipster. |
| Spring Data repository fragments (`FooRepositoryImpl` behind `FooRepository`)                           |                    0 |        1 file |                                    0 | The fragment's own queries are read. The proxy that connects `FooRepository.fetchX` to `FooRepositoryImpl.fetchX` is not, so a flow through the repository stops there.                                                                                            |
| Framework lookups with no injection point (`userDetailsService`, `auditorAwareRef`)                     |                    0 |       2 beans |                                    — | No link: nothing in the code receives the bean.                                                                                                                                                                                                                    |
| Selecting an association (`select p.owner from Pet p`); named entity graphs                             |                    0 |             0 |                              unknown | Not read. Association paths in JOIN and WHERE, and `@EntityGraph(attributePaths)`, are read (rules `orm.jpa-path-join`, `orm.entity-graph`). A path that only compares an association or its id is assumed to join nothing (R46, not confirmed against Hibernate). |
| Criteria API, `em.find(Entity.class)`, query text built at run time                                     |                    0 |             0 |                              unknown | A `createQuery(...)` call whose text is not a literal is recorded as a `query` gap. Criteria API and `em.find` calls are skipped.                                                                                                                                  |
| Lombok (`lombok.*`)                                                                                     |                    0 |             0 |                                    0 | Generated getters, setters and constructors are invisible. A Lombok `@RequiredArgsConstructor` bean has no injection points.                                                                                                                                       |
| Kotlin Spring applications                                                                              |                    — |             — |                                    — | Kotlin is parsed. The Spring MVC route reader also accepts Kotlin files, but no test or corpus covers it. Kotlin beans and JPA queries are not read.                                                                                                               |

"Unknown" means the construct was not counted in that corpus; it does not mean zero.

## 4. How to read a Java result

- An **observed** link was read straight from one source construct, for example a route annotation on its method, an `@Table` name, or a call to a member of the same class.
- An **inferred** link follows a rule. Bean wiring, Spring Data repository tables and calls resolved through declared types are inferred, because profiles, proxies and run-time types can change the answer.
- A **gap** (unresolved reference) is something CodeAtlas saw but could not resolve. The coverage report counts gaps by kind (`call`, `route_handler`, `heritage`, `config`, `query`, `injection`) and says how many it dropped past the 5,000-per-kind cap.
- The constructs in §3 mostly produce **no link and no gap**. Treat a missing link as "not seen", never as "does not exist".
- For compiler-grade call links, run `scip-java` in your build and pass `--scip <file>` (CLI only; ADR 0018).
