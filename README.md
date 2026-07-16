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

Edit `.env` and fill in your OMS credentials and Discord webhook URL.

## Configuration

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | HTTP port for the Express server |
| `OMS_API_ENDPOINTS` | Comma-separated OMS API base URLs to poll |
| `OMS_BASE_URL` | Single OMS API base URL fallback when `OMS_API_ENDPOINTS` is not set |
| `OMS_USERNAME` | OMS login ID |
| `OMS_PASSWORD` | OMS password |
| `OMS_DEVICE_ID` | Device identifier required by OMS login |
| `OMS_MFA_KEY` | MFA key, if required by the OMS account |
| `OMS_MFA_CODE` | MFA code, if required by the OMS account |
| `OMS_APP_TYPE` | App type value expected by the OMS login API (default `1`) |
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL for alerts |
| `CRON_SCHEDULE` | Cron expression for polling frequency (default `*/5 * * * *`) |
| `LOG_LEVEL` | Winston log level (`error`, `warn`, `info`, `debug`) |
| `REQUEST_TIMEOUT_MS` | Timeout for outbound HTTP requests |
| `TOKEN_REFRESH_BUFFER_MS` | How early to refresh the access token before expiry |

No credentials or URLs are hardcoded — all configuration is read from `.env`.

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
  retry authentication. Check `OMS_USERNAME`/`OMS_PASSWORD`/`OMS_DEVICE_ID`
  and any MFA requirements.
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
