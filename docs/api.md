# API Contract Specification

Base API style: JSON over HTTPS.

## 1. Authentication

- Current auth is email magic-link + server session.
- Protected endpoints are authenticated by the `x-session-id` request header.
- Request bodies for `/api/chat` and `/api/direct` should not include `phone` for auth.

## 2. State retrieval

### GET `/api/state`

Response:

```json
{
  "state": { "version": 1, "people": [], "appointments": [], "availability": [], "history": [] },
  "etag": "\"abc123\""
}
```

## 3. Chat endpoint

### POST `/api/chat`

Auth:

- Requires `x-session-id` header.
- Session email membership is validated server-side for the provided `groupId`.

Request:

```json
{ "groupId": "<groupId>", "message": "add PT for mom tomorrow at 3pm" }
```

Response (one-of union):

### A) Query/direct response

```json
{
  "kind": "reply",
  "assistantText": "...",
  "stateVersion": 3
}
```

### B) Mutation proposal response

```json
{
  "kind": "proposal",
  "proposalId": "prop_123",
  "assistantText": "Please confirm you want to ... Reply `confirm` to proceed or `cancel`.",
  "actions": [],
  "statePreviewSummary": "...",
  "etag": "\"abc123\"",
  "expiresAt": "<ISO-8601>",
  "needsConfirmation": true
}
```

### C) Clarification response

```json
{
  "kind": "clarify",
  "question": "Which appointment code did you mean?",
  "candidates": [{ "code": "APR-12-PT-1", "summary": "..." }]
}
```

### D) Error response

```json
{
  "kind": "error",
  "message": "Unable to process request"
}
```

## 4. Direct action endpoint

### POST `/api/direct`

Auth:

- Requires `x-session-id` header.
- Session email membership is validated server-side for the provided `groupId`.

Request (minimal example):

```json
{
  "groupId": "<groupId>",
  "action": { "type": "get_appointment_detail", "appointmentId": "<appointmentId>" }
}
```

Response:

- Returns direct-action specific JSON payloads depending on `action.type`.
- Error payloads include `traceId` for diagnostics.

## 5. Confirmation and cancellation

### POST `/api/confirm`

Request:

```json
{ "proposalId": "prop_123", "etag": "\"abc123\"" }
```

Response:

```json
{
  "kind": "applied",
  "assistantText": "Done. ...",
  "affectedCodes": ["APR-12-PT-1"],
  "etag": "\"def456\"",
  "snapshotText": "Upcoming appointments: ..."
}
```

Supports plain `confirm` and `confirm <proposalId>` semantics at chat layer.

### POST `/api/cancel`

Request:

```json
{ "proposalId": "prop_123" }
```

Response:

```json
{ "kind": "reply", "assistantText": "Canceled pending proposal." }
```

## 6. Undo / backup / restore

### POST `/api/undo`

Request:

```json
{ "etag": "\"def456\"" }
```

Behavior:

- Returns proposal response (undo is a mutation).
- Requires confirmation before applying.

### POST `/api/backup`

Behavior:

- `backup now` maps here.
- Returns proposal response; requires confirm.

### POST `/api/restore`

Behavior:

- `restore from backup <name>` maps here.
- Returns proposal response; requires confirm.

### GET `/api/backups` (optional)

Response:

```json
{
  "items": [
    { "name": "state-20250418-153045.json", "createdAt": "<ISO-8601>" }
  ]
}
```

## 7. ETag and conflict handling

Rules:

- All writes require `If-Match` semantics via etag in request.
- If ETag mismatch: return `409` conflict.
- Conflict payload must include:
  - message that state changed
  - latest snippet of relevant state
  - instruction to re-propose against latest state

## 8. Time parsing policy

Timezone default: `America/Los_Angeles`.

Mutation input constraints:

- Mutation intents must resolve to explicit date+time.
- Missing date/time requires `kind=clarify`.
- Relative expressions (e.g., “tomorrow”, “next Friday”) may be interpreted **only in proposal stage**.
- Confirmation text must include resolved absolute datetime with timezone context.

## 9. Query vs mutation classification

Deterministic (no OpenAI) classification for:

- `help`, `?`
- `confirm`, `cancel`
- `list`
- `show`
- `export`
- `undo`
- `backup`
- `restore`

Examples:

- `who is available in march` => query (immediate reply)
- `delete APR-12-PT-1` => mutation proposal (confirmation required)

## 10. OpenAI integration boundary

OpenAI is used only for free-form natural language command-to-action parsing.

- Structured Outputs JSON schema only (actions, no prose).
- Deterministic command paths bypass OpenAI.
- Invalid model output must be rejected and mapped to clarify/error.
- TimeSpec preview (`/api/direct` `resolve_appointment_time`) may use OpenAI Responses API (`text.format` JSON schema) for natural-language time resolution, and falls back to deterministic parsing when the AI call/response fails.

