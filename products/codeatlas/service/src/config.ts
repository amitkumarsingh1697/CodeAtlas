import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { aiConfigSchema } from '@nexora/ai';

export const serviceConfigSchema = z.object({
  home: z.string().min(1),
  port: z.coerce.number().int().min(0).max(65535).default(4317),
  /** Optional comma-separated allowlist of directories repositories must live under. Empty = any directory the user chooses, except in a packaged install (home folder only). */
  allowedRoots: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  webDir: z.string().optional(),
  /** Workspace for investigation worktrees. */
  worktreeDir: z.string().optional(),
  ai: aiConfigSchema,
});

export type ServiceConfig = z.infer<typeof serviceConfigSchema>;

export function loadServiceConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<Record<string, unknown>> = {},
): ServiceConfig {
  const home = env.CODEATLAS_HOME ?? join(homedir(), '.codeatlas');
  const cfg = serviceConfigSchema.parse({
    home,
    port: env.CODEATLAS_PORT,
    allowedRoots: env.CODEATLAS_ALLOWED_ROOTS,
    webDir: env.CODEATLAS_WEB_DIR,
    worktreeDir: env.CODEATLAS_WORKTREE_DIR,
    ai: env,
    ...overrides,
  });
  // PKG-002: an installed copy (its launcher sets CODEATLAS_PACKAGED=1) only indexes folders under
  // the user's home folder unless roots were set. A development run stays unrestricted.
  if (env.CODEATLAS_PACKAGED === '1' && !cfg.allowedRoots.length) cfg.allowedRoots = [homedir()];
  return cfg;
}
