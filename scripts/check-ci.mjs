import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import './check-recovery.mjs'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const ci = read('.github/workflows/ci.yml')
assert.match(ci, /^on:\n  push:\n    branches: \[master\]\n  pull_request:\n    branches: \[master\]\n  workflow_call:\n\n/m)

function checkSecurity(source) {
  // Exact standalone steps prevent filters, ignored errors and success masking.
  assert.match(source, /^    env:\n      pnpm_config_verify_deps_before_run: 'false'\n    strategy:\n      fail-fast: false\n      matrix:\n        target: \[client, admin, docs\]\n        include:\n          - target: client\n            filter: \.\/packages\/client\.\.\.\n          - target: admin\n            filter: \.\/packages\/admin\.\.\.\n          - target: docs\n            filter: \.\/docs\.\.\.\n    steps:\n/m)
  assert.equal((source.match(/pnpm_config_verify_deps_before_run/gi) ?? []).length, 1, 'No step may override explicit installation')
  assert.match(source, /^      - name: Audit JavaScript dependencies\n        if: matrix.target == 'client'\n        run: pnpm audit --audit-level=high\n(?=      - )/m)
  assert.match(source, /^      - name: Check Go vulnerabilities\n        run: go run golang\.org\/x\/vuln\/cmd\/govulncheck@v\d+\.\d+\.\d+ \.\/\.\.\.\n(?=      - )/m)
  assert.match(source, /^      - name: Install target dependencies\n        env:\n          FILTER: \$\{\{ matrix.filter \}\}\n        run: pnpm --filter "\$FILTER" --fail-if-no-match install --frozen-lockfile --prefer-offline\n      - name: Install SDK test browser\n        if: matrix.target == 'client'\n        run: pnpm -C packages\/client exec playwright install --with-deps chromium\n(?=      - name: Verify SDK browser behavior\n)/m)
  assert.match(source, /^      - name: Verify SDK browser behavior\n        if: matrix.target == 'client'\n        run: pnpm -C packages\/client run test:browser\n(?=      - )/m)
  assert.match(source, /^      - name: Verify API smoke script\n        if: matrix.target == 'client'\n        run: pwsh -NoProfile -File scripts\/real-api-smoke.test.ps1\n(?=      - )/m)
  assert.match(source, /^      - name: Verify frontend\n        if: matrix.target != 'docs'\n        env:\n          TARGET: \$\{\{ matrix.target \}\}\n        run: pnpm "verify:\$TARGET"\n(?=      - )/m)
  assert.match(source, /^      - name: Build and verify documentation\n        if: matrix.target == 'docs'\n        run: \|\n          pnpm docs:build\n          sh scripts\/verify-docs-output.sh docs\/\.vitepress\/dist\n(?=      - )/m)
  assert.match(source, /^      - run: go test -count=1 \.\/\.\.\.\n      - run: go vet \.\/\.\.\.\n      - run: go build -trimpath -ldflags="-s -w" -o \/tmp\/ecoku-server \.\n/m)
  assert.doesNotMatch(source, /^\s+continue-on-error:/m, 'CI failures must block release')
  assert.doesNotMatch(source, /^    if:/m, 'Required CI jobs must not be conditional')
}
checkSecurity(ci)
// Exercise the guards in memory; never run scanners or alter workflow fixtures.
for (const [before, after] of [
  ['--audit-level=high', '--audit-level=critical'],
  ['--audit-level=high', '--audit-level=high --ignore-registry-errors'],
  ['--audit-level=high', '--audit-level=high --prod'],
  ['--audit-level=high', '--audit-level=high || true'],
  ['pnpm audit', 'pnpm --filter ./packages/client... audit'],
  ['target: [client, admin, docs]', 'target: [client, admin]'],
  ['filter: ./packages/client...', 'filter: ecoku'],
  ['filter: ./packages/admin...', 'filter: ./packages/client...'],
  ['filter: ./docs...', 'filter: ecoku-docs'],
  ["pnpm_config_verify_deps_before_run: 'false'", "pnpm_config_verify_deps_before_run: 'install'"],
  ["      pnpm_config_verify_deps_before_run: 'false'\n", ''],
  ['--filter "$FILTER" --fail-if-no-match ', ''],
  ['--frozen-lockfile ', ''],
  ["if: matrix.target == 'client'", 'if: false'],
  [/govulncheck@v[\d.]+/, 'govulncheck@latest'],
  [' ./...\n', ' -json ./...\n'],
  ['playwright install --with-deps chromium', 'playwright install chromium'],
  ['run test:browser\n', 'run test:browser || true\n'],
  ['-File scripts/real-api-smoke.test.ps1', '-Command exit 0'],
  ["if: matrix.target != 'docs'", 'if: false'],
  ['pnpm docs:build', 'pnpm docs:build || true'],
  ['go test -count=1 ./...', 'go test -count=1 ./... || true'],
  ['  server:\n', '  server:\n    continue-on-error: true\n'],
  ['  server:\n', '  server:\n    if: false\n'],
]) assert.throws(() => checkSecurity(ci.replace(before, after)))

