# Auth Model (Email-Only)

This repository uses an **email-based, session-backed** authentication model.

- The web client stores a durable session token in `localStorage` as **`fs.sessionId`**.
- The client authenticates API requests via the **`x-session-id`** header.
- The API validates sessions against blob-stored session records and authorizes access by **group membership for the session email**.

Legacy SMS/cell identity is not supported. Any remaining telephony references are legacy and must be removed.

---

## Architecture

### Identity
- **Email is the only identity key**.
- Emails are normalized (trim + lowercase) for matching.
- Group authorization is based on active membership of the session email.

### Client session storage
- Durable credential: `localStorage['fs.sessionId']`
- UI cache only (not authoritative): `fs.sessionEmail`, `fs.sessionName`

### API authentication
- Client sends: `x-session-id: <fs.sessionId>`
- Server resolves session via `requireSessionFromRequest()` / `getSessionWithStatus()`.

### Session records
Sessions are stored as JSON blobs at:

- `${SESSION_BLOB_PREFIX || 'familyscheduler/sessions'}/${sessionId}.json`

Each session includes:
- `kind`: `full` | `provisional` | `igniteGrace`
- `email`
- `expiresAt`
- optional scope constraints (notably for `igniteGrace`)

---

## Invariants

These must remain true across client and server:

1. `fs.sessionId` represents the user's durable auth state.
2. A `full` session must **never** be replaced/overwritten by an `igniteGrace` session.
3. Organizer flows (QR/ignite organizer, spinoff, start/close/photo) must require a valid `full` session.
4. igniteGrace exists **only** to support unauthenticated joiners (who may not have an account/session yet).
5. `/api/ignite/spinoff` must not rotate or replace `fs.sessionId`.
6. No telephony-based auth or validation exists.

---

## Login (Email magic link)

### `POST /api/auth/request-link`
- Input: `{ email, returnTo? }`
- Response: `{ ok: true }` (always `ok: true` to reduce account enumeration)

### `POST /api/auth/consume-link`
- Verifies token and creates a durable `full` session.
- Response includes `{ ok: true, sessionId, email, expiresAt }`
- Client stores `sessionId` into `localStorage['fs.sessionId']`.

---

## Group authorization

### Membership rule
- A request for a group is allowed only if the session email corresponds to an **active** group member.

### `POST /api/group/join`
Purpose: confirm that the current identity is allowed to access `groupId`.

- Success: `{ ok: true, personId, groupName, ... }`
- Failures include:
  - `group_not_found` (404)
  - `not_allowed` (403)
  - `join_failed` (500)

---

## Ignite / Breakout

### Organizer (QR owner)
Organizer actions require:
- valid `full` session (`x-session-id` present and valid)
- active membership in the group

Organizer endpoints include (non-exhaustive):
- `POST /api/ignite/start`
- `POST /api/ignite/close`
- `POST /api/ignite/photo`
- `POST /api/ignite/spinoff`
- `GET|POST /api/ignite/meta` (polling/metadata)

**Organizer does not use igniteGrace.** If organizer is logged in, QR/polling must authenticate via the durable `fs.sessionId`.

### Joiner (may be unauthenticated)
`POST /api/ignite/join` supports two paths:

1) **Authenticated join**
- Caller has `x-session-id`
- Server uses session email
- No new session is issued

2) **Unauthenticated join**
- Caller supplies `{ name, email }`
- Server may issue a short-lived `igniteGrace` session
- Response may include `sessionId` for the client to use **only when no durable session exists**

**Critical:** igniteGrace must not overwrite an existing `full` session token.

### Spinoff
`POST /api/ignite/spinoff`:
- requires authenticated organizer membership in the source group
- creates a new group and seeds organizer membership
- returns `{ ok: true, newGroupId, linkPath }`
- must not return or rotate a global session token

---

## Session error codes

Common session errors:
- `AUTH_PROVISIONAL_EXPIRED` — provisional session expired (client clears `fs.sessionId` and routes to login)
- `AUTH_IGNITE_GRACE_EXPIRED` — ignite grace session expired
- `AUTH_SESSION_SCOPE_VIOLATION` — session not permitted for requested group/session scope

---

## Debugging

Web:
- `VITE_DEBUG_AUTH_LOGS=true`

API:
- `DEBUG_AUTH_LOGS=true`

Error responses include `traceId` for correlation.

---

## Removal rule (legacy cleanup)

Legacy telephony markers should not exist in docs and contracts. If present, remove or migrate to email/session-based handling.
