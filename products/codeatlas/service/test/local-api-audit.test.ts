// PKG-002: session-token handling and the allowed-roots restriction of the local service.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadServiceConfig } from '../src/config';
import { createSessionToken, validateRepoPath } from '../src/server';
import { startService } from './helpers';

const made: string[] = [];
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  made.push(d);
  return d;
};
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('session token', () => {
  it('is a new 256-bit token on every start, never reused from disk', () => {
    const home = tmp('ca-tok-');
    const a = createSessionToken(home);
    const b = createSessionToken(home);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(b).not.toBe(a);
    expect(readFileSync(join(home, 'token'), 'utf8').trim()).toBe(b);
  });

  it('replaces a token file left readable by others, and tightens the data folder', () => {
    const home = tmp('ca-tok-');
    chmodSync(home, 0o755);
    writeFileSync(join(home, 'token'), `${'x'.repeat(43)}\n`, { mode: 0o644 });
    chmodSync(join(home, 'token'), 0o644);
    const t = createSessionToken(home);
    expect(t).not.toBe('x'.repeat(43));
    expect(statSync(join(home, 'token')).mode & 0o777).toBe(0o600);
    expect(statSync(home).mode & 0o777).toBe(0o700);
  });

  it('is removed from disk when the service stops, and a restart issues a different one', async () => {
    const home = tmp('ca-svc-');
    const first = await startService([], {}, home);
    const t1 = first.ctx.token;
    expect(existsSync(join(home, 'token'))).toBe(true);
    await first.close();
    expect(existsSync(join(home, 'token'))).toBe(false);
    const second = await startService([], {}, home);
    expect(second.ctx.token).not.toBe(t1);
    expect((await second.api('/api/repos', { token: t1 })).status).toBe(401);
    expect((await second.api('/api/repos')).status).toBe(200);
    await second.close();
  });

  it('leaves a newer token alone when an older service stops', async () => {
    const home = tmp('ca-svc-');
    const older = await startService([], {}, home);
    const newer = createSessionToken(home);
    await older.close();
    expect(readFileSync(join(home, 'token'), 'utf8').trim()).toBe(newer);
  });

  it('is not accepted in a query string, only in the header', async () => {
    const svc = await startService();
    const r = await svc.api(`/api/repos?token=${svc.ctx.token}`, { token: null });
    expect(r.status).toBe(401);
    await svc.close();
  });
});

describe('allowed roots', () => {
  it('refuses a folder outside CODEATLAS_ALLOWED_ROOTS and accepts one inside', () => {
    const allowed = tmp('ca-allowed-');
    const outside = tmp('ca-outside-');
    mkdirSync(join(allowed, 'repo'));
    const cfg = loadServiceConfig({
      CODEATLAS_HOME: tmp('ca-h-'),
      CODEATLAS_ALLOWED_ROOTS: allowed,
    });
    expect(validateRepoPath(cfg, join(allowed, 'repo'))).toContain('repo');
    expect(() => validateRepoPath(cfg, outside)).toThrow(/outside the allowed roots/u);
    // A sibling whose name starts with the allowed root's name is still outside it.
    const sibling = `${allowed}-x`;
    mkdirSync(sibling);
    made.push(sibling);
    expect(() => validateRepoPath(cfg, sibling)).toThrow(/outside the allowed roots/u);
  });

  it('a packaged install restricts to the home folder when no roots are set', () => {
    const cfg = loadServiceConfig({ CODEATLAS_HOME: tmp('ca-h-'), CODEATLAS_PACKAGED: '1' });
    expect(cfg.allowedRoots).toEqual([homedir()]);
    expect(() => validateRepoPath(cfg, '/')).toThrow(/outside the allowed roots/u);
  });

  it('a packaged install keeps roots that were set explicitly', () => {
    const allowed = tmp('ca-allowed-');
    const cfg = loadServiceConfig({
      CODEATLAS_HOME: tmp('ca-h-'),
      CODEATLAS_PACKAGED: '1',
      CODEATLAS_ALLOWED_ROOTS: allowed,
    });
    expect(cfg.allowedRoots).toEqual([allowed]);
  });

  it('a development run is not restricted unless roots are set', () => {
    expect(loadServiceConfig({ CODEATLAS_HOME: tmp('ca-h-') }).allowedRoots).toEqual([]);
  });
});
