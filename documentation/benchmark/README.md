# Accuracy benchmark

This folder holds the CodeAtlas accuracy benchmark (roadmap ACC-001 to ACC-004, package doc 07 §3).

| File                                           | What it is                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [ADJUDICATION_GUIDE.md](ADJUDICATION_GUIDE.md) | How a relationship is labelled, matched and adjudicated (ACC-001). **Draft** until the founder approves it and decision D-9 names the reviewer. |
| [CORPUS.md](CORPUS.md)                         | Pinned repositories, commits and licences (ACC-002)                                                                                             |
| `ground-truth/*.json`                          | One labelled file per repository, validated by `groundTruthSchema` (`products/codeatlas/core/src/benchmark/ground-truth.ts`)                    |
| [BENCHMARK_HISTORY.md](BENCHMARK_HISTORY.md)   | One row per scored run (ACC-004)                                                                                                                |

## Running it

```bash
git clone https://github.com/spring-projects/spring-petclinic /tmp/petclinic
git -C /tmp/petclinic checkout 500158f732419217507c7656904b8e6aa1bcc0d6
pnpm --filter @nexora/codeatlas-core exec tsx scripts/score-benchmark.ts \
  "$PWD/documentation/benchmark/ground-truth/spring-petclinic.json" /tmp/petclinic --json /tmp/petclinic-score.json
```

The script refuses a checkout at another commit, indexes into an in-memory database with default options (no SCIP, no model) and prints precision, recall and F1 by relationship type, with true and false positives split by evidence class.

CI runs the scorer's unit tests and validates every ground-truth file (`core/test/benchmark.test.ts`). CI does not clone the corpus, so a scored run is recorded by hand in the history.

## Rule for quoting figures

Only figures from a ground-truth file whose `labelling.status` is `adjudicated` may be used outside the company. The scorer prints a warning above every other result.
