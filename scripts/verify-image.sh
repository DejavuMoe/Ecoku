#!/bin/sh
set -eu

image="${1:?usage: verify-image.sh IMAGE [PREVIOUS_IMAGE]}"
previous="${2:-}"
test "$(docker image inspect --format '{{.Config.User}}' "$image")" = '10001:10001'
test "$(docker image inspect --format '{{json .Config.Entrypoint}}' "$image")" = '["/app/ecoku-server"]'
test "$(docker image inspect --format '{{.Config.StopSignal}}' "$image")" = 'SIGTERM'
test "$(docker image inspect --format '{{json .Config.Healthcheck.Test}}' "$image")" = '["CMD","/app/ecoku-server","healthcheck"]'
arch=$(docker image inspect --format '{{.Architecture}}' "$image")
scratch="$(mktemp -d -t ecoku-imagecheck.XXXXXX)"
container=''
volume=''
bind_data=''
set_owner() {
  # Only the disposable fixture needs ownership setup; the service always drops ALL.
  docker run --rm --network=none --read-only --user=0:0 --cap-drop=ALL --cap-add=CHOWN --cap-add=DAC_OVERRIDE \
    --security-opt=no-new-privileges --pids-limit=16 --memory=32m --cpus=1 \
    --mount "type=bind,src=$bind_data,dst=/fixture" --entrypoint /bin/chown \
    "$previous" -R "$1" /fixture
}
cleanup() {
  if [ -n "$container" ]; then docker rm -f "$container" >/dev/null 2>&1 || true; fi
  if [ -n "$volume" ]; then docker volume rm "$volume" >/dev/null; fi
  if [ -n "$bind_data" ]; then set_owner "$(id -u):$(id -g)"; fi
  rm -rf -- "$scratch"
}
trap cleanup EXIT HUP INT TERM
CGO_ENABLED=0 GOOS=linux GOARCH="$arch" go build -trimpath -o "$scratch/imagecheck" "$(dirname "$0")/imagecheck.go"
if [ -n "$previous" ]; then
  bind_data="$scratch/data"
  mkdir -m 0750 "$bind_data"
  set_owner 10001:10001
  data_mount="type=bind,src=$bind_data,dst=/data"
else
  volume=$(docker volume create)
  data_mount="type=volume,src=$volume,dst=/data"
fi
cat > "$scratch/config.yaml" <<'YAML'
notifications:
  instance_public_url: "http://127.0.0.1:12123"
sites:
  - id: imagecheck
    site_url: "https://imagecheck.example"
    allowed_origins: ["https://imagecheck.example"]
YAML
chmod 0644 "$scratch/config.yaml"
chmod 0755 "$scratch/imagecheck"
# Dummy credentials only; no host credentials or published ports enter this fixture.
password_hash=$(printf '%s\n' image-check-fixture-password | docker run --rm -i --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges "$image" hash-password)

start() {
  current=$1
  probe=$2
  container=$(docker create --pull=never --network=none --read-only \
    --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=64 \
    --cpus=1 --memory=384m --memory-swap=384m --ulimit fsize=67108864:67108864 \
    --log-driver=local --log-opt max-size=1m --log-opt max-file=1 --log-opt compress=false \
    --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
    --mount "$data_mount" \
    --mount "type=bind,src=$scratch/config.yaml,dst=/app/config.yaml,readonly" \
    --mount "type=bind,src=$scratch/imagecheck,dst=/imagecheck,readonly" \
    --env TZ=Asia/Shanghai --env ECOKU_ADMIN_USERNAME=imagecheck \
    --env "ECOKU_ADMIN_PASSWORD_HASH=$password_hash" \
    --env ECOKU_ADMIN_TOKEN_KEY=image-check-fixture-token-key-32bytes \
    "$current")
  docker start "$container" >/dev/null
  ready=false
  for attempt in $(seq 1 30); do
    if [ "$probe" = native ]; then
      if docker exec "$container" /app/ecoku-server healthcheck 2>/dev/null; then ready=true; break; fi
    else
      if docker exec "$container" wget -q -T 2 -O /dev/null http://127.0.0.1:12123/api/health 2>/dev/null; then ready=true; break; fi
    fi
    test "$(docker inspect --format '{{.State.Running}}' "$container")" = true || break
    sleep 1
  done
  if [ "$ready" != true ]; then
    echo "Image did not become healthy after $attempt attempts" >&2
    docker logs "$container" >&2
    exit 1
  fi
}

stop() {
  docker stop --signal SIGTERM --timeout 25 "$container" >/dev/null
  test "$(docker inspect --format '{{.State.ExitCode}}' "$container")" = 0
  test "$(docker inspect --format '{{.State.OOMKilled}}' "$container")" = false
  docker cp "$container:/data/ecoku-secrets.json" "$scratch/secrets.json" >/dev/null
  docker cp "$container:/data/ecoku.sqlite3" "$scratch/database.sqlite3" >/dev/null
  docker rm "$container" >/dev/null
  container=''
}

if [ -n "$previous" ]; then
  test "$(docker image inspect --format '{{.Architecture}}' "$previous")" = "$arch"
  start "$previous" legacy
  docker exec "$container" /imagecheck -seed
  stop
  cp "$scratch/secrets.json" "$scratch/previous-secrets.json"
  cp "$scratch/database.sqlite3" "$scratch/previous.sqlite3"
fi

start "$image" native
if [ -n "$previous" ]; then
  docker exec "$container" /imagecheck -distroless -comments=2 -add
else
  docker exec "$container" /imagecheck -distroless
fi
docker exec "$container" /app/ecoku-server captcha status
stop

if [ -n "$previous" ]; then
  cmp "$scratch/previous-secrets.json" "$scratch/secrets.json"
  start "$previous" legacy
  docker exec "$container" /imagecheck -comments=3
  stop
  cmp "$scratch/previous-secrets.json" "$scratch/secrets.json"
  python3 - "$scratch/previous.sqlite3" "$scratch/database.sqlite3" <<'PY'
import sqlite3
import sys
with sqlite3.connect(sys.argv[1]) as before, sqlite3.connect(sys.argv[2]) as after:
    assert after.execute('PRAGMA integrity_check').fetchone() == ('ok',)
    for table in ('schema_migrations', 'sites', 'site_origins', 'admin_accounts', 'notification_settings'):
        assert before.execute(f'SELECT * FROM {table} ORDER BY 1').fetchall() == after.execute(f'SELECT * FROM {table} ORDER BY 1').fetchall(), table
    assert before.execute('SELECT * FROM comments ORDER BY id').fetchall() == after.execute('SELECT * FROM comments WHERE id <= 2 ORDER BY id').fetchall()
    assert after.execute('SELECT count(*) FROM comments').fetchone() == (3,)
print('Upgrade and rollback preserved schema, accounts, sites, encrypted credentials, keys and old/new comments.')
PY
fi
echo 'Image runtime checks passed, including SIGTERM and clean database shutdown.'
