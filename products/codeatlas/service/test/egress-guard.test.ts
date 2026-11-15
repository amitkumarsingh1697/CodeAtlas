import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/** PKG-004: the egress guard must record and refuse every outbound network path Node offers. */
const GUARD = fileURLToPath(new URL('../scripts/egress-guard.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'codeatlas-egress-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(name: string, code: string) {
  const log = join(dir, `${name}.log`);
  const r = spawnSync(process.execPath, ['--import', GUARD, '--input-type=module', '-e', code], {
    env: { ...process.env, CODEATLAS_EGRESS_LOG: log },
    encoding: 'utf8',
    timeout: 20_000,
  });
  const logged = existsSync(log) ? readFileSync(log, 'utf8') : '';
  return { status: r.status, stdout: r.stdout, logged };
}

const attempts: [string, string, string][] = [
  ['fetch', "await fetch('https://example.com/x')", 'fetch https://example.com'],
  [
    'net',
    "const net = await import('node:net'); net.connect(443, '93.184.215.14')",
    'net.connect 93.184.215.14:443',
  ],
  [
    'tls',
    "const tls = await import('node:tls'); tls.connect(443, 'example.com')",
    'net.connect example.com:443',
  ],
  [
    'http',
    "const http = await import('node:http'); http.get('http://example.com/')",
    'http.request example.com',
  ],
  [
    'https',
    "const https = await import('node:https'); https.request('https://example.com/')",
    'https.request example.com',
  ],
  [
    'dns',
    "const dns = await import('node:dns'); dns.lookup('example.com', () => {})",
    'dns.lookup example.com',
  ],
  [
    'dns-named',
    "import { lookup } from 'node:dns'; lookup('example.com', () => {})",
    'dns.lookup example.com',
  ],
  [
    'dns-promises',
    "const dns = await import('node:dns/promises'); await dns.resolve4('example.com')",
    'dns.resolve4 example.com',
  ],
  [
    'dgram',
    "const d = await import('node:dgram'); d.createSocket('udp4').send('x', 53, '8.8.8.8')",
    'dgram.send 8.8.8.8:53',
  ],
  [
    'git',
    "const cp = await import('node:child_process'); cp.spawnSync('git', ['clone', 'https://example.com/r.git'])",
    'child_process git clone',
  ],
];

describe('egress guard (PKG-004)', () => {
  it.each(attempts)('records and refuses %s', (name, code, expected) => {
    const r = run(name, code);
    expect(r.logged).toContain(`EGRESS ${expected}`);
    expect(r.status).not.toBe(0);
  });

  it('leaves local work alone: files and local git commands', () => {
    const r = run(
      'local',
      "const fs = await import('node:fs'); const cp = await import('node:child_process'); fs.readFileSync(process.execPath); cp.spawnSync('git', ['--version']); console.log('done')",
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('done');
    expect(r.logged).toBe('');
  });
});
