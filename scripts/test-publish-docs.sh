#!/bin/sh
set -eu

# Run from the repository root; no build or production paths are needed.
mkdir -p tmp
test_root=$(mktemp -d "$PWD/tmp/publish-docs.XXXXXX")
trap 'rm -rf -- "$test_root"' EXIT
source_dir="$test_root/dist"
mkdir -p "$source_dir/en" "$source_dir/zh-hant" "$source_dir/ja"
for file in index.html 404.html en/index.html zh-hant/index.html; do
  printf 'fixture\n' > "$source_dir/$file"
done
i=0
while [ "$i" -lt 16 ]; do
  printf 'asset\n' > "$source_dir/asset-$i.js"
  i=$((i + 1))
done

export DOCS_DEPLOY_ROOT="$test_root/site"
mkdir "$DOCS_DEPLOY_ROOT"
sha=0000000000000000000000000000000000000000
publish() { sh scripts/publish-docs.sh "$source_dir" "$sha-$1"; }
publish 1-0
[ "$(readlink "$DOCS_DEPLOY_ROOT/html")" = "releases/$sha-1-0" ]
[ -s "$DOCS_DEPLOY_ROOT/html/en/index.html" ]
[ -f "$DOCS_DEPLOY_ROOT/.deploy.lock" ]
publish 2-0
[ -s "$DOCS_DEPLOY_ROOT/releases/$sha-1-0/index.html" ]
publish 1-1
[ "$(readlink "$DOCS_DEPLOY_ROOT/html")" = "releases/$sha-2-0" ]
[ ! -e "$DOCS_DEPLOY_ROOT/releases/$sha-1-1" ]
mkdir "$DOCS_DEPLOY_ROOT/releases/notes"
ln -s "$test_root" "$DOCS_DEPLOY_ROOT/releases/1111111111111111111111111111111111111111-0-0"
publish 2-1
[ -d "$DOCS_DEPLOY_ROOT/releases/notes" ]
[ -L "$DOCS_DEPLOY_ROOT/releases/1111111111111111111111111111111111111111-0-0" ]
[ "$(readlink "$DOCS_DEPLOY_ROOT/html")" = "releases/$sha-2-1" ]
[ -s "$DOCS_DEPLOY_ROOT/releases/$sha-2-0/index.html" ]
[ ! -e "$DOCS_DEPLOY_ROOT/releases/$sha-1-0" ]
[ "$(find "$DOCS_DEPLOY_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -name "$sha-*" | wc -l)" -eq 2 ]
: > "$source_dir/index.html"
if publish 3-0; then exit 1; fi
[ "$(readlink "$DOCS_DEPLOY_ROOT/html")" = "releases/$sha-2-1" ]
[ -s "$DOCS_DEPLOY_ROOT/html/index.html" ]
[ -s "$DOCS_DEPLOY_ROOT/releases/$sha-2-0/index.html" ]
printf 'fixture\n' > "$source_dir/index.html"

# Neither an existing html directory nor the old symlink layout is replaced.
export DOCS_DEPLOY_ROOT="$test_root/existing"
mkdir -p "$DOCS_DEPLOY_ROOT/html"
if publish 4-0; then exit 1; fi
[ -d "$DOCS_DEPLOY_ROOT/html" ] && [ ! -L "$DOCS_DEPLOY_ROOT/html" ]
export DOCS_DEPLOY_ROOT="$test_root/legacy"
ln -s site "$DOCS_DEPLOY_ROOT"
if publish 5-0; then exit 1; fi
[ "$(readlink "$DOCS_DEPLOY_ROOT")" = site ]
echo 'Documentation publish checks passed'
