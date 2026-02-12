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

Start local Postgres with Docker Compose:

```bash
$ docker compose up -d
```

This boots Postgres on `localhost:5432`, applies `apps/server/sql/schema.sql` on
first run, and seeds a dev admin user:

- Email: `seeded.admin@satori.local`
- Password: `SatoriDev#2026`

### Server (auth + sync API)

1) Export env vars:

```bash
$ export DATABASE_URL="postgres://postgres:postgres@localhost:5432/satori_desktop"
$ export JWT_SECRET="change-me-to-a-long-random-string"
```

2) Start the server:

```bash
$ pnpm server:start
```

JWT expiry defaults to `259200` seconds (3 days). When expired, the desktop app locks and requires re-login (internet required).

### Development (desktop app)

Recommended full local flow:

```bash
$ pnpm install
$ cp env.example .env
$ docker compose up -d
$ pnpm dev
```

Default seeded login (local dev):

- Email: `seeded.admin@satori.local`
- Password: `SatoriDev#2026`

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

## Releases

GitHub releases are now automated with two workflows:

1. `Release Please` (`.github/workflows/release-please.yml`)
2. `Release Binaries` (`.github/workflows/release-binaries.yml`)

Release behavior:

1. Every push to `main` updates/creates a release PR from Conventional Commits.
2. Merging that PR updates `CHANGELOG.md`, bumps `apps/desktop/package.json`, creates a tag (`vX.Y.Z`), and publishes a GitHub Release with notes.
3. When the release is published, a matrix build (macOS/Windows/Linux) attaches installers/packages and per-platform SHA256 checksum files to the same GitHub Release.

Maintainer flow:

1. Merge normal feature/fix commits into `main`.
2. Merge the generated release PR.
3. Wait for `Release Binaries` to finish and verify assets in the GitHub Release page.

Optional production signing/notarization secrets (recommended before public distribution):

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `CSC_LINK`
- `CSC_KEY_PASSWORD`

Required GitHub settings for release PR creation:

1. Repository `Settings` -> `Actions` -> `General` -> `Workflow permissions`
2. Set `Read and write permissions`
3. Enable `Allow GitHub Actions to create and approve pull requests`

Optional (recommended) secret for Release Please:

- `RELEASE_PLEASE_TOKEN`: GitHub token with `contents: write` and `pull_requests: write`
- If this secret is present, the workflow uses it; otherwise it falls back to `GITHUB_TOKEN`.

## Troubleshooting

### LocalDbOpenError / NODE_MODULE_VERSION mismatch

If you see an error mentioning `NODE_MODULE_VERSION` (native module ABI mismatch), rebuild native deps for Electron:

```bash
$ pnpm rebuild:native
```

### Re-run DB initialization scripts

If you need Compose to re-apply schema + seed scripts from scratch:

```bash
$ docker compose down -v
$ docker compose up -d
```

### Port 5432 already in use

If `docker compose up` fails because `5432` is already allocated, stop the
other Postgres/container using that port (or change the published port in
`compose.yaml`).
