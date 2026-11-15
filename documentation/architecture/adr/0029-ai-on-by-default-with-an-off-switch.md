# ADR 0029: AI assistance on by default, with an off switch and a notice of what is sent

- Status: accepted
- Date: 2026-11-14
- Decision owner: founder (audit decision D-6, 2026-11-14)
- Deviation from: package document 06 §4 ("Be off by default until user enables it")

## Context

Package document 06 §4 asks for every optional AI feature to be off by default. The founder decided on 2026-11-14 that AI should stay on by default and that the user can turn it off. Until now the only control was the `AI_PROVIDER` environment variable (default `ollama`), which a user cannot change from the app. The Ollama provider also treated every `OLLAMA_BASE_URL` as local, so pointing it at another machine sent source excerpts there with no consent (audit finding, risk S-01 in `docs/audit/TECHNICAL_RISK_REGISTER.md`).

## Decision

1. AI stays on by default. When no model is reachable, Ask answers with the relevant code and relationships only, as before.
2. Settings has a "Turn AI off" switch (`POST /api/settings/ai`, stored in the local `meta` table (corrected 2026-11-15: there is no `settings` table)). When AI is off, chat and investigations use the disabled provider, so no request reaches any model.
3. Ask and Settings show the endpoint (without credentials) and what each question sends: the question, up to 8 source excerpts of at most 60 lines each with secrets redacted, and the related graph facts with paths and lines.
4. Both providers (Ollama and OpenAI-compatible) treat any host other than `localhost`, `127.0.0.0/8` or `::1` as remote, and refuse to call it unless `AI_REMOTE_CONSENT=true`. Status reports the remote Ollama as unavailable without contacting it.
5. The other §4 rules still apply: payloads are minimised and redacted, logs hold metadata only, and every feature works without a model.

## Consequences

- A user who has a local Ollama gets model answers without a setup step. That is the reason for the deviation.
- Residual risk: a user who never opens Settings may not notice AI is on. The notice on the Ask page, beside the question box, is the mitigation. Risk S-02 in the audit register is accepted by the founder.
- Tests: `packages/ai/src/__tests__/ai.test.ts` (remote consent), `products/codeatlas/service/test/chat.test.ts` (on/off switch), the Settings step of the E2E journey.
