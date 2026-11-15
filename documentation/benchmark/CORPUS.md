# Benchmark corpus (ACC-002)

Ground-truth files hold repository names, paths, symbol names and line numbers only, no source text.

| Repository                                                                              | Stack                                    | Commit                                     | Licence    | Ground truth                                                                                          | Status          |
| --------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------- | --------------- |
| [spring-projects/spring-petclinic](https://github.com/spring-projects/spring-petclinic) | Java 17, Spring MVC, Spring Data JPA     | `500158f732419217507c7656904b8e6aa1bcc0d6` | Apache-2.0 | [spring-petclinic.json](ground-truth/spring-petclinic.json): routes, entity tables, repository tables | claude-labelled |
| [immich-app/immich](https://github.com/immich-app/immich)                               | TypeScript, NestJS, Kysely, PostgreSQL   | `e5d6eb7be67834f59d90e4b7a86f5dec7ac9af86` | AGPL-3.0   | not yet                                                                                               | pinned          |
| Multi-module Spring Boot app                                                            | Java, Spring Boot, several Maven modules | not chosen                                 | —          | —                                                                                                     | to pick         |

Twenty (`1dd1c249ad213de6883be5296deb3bbba8420a22`, AGPL-3.0 with qualifications) and Keycloak (`a29205c`, Apache-2.0) were used in the audit baseline but are too large to label by hand in full; they are candidates for sampled labels later.
