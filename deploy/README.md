# Deploying the hosted instance

The hosted CompanyMind runs on one DigitalOcean droplet (`ssh companymind`,
165.22.176.157, Ubuntu 24.04, 1 vCPU / 2 GB + 4 GB swap) with the root
`docker-compose.yml`. Host nginx terminates TLS; every container listens on
127.0.0.1 only, so the public surface is 22, 80 and 443.

| Host | Serves |
|---|---|
| `app.companymind.uz` | `web` (127.0.0.1:3000) — `/` redirects to `/dashboard` |
| `companymind.uz`, `www.companymind.uz` | `marketing` (127.0.0.1:3001) |
| `app.165-22-176-157.sslip.io`, `165-22-176-157.sslip.io` | same, fallback names that need no DNS |

## Files in this directory

- `nginx/companymind.conf` → `/etc/nginx/sites-available/companymind`
  (symlinked into `sites-enabled`). Mirrors the live file, certbot's blocks
  included. If you change it on the server, copy it back here.
- `docker-compose.override.yml` → `/opt/companymind/docker-compose.override.yml`.
  Rebinds `db`/`web`/`marketing` to 127.0.0.1 and adds `restart: unless-stopped`.
  Server-only: don't put it at the repo root locally, it would change your dev ports.

Secrets live only in `/opt/companymind/.env` (mode 600, generated on the box —
see `.env.example` for the keys). They are not in this repo.

## Ship a new version

There is no git checkout on the server; the tree is synced from a local clone.
The excludes matter: `--delete` would otherwise remove the server's `.env` and
override file.

```bash
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .venv --exclude __pycache__ \
  --exclude .git --exclude reference --exclude .storage \
  --exclude .env --exclude .env.local --exclude docker-compose.override.yml \
  ./ companymind:/opt/companymind/

ssh companymind 'cd /opt/companymind && docker compose build && docker compose up -d'
```

The engine takes ~25 s after start to answer `/health` on this box (numpy /
scikit-learn import on one vCPU) — web gets `ECONNREFUSED` until then.

### Migrations

`drizzle-kit` isn't in the runtime image, so run it from the build stage:

```bash
ssh companymind 'cd /opt/companymind &&
  docker build -q --target build -t companymind-web-tools ./web &&
  docker run --rm --network companymind_default --env-file .env \
    companymind-web-tools npx drizzle-kit migrate'
```

### Platform super-admin (seed-only)

```bash
docker run --rm --network companymind_default --env-file .env \
  -e SEED_EMAIL=… -e SEED_PASSWORD=… -e SEED_WORKSPACE=CompanyMind \
  companymind-web-tools npm run seed
```

## TLS

One Let's Encrypt certificate (`--cert-name app.companymind.uz`) covers all five
names; `certbot.timer` renews it. To add a hostname, add it to a `server_name`
and expand the certificate:

```bash
certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email \
  --redirect --expand --cert-name app.companymind.uz \
  -d app.companymind.uz -d app.165-22-176-157.sslip.io -d 165-22-176-157.sslip.io \
  -d companymind.uz -d www.companymind.uz -d <new-name>
```

`certbot renew --dry-run` sleeps a random few minutes when run without a TTY;
add `--no-random-sleep-on-renew` to test it interactively.
