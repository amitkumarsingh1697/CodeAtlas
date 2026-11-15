#!/usr/bin/env bash
# PKG-004: index a repository, write the assessment and the brain with the network denied.
# Two layers: a Linux network namespace with no interfaces but loopback (unshare -n), and the
# egress guard (products/codeatlas/service/scripts/egress-guard.mjs), which records and refuses
# every outbound attempt Node makes. Passes only if every command succeeds, the outputs are
# written, the namespace really has no network, and the guard recorded nothing.
# Usage: scripts/egress-check.sh [repository-to-index]   (default: products/codeatlas/core)
# Set EGRESS_KEEP=1 to keep the work folder for inspection.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$(cd "${1:-$ROOT/products/codeatlas/core}" && pwd)"
WORK="$(mktemp -d)"
if [ -n "${EGRESS_KEEP:-}" ]; then
  echo "egress-check: keeping $WORK" >&2
else
  trap 'rm -rf "$WORK" 2>/dev/null || sudo -n rm -rf "$WORK" || true' EXIT
fi
LOG="$WORK/egress.log"
: >"$LOG"

# Pick a way into a network namespace: unprivileged first, sudo where user namespaces are restricted.
# Under sudo, PATH and the variables below are passed explicitly, because sudo resets them.
if unshare -rn true 2>/dev/null; then
  AS=() NETNS=(unshare -rn)
elif sudo -n unshare -n true 2>/dev/null; then
  AS=(sudo -n) NETNS=(unshare -n)
else
  echo "egress-check: cannot create a network namespace (needs unshare -rn or passwordless sudo)" >&2
  exit 2
fi
echo "egress-check: network namespace via ${AS[*]:-} ${NETNS[*]}" >&2

cat >"$WORK/inner.sh" <<'INNER'
set -euo pipefail
cd "$ROOT/products/codeatlas/service"
# The namespace must really be offline: a direct connection has to fail, without the guard.
if node -e "require('net').connect(443,'1.1.1.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"; then
  echo "egress-check: the network namespace still reaches the internet" >&2
  exit 3
fi
run() { node --no-warnings --import tsx --import ./scripts/egress-guard.mjs src/cli.ts "$@"; }
run index "$TARGET" >"$WORK/index.json" 2>"$WORK/index.err"
run assessment "$TARGET" --out "$WORK/assessment.json" >/dev/null 2>"$WORK/assessment.err"
run brain "$TARGET" --out "$WORK/brain.html" --json "$WORK/brain.json" >/dev/null 2>"$WORK/brain.err"
INNER

${AS[@]+"${AS[@]}"} env PATH="$PATH" ROOT="$ROOT" TARGET="$TARGET" WORK="$WORK" \
  CODEATLAS_HOME="$WORK/home" CODEATLAS_EGRESS_LOG="$LOG" AI_PROVIDER=disabled HOME="$WORK" \
  "${NETNS[@]}" bash "$WORK/inner.sh"

fail=0
if [ -s "$LOG" ]; then
  echo "egress-check: outbound attempts recorded:" >&2
  sort "$LOG" | uniq -c >&2
  fail=1
fi
for f in index.json assessment.json brain.html brain.json; do
  if [ ! -s "$WORK/$f" ]; then
    echo "egress-check: $f was not written" >&2
    fail=1
  fi
done
WORK="$WORK" node -e "
const w = process.env.WORK;
const a = require(w + '/assessment.json');
const i = require(w + '/index.json');
const mods = a.architecture?.modules?.length ?? 0;
console.log('egress-check:', i.files.structurallyAnalysed, 'files analysed,', i.symbols, 'symbols,', mods, 'module(s) in the assessment; outbound attempts recorded:', require('fs').readFileSync(w + '/egress.log', 'utf8').split('\n').filter(Boolean).length);
if (!i.files.structurallyAnalysed || !i.symbols || !mods) process.exit(1);
" || fail=1
exit $fail
