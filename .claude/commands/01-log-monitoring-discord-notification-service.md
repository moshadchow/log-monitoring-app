# OMS Log Monitoring & Discord Notification Service (Node.js + Express)

Develop a **Node.js backend service using Express.js** that authenticates with the OMS API, periodically retrieves error logs, and sends notifications to a Discord channel.

---

# Technology Stack

- Runtime: Node.js (LTS)
- Framework: Express.js
- HTTP Client: Axios
- Scheduler: node-cron
- Environment Variables: dotenv
- Logging: Winston (or Pino)
- Process Manager: PM2 (recommended for production)

---

# 1. Authentication

Authenticate using the OMS Login API.

**Endpoint**

```http
POST /api/login
```

### Request Body

```json
{
  "loginId": "string",
  "password": "string",
  "deviceId": "string",
  "mfaKey": "string",
  "mfaCode": "string",
  "appType": 1
}
```

The login API returns:

- JWT Access Token
- Refresh Token

---

# 2. Environment Configuration

Store all configurable values in the `.env` file.

Example:

```env
NODE_ENV=production

PORT=3000

OMS_BASE_URL=https://uat.xfltrade.com:20121

OMS_USERNAME=
OMS_PASSWORD=
OMS_DEVICE_ID=
OMS_MFA_KEY=
OMS_MFA_CODE=

DISCORD_WEBHOOK_URL=

CRON_SCHEDULE=*/5 * * * *

LOG_LEVEL=ERROR
```

**Requirements**

- Do not hardcode credentials.
- Do not hardcode API URLs.
- All runtime configuration must come from `.env`.

---

# 3. OMS Log Retrieval

After successful authentication, call the Logs API.

**Endpoint**

```http
POST /api/logs
```

### Request Header

```http
Authorization: Bearer <JWT Access Token>
```

### Sample Response

```json
{
  "lastUpdatedTimeUtc": "2026-06-25T09:37:29.419Z",
  "success": true,
  "total": 1,
  "data": [
    {
      "id": "6a3cf1e47d720b58b79a1889",
      "logType": 0,
      "timestamp": "2026-06-25T09:16:19.919Z",
      "dateTimeLocal": "2026-06-25T15:16:19.919",
      "level": "ERROR",
      "thread": "75",
      "logger": "EcoSoftBD.Oms.Worker.Workers.BrokerWorkers.OrderSubmissionWorker",
      "traceId": "48d343eb-d5a3-47b9-9ccc-8da3ee9d11c9",
      "server": "OMS-WORKER-UAT-2",
      "message": "[SNM-DSE] Failed to perform job during the last -0 second for [WorkerHelper. A task was canceled.",
      "after": "0 second",
      "exception": "System.Threading.Tasks.TaskCanceledException: A task was canceled..."
    }
  ]
}
```

---

# 4. Log Processing

For every scheduled execution:

1. Call the Logs API.
2. Filter logs where:
   - `level = ERROR`
3. Sort the logs by `timestamp` (latest first).
4. Select the latest error log.
5. Ignore duplicate notifications using the log `id`.
6. If no new error is found, do not send a Discord notification.

---

# 5. Discord Notification

Whenever a new error log is detected, send a notification to the configured Discord webhook.

## Notification Contents

The notification **must include**:

- Timestamp
- Level
- Server
- Message
- Exception

### Example

```
🚨 OMS Error Alert

Timestamp : 2026-06-25 15:16:19
Level     : ERROR
Server    : OMS-WORKER-UAT-2

Message
-------------------------------------------------
[SNM-DSE] Failed to perform job during the last -0 second for WorkerHelper.
A task was canceled.

Exception
-------------------------------------------------
System.Threading.Tasks.TaskCanceledException:
A task was canceled.
...
```

**Requirements**

- Use Discord Markdown formatting.
- Make the message easy to read.
- Escape special characters if required.

---

# 6. Scheduler

Use **node-cron** to execute the monitoring job automatically.

Requirements:

- Cron schedule must be configurable from `.env`.
- Prevent overlapping executions.
- Retry transient failures.
- Record the last successful execution timestamp.

---

# 7. JWT Token Management

Implement automatic JWT management.

Requirements:

- Authenticate when the application starts.
- Store Access Token and Refresh Token securely in memory.
- Refresh the Access Token before expiration.
- Automatically re-authenticate if the refresh token expires.
- Ensure scheduled jobs always use a valid Access Token.

---

# 8. Error Handling

Handle and log:

- Authentication failures
- Token expiration
- Network failures
- OMS API failures
- Request timeouts
- Invalid API responses
- Discord webhook failures
- Scheduler failures

The application must continue running even if a scheduled execution fails.

---

# 9. REST API Endpoints

Implement the following endpoints for monitoring:

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Returns application health status |
| GET | `/status` | Returns scheduler status, token status, last execution time, and last notification time |
| POST | `/run-now` | Manually trigger the monitoring job |
| GET | `/version` | Returns application version |

---

# 10. Project Structure

```text
src/
│
├── app.js
├── server.js
│
├── config/
│   ├── env.js
│   └── logger.js
│
├── routes/
│   ├── health.routes.js
│   └── status.routes.js
│
├── controllers/
│
├── services/
│   ├── auth.service.js
│   ├── token.service.js
│   ├── oms.service.js
│   ├── discord.service.js
│   └── monitor.service.js
│
├── jobs/
│   └── cron.job.js
│
├── middleware/
│
├── utils/
│
└── storage/
    └── state.json
```

---

# 11. Logging

Use **Winston** (or **Pino**) for logging.

Log the following events:

- Application startup
- Authentication
- Token refresh
- Scheduler execution
- OMS API requests
- Discord notifications
- Errors
- Performance metrics

Store logs in:

- Console
- Rotating log files

---

# 12. Production Requirements

The application should be production-ready.

Requirements:

- Express.js backend service
- PM2 compatible
- Environment-based configuration
- Graceful shutdown
- Request timeout handling
- Axios retry mechanism
- Modular architecture
- Separation of concerns
- Clean, maintainable code
- No hardcoded values

---

# Deliverables

The completed solution must include:

- Complete Express.js application
- `.env.example`
- `package.json`
- Source code
- Cron scheduler
- JWT authentication and token refresh
- OMS API client
- Discord notification service
- Winston logging
- REST monitoring endpoints
- Comprehensive `README.md` with:
  - Installation
  - Configuration
  - Running locally
  - PM2 deployment
  - Environment variables
  - Troubleshooting