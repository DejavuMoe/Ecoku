# Configuration reference

The annotated template below collects every `app/config.yaml` field, default, allowed value, explanation, and example. The Docker deployment page includes the same template, so there is no separate field table to reconcile.

## Complete configuration template {#template}

For a new deployment, copy the template and replace `instance_public_url`. Active options use defaults. Keep legacy compatibility options commented unless retaining old deployment behavior. Each top-level YAML section must appear only once; do not append a second `site:` or `admin:` section.

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

Logs go to stdout by default; use `docker compose logs`. Docker controls retention and rotation. `site.log_path` in the template is a legacy option; new deployments need no log directory mount.

## Environment variables {#env}

New deployments need no `ecoku.env`. Compose’s `TZ: Asia/Shanghai` controls comment and notification timestamps. Edit that line to change the zone; `TZ` is not a YAML configuration field.

The template’s `*_env` fields are old environment variable names, not secret values. New instances create the administrator, temporary password, and persistent keys automatically. Existing instances must import and back up before removing old variables. The image sets `GIN_MODE=release` and `ECOKU_RUNTIME=container`; do not override them.

## Legacy configuration migration {#legacy}

The template documents all compatibility fields still accepted and their defaults. Site seeds are imported only into brand-new databases and never overwrite existing sites. Manage sites, SMTP, Telegram, CAPTCHA, and Smoji in the console.

See [legacy instance configuration migration](../self-hosting/upgrade#legacy-config) for upgrade and environment-variable removal steps. Back up the database and its sibling `ecoku-secrets.json` together.
