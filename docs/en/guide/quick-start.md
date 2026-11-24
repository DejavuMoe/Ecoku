# Quick start

Start from a Linux host with Docker installed and end with a comment section under your blog posts. This page has only the required commands; each step is covered in full on its own page.

<div class="page-meta">
<div>

**You will**

- Run Ecoku on your host
- Sign in to the admin console over HTTPS
- See a comment section under a post

</div>
<div>

**Before you start**

- A Linux host with Docker and Compose v2.17+
- A domain for Ecoku, such as `ecoku.example.com`
- Caddy (or Nginx) installed on the host

</div>
</div>

<div class="steps">

### Create the deployment directory

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data && cd ~/Ecoku
sudo chown -R 10001:10001 data && sudo chmod 750 data
```

### Write compose.yaml and config.yaml

`compose.yaml`:

```yaml
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.6.3"
    init: true
    restart: unless-stopped
    container_name: ecoku
    environment:
      TZ: Asia/Shanghai
      ECOKU_ADMIN_LOCALE: zh-CN
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./data:/data
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=16m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "/app/ecoku-server", "healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

`app/config.yaml`. Replace the URL with the domain you set aside for Ecoku:

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

```bash
chmod 644 app/config.yaml
```

### Start and get the administrator password

Start once so Ecoku creates the database and the administrator account, then stop it and generate a temporary password:

```bash
sudo docker compose up -d --wait
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait
```

Note what follows `管理员临时密码：` (temporary administrator password) in the output. It doesn't appear in the logs; if you lose it, run the command again.

### Set up HTTPS

Add this to your Caddyfile:

```caddyfile
ecoku.example.com {
    reverse_proxy 127.0.0.1:12123 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

After reloading Caddy, make Ecoku trust forwarding headers from the Docker gateway. Otherwise all visitors share one rate limit:

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

Write the address it prints (for example `172.18.0.1`) into `app/config.yaml`, then recreate the container:

```yaml
site:
  trusted_proxies: ["172.18.0.1/32"]
```

```bash
sudo docker compose up -d --force-recreate --wait
```

### Sign in and register your blog

Open `https://ecoku.example.com/admin/`, sign in with `admin` and the temporary password, and set a permanent password when prompted.

Then fill in **New site**:

- **Site ID**: for example `blog`; the embed code uses it
- **Site URL**: `https://blog.example.com`
- **Allowed origins**: `https://blog.example.com`

### Embed comments

Put this HTML where the comment section goes in your post template. Output the post path in `data-page-key` with a template variable, such as Hugo's <code v-pre>{{ .RelPermalink }}</code>.

```html
<section id="ecoku-comments" class="ecoku-shell" data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="Hello, world">
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Reload comments</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

Open a post and the comment section appears.

</div>

## Next steps

<div class="cards">
<Card title="Set up backups" link="/self-hosting/backup" icon="database">Back up the database and the key file together.</Card>
<Card title="Turn on notifications" link="/admin/notifications" icon="bell">Get an email or Telegram message when a new comment arrives.</Card>
<Card title="Set up your blogger identity" link="/admin/blogger" icon="message">Reply as the blogger in your own comment section.</Card>
<Card title="Adjust the look" link="/integration/custom-css" icon="sliders">Match the comment section to your blog's colors.</Card>
</div>

If you run into problems, see the [FAQ](../reference/faq) first. For a full production deployment, see [Docker installation](../self-hosting/docker).
