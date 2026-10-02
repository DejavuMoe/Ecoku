# Configuration reference

The annotated template below collects every `app/config.yaml` field, default, allowed value, explanation, and example. The Docker deployment page includes the same template, so there is no separate field table to reconcile.

## Complete configuration template {#template}

Copy the template and replace `instance_public_url`. Other active values are defaults; uncomment optional assignments as needed. Each top-level YAML section may appear only once, so do not append duplicate `site:` or `admin:` sections. The admin console is always enabled and session duration is fixed, not tunable.

<div class="config-template">

<<< ../../../deploy/config.en.yaml.example{yaml}

</div>

## Apply changes {#reload}

Save the file, then recreate the container from the Compose directory and inspect its logs. Editing the mounted YAML does not hot-reload the service:

```bash
sudo docker compose up -d --force-recreate ecoku
sudo docker compose logs --tail=100 ecoku
```

Only one YAML document is allowed. Unknown fields, invalid values, and duplicate fields prevent startup. Correct the reported problem and start again.

## Rate-limit behavior {#rate-limit}

Defaults, units, and examples for every `rate_limit` field are in the template. Counters are per IP; excess requests return `429` and `Retry-After`, and restart resets counters. `0` restores the default rather than disabling limits. Behind a reverse proxy, also set `site.trusted_proxies` so visitors do not share the proxy IP’s allowance.

## Logs {#logs}

Logs go to stdout by default; view them with `docker compose logs`. Docker controls retention and rotation. `site.log_path` optionally enables file logging alongside stdout when set to a real path, requiring a writable mounted directory. See the template for accepted values.

## Environment variables {#env}

New deployments need no `ecoku.env`. Compose’s `TZ: Asia/Shanghai` controls comment and notification timestamps. Edit that line to change the zone; `TZ` is not a YAML configuration field.

The template’s `*_env` fields name environment variables read by the process, not secret values. To supply values yourself, inject the named variables through Compose `environment` or `env_file`. By default the administrator and persistent keys are created automatically. Do not override the image’s `GIN_MODE=release` or `ECOKU_RUNTIME=container`.

## Initialization and persistent data {#legacy}

The `sites` seeds are imported only when creating a brand-new database and do not overwrite existing sites. Later site edits, SMTP, Telegram, CAPTCHA and Smoji settings belong in the console. Back up the database and its sibling `ecoku-secrets.json` together. Changing the database path does not move data.
