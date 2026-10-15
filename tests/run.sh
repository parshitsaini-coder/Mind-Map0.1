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
  perl tests/addext.pl < "$f" | sed 's/import\.meta\.env/({})/g' > "$f.tmp" && mv "$f.tmp" "$f"
done
node .testbuild/tests/"$1"
