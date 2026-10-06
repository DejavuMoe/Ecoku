#!/bin/sh
set -eu

image="${1:?usage: verify-image.sh IMAGE}"
test "$(docker image inspect --format '{{.Config.User}}' "$image")" = '10001:10001'
test "$(docker image inspect --format '{{json .Config.Entrypoint}}' "$image")" = '["/app/ecoku-server"]'
test "$(docker image inspect --format '{{.Config.StopSignal}}' "$image")" = 'SIGTERM'

scratch="$(mktemp -d)"
container=''
cleanup() {
  if [ -n "$container" ]; then docker rm -f "$container" >/dev/null 2>&1 || true; fi
  rm -rf -- "$scratch"
}
trap cleanup EXIT HUP INT TERM
printf 'notifications:\n  instance_public_url: "http://127.0.0.1:12123"\n' > "$scratch/config.yaml"
chmod 0644 "$scratch/config.yaml"
container="$(docker create --pull=never --network=none --read-only \
  --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=64 \
  --cpus=1 --memory=384m --memory-swap=384m --ulimit fsize=67108864:67108864 \
  --log-driver=local --log-opt max-size=1m --log-opt max-file=1 \
  --tmpfs /data:rw,noexec,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0750 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  --mount "type=bind,src=$scratch/config.yaml,dst=/app/config.yaml,readonly" "$image")"
docker start "$container" >/dev/null
ready=false
for attempt in $(seq 1 30); do
  if docker exec "$container" wget -q -T 2 -O /dev/null http://127.0.0.1:12123/api/health; then ready=true; break; fi
  test "$(docker inspect --format '{{.State.Running}}' "$container")" = true || break
  sleep 1
done
if [ "$ready" != true ]; then
  echo "Image did not become healthy after $attempt attempts" >&2
  docker logs "$container" >&2
  exit 1
fi
docker exec "$container" sh -eu -c '
  test "$(id -u)" = 10001
  test -s /data/ecoku.sqlite3
  test -s /data/ecoku-secrets.json
  test -r /etc/ssl/certs/ca-certificates.crt
  test -r /usr/share/zoneinfo/Asia/Shanghai
  for asset in ecoku.umd.js ecoku-loader.js ecoku.css ecoku.unstyled.css; do
    test -s "/app/client/$asset"
    wget -q -T 2 -O /dev/null "http://127.0.0.1:12123/client/$asset"
  done
  wget -q -T 2 -O /dev/null http://127.0.0.1:12123/admin/
  if touch /app/readonly-probe 2>/dev/null; then exit 1; fi
'
docker stop --signal SIGTERM --timeout 25 "$container" >/dev/null
test "$(docker inspect --format '{{.State.ExitCode}}' "$container")" = 0
test "$(docker inspect --format '{{.State.OOMKilled}}' "$container")" = false
echo 'Image runtime checks passed: nonroot, read-only root, isolated data, assets, health and SIGTERM.'
