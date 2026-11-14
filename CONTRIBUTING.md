# Contributing

Thanks for your interest in CodeAtlas.

## Before you start

- Read [CLAUDE.md](CLAUDE.md) for the engineering rules (no fake implementations, tests first, research before using an unfamiliar library) and the [master specification](documentation/product/MASTER_SPECIFICATION.md) for what CodeAtlas must do (§5).
- For anything larger than a small fix, open an issue first so the approach can be agreed.

## Development

```bash
pnpm install
pnpm check                        # typecheck, lint, unit and integration tests
pnpm format:check
pnpm --filter @nexora/codeatlas-web build && pnpm --filter @nexora/codeatlas-web e2e
```

## Pull requests

- Keep each change focused and add or extend tests for it.
- `pnpm check`, `pnpm format:check` and the relevant E2E suite must pass. CI runs all of them.
- Update [documentation/REQUIREMENTS_TRACEABILITY.md](documentation/REQUIREMENTS_TRACEABILITY.md) and other docs your change affects.
- Never commit secrets or private source code. Test data must be synthetic.

## Licence

By contributing you agree that your contribution is licensed under the [Apache License 2.0](LICENSE), the licence of this repository.
