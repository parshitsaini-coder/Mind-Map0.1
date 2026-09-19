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
run "render smoke test"  node tests/render.mjs
echo; echo "▸ production build"; npm run build > /tmp/b.txt 2>&1 && grep -E "✓ built" /tmp/b.txt || { FAIL=1; tail -20 /tmp/b.txt; }
echo; echo "▸ lint"; npm run lint 2>&1 | tail -1
echo
[ $FAIL -eq 0 ] && echo "══ ALL GREEN ══" || { echo "══ FAILURES ══"; exit 1; }
