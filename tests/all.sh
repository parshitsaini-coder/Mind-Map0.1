#!/bin/bash
# Runs the full suite: import graph, unit tests, render smoke test, build, lint.
set -e
cd "$(dirname "$0")/.."
FAIL=0
run() { echo; echo "▸ $1"; shift; "$@" > /tmp/out.txt 2>&1 && tail -2 /tmp/out.txt || { FAIL=1; tail -25 /tmp/out.txt; }; }

echo "▸ import graph"; node tests/check-imports.mjs || FAIL=1
run "stats primitives"   ./tests/run.sh t1.mjs
run "analytics engine"   ./tests/run.sh analytics.test.mjs
run "tools engine"       ./tests/run.sh tools.test.mjs
run "edge tools"         ./tests/run.sh edgetools.test.mjs
run "density & CSS"      node tests/density.test.mjs
run "terminal engine"    node tests/terminal-engine.test.mjs
run "terminal ledger"    node tests/terminal-ledger.test.mjs
run "terminal orders"    node tests/terminal-orders.test.mjs
run "terminal stats"     node tests/terminal-stats.test.mjs
run "terminal phase 4"   node tests/terminal-phase4.test.mjs
run "terminal indicators" node tests/terminal-indicators.test.mjs
run "terminal drawings"   node tests/terminal-drawings.test.mjs
run "terminal phase 6"    ./tests/run.sh terminal-phase6.test.mjs
run "terminal phase 7"    node tests/terminal-phase7.test.mjs
run "terminal phase 7 store" ./tests/run.sh terminal-phase7-store.test.mjs
run "terminal phase 8"    node tests/terminal-phase8.test.mjs
run "terminal phase 8 store" ./tests/run.sh terminal-phase8-store.test.mjs
run "terminal phase 9"    node tests/terminal-phase9.test.mjs
run "terminal phase 9 store" ./tests/run.sh terminal-phase9-store.test.mjs
run "terminal phase 10"   ./tests/run.sh terminal-phase10.test.mjs
run "terminal phase 10 store" ./tests/run.sh terminal-phase10-store.test.mjs
run "terminal phase 11"   node tests/terminal-phase11.test.mjs
run "terminal phase 11 store" ./tests/run.sh terminal-phase11-store.test.mjs
run "terminal phase 12"   node tests/terminal-phase12.test.mjs
run "terminal phase 12 store" ./tests/run.sh terminal-phase12-store.test.mjs
run "terminal phase 13"   node tests/terminal-phase13.test.mjs
run "terminal phase 13 store" ./tests/run.sh terminal-phase13-store.test.mjs
run "terminal phase 14"   node tests/terminal-phase14.test.mjs
run "terminal phase 14 store" ./tests/run.sh terminal-phase14-store.test.mjs
run "terminal performance" node --expose-gc tests/terminal-perf.test.mjs
run "render smoke test"  node tests/render.mjs
echo; echo "▸ production build"; npm run build > /tmp/b.txt 2>&1 && grep -E "✓ built" /tmp/b.txt || { FAIL=1; tail -20 /tmp/b.txt; }
echo; echo "▸ secret scan"; node tests/secret-scan.mjs || FAIL=1
echo; echo "▸ lint"; npm run lint 2>&1 | tail -1
echo
[ $FAIL -eq 0 ] && echo "══ ALL GREEN ══" || { echo "══ FAILURES ══"; exit 1; }
