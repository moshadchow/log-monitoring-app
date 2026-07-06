# OMS Log Monitoring & Discord Notification Service

Node.js/Express backend that authenticates with the OMS API, polls for new
`ERROR`-level logs on a schedule, and sends formatted alerts to a Discord
channel via webhook.

## Features

- JWT-based OMS authentication with automatic token refresh and re-login fallback
- Scheduled log polling via `node-cron` (configurable schedule, overlap-safe)
- Deduplicated Discord notifications for the latest error log
- Winston logging to console and daily-rotated files
- REST endpoints for health, status, manual trigger, and version
- PM2-ready with graceful shutdown

## Installation

```bash
npm install
cp .env.example .env
```

Edit `.env` with your database connection settings and Discord webhook URL.
OMS credentials are no longer stored in `.env` — seed them into the
`broker_db.oms_endpoints` MySQL table using `sql/001_create_oms_endpoints.sql`.

## Configuration

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | HTTP port for the Express server |
| `DB_HOST` | MySQL host for `broker_db` |
| `DB_PORT` | MySQL port (default `3306`) |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database name (`broker_db`) |
| `DB_CONNECTION_LIMIT` | Max pooled MySQL connections (default `10`) |
| `OMS_CONFIG_CACHE_TTL_MS` | How long the OMS endpoint config is cached in memory before re-querying the database (default `300000`) |
| `APP_ENCRYPTION_KEY` | Fernet key used to decrypt `oms_endpoints.encrypted_password` |
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL for alerts |
| `CRON_SCHEDULE` | Cron expression for polling frequency (default `*/5 * * * *`) |
| `LOG_LEVEL` | Winston log level (`error`, `warn`, `info`, `debug`) |
| `REQUEST_TIMEOUT_MS` | Timeout for outbound HTTP requests |
| `TOKEN_REFRESH_BUFFER_MS` | How early to refresh the access token before expiry |

No credentials are hardcoded. Infra settings are read from `.env`; OMS
endpoint credentials (base URL, username, encrypted password, device ID, MFA key/code,
app type) are read from the `broker_db.oms_endpoints` MySQL table, cached in
memory, and refreshed every `OMS_CONFIG_CACHE_TTL_MS`. Logs and API responses
must not expose OMS credentials or tokens.

## OMS Endpoint Configuration

OMS credentials live in the `broker_db.oms_endpoints` table instead of
`.env`. Run `sql/001_create_oms_endpoints.sql` once to create the table and
then insert an active row with the OMS credentials. Columns:

| Column | Description |
|---|---|
| `base_url` | Base URL of the OMS API |
| `username` | OMS login ID |
| `encrypted_password` | Fernet-encrypted OMS password |
| `device_id` | Device identifier required by OMS login |
| `mfa_key` / `mfa_code` | MFA key/code, if required by the OMS account |
| `app_type` | App type value expected by the OMS login API |
| `is_active` | Only rows with `is_active = 1` are eligible to be loaded |
| `description` | Optional free-text note |

To rotate credentials or switch endpoints, `UPDATE` the active row (or
insert a new row and flip `is_active`) directly in MySQL — no restart
required. The service picks up changes within `OMS_CONFIG_CACHE_TTL_MS`.
If multiple rows are active, the most recently updated one wins.

For an existing `oms_endpoints` table, run
`sql/002_migrate_oms_endpoints_encrypted_password.sql` to add any missing
metadata columns (`is_active`, MFA fields, description, index) while keeping
`encrypted_password` as the credential source.

## Running locally

```bash
npm run dev   # nodemon, auto-restart on file changes
npm start     # plain node
```

On startup the service authenticates with OMS, starts the cron scheduler,
and starts the HTTP server.

## REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/status` | Scheduler status, token status, last execution/notification time |
| POST | `/run-now` | Manually trigger a monitoring cycle |
| GET | `/version` | Application version |

## PM2 Deployment

```bash
npm install -g pm2
npm run pm2:start      # pm2 start src/server.js --name oms-log-monitor
pm2 save
pm2 startup            # configure PM2 to start on boot
```

Useful PM2 commands:

```bash
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

## Logs

- Console: human-readable, colorized
- Files: `logs/app-YYYY-MM-DD.log` (all levels), `logs/error-YYYY-MM-DD.log`
  (errors only), rotated daily and retained for 14/30 days respectively

## State

Dedupe and execution metadata are persisted to `src/storage/state.json`
(`lastSeenLogId`, `lastExecutionAt`, `lastExecutionStatus`,
`lastNotificationAt`). This file is gitignored and recreated automatically
if missing.

## Troubleshooting

- **Authentication failures at startup**: the service logs the error and
  still starts the HTTP server and scheduler; subsequent cron ticks will
  retry authentication. Check the active row in `broker_db.oms_endpoints`
  (`is_active = 1`) for correct `username`/`encrypted_password`/`device_id`
  and any MFA requirements, and confirm the database is reachable
  (`DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`) and `APP_ENCRYPTION_KEY`
  matches the key used to encrypt the password.
- **No Discord notifications**: confirm `DISCORD_WEBHOOK_URL` is correct and
  the webhook is active. Webhook failures are logged but do not crash the
  scheduler — check `logs/error-*.log`.
- **Cron not firing**: verify `CRON_SCHEDULE` is a valid cron expression; an
  invalid expression throws at startup. Check `/status` for the scheduler's
  configured schedule and running state.
- **Duplicate alerts**: notifications are deduped by the log `id` stored in
  `src/storage/state.json`. If you need to force a re-notification, stop the
  service and clear `lastSeenLogId` in that file.
- **Overlapping executions**: the cron job is guarded by an in-memory flag —
  a tick that starts while a previous cycle is still running is skipped and
  logged as a warning.
