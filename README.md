# PACA — Professional Agile Certification, Africa

An npm-workspaces/Turborepo monorepo for the PACA platform: membership
management, exams, and certification.

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
- **Docker Desktop** — used to run Postgres and Redis locally
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

Put them in `apps/api/.env`. Everything else there (Paystack, S3, Resend,
Anthropic keys) is optional for local dev — those integrations simply won't
work until you supply real keys. Keep `.env` (root) in sync manually if you
want it to stay an accurate reference.

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

## Stopping / resetting infrastructure

```bash
docker compose down          # stop Postgres + Redis (keeps data)
docker compose down -v       # stop and wipe database/redis volumes
```
