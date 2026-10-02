#!/bin/sh

set -eu

site_dir="${1:-}"

if [ -z "$site_dir" ]; then
  echo "usage: $0 SITE_DIR" >&2
  exit 64
fi
if [ ! -d "$site_dir" ] || [ -L "$site_dir" ]; then
  echo "documentation output is not a directory: $site_dir" >&2
  exit 66
fi

for required_file in \
  index.html \
  404.html \
  en/index.html \
  zh-hant/index.html
do
  if [ ! -s "$site_dir/$required_file" ]; then
    echo "documentation output is missing: $required_file" >&2
    exit 65
  fi
done

for excluded_path in \
  internal \
  progress \
  contribute \
  en/contribute \
  zh-hant/contribute
do
  if [ -e "$site_dir/$excluded_path" ] || [ -L "$site_dir/$excluded_path" ]; then
    echo "excluded documentation was published: $excluded_path" >&2
    exit 65
  fi
done

file_count="$(find "$site_dir" -type f | wc -l | tr -d ' ')"
if [ "$file_count" -lt 20 ]; then
  echo "documentation output is unexpectedly small: $file_count files" >&2
  exit 65
fi

echo "documentation output verified: $site_dir ($file_count files)"
