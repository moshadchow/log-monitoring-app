# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # run the service (node src/server.js)
npm run dev        # run with nodemon (auto-restart on file change)
npm run pm2:start  # start under PM2 as "oms-log-monitor"
npm run pm2:logs   # tail PM2 logs
```

There are no test or lint scripts.

## Architecture

The service authenticates with an OMS (Order Management System) API, polls for error logs every 5 minutes, and sends Discord notifications for new errors.

### Startup sequence (`src/server.js`)

1. `tokenService.authenticate()` — logs in to OMS, stores JWT in memory. Failure is non-fatal; cron will retry.
2. `cronJob.start()` — schedules the monitoring cycle via `node-cron`.
3. `app.listen()` — starts Express on `PORT` (default 3000).

### Main data flow per cron tick

```
cron.job.js (overlap guard)
  → monitor.service.js: runCycle()
      → oms.service.js: fetchLogs()        — GET /api/logs with Bearer token + query params
          → token.service.js               — returns cached token, refreshes if expiring soon
      → filter level==='ERROR', sort newest-first
      → stateStore: compare latest.id vs lastSeenLogId (dedupe)
      → discord.service.js: sendErrorNotification()
      → stateStore: persist lastSeenLogId, timestamps, status
```

### OMS API envelope

Every OMS response wraps its payload in `{ data: { ... } }`. All response parsers must unwrap with:
```js
const envelope = response.data || {};
const data = envelope.data || envelope;  // handles both enveloped and flat shapes
```
This pattern is already applied in `auth.service.js` and `token.service.js`. Apply it to any new OMS API calls.

### Key services

| File | Responsibility |
|---|---|
| `src/services/auth.service.js` | `login()` — POST /api/login, returns `{ accessToken, refreshToken, expiresIn }` |
| `src/services/token.service.js` | In-memory token state; `getValidAccessToken()` refreshes automatically; deduplicates concurrent refresh calls via `refreshInFlight` promise |
| `src/services/oms.service.js` | `fetchLogs()` — GET /api/logs with 5-minute rolling window, `Filter.logType=WorkerLog`, local-time datetime params |
| `src/services/monitor.service.js` | Orchestration: fetch → dedupe → notify → persist |
| `src/services/discord.service.js` | Formats and POSTs to Discord webhook (uses plain `axios`, not the shared httpClient) |
| `src/utils/httpClient.js` | Axios instance with `baseURL=OMS_BASE_URL`, 3 retries with exponential backoff (retries 429, 5xx, network errors) |

### State persistence

`src/storage/state.json` — auto-created, gitignored. Fields: `lastSeenLogId` (dedupe key), `lastExecutionAt`, `lastExecutionStatus`, `lastNotificationAt`. To force a re-notification, set `lastSeenLogId` to `null`.

### Configuration

`src/config/env.js` loads `.env` and fails fast if any required var is missing: `OMS_BASE_URL`, `OMS_USERNAME`, `OMS_PASSWORD`, `OMS_DEVICE_ID`, `DISCORD_WEBHOOK_URL`.

The `Filter.fromDateTimeLocal` / `Filter.toDateTimeLocal` params use **local time** (via `getFullYear/Month/Date/Hours/Minutes`), not UTC — the OMS server expects local datetime strings.

### HTTP endpoints

- `GET /health` — liveness check
- `GET /status` — scheduler state, token state, last execution info
- `POST /run-now` — manually trigger a monitoring cycle (same overlap guard as cron)
- `GET /version` — package version

### Logging

Winston with three transports: colorized console, `logs/app-YYYY-MM-DD.log` (14-day retention), `logs/error-YYYY-MM-DD.log` (30-day retention, errors only). Level controlled by `LOG_LEVEL` env var.
