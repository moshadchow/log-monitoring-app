# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js 18+ Express service for polling OMS logs and sending Discord alerts. Runtime entry points are `src/server.js` and `src/app.js`. Feature code is organized by responsibility: `src/config` for environment, logging, and ignore patterns; `src/controllers` and `src/routes` for HTTP endpoints; `src/jobs` for the cron scheduler; `src/services` for OMS, token, monitor, auth, and Discord integrations; and `src/utils` for shared helpers such as the HTTP client, state store, and log filtering. Runtime artifacts live in `logs/` and `src/storage/state.json`; both are ignored and should not be committed.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `cp .env.example .env`: create local configuration, then fill in OMS and Discord values.
- `npm run dev`: start `src/server.js` with nodemon for local development.
- `npm start`: run the service with plain Node.
- `npm run pm2:start`, `npm run pm2:restart`, `npm run pm2:logs`, `npm run pm2:stop`: operate the production PM2 process named `oms-log-monitor`.

There is no build step; code runs directly in Node.

## Coding Style & Naming Conventions

Use CommonJS modules (`require`, `module.exports`) and 2-space indentation. Prefer single quotes and semicolons, matching the existing source. Keep files named by role, for example `token.service.js`, `monitor.controller.js`, and `health.routes.js`. Use camelCase for variables and functions. Keep configuration access centralized in `src/config/env.js`, and use the shared logger instead of `console`.

## Testing Guidelines

No test framework or `npm test` script is currently configured. When adding tests, add the script to `package.json` and place tests near the code or under a clearly named test directory. Until automated tests exist, verify changes manually with `npm run dev`, `GET /health`, `GET /status`, and `POST /run-now` against a configured `.env`.

## Commit & Pull Request Guidelines

Recent commit history uses short, direct summaries such as `Stop tracking .env in git` and `Add ignore-list filtering for noisy Discord log alerts`. Keep commit messages concise and action-oriented. Pull requests should describe the behavioral change, list manual verification steps, call out configuration changes, and include relevant logs or screenshots for endpoint or Discord-notification changes.

## Security & Configuration Tips

Do not commit secrets, production URLs, `logs/`, or `src/storage/state.json`. Update `.env.example` when adding required variables. OMS API responses may be wrapped in `{ data: ... }`; follow the existing unwrapping pattern before reading payload fields.
