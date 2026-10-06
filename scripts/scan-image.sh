#!/usr/bin/env bash
set -euo pipefail

image=${1:?usage: scan-image.sh IMAGE ARCH REPORT_DIR}
arch=${2:?missing architecture}
report_dir=${3:?missing report directory}
version=0.75.0
case "$arch" in
  amd64) archive_arch=64bit; checksum=c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f ;;
  arm64) archive_arch=ARM64; checksum=a1ee9f6ffb7d112b64ff726a2a0717c21175c1114361391f4a132956751a13b3 ;;
  *) echo 'Unsupported scanner architecture' >&2; exit 64 ;;
esac
[[ "$image" =~ @sha256:[a-f0-9]{64}$ ]]
[[ $(docker image inspect --format '{{.Architecture}}' "$image") == "$arch" ]]
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
mkdir -p "$report_dir"
curl --fail --silent --show-error --location --retry 3 \
  "https://github.com/aquasecurity/trivy/releases/download/v$version/trivy_${version}_Linux-${archive_arch}.tar.gz" \
  --output "$scratch/trivy.tar.gz"
printf '%s  %s\n' "$checksum" "$scratch/trivy.tar.gz" | sha256sum --check --strict
tar -xzf "$scratch/trivy.tar.gz" -C "$scratch" trivy
printf 'image=%s\narchitecture=%s\ntrivy=%s\n' "$image" "$arch" "$version" > "$report_dir/inputs.txt"
export TRIVY_CACHE_DIR="$scratch/cache"
# Inspect the pulled digest; do not silently fall back to a tag or another registry.
"$scratch/trivy" image --disable-telemetry --timeout 5m --image-src docker \
  --format cyclonedx --output "$report_dir/sbom.cdx.json" "$image"
# Record the exact database used below, including its update time.
"$scratch/trivy" image --disable-telemetry --timeout 5m --download-db-only
"$scratch/trivy" version --format json > "$report_dir/scanner-version.json"
"$scratch/trivy" image --disable-telemetry --timeout 5m --image-src docker \
  --skip-db-update --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --ignorefile /dev/null \
  --format json --output "$report_dir/vulnerabilities.json" "$image"
