# Benchmark history (ACC-004)

One row per scored run. Figures from files that are not `adjudicated` are for engineering use only.

| Date       | CodeAtlas commit   | Repository @ commit          | Labelling       | handled_by P / R | maps_to P / R | reads_table P / R | writes_table P / R  | Notes                                                                                           |
| ---------- | ------------------ | ---------------------------- | --------------- | ---------------- | ------------- | ----------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| 2026-11-15 | before this change | spring-petclinic @ `500158f` | claude-labelled | 100% / 100%      | 100% / 100%   | 100% / 100%       | 66.7% / 100% (1 FP) | FP: `VetRepository` → `vets` written, but it extends the bare `Repository` with finders only    |
| 2026-11-15 | PR #5              | spring-petclinic @ `500158f` | claude-labelled | 100% / 100%      | 100% / 100%   | 100% / 100%       | 100% / 100%         | Read-only bare `Repository` fixed (`packages/orm/src/jvm.ts`); regression test in `orm.test.ts` |

PetClinic is small and was the fixture the route adapter was built against, so these figures say little about other repositories. The NestJS and multi-module Spring files are next.
