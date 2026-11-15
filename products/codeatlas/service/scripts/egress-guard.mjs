// Egress guard for the network-denied check (PKG-004). Load with `node --import`.
// Every outbound network path Node offers is wrapped: the attempt is appended to
// $CODEATLAS_EGRESS_LOG (or stderr) as `EGRESS <kind> <target>`, then refused with an error.
// Only the target host and port are recorded, never request bodies, headers or file contents.
// Test and CI use only: never load this in the product.
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import childProcess from 'node:child_process';
import dgram from 'node:dgram';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const LOG = process.env.CODEATLAS_EGRESS_LOG;

function refuse(kind, target) {
  const line = `EGRESS ${kind} ${target}\n`;
  if (LOG) appendFileSync(LOG, line);
  else process.stderr.write(line);
  const e = new Error(`network access refused by the egress guard: ${kind} ${target}`);
  e.code = 'EGRESS_REFUSED';
  throw e;
}

function hostOf(input) {
  try {
    if (typeof input === 'string' || input instanceof URL) return new URL(String(input)).host;
    if (input && typeof input === 'object')
      return input.url ? new URL(input.url).host : `${input.hostname ?? input.host ?? '?'}`;
  } catch {
    return String(input).slice(0, 80);
  }
  return '?';
}

/** net.connect(port, host) | net.connect({ port, host }) | net.connect(path) */
function socketTarget(args) {
  const [a, b] = args;
  if (Array.isArray(a)) return socketTarget(a);
  if (a && typeof a === 'object')
    return a.path ? `ipc:${a.path}` : `${a.host ?? 'localhost'}:${a.port}`;
  if (typeof a === 'number' || /^\d+$/.test(String(a)))
    return `${typeof b === 'string' ? b : 'localhost'}:${a}`;
  return `ipc:${a}`;
}

const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function connect(...args) {
  const target = socketTarget(args);
  // Local IPC (Unix sockets, Windows pipes) is not network egress.
  if (target.startsWith('ipc:')) return origConnect.apply(this, args);
  refuse('net.connect', target);
};
tls.connect = (...args) => refuse('net.connect', socketTarget(args));

for (const [mod, name] of [
  [http, 'http'],
  [https, 'https'],
]) {
  mod.request = (input) => refuse(`${name}.request`, hostOf(input));
  mod.get = (input) => refuse(`${name}.request`, hostOf(input));
}

globalThis.fetch = async (input) =>
  refuse('fetch', `${new URL(String(input.url ?? input)).protocol}//${hostOf(input)}`);

const DNS = [
  'lookup',
  'lookupService',
  'resolve',
  'resolve4',
  'resolve6',
  'resolveAny',
  'resolveCname',
  'resolveMx',
  'resolveNs',
  'resolveSrv',
  'resolveTxt',
  'reverse',
];
for (const fn of DNS) {
  if (typeof dns[fn] === 'function') dns[fn] = (host) => refuse(`dns.${fn}`, String(host));
  if (dns.promises && typeof dns.promises[fn] === 'function')
    dns.promises[fn] = async (host) => refuse(`dns.${fn}`, String(host));
}

const origCreateSocket = dgram.createSocket;
dgram.createSocket = (...args) => {
  const s = origCreateSocket(...args);
  s.send = (msg, ...rest) => {
    const port = rest.find((x) => typeof x === 'number' && x > 0);
    const host = rest.find((x) => typeof x === 'string');
    refuse('dgram.send', `${host ?? 'localhost'}:${port ?? '?'}`);
  };
  s.connect = (port, host) => refuse('dgram.connect', `${host ?? 'localhost'}:${port}`);
  return s;
};

// git and similar tools reach the network on their own; refuse the network subcommands.
const NETWORK_GIT = new Set([
  'clone',
  'fetch',
  'pull',
  'push',
  'ls-remote',
  'remote-https',
  'submodule',
]);
const NETWORK_TOOLS = new Set(['curl', 'wget', 'ssh', 'scp', 'npm', 'pnpm', 'npx', 'yarn']);
function checkSpawn(file, args) {
  const base = String(file).split(/[\\/]/).pop();
  const list = Array.isArray(args) ? args.map(String) : [];
  if (base === 'git' || base === 'git.exe') {
    const sub = list.find(
      (a) => !a.startsWith('-') && !list[list.indexOf(a) - 1]?.match(/^-(C|c)$/),
    );
    if (sub && NETWORK_GIT.has(sub)) refuse('child_process', `git ${sub}`);
  } else if (NETWORK_TOOLS.has(base)) refuse('child_process', base);
}
for (const fn of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
  const orig = childProcess[fn];
  childProcess[fn] = function wrapped(file, args, ...rest) {
    checkSpawn(file, args);
    return orig.call(this, file, args, ...rest);
  };
}

// Shell strings: refuse the same tools and git subcommands.
for (const fn of ['exec', 'execSync']) {
  const orig = childProcess[fn];
  childProcess[fn] = function wrapped(command, ...rest) {
    const words = String(command).trim().split(/\s+/);
    checkSpawn(words[0], words.slice(1));
    return orig.call(this, command, ...rest);
  };
}

syncBuiltinESMExports();
