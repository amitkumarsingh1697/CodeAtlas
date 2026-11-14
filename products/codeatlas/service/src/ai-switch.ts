import { DisabledProvider, type AiConfig, type ModelProvider } from '@nexora/ai';
import { getSetting, setSetting, type Db } from '@nexora/codeatlas-core';

/**
 * AI is on by default and the user can turn it off in Settings (founder decision D-6,
 * ADR 0025). The choice is stored in the local database; when it is off no request
 * reaches any model and every feature takes its deterministic path.
 */
const SETTING = 'ai_enabled';

export function aiEnabled(db: Db): boolean {
  return getSetting(db, SETTING) !== 'false';
}

export function setAiEnabled(db: Db, enabled: boolean): void {
  setSetting(db, SETTING, enabled ? 'true' : 'false');
}

/** Wraps a provider so the Settings switch applies to every call, without a restart. */
export function switchable(db: Db, inner: ModelProvider): ModelProvider {
  const off = new DisabledProvider();
  return {
    get id() {
      return aiEnabled(db) ? inner.id : off.id;
    },
    get local() {
      return aiEnabled(db) ? inner.local : off.local;
    },
    capabilities: () => (aiEnabled(db) ? inner.capabilities() : off.capabilities()),
    generate: (req) => (aiEnabled(db) ? inner.generate(req) : off.generate()),
  };
}

/** Where model requests go, without credentials, for the "what is sent" notice. */
export function aiEndpoint(cfg: AiConfig): string | null {
  const raw =
    cfg.AI_PROVIDER === 'ollama'
      ? cfg.OLLAMA_BASE_URL
      : cfg.AI_PROVIDER === 'openai-compatible'
        ? cfg.OPENAI_COMPAT_BASE_URL
        : undefined;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return null;
  }
}

/** Plain-language description of the context a model receives. Kept in step with core/chat. */
export const AI_DATA_SENT =
  'Your question, up to 8 source excerpts of at most 60 lines each (secrets redacted), and the related graph facts with file paths and line numbers. Indexing, search, coverage and every other feature never use a model.';