const release = read('.github/workflows/release.yml')
const scan = read('scripts/scan-image.sh')
function checkRelease(source, scanner) {
  assert.match(source, /^on:\n  push:\n    tags: \['v\*'\]\n/m)
  assert.match(source, /^  verify:\n    needs: check\n    uses: \.\/\.github\/workflows\/ci\.yml\n\n/m)
  for (const job of ['image', 'npm']) {
    assert.match(source, new RegExp(`^  ${job}:\\n    needs: \\[check, verify\\]\\n`, 'm'))
  }
  const image = source.match(/^  image:\n[\s\S]*?(?=^  manifest:\n)/m)?.[0]
  assert.ok(image, 'Image verification must precede the manifest job')
  assert.match(image, /^    runs-on: \$\{\{ matrix.runner \}\}\n    timeout-minutes: 45\n    permissions:\n      contents: read\n      packages: write\n    strategy:\n      fail-fast: false\n      matrix:\n        include:\n          - arch: amd64\n            runner: ubuntu-24.04\n          - arch: arm64\n            runner: ubuntu-24.04-arm\n    steps:\n/m)
  assert.match(image, /^      - name: Verify final image runtime and vulnerabilities\n        env:\n          IMAGE: \$\{\{ needs.check.outputs.image \}\}@\$\{\{ steps.build.outputs.digest \}\}\n          ARCH: \$\{\{ matrix.arch \}\}\n        run: \|\n          docker pull "\$IMAGE"\n          sh scripts\/verify-image.sh "\$IMAGE"\n          bash scripts\/scan-image.sh "\$IMAGE" "\$ARCH" "\$RUNNER_TEMP\/image-checks"\n      - name: Save image SBOM and scan results\n        if: always\(\)\n        uses: actions\/upload-artifact@[a-f0-9]{40} #[^\n]+\n        with:\n          name: image-checks-\$\{\{ matrix.arch \}\}\n          path: \$\{\{ runner.temp \}\}\/image-checks\n          if-no-files-found: warn\n          retention-days: 30\n(?=      - name: Export image digest\n)/m)
  assert.match(source, /^  manifest:\n    needs: \[check, image\]\n/m)
  assert.match(source, /^  release:\n    needs: \[manifest, npm\]\n/m)
  assert.doesNotMatch(source, /^\s+continue-on-error:/m, 'Image failures must block the manifest and release')
  assert.doesNotMatch(source, /^    if:/m, 'Required release jobs must not be conditional')
  assert.doesNotMatch(source, /^(?:defaults:|    defaults:|        shell:)/m, 'Do not override the fail-fast workflow shell')
  // Guard the scanner's security contracts, not its housekeeping implementation.
  assert.match(scanner, /^#!\/usr\/bin\/env bash\nset -euo pipefail\n/)
  assert.match(scanner, /^version=0\.75\.0$/m)
  assert.match(scanner, /^  amd64\) archive_arch=64bit; checksum=c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f ;;$/m)
  assert.match(scanner, /^  arm64\) archive_arch=ARM64; checksum=a1ee9f6ffb7d112b64ff726a2a0717c21175c1114361391f4a132956751a13b3 ;;$/m)
  assert.match(scanner, /^\[\[ "\$image" =~ @sha256:\[a-f0-9\]\{64\}\$ \]\]$/m)
  assert.match(scanner, /^\[\[ \$\(docker image inspect --format '\{\{\.Architecture\}\}' "\$image"\) == "\$arch" \]\]$/m)
  const checksum = scanner.search(/^printf '%s  %s\\n' "\$checksum" "\$scratch\/trivy.tar.gz" \| sha256sum --check --strict$/m)
  const extract = scanner.search(/^tar -xzf "\$scratch\/trivy.tar.gz" -C "\$scratch" trivy$/m)
  assert.ok(checksum >= 0 && extract > checksum, 'Verify the scanner archive checksum before extracting its executable')
  assert.match(scanner, /^"\$scratch\/trivy" image --disable-telemetry --timeout 5m --image-src docker \\\n  --format cyclonedx --output "\$report_dir\/sbom.cdx.json" "\$image"\n/m)
  assert.match(scanner, /^export TRIVY_CACHE_DIR="\$scratch\/cache"$/m)
  assert.match(scanner, /^"\$scratch\/trivy" image --disable-telemetry --timeout 5m --download-db-only\n"\$scratch\/trivy" version --format json > "\$report_dir\/scanner-version.json"\n"\$scratch\/trivy" image --disable-telemetry --timeout 5m --image-src docker \\\n  --skip-db-update --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --ignorefile \/dev\/null \\\n  --format json --output "\$report_dir\/vulnerabilities.json" "\$image"\n/m)
  assert.doesNotMatch(scanner, /^exit 0\b|^set \+|\|\|\s*(?:true\b|:(?:\s|$)|exit 0\b)/m, 'Scanner failures must not become success')
}
checkRelease(release, scan)
for (const [before, after] of [
  ['tags: [\'v*\']', 'tags: [\'other-*\']'],
  ['uses: ./.github/workflows/ci.yml', 'uses: ./.github/workflows/other.yml'],
  ['needs: [check, verify]', 'needs: check'],
  ['- arch: arm64', '- arch: amd64'],
  ['runner: ubuntu-24.04-arm', 'runner: ubuntu-24.04'],
  ['@${{ steps.build.outputs.digest }}', ':${{ github.ref_name }}'],
  ['ARCH: ${{ matrix.arch }}', 'ARCH: amd64'],
  ['docker pull "$IMAGE"', 'docker pull "$IMAGE" || true'],
  ['name: Verify final image runtime and vulnerabilities\n', 'name: Verify final image runtime and vulnerabilities\n        if: false\n'],
  ['sh scripts/verify-image.sh "$IMAGE"', ': skip-runtime'],
  ['bash scripts/scan-image.sh "$IMAGE" "$ARCH" "$RUNNER_TEMP/image-checks"', ': skip-scan'],
  ['if: always()', 'if: success()'],
  ['name: image-checks-${{ matrix.arch }}', 'name: image-checks'],
  ['name: Export image digest', 'name: Export unchecked digest'],
  ['needs: [check, image]', 'needs: check'],
  ['needs: [manifest, npm]', 'needs: npm'],
  ['  image:\n', '  image:\n    continue-on-error: true\n'],
  ['  image:\n', '  image:\n    if: false\n'],
  ['        run: |\n          docker pull', '        shell: bash {0}\n        run: |\n          docker pull'],
  ['jobs:\n', 'defaults:\n  run:\n    shell: bash {0}\n\njobs:\n'],
]) assert.throws(() => checkRelease(release.replace(before, after), scan))
for (const [before, after] of [
  ['set -euo pipefail', 'set +e'],
  ['version=0.75.0', 'version=latest'],
  ['checksum=c6e65a', 'checksum=06e65a'],
  ['checksum=a1ee9f', 'checksum=01ee9f'],
  ['@sha256:[a-f0-9]{64}$', ':latest$'],
  ['== "$arch"', '== amd64'],
  ['sha256sum --check --strict', 'true'],
  [/^(printf [^\n]+ \| sha256sum --check --strict)\n(tar -xzf [^\n]+)/m, '$2\n$1'],
  ['tar -xzf "$scratch/trivy.tar.gz" -C "$scratch" trivy', 'tar -xzf "$scratch/unverified.tar.gz" -C "$scratch" trivy'],
  ['--image-src docker', '--image-src remote'],
  ['--format cyclonedx', '--format table'],
  ['--download-db-only', '--skip-db-update'],
  ['version --format json', 'version --format table'],
  ['--skip-db-update --scanners', '--scanners'],
  ['--severity HIGH,CRITICAL', '--severity CRITICAL'],
  ['--exit-code 1', '--exit-code 0'],
  ['--ignorefile /dev/null', '--ignore-unfixed'],
  ['set -euo pipefail', 'set -euo pipefail\nexit 0'],
  ['"$report_dir/vulnerabilities.json" "$image"', '"$report_dir/vulnerabilities.json" "$image" || true'],
]) assert.throws(() => checkRelease(release, scan.replace(before, after)))
// A normal branch build must succeed even when its package version is published.
assert.doesNotMatch(ci, /npm\s+publish\b/)
assert.match(ci, /npm pack --ignore-scripts --pack-destination/)
assert.match(ci, /pnpm "verify:\$TARGET"/)
assert.match(ci, /CGO_ENABLED: '0'/)
const node = read('mise.toml').match(/^node = "([^"]+)"/m)[1]
const pnpm = read('mise.toml').match(/^pnpm = "([^"]+)"/m)[1]
assert.match(ci, new RegExp(`version: ${pnpm.replaceAll('.', '\\.')}`))
for (const file of readdirSync(new URL('../.github/workflows/', import.meta.url))) {
  const source = read(`.github/workflows/${file}`)
  for (const [, action] of source.matchAll(/uses:\s*(\S+)/g)) {
    assert.ok(action.startsWith('./') || /^[\w-]+\/[\w-]+@[a-f0-9]{40}$/.test(action), `${file}: action must use a full commit SHA`)
  }
  for (const [, version] of source.matchAll(/node-version:\s*([\d.]+)/g)) assert.equal(version, node, `${file}: Node differs from mise.toml`)
}
for (const file of ['.github/workflows/release.yml', '.github/workflows/recover-npm.yml']) {
  assert.match(read(file), /npm publish \.\/artifact\/\*\.tgz --ignore-scripts --access public --provenance/)
}
const recovery = read('.github/workflows/recover-npm.yml')
assert.match(recovery, /if: github.ref == 'refs\/heads\/master'/)
assert.match(recovery, /git\/ref\/tags\/\$TAG/)
assert.match(recovery, /assert.equal\(run.head_sha, commit.sha\)/)
assert.match(recovery, /ref: \$\{\{ steps.provenance.outputs.sha \}\}/)
assert.ok(recovery.indexOf('appendFileSync(process.env.GITHUB_OUTPUT') < recovery.indexOf('uses: actions/checkout@'))
assert.ok(recovery.indexOf('uses: actions/checkout@') < recovery.indexOf('node scripts/check-release.mjs'))
assert.doesNotMatch(recovery, /ref: \$\{\{ inputs.tag \}\}/)
const docsDeploy = read('.woodpecker/docs-deploy.yml')
assert.match(docsDeploy, /pnpm --filter \.\/docs\.\.\. --fail-if-no-match install --frozen-lockfile --prefer-offline/)
assert.match(docsDeploy, /pnpm_config_verify_deps_before_run: "false"/)
console.log('CI checks passed: filtered installs, dependency/image security gates, release reuse, packaging without publishing, pinned actions, matching Node/pnpm and release provenance.')
