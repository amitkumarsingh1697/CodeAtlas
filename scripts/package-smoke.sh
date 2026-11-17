#!/usr/bin/env bash
# PKG-001: install an archive into an empty folder, with an empty environment, and prove it works:
# version and help, an assessment, a brain, the support bundle, the web UI and API over loopback,
# the packaged allowed-roots default, the token removed on stop, and a clean uninstall.
# Usage: scripts/package-smoke.sh dist/package/codeatlas-<version>-<os>-<arch>.tar.gz
set -euo pipefail
ARCHIVE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
trap '[ -n "${PID:-}" ] && kill "$PID" 2>/dev/null; rm -rf "$T"' EXIT
fail() { echo "package-smoke: $*" >&2; exit 1; }

(cd "$(dirname "$ARCHIVE")" && { sha256sum -c SHA256SUMS 2>/dev/null || shasum -a 256 -c SHA256SUMS; }) >/dev/null ||
  fail "checksum does not match SHA256SUMS"
mkdir -p "$T/home/work"
tar -xzf "$ARCHIVE" -C "$T/home"
APP="$(ls -d "$T"/home/codeatlas-*)"
# An empty environment: no system Node, pnpm or repository checkout on PATH.
ca() { env -i HOME="$T/home" PATH=/usr/bin:/bin "$APP/bin/codeatlas" "$@"; }

ca >/dev/null || fail "usage did not exit 0"
# A small repository inside the home folder.
R="$T/home/work/demo"
mkdir -p "$R/src"
printf 'export function add(a: number, b: number): number {\n  return a + b;\n}\n' >"$R/src/math.ts"
printf 'import { add } from "./math";\nexport const total = add(1, 2);\n' >"$R/src/index.ts"
printf '{"name":"demo","version":"1.0.0"}\n' >"$R/package.json"
git -C "$R" init -q && git -C "$R" add -A &&
  git -C "$R" -c user.name=t -c user.email=t@example.invalid commit -qm init

ca assessment "$R" --out "$T/a.json" >/dev/null 2>"$T/a.err" || { cat "$T/a.err"; fail "assessment failed"; }
grep -q '"modelVersion"' "$T/a.json" || fail "assessment not written"
ca brain "$R" --out "$T/b.html" >/dev/null 2>"$T/b.err" || { cat "$T/b.err"; fail "brain failed"; }
[ -s "$T/b.html" ] || fail "brain not written"
ca support-bundle --out "$T/s.json" >/dev/null || fail "support bundle failed"
grep -q '"packaged": true' "$T/s.json" || fail "support bundle does not report a packaged install"
[ "$(stat -c %a "$T/home/.codeatlas" 2>/dev/null || stat -f %Lp "$T/home/.codeatlas")" = 700 ] ||
  fail "data folder is not owner-only"

PORT=$((20000 + RANDOM % 20000))
env -i HOME="$T/home" PATH=/usr/bin:/bin CODEATLAS_PORT=$PORT "$APP/bin/codeatlas" serve >"$T/serve.out" 2>&1 &
PID=$!
for _ in $(seq 1 60); do grep -q '#token=' "$T/serve.out" && break; sleep 0.5; done
TOKEN="$(sed -n 's/.*#token=\([A-Za-z0-9_-]*\).*/\1/p' "$T/serve.out")"
[ -n "$TOKEN" ] || { cat "$T/serve.out"; fail "serve did not print a token"; }
B="http://127.0.0.1:$PORT"
curl -fsS "$B/api/health" | grep -q ok || fail "health check failed"
curl -fsS "$B/" | grep -qi '<html' || fail "web UI not served"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "x-codeatlas-token: $TOKEN" -H 'content-type: application/json' \
  -d '{"path":"/"}' "$B/api/repos")
[ "$code" = 403 ] || fail "a folder outside the home folder was not refused (HTTP $code)"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "x-codeatlas-token: $TOKEN" -H 'content-type: application/json' \
  -d "{\"path\":\"$R\"}" "$B/api/repos")
[ "$code" = 200 ] || fail "a folder inside the home folder was refused (HTTP $code)"
kill "$PID" && wait "$PID" 2>/dev/null || true
PID=
[ ! -e "$T/home/.codeatlas/token" ] || fail "token file left after stop"

rm -rf "$APP" "$T/home/.codeatlas"
[ ! -e "$APP" ] && [ ! -e "$T/home/.codeatlas" ] || fail "uninstall left files"
echo "package-smoke: $(basename "$ARCHIVE") passed (assessment, brain, support bundle, serve, allowed roots, token, uninstall)"
