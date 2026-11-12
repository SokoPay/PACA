# PACA — Professional Agile Certification, Africa

An npm-workspaces/Turborepo monorepo for the PACA platform: membership
applications and review, membership payments (Paystack: card, mobile money,
bank), the open assessment, and certificates.

**Member journey:** register → apply for a tier (form + type-checked documents)
→ admin approves → member pays the annual fee in the Paystack popup → membership
becomes ACTIVE until 31 December → member sits the assessment → a pass issues a
certificate that anyone can check at `/verify/<credential-id>`.

## Project layout

```
apps/
  api/            NestJS (Fastify) API — http://127.0.0.1:4100/api/v1
  web/            Next.js frontend  — http://127.0.0.1:3100
packages/
  db/             Prisma schema, migrations, seed scripts (@paca/db)
  core/           Domain logic (@paca/core)
  shared/         Shared types/utils (@paca/shared)
  config/         Shared config (@paca/config)
```

Orchestrated with [Turborepo](https://turbo.build/) via npm workspaces.

## Prerequisites

- **Node.js >= 20**
- **npm** (bundled with Node)
- **PostgreSQL 16**, either through Docker Desktop (below) or installed
  natively. Redis is optional locally: without `REDIS_URL` the API keeps
  rate-limit counters in memory.
- **Git for Windows** (provides a `bash.exe` used to run this repo's dev
  scripts correctly on Windows — see note below)

## 1. Start Postgres and Redis with Docker

A `docker-compose.yml` at the repo root spins up Postgres and Redis with
credentials matching the `.env` files:

```bash
docker compose up -d
```

This starts:
- **Postgres** on `127.0.0.1:5432` (db `paca_dev`, user `postgres`, password `paca_dev`)
- **Redis** on `127.0.0.1:6379`

Check both are healthy with `docker compose ps`.

> The `.env.example` comment mentions WSL Postgres — that's just a note that
> `localhost` and `127.0.0.1` can resolve differently under WSL. Since we're
> using Docker Desktop, `127.0.0.1` works fine.

## 2. Configure environment variables

There are **two separate `.env` files** — this trips people up, so read this
carefully:

- **`.env`** (repo root) — a reference copy of every variable, not actually
  loaded by anything.
- **`apps/api/.env`** — the file the API process actually reads (it runs
  `node --env-file=.env` from inside `apps/api/`, so it resolves `.env`
  relative to that folder). **Edit this one** for anything that needs to
  reach the running API — JWT secrets, Paystack keys, DB URL, etc.

The API validates its env at startup and **refuses to boot** if
`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are missing, identical, or shorter
than 32 characters. Generate two distinct secrets:

```bash
openssl rand -base64 48   # -> JWT_ACCESS_SECRET
openssl rand -base64 48   # -> JWT_REFRESH_SECRET
```

Put them in `apps/api/.env`. Everything else there (Paystack, ClamAV, Redis, S3,
Resend, Anthropic keys) is optional for local dev; each of those features stays
off until you supply its settings. Keep `.env` (root) in sync manually if you
want it to stay an accurate reference.

To take payments locally, add your Paystack **test** secret key to
`apps/api/.env`, plus the charge settings (see [Payments](#payments-paystack)):

```bash
PAYSTACK_SECRET_KEY="sk_test_..."
PAYSTACK_CURRENCY="GHS"
PAYSTACK_USD_RATE=12.5
PAYSTACK_CHANNELS="card,mobile_money,bank,bank_transfer"
```

The API refuses to boot if a Paystack key is set without `PAYSTACK_USD_RATE`
(unless the currency is USD).

## 3. Install dependencies

```bash
npm install
```

> **Slow/unstable connections:** the repo's `.npmrc` already raises
> `fetch-timeout`/`fetch-retries` and caps `maxsockets=1` — large packages
> (`prisma`, `next`, `@next/swc-*`) were timing out when downloaded in
> parallel on a slow line. If installs still fail, re-run `npm install`;
> npm resumes from what's already cached.

## 4. Set up the database

```bash
npm run db:generate   # generate the Prisma client
npm run db:migrate    # run migrations against the Dockerized Postgres
npm run db:seed       # (optional) seed sample data
```

## 5. Run the app

```bash
npm run dev
```

This runs `turbo run dev`, starting both apps in watch mode:
- Web: http://127.0.0.1:3100
- API: http://127.0.0.1:4100/api/v1 (check http://127.0.0.1:4100/api/v1/health)

> **Windows note:** `apps/api`'s dev script runs `tsc -w & node --watch
> dist/main.js` — the `&` is POSIX shell syntax to run both in parallel. npm
> normally executes scripts via `cmd.exe` on Windows, where `&` just chains
> commands *sequentially*, so `node` would never start (`tsc -w` never
> exits). This repo's `.npmrc` sets `script-shell` to Git Bash to fix that.
> If you don't have Git for Windows installed, install it (or WSL) first.

## Other commands

| Command             | Description                              |
|----------------------|-------------------------------------------|
| `npm run build`      | Build all apps/packages                   |
| `npm run lint`       | Lint all workspaces                       |
| `npm run typecheck`  | Type-check all workspaces                 |
| `npm run test`       | Run tests                                 |
| `npm run db:studio`  | Open Prisma Studio (DB browser GUI)       |

## Creating the first admin

Every registration creates a `MEMBER`. To get into `/admin`, register through
the site, then promote that account from a shell with database access:

```bash
npm run db:promote -- you@example.com SUPERADMIN
```

After that, a SUPERADMIN can change other users' roles from the admin UI.

## Payments (Paystack)

Members pay their annual fee from the dashboard. When an admin approves an
application, the membership is created as `PENDING_PAYMENT` and the dashboard
shows a **Pay** button. Clicking it opens Paystack's checkout popup on the same
page, where the member can pay by **card, mobile money or bank**.

**How it works**

1. `POST /api/v1/payments/membership/initialize`: the API reads the tier price
   from `tier_configs` (in USD), converts it at `PAYSTACK_USD_RATE` to
   `PAYSTACK_CURRENCY`, creates a `Payment` row, and opens a Paystack
   transaction. The browser receives only a one-time access code. It never sees
   the secret key and cannot change the amount.
2. The popup (Paystack InlineJS v2) collects the payment.
3. `POST /api/v1/payments/<reference>/verify`: when the popup reports success,
   the API asks Paystack directly whether the transaction succeeded and checks the
   amount and currency. Only then does it activate the membership.
4. `POST /api/v1/payments/paystack/webhook`: Paystack also notifies the API.
   The request is authenticated by its HMAC-SHA512 signature, stored in
   `webhook_events`, and runs the same activation logic. This covers mobile
   money approvals that complete after the popup closes.

Activation happens exactly once, even if the verify call and the webhook arrive
together. It sets the membership to `ACTIVE` until 31 December of the payment
year, records a `membership_periods` row, and grants the first block of
certification attempts (`exam_entitlements`) for tiers that require the exam.
Every step is written to the activity log.

A `LAPSED` membership shows the same button as a renewal. Members see their
payment history on the dashboard. Admins see all payments under
**Admin → Payments**.

**Configuration** (`apps/api/.env` locally, `.env.production` on the droplet)

| Variable | Meaning |
|---|---|
| `PAYSTACK_SECRET_KEY` | `sk_test_...` for testing, `sk_live_...` for launch. Without it, payment is switched off. |
| `PAYSTACK_CURRENCY` | Charge currency. The PACA account is Ghanaian and only accepts `GHS`, which mobile money also requires. |
| `PAYSTACK_USD_RATE` | Cedis per 1 USD. Tier prices are stored in USD. Update it when the rate moves. |
| `PAYSTACK_CHANNELS` | Methods offered in the popup. Default: `card,mobile_money,bank,bank_transfer`. |

**Webhook:** in the Paystack dashboard (Settings → API Keys & Webhooks), set the
Test webhook URL to `https://<your-domain>/api/v1/payments/paystack/webhook`.
Paystack cannot reach `localhost`, so local testing relies on step 3 only. That
is enough for card payments.

**Testing:** with a test key, no real money moves. The Paystack popup offers its
own test card and test mobile money options. A simple test card is
`4084 0840 8408 4081`, any future expiry, CVV `408`.

## Deploying to a DigitalOcean droplet (test environment)

`docker-compose.prod.yml` runs PACA as one self-contained Docker project named
`paca`: Postgres, Redis (rate-limit counters), a one-shot migration job, the
API, the web app, and an internal Caddy that routes `/api/*` to the API and
everything else to the web app. Only that Caddy publishes a port. On a shared
droplet it binds to `127.0.0.1:8090`, and the droplet's own web server forwards
PACA's domain to it. None of PACA's other containers publish ports, so they
cannot clash with other projects' databases or Redis.

Upload virus scanning (ClamAV) is **off** in this stack, because it needs
about 1.5 GB RAM. Uploads are still checked to be genuine PDF/PNG/JPEG files and
appear to admins as "Not scanned". To turn scanning on later on a bigger server,
add a `clamav/clamav:stable` service and set `CLAMAV_HOST` on the api.

### Runbook: the shared SokoPay droplet (host Caddy on 80/443)

Run as root on the droplet. Replace `ukcloudlogin.com` if the domain differs.

**1. Check memory, ports and DNS**

```bash
free -h                                               # note "available"
sudo ss -tlpn '( sport = :80 or sport = :443 or sport = :8090 )'   # caddy on 80/443, nothing on 8090
dig +short ukcloudlogin.com; curl -4 -s ifconfig.me; echo         # the two IPs must match
```

**2. Add swap** (the one-time build needs ~1.5 GB peak; swap protects the other apps)

```bash
swapon --show            # nothing printed = no swap yet, so:
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**3. Get the code** (private repo: read-only deploy key)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/paca_deploy -N "" -C "paca-droplet"
cat ~/.ssh/paca_deploy.pub
```

Add the printed key on GitHub under **SokoPay/PACA → Settings → Deploy keys**
with write access **off**. Then:

```bash
cat >> ~/.ssh/config <<'EOF'

Host github-paca
    HostName github.com
    User git
    IdentityFile ~/.ssh/paca_deploy
    IdentitiesOnly yes
EOF
git clone github-paca:SokoPay/PACA.git /opt/paca
```

**4. Create `.env.production`** (generates fresh secrets)

```bash
cd /opt/paca
DOMAIN=ukcloudlogin.com
cat > .env.production <<EOF
PUBLIC_URL="https://$DOMAIN"
SITE_ADDRESS=":80"
HTTP_BIND="127.0.0.1:8090"
HTTPS_BIND="127.0.0.1:8453"
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
JWT_ACCESS_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
JWT_REFRESH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
PAYSTACK_SECRET_KEY=""
PAYSTACK_CURRENCY="GHS"
PAYSTACK_USD_RATE="12.5"
PAYSTACK_CHANNELS="card,mobile_money,bank,bank_transfer"
ANTHROPIC_API_KEY=""
EOF
chmod 600 .env.production
nano .env.production     # paste the sk_test_... key; set the cedi rate; Ctrl+O, Enter, Ctrl+X
```

Keep a copy of this file in a password manager.

**5. Build and start**

```bash
echo "alias dc='docker compose -p paca -f /opt/paca/docker-compose.prod.yml --env-file /opt/paca/.env.production'" >> ~/.bashrc
source ~/.bashrc
cd /opt/paca && dc up -d --build          # first build ~10-20 min on this droplet
dc ps                                     # migrate "exited (0)"; others running/healthy
curl -s http://127.0.0.1:8090/api/v1/health; echo
```

**6. Add the domain to the host Caddy** (HTTPS is automatic)

```bash
grep -n "import" /etc/caddy/Caddyfile     # if sites are imported from a folder, put the block there instead
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)
sed 's/paca.example.com/ukcloudlogin.com/' deploy/host-caddy-paca.caddy >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy
journalctl -u caddy -n 50 --no-pager | grep -i -E "ukcloudlogin|certificate obtained|error"
```

To undo: `cp /etc/caddy/Caddyfile.bak-<date> /etc/caddy/Caddyfile && systemctl reload caddy`.

**7. Seed data and create the first SUPERADMIN**

```bash
dc run --rm migrate npm run db:seed
# register on https://ukcloudlogin.com first, then:
dc run --rm migrate npm run db:promote -- you@example.com SUPERADMIN
```

**8. Paystack:** in the dashboard, under Settings → API Keys & Webhooks (Test),
set the webhook URL to `https://ukcloudlogin.com/api/v1/payments/paystack/webhook`.

**9. Test end to end:** register a member, apply and upload a PDF, approve it as
admin, then pay with test card `4084 0840 8408 4081` (any future expiry, CVV
`408`). The membership should show **Active**.

**Updating:** `cd /opt/paca && git pull && dc up -d --build`. Migrations run
automatically before the API starts.

**Everyday commands:** `dc ps`, `dc logs -f api web`, `dc restart`, `dc down`
(keeps data), `docker stats --no-stream` (memory per container).

**Never on a shared droplet:**

- `docker system prune -a` and `docker volume prune` can delete other projects' data.
- `dc down -v` wipes PACA's database and uploads.
- Changing `ufw` rules can break other apps.

### Dedicated droplet (nothing else on 80/443)

Delete `HTTP_BIND`/`HTTPS_BIND` from `.env.production` and set `SITE_ADDRESS`
to the domain. PACA's Caddy then takes ports 80/443 and gets the HTTPS
certificate itself. Skip step 6.

**Data:** the database, uploaded documents and Caddy's state are stored in the
named Docker volumes `paca_postgres-data`, `paca_uploads` and `paca_caddy-data`,
so they survive rebuilds.

## Stopping / resetting infrastructure

```bash
docker compose down          # stop Postgres + Redis (keeps data)
docker compose down -v       # stop and wipe database/redis volumes
```
