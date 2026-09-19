#!/bin/bash
# Mirrors src/ into .testbuild/ with explicit .js extensions on relative
# imports so plain Node can run the modules Vite normally resolves.
set -e
cd "$(dirname "$0")/.."
rm -rf .testbuild
mkdir -p .testbuild
cp -r src .testbuild/src
cp -r tests .testbuild/tests
find .testbuild/src -name '*.js' -o -name '*.jsx' | while read -r f; do
  perl -0pi -e "s{(from\s+')(\.[^']*?)(')}{ \$2 =~ /\.(js|jsx|json|css)\$/ ? \"\$1\$2\$3\" : \"\$1\$2.js\$3\" }ge" "$f"
done
node .testbuild/tests/"$1"
