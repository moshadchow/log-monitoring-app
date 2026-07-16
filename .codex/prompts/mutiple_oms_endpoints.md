# Enhance OMS Log Monitoring Service to Support Multiple OMS API Endpoints

Based on the existing project architecture described in `AGENTS.md`, extend the OMS Log Monitoring Service to support polling logs from multiple OMS API endpoints while preserving the current implementation and project conventions. :contentReference[oaicite:0]{index=0}

## Objective

Add support for an additional OMS API endpoint so that the monitoring service retrieves logs from **both** OMS servers and sends qualifying error notifications to the configured Discord channel.

## OMS API Endpoints

### Primary Endpoint (Existing)

```text
https://prod-oms-api-1.xfltrade.com:20121
```

### Secondary Endpoint (New)

```text
https://prod-oms-api-11.xfltrade.com:20121
```

---

# Configuration

Update the configuration so that multiple OMS endpoints can be managed without duplicating code.

Example:

```env
OMS_API_ENDPOINTS=https://prod-oms-api-1.xfltrade.com:20121,https://prod-oms-api-11.xfltrade.com:20121
```

If the existing authentication credentials are shared between both endpoints, reuse the existing credentials.

If future endpoints require different credentials, design the implementation so that endpoint-specific credentials can be supported without major refactoring.

---

# Log Retrieval

For every scheduled execution:

1. Iterate through all configured OMS API endpoints.
2. Authenticate (or reuse an existing valid token) for each endpoint as required.
3. Fetch logs using the existing log retrieval process.
4. Process each endpoint independently.

A failure on one endpoint must **not** prevent processing of the remaining endpoints.

---

# Log Processing

For each endpoint:

- Apply the existing ignore-pattern filtering.
- Apply duplicate detection.
- Continue using the existing log parsing logic.
- Preserve the current alert generation process.

The implementation should reuse the existing monitoring service rather than introducing duplicate logic.

---

# Discord Notifications

Send Discord notifications for qualifying logs from **both** OMS endpoints.

Each notification should clearly indicate which OMS server generated the log.

Example:

```text
OMS Server: https://prod-oms-api-11.xfltrade.com:20121

Timestamp:
2026-07-16 10:15:32

Level:
ERROR

Server:
OMS-WORKER-PROD-11

Message:
...

Exception:
...
```

This allows recipients to identify the originating OMS environment immediately.

---

# State Management

Maintain duplicate detection independently for each OMS endpoint.

Ensure that:

- Previously processed logs from Endpoint A do not suppress notifications from Endpoint B.
- Each endpoint maintains its own processing state (e.g., last processed timestamp, message ID, or log key).

---

# Error Handling

If one OMS endpoint is unavailable:

- Log the failure.
- Continue processing the remaining endpoints.
- Continue sending Discord notifications for logs retrieved successfully from other endpoints.

The monitoring service should never terminate because one endpoint is unreachable.

---

# Logging

Log the following information:

- Endpoint being processed
- Authentication success/failure
- Number of logs retrieved
- Number of logs ignored
- Number of notifications sent
- Processing duration
- Errors and exceptions

---

# Code Organization

Follow the existing project architecture described in `AGENTS.md`.

- Keep endpoint configuration centralized.
- Reuse the existing authentication service.
- Reuse the existing OMS log service.
- Reuse the existing Discord notification service.
- Avoid duplicating business logic.
- Keep the implementation modular and scalable so additional OMS endpoints can be added easily in the future. :contentReference[oaicite:1]{index=1}

---

# Acceptance Criteria

- Logs are retrieved from both OMS API endpoints.
- Both endpoints are processed during every scheduled execution.
- Existing ignore rules and duplicate detection continue to function correctly.
- Discord notifications clearly identify the originating OMS endpoint.
- A failure on one endpoint does not affect processing of the other.
- The implementation follows the existing project structure and remains easily extensible for additional OMS servers.