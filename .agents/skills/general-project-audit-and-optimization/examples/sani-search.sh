#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 2 ]]; then
    echo "Usage: bash sani-search.sh SANI_CHECKOUT REVISION" >&2
    exit 2
fi

repo=$(git -C "$1" rev-parse --show-toplevel)
candidate=$(git -C "$repo" rev-parse --verify --end-of-options "$2^{commit}")
probe=4419880b512dc65555b6abc88da3094665076df8
spec=web/e2e/audit-regressions.spec.ts
test_name='AUD-006 encoded short URL search survives editing and stats refresh zh/dark/1280'

temp_root=$(cd -- "${TMPDIR:-/tmp}" && pwd -P)
run=$(mktemp -d "$temp_root/sani-acceptance.XXXXXXXX")
trap 'rm -rf -- "$run"' EXIT
mkdir "$run/source" "$run/runtime"
git -C "$repo" archive "$candidate" | tar -x -C "$run/source"
# The earlier product revision predates the test. Use the identical upstream probe on each candidate.
git -C "$repo" show "$probe:$spec" > "$run/source/web/e2e/acceptance-replay.spec.ts"
printf 'candidate=%s\nprobe=%s\nprobe_blob=%s\ncase=%s\n' \
    "$candidate" "$probe" "$(git -C "$repo" rev-parse "$probe:$spec")" "$test_name"

cd "$run/source"
export CI=1 TMPDIR="$run/runtime" GOTOOLCHAIN=local PLAYWRIGHT_SKIP_BROWSER_GC=1
unset SANI_QA_DIR
go version
node --version
pnpm --version
pnpm install --frozen-lockfile
make RUN= VERSION="$candidate" build
pnpm --dir web exec playwright --version
pnpm --dir web exec playwright install --only-shell chromium
pnpm --dir web exec playwright test e2e/acceptance-replay.spec.ts \
    --project=chromium --grep "$test_name$" --workers=1 --retries=0 --forbid-only --reporter=list
