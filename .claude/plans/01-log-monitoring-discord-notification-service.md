OMS Log Monitoring & Discord Notification Service — Implementation Plan

 Context

 E:\xfl-projects\log-monitoring-app currently contains only the spec file
 .claude\commands\01-log-monitoring-discord-notification-service.md — no
 package.json, no src/, no .env. This is a greenfield build. The spec
 fully defines the service: a Node.js/Express app that logs into the OMS API,
 polls an error-log endpoint on a cron schedule, and pushes Discord webhook
 alerts for new ERROR-level entries, with JWT token lifecycle management,
 REST monitoring endpoints, and PM2-ready production hygiene.

 Decisions confirmed with the user:
 - Logger: Winston (with winston-daily-rotate-file for rotation).
 - OMS /api/logs call: no documented request params — call with
 minimal/empty body, fetch returned logs, filter level === 'ERROR' and
 dedupe by id client-side, exactly as spec section 4 describes.
 - Dedupe/state persistence: flat JSON file at src/storage/state.json
 (single-instance PM2 service, no DB needed).

 Project structure to create

 Exactly as specified in the command file:

 log-monitoring-app/
 ├── src/
 │   ├── app.js
 │   ├── server.js
 │   ├── config/
 │   │   ├── env.js
 │   │   └── logger.js
 │   ├── routes/
 │   │   ├── health.routes.js
 │   │   └── status.routes.js
 │   ├── controllers/
 │   │   └── monitor.controller.js
 │   ├── services/
 │   │   ├── auth.service.js
 │   │   ├── token.service.js
 │   │   ├── oms.service.js
 │   │   ├── discord.service.js
 │   │   └── monitor.service.js
 │   ├── jobs/
 │   │   └── cron.job.js
 │   ├── middleware/
 │   │   ├── errorHandler.js
 │   │   └── requestLogger.js
 │   ├── utils/
 │   │   ├── httpClient.js   (axios instance + retry config)
 │   │   └── stateStore.js   (read/write storage/state.json)
 │   └── storage/
 │       └── state.json      (gitignored, seeded empty at runtime)
 ├── .env.example
 ├── .gitignore
 ├── package.json
 └── README.md

 Implementation steps

 1. package.json — Node LTS engines field, dependencies: express,
 axios, axios-retry, node-cron, dotenv, winston,
 winston-daily-rotate-file. Dev: nodemon. Scripts: start, dev,
 pm2:start.
 2. .env.example — all variables from spec section 2
 (NODE_ENV, PORT, OMS_BASE_URL, OMS_USERNAME, OMS_PASSWORD, OMS_DEVICE_ID, OMS_MFA_KEY, OMS_MFA_CODE, DISCORD_WEBHOOK_URL,
 CRON_SCHEDULE, LOG_LEVEL)
 with no real values.
 3. config/env.js — loads dotenv, validates required vars present at
 startup, exports a typed config object. Fail fast with a clear log error
 if a required var is missing.
 4. config/logger.js — Winston logger: console transport +
 winston-daily-rotate-file transport, level from LOG_LEVEL, JSON format
 for files, colorized human format for console.
 5. utils/httpClient.js — shared axios instance with timeout and
 axios-retry (exponential backoff, retry on network errors/5xx/429, not
 on 4xx auth errors).
 6. services/auth.service.js — login() calls POST /api/login with
 body from spec section 1, returns { accessToken, refreshToken, expiresIn }.
 Handles auth failure with a typed error.
 7. services/token.service.js — in-memory token store. Tracks expiry,
 exposes getValidAccessToken() that refreshes proactively before
 expiration, and falls back to full re-login if refresh fails. Single
 in-flight refresh guard so concurrent callers don't trigger duplicate
 refreshes.
 8. services/oms.service.js — fetchLogs() calls POST /api/logs with
 Authorization: Bearer <token> from token.service, minimal/empty body,
 returns data array. Surfaces invalid-response/timeout errors distinctly
 for logging.
 9. utils/stateStore.js — reads/writes storage/state.json containing
 { lastSeenLogId, lastExecutionAt, lastNotificationAt }. Creates the file
 with defaults if missing.
 10. services/discord.service.js — formats the Discord Markdown message
 per spec section 5 example (timestamp, level, server, message, exception,
 🚨 OMS Error Alert header), escapes Markdown special chars, posts via
 axios to DISCORD_WEBHOOK_URL. Logs and swallows webhook failures (must
 not crash the scheduler).
 11. services/monitor.service.js — orchestrates one monitoring cycle:
 fetch logs → filter level === 'ERROR' → sort by timestamp desc → take
 latest → compare id against stateStore.lastSeenLogId → if new, send
 Discord notification and update state; else no-op. Wrapped in
 try/catch so a failure in one cycle doesn't crash the process.
 12. jobs/cron.job.js — node-cron schedule from CRON_SCHEDULE env,
 calls monitor.service.runCycle(). Uses an isRunning guard flag to
 prevent overlapping executions; logs skipped overlapping runs.
 13. middleware/errorHandler.js + middleware/requestLogger.js —
 centralized Express error handler (logs + JSON error response) and
 request logging via Winston.
 14. routes/health.routes.js — GET /health → { status: 'ok' }.
 15. routes/status.routes.js + controllers/monitor.controller.js —
 GET /status (scheduler running state, token status/expiry, last
 execution time, last notification time from state store),
 POST /run-now (manually triggers monitor.service.runCycle(),
 respects the overlap guard), GET /version (reads package.json
 version).
 16. app.js — Express app: JSON body parsing, request timeout
 middleware, mounts health and status routers, error handler last.
 17. server.js — entry point: loads env/logger, calls
 authService.login() once at startup to seed tokens, starts the cron
 job, starts the HTTP server, and implements graceful shutdown
 (SIGINT/SIGTERM → stop accepting requests, let in-flight cycle
 finish, exit).
 18. .gitignore — node_modules, .env, src/storage/state.json,
 log files.
 19. README.md — installation, .env configuration reference,
 npm run dev for local, PM2 deployment (pm2 start with example
 ecosystem.config.js or CLI command), environment variable table,
 troubleshooting (auth failures, webhook failures, cron not firing).

 Verification

 - npm install succeeds with no errors.
 - cp .env.example .env, fill in placeholder/test OMS + Discord values.
 - npm run dev starts without throwing; GET /health returns 200.
 - GET /status returns scheduler/token/last-run info even before first cron
 tick.
 - POST /run-now triggers a cycle manually; check Winston console/file logs
 show login → fetch logs → (no-op or notification) sequence.
 - Temporarily point OMS_BASE_URL at a mock server (or stub responses) to
 confirm: new ERROR log → Discord webhook receives a correctly formatted
 message; repeat call with same latest id → no duplicate Discord message.
 - Kill the process with Ctrl+C and confirm graceful shutdown log lines