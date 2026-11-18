#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo 'Usage: sh scripts/test-sdk-consumer.sh <ecoku.tgz>' >&2
  exit 1
fi

tarball=$(realpath -- "$1")
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
cd "$scratch"
printf '%s\n' '{"name":"ecoku-consumer-test","version":"1.0.0","private":true}' > package.json
npm install --offline --engine-strict --ignore-scripts --no-audit --no-fund --no-package-lock --cache "$scratch/.npm" "$tarball"

node --input-type=module <<'JS'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { default: esm } = await import('ecoku')
const commonJS = require('ecoku')
for (const Ecoku of [esm, commonJS]) {
  assert.equal(typeof Ecoku, 'function')
  assert.equal(typeof Ecoku.prototype.init, 'function')
  assert.equal(typeof Ecoku.prototype.destroy, 'function')
}
const packageRoot = new URL('./node_modules/ecoku/', import.meta.url)
const metadata = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'))
assert.equal(metadata.exports['.'].types, metadata.types)
assert.ok(readFileSync(new URL(metadata.types, packageRoot), 'utf8').length > 0)
console.log(`ecoku@${metadata.version}: ESM, CommonJS and declaration entry passed on ${process.version}`)
JS
