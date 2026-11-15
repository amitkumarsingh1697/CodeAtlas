# Adjudication guide (ACC-001)

**Status:** draft, 2026-11-15. Decision D-9 (2026-11-15) settles who reviews: Claude labels, and the founder checks a random 10% sample of each file. A file stays `claude-labelled` until that check is done.

## 1. What a label is

A label is one relationship a person found in the source of a pinned commit: a type, a source key, a target key and the file and line that prove it. Keys use CodeAtlas node-key spelling so matching is exact after normalisation (`normaliseKey`):

| Kind        | Key form                                  | Example                                                  |
| ----------- | ----------------------------------------- | -------------------------------------------------------- |
| Route       | `VERB /path`                              | `GET /owners/{ownerId}`                                  |
| Code symbol | `<repo-relative file>#<Container.member>` | `src/.../OwnerController.java#OwnerController.showOwner` |
| Table       | `table:<name>`                            | `table:owners`                                           |

Labels are written from the source, never copied from CodeAtlas output. A labeller may compare with CodeAtlas afterwards to look for labels they missed, but must confirm each addition in the source.

## 2. Relationship types and rules (v1)

| Type           | Counts                                                                                                                                        | Does not count                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `handled_by`   | One per HTTP verb and path declared by a framework annotation or decorator, to the method that handles it; class-level prefixes joined        | Servlet context path, NestJS global prefix, routes built at run time                                       |
| `maps_to`      | An entity or model class to its own primary table (explicit name or the framework default)                                                    | Mapped superclasses; join tables (`@JoinTable`), which need their own type                                 |
| `reads_table`  | A repository or data-access class to the table of the aggregate it names                                                                      | Tables reached only through cascades or eager fetches                                                      |
| `writes_table` | As `reads_table`, only when the class declares or inherits a write method (save, delete, `@Modifying`)                                        | A read-only repository (for example Spring Data `Repository<T, ID>` with finders only)                     |
| `calls`        | A call site to the method the declared type resolves to. **A call through an interface targets the interface method, not an implementation.** | Calls whose target is only known at run time (callbacks, reflection, dynamic dispatch on an untyped value) |
| `imports`      | A file to the file or package its import statement resolves to                                                                                | External packages that are not in the repository                                                           |

## 3. Scope

Each ground-truth file names, per type, the folders whose relationships of that type were **all** labelled. A prediction of that type counts only when its source file lies in one of those folders; everything else is reported as out of scope, not as a false positive. Production code only: the scorer treats any test file or test-support folder (`isTestSupportPath`) as out of scope, even under a labelled folder.

## 4. Matching and scoring

- A prediction matches a label when type, normalised source key and normalised target key are all equal.
- Duplicate predictions of the same pair count once, with the strongest evidence class.
- Precision = TP / (TP + FP); recall = TP / (TP + FN); F1 is their harmonic mean. A value with a zero denominator is reported as n/a, never as 0 or 100%.
- Results are split by evidence class (observed, inferred) for true and false positives.

## 5. Adjudication

1. The labeller records `labelledBy`, the date and the method.
2. A reviewer who did not write the labels checks them. Under decision D-9 the founder reviews a random sample of 10% of each type's labels, rounded up, drawn with `scripts/review-sample.ts <file> <seed>` (the same seed gives the same sample). Disagreements are settled against the source and recorded in `outOfScope` or a label `note`.
3. Only after review is `status` set to `spot-checked` (sample) or `adjudicated` (every label), with `reviewedBy`, `reviewedOn` and, for a sample, `review: { checked, disagreements, seed }`.
4. Figures may be quoted outside the company from an `adjudicated` file, or from a `spot-checked` file whose review covers at least 10% of its labels (`isPublishable`). The scorer prints a warning above every other result.
5. A change to a rule in section 2 means re-checking every label of that type.
