# Auth Model (Current + Planned)

This repo currently implements a **group-scoped, phone-based** access model with **client-side session caching**.
A newer, more explicit model has been discussed and is documented here as **Planned** (not yet implemented).

This document is intended to be **authoritative** for how auth/authorization should work. If behavior changes, update this doc in the same PR.

---


## Implemented now (incremental magic-link backend)

The following backend pieces are now implemented in addition to the existing phone-based gates:

- `POST /api/auth/request-link`
  - accepts `{ email, traceId?, returnTo? }`
  - always returns `200 { ok: true, traceId }` to reduce account enumeration risk
  - when configured, sends a signed magic-link email
- `POST /api/auth/consume-link`
  - accepts `{ token, traceId? }`
  - verifies token and creates a durable blob-backed session
  - returns `{ ok: true, sessionId, email, traceId, expiresAt }`
- Durable sessions are stored in blob JSON and are intended to be supplied by clients via `x-session-id` header.

Important: existing endpoints still enforce the current phone-based membership gates. A full auth cutover is deferred to a later milestone.

---

## 1) Current (Implemented) — v1 Phone + Group Membership Gate

### 1.1 Summary
- **No accounts**. No login tokens or server sessions.
- Access is **group-scoped** and based on:
  - `groupId` (UUIDv4)
  - `phone` normalized to E.164-like format
  - membership check against `state.people[].cellE164` (active people)
- Frontend caches `{ groupId, phone, joinedAt }` under `familyscheduler.session` (primarily in `sessionStorage`, fallback from `localStorage`).

### 1.2 Client “session”
- Storage key: `familyscheduler.session`
- Shape: `{ groupId, phone, joinedAt }`
- This is **not** cryptographic auth; it is client-side convenience.
- The app continuously re-validates this cached phone via the API before allowing access.

### 1.3 Guarded routes / revalidation
Routes such as:
- `/#/g/:groupId/app`
- `/#/g/:groupId/ignite`

are gated by `GroupAuthGate`, which:
- denies if no cached session (`no_session`)
- denies if `groupId` mismatch (`group_mismatch`) and clears session
- otherwise POSTs `/api/group/join` with stored `phone` and proceeds only if allowed
- on failure clears session and redirects back to join with `err` + `trace` params

### 1.4 Backend membership rule
- Request validation:
  - `groupId` must match UUIDv4
  - `phone` must be present and normalizable
- Authorization:
  - allowed only if `findActivePersonByPhone(state, phoneE164)` succeeds
  - otherwise `403 not_allowed`

### 1.5 `/api/group/join` contract
- Input: `{ groupId, phone, traceId? }`
- Success: `{ ok: true, personId, groupName, traceId }`
- Failure:
  - `404 group_not_found` (when group state not found)
  - `403 not_allowed` (when phone not in active people list)
- Responses include `{ ok:false, error, message, traceId }` on errors.

### 1.6 Ignite / Breakout (Implemented) access behavior
Ignite endpoints are also membership-protected by groupId+phone:

- `POST /api/ignite/start`
  - requires active membership
  - prevents replacing another OPEN/CLOSING ignite by a different owner
- `POST /api/ignite/join`
  - requires joinable session
  - **may add** a new active person for that phone if missing (ignite-specific behavior)
- `GET|POST /api/ignite/meta`
  - requires active membership and matching `sessionId`
- `POST /api/ignite/close`
  - requires active membership
  - requires caller be the session creator (`createdByPersonId`)
- `GET|POST /api/ignite/photo` (+ `GET /api/ignite/photo`)
  - requires active membership and joinability
  - `ignitePhoto` contains a special-case fallback for phone from `x-ms-client-principal` when body phone is missing (endpoint-specific)

### 1.7 Traceability knobs (Implemented)
- Web: `VITE_DEBUG_AUTH_LOGS=true`
- API: `DEBUG_AUTH_LOGS=true`
- API populates `traceId` when missing (ensureTraceId), and includes `traceId` in error responses.

### 1.8 Web magic-link consume route (Implemented)
- Web now handles `/#/auth/consume?token=...` and posts token to `POST /api/auth/consume-link`.
- On success, client stores `sessionId` in `localStorage` key `fs.sessionId` and redirects to home.
- Web API helper now auto-attaches `x-session-id` when present; backend enforcement remains unchanged in this increment.

---

## 2) Planned (Not Implemented Yet) — Email-Based, Magic Link, QR Provisional Join

This section documents the proposed future model. **Do not assume this exists in code** until implemented.

### 2.1 Goals / invariants
- Preserve core product flows, especially Ignite “viral” joining and spinoff.
- Avoid passwords; use email “magic link” activation.
- Support two entry paths:
  1) Normal website entry (magic link, dashboard)
  2) Breakout join via QR/link (fast provisional access), then step-up activation

### 2.2 High-level concept
- Identity is **email** (normalized), not phone.
- Two session levels:
  - **Provisional session**: created immediately when joining via QR while organizer allows joining; lasts ~30 minutes
  - **Activated session**: created after clicking a magic link; enables dashboard and persistent access
- Organizer-controlled “QR open/close” gates whether new provisional joins can occur.

### 2.3 Breakout (Ignite) QR join policy (Planned)
- While QR/join window is OPEN:
  - anyone with the link can enter any email and receive **provisional access** to the group for 30 minutes
- When organizer CLOSES QR/join:
  - new “free joins” stop immediately (no new provisional joins)
  - subsequent access requires email already present in group membership list (e.g., as `INVITED/PROVISIONAL/ACTIVE`)
- After provisional TTL expires:
  - user must activate via magic link to continue (`activation_required`)
  - on activation, user becomes a verified/active member and lands in dashboard

### 2.4 Normal website entry + invite flow (Planned)
- Visit website → enter email → receive magic link → click → authenticated session → dashboard
- Create groups, add member emails, click “send invite”
- Invite recipient can ignore or accept:
  - ignore: no access
  - accept: activates via magic link and gains group access

### 2.5 Suggested membership states (Planned)
- `INVITED`: organizer added email, not yet accepted/verified
- `PROVISIONAL`: joined during QR-open window, time-limited until activation
- `ACTIVE`: email verified and accepted
- `REMOVED` (optional)

### 2.6 Tokens / links (Planned contracts)
- Magic link token:
  - signed, single-use, short-lived (e.g., 10–60 minutes)
- Provisional session token:
  - short-lived (e.g., 30 minutes), group-scoped (and optionally ignite session-scoped)
- Activated session token:
  - longer TTL (days/weeks; sliding optional)

### 2.7 Error / status code expectations (Planned)
- `401 activation_required` when provisional session expired and step-up is required
- `403 not_allowed` when membership is required but email is not a member (post-close)
- `410` for expired magic links or closed join window (as appropriate)
- Preserve Ignite session grace semantics (`410` for expired join grace) when applicable.

### 2.8 Abuse controls (Planned)
Because QR-open allows “any email”:
- rate limit join attempts per IP + group/session
- throttle write-heavy operations for provisional users (optional)
- audit log provisional actions (attribution by entered email)

---

## 3) Known documentation drift
- `docs/api.md` currently describes `/api/auth/login` and token auth flows that are **not implemented** in v1.
  Treat it as legacy unless/until updated to match current/planned behavior.

## 2026-02 staging cutover (develop only)
- Identity is email-only in staging.
- Session auth is required via `X-Session-Id` for all state mutation endpoints.
- Membership is validated by `state.members[].email` (active only).
- Phone-based auth/membership is deprecated for staging dogfood.
- `ignite/join` accepts `{ groupId, sessionId, name, email }` and can provision a new active member/person during joinable windows.
