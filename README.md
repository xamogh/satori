# satori-desktop

Local-first Electron desktop app with a small Postgres-backed auth/sync service.

## Repo layout

- `apps/desktop`: Electron desktop app (main/preload/renderer)
- `apps/server`: Postgres-backed auth + sync API
- `packages/domain`: shared domain schemas/types (auth + domain + sync)
- `packages/api-contract`: shared HttpApi definition + HTTP error/auth contracts (client + server)
- `packages/ipc-contract`: shared IPC contract (desktop preload + main)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Environment

- Example env file: `env.example`
- Recommended: copy it and edit secrets (do not commit `.env`)

```bash
$ cp env.example .env
```

The runtime expects these vars in `process.env`.

For local development, `pnpm dev`, `pnpm dev:desktop`, and `pnpm server:*` will auto-load `.env` (via Node `--env-file-if-exists`).

If you run the server directly (or in production), export vars in your shell / process manager:

```bash
$ set -a
$ source .env
$ set +a
```

### Postgres (local)

If you already have Postgres running, skip this. For local dev:

```bash
$ docker run --name satori-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=satori_desktop \
  -p 5432:5432 \
  -d postgres:16
```

### Server (auth + sync API)

1) Export env vars:

```bash
$ export DATABASE_URL="postgres://postgres:postgres@localhost:5432/satori_desktop"
$ export JWT_SECRET="change-me-to-a-long-random-string"
```

2) Apply schema (idempotent):

```bash
$ pnpm server:migrate
```

3) Create a user:

```bash
$ pnpm server:create-user -- --email you@example.com --password "..." --role staff
```

4) Start the server:

```bash
$ pnpm server:start
```

JWT expiry defaults to `259200` seconds (3 days). When expired, the desktop app locks and requires re-login (internet required).

### Development (desktop app)

```bash
$ export SATORI_API_BASE_URL="http://localhost:4000"
$ pnpm dev
```

If you want to run only the Electron app (without the server):

```bash
$ pnpm dev:desktop
```

### Database schema

- Server schema: `apps/server/sql/schema.sql`

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

## Troubleshooting

### LocalDbOpenError / NODE_MODULE_VERSION mismatch

If you see an error mentioning `NODE_MODULE_VERSION` (native module ABI mismatch), rebuild native deps for Electron:

```bash
$ pnpm rebuild:native
```
