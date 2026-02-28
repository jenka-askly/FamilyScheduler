# Breakout/Invite QR Join Session Contract (DSID vs GSID)

Spec ID: `breakout-qr-join-dsid-gsid`
Status: Authoritative for join/session behavior. This document explicitly separates **CURRENT** behavior from **REQUIRED TARGET** and **PLANNED** behavior.

## 1. Overview

This spec defines the join/session contract for:

- Breakout QR join (`/#/s/:groupId/:sessionId`) with guest/grace support.
- Invite Member by QR (member add flow) where guest access is not allowed.
- DSID+GSID mismatch handling and claim flow.

It also defines server/client contracts, storage semantics, and invariants to prevent historical regressions (especially accidental DSID writes during guest breakout join and unintended grace auto-upgrade).

## 2. Terminology

- **Durable session (DSID concept)**
  - Storage key: `localStorage["fs.sessionId"]`
  - Durable authenticated session used for full app access.

- **Grace session (GSID concept)**
  - Storage keys:
    - `localStorage["fs.igniteGraceSessionId"]`
    - `localStorage["fs.igniteGraceGroupId"]`
    - `localStorage["fs.igniteGraceExpiresAtUtc"]`
  - Temporary scoped session used for guest/grace breakout access.

- **Scanned QR token**
  - Route shape: `/#/s/:groupId/:sessionId`
  - This URL token is request input only. It is **not** persisted as a storage key.

## 3. Invariants (Bug Preventers)

1. Breakout scan with no DSID MUST NOT create/store `fs.sessionId`.
2. Grace MUST remain grace until explicit upgrade (magic link completion and/or explicit claim flow).
3. `/api/group/join` MUST NOT auto-upgrade igniteGrace during passive navigation/auth gating. **REQUIRED TARGET** (CURRENT differs; see section 5.3).
4. Invite Member by QR MUST NOT allow guest/grace access; sign-in is required before join. **REQUIRED TARGET** (CURRENT differs; see section 5.2).
5. Invite QR is invalid immediately when organizer closes dialog/session (server-enforced via ignite session status).
6. At most one GSID group scope is active per device (overwrite rule via `fs.igniteGraceGroupId` + grace key replacement).

## 4. Flows

### 4.1 Breakout QR (Organizer “scan to join meeting”)

- Entry route: `/#/s/:groupId/:sessionId`
- Client call: `POST /api/ignite/join`

**CURRENT**

- If request has valid auth session header (`x-session-id`):
  - Server treats request as authed and returns `{ ok: true, breakoutGroupId, traceId }` (no grace session issuance).
  - Client DSID path clears any `fs.igniteGrace*` keys.
- If request has no valid auth session:
  - Server requires `name` + `email`, may trigger magic-link send, and issues igniteGrace session:
    - Response includes `sessionId` (GSID), `graceExpiresAtUtc`, `breakoutGroupId`, `requiresVerification: true`.
  - Client stores `fs.igniteGraceSessionId`, `fs.igniteGraceGroupId`, `fs.igniteGraceExpiresAtUtc`.
  - Client MUST NOT write `fs.sessionId` in this branch.
- In-app UX for grace shows `Guest access (limited)` messaging.

### 4.2 Invite Member by QR (Member panel)

**REQUIRED TARGET**

- Guest/grace join is not allowed.
- Scan while invite is active:
  - If not signed in: show email dialog, send magic link.
  - After auth: attempt join; succeeds only while invite remains active.
  - If organizer has already closed invite: show “Invite expired/closed”.
- If already signed in: join immediately when invite active.
- This flow must not write `fs.igniteGrace*` keys.

**CURRENT (important divergence)**

- Member panel “Show QR (Anyone can join)” currently uses:
  - `POST /api/ignite/start` to open invite session.
  - QR link `/#/s/:groupId/:sessionId` (same ignite join route as breakout).
- Therefore current behavior allows guest/grace join while session is OPEN.

### 4.3 DSID+GSID mismatch + Claim

Scenario: device has DSID, but DSID identity is not a member in the target group; device also has GSID scoped to that group.

**PLANNED**

- UX: show mismatch banner/modal with primary CTA: **“Join with my account”**.
- Server API: `POST /api/group/claim` requiring BOTH DSID + GSID.
- Success result:
  - Add DSID identity as active member in GSID group.
  - Clear `fs.igniteGraceSessionId`, `fs.igniteGraceGroupId`, `fs.igniteGraceExpiresAtUtc`.
  - Continue with full DSID UX.

## 5. Server Contracts (authoritative)

### 5.1 `POST /api/ignite/start`

**CURRENT**

- Auth required (`requireSessionEmail`) and caller must be active group member.
- Request body: `{ groupId, traceId? }`.
- Creates/overwrites `state.ignite` with:
  - `sessionId` (new random UUID)
  - `status: "OPEN"`
  - `graceSeconds` (default)
  - `joinedPersonIds`, `photoUpdatedAtByPersonId`
- Response: `{ ok: true, sessionId, status, traceId }`.

### 5.2 `POST /api/ignite/join`

**CURRENT**

- Required body fields: `groupId`, `sessionId` (+ `traceId` optional).
- Unauthed requires `name` + `email`; authed request does not.
- Validates ignite session is OPEN and matches `sessionId`; otherwise returns `403` with `IGNITE_CLOSED`.
- Authed path response: `{ ok: true, breakoutGroupId, traceId }`.
- Unauthed path response: `{ ok: true, breakoutGroupId, sessionId: <GSID>, graceExpiresAtUtc, requiresVerification: true, traceId }`.
- Can return `404 group_not_found`, validation `400` errors, and photo validation/storage errors when photo is supplied.

**REQUIRED TARGET note for Invite Member by QR**

- For member-invite QR semantics, endpoint/flow must require sign-in and reject guest/grace admission for that invite type.

### 5.3 `POST /api/group/join`

**CURRENT**

- Requires `x-session-id` (resolved via `requireSessionFromRequest`).
- Request body: `{ groupId, traceId? }`.
- For `session.kind === "igniteGrace"`, current implementation:
  - Allows/creates membership if missing.
  - Promotes invited -> active.
  - Issues durable session (`createSession`) and returns `sessionId` (auto-upgrade behavior).
- For non-grace sessions: verifies membership (`active` or `invited`) and promotes `invited` to `active`.

**REQUIRED TARGET**

- No automatic durable upgrade from igniteGrace during gate/navigation-driven `/api/group/join`.
- Grace should remain grace unless explicit upgrade step is requested by user flow.

### 5.4 `POST /api/group/claim`

**PLANNED**

- Requires both DSID and GSID proofs.
- Validation rules:
  - GSID must be unexpired and scoped to requested group.
  - DSID identity must authenticate successfully.
  - Claim is denied if scopes mismatch.
- Expected response on success:
  - DSID becomes active group member.
  - GSID is consumed/invalidated client-side (and server-side if token revocation list is introduced).

## 6. Storage & Clearing Rules

- Durable keys:
  - `fs.sessionId`, `fs.sessionEmail`, `fs.sessionName`
- Grace keys:
  - `fs.igniteGraceSessionId`, `fs.igniteGraceGroupId`, `fs.igniteGraceExpiresAtUtc`

**CURRENT clear behaviors**

- Debug menu supports clear DSID / clear GSID / clear ALL.
- App sign-out clears DSID keys + all GSID keys.
- On `/api/group/join` success that returns durable `sessionId`, client writes `fs.sessionId` and clears all GSID keys.

**REQUIRED TARGET**

- Auth consume/explicit upgrade should set DSID and clear GSID atomically when the user is being promoted out of grace.

## 7. Scenarios / Acceptance Checklist

- **S1**: New device (no DSID) scans breakout QR -> `fs.sessionId` remains empty; `fs.igniteGrace*` keys are set.
- **S2**: Signed-in device scans breakout QR -> DSID path; GSID keys cleared/ignored; no guest banner.
- **S3**: Grace user navigates app/gate checks -> MUST remain grace unless explicit upgrade action taken (**REQUIRED TARGET**).
- **S4**: Invite Member by QR scanned while signed-out -> sign-in required first; no guest access (**REQUIRED TARGET**).
- **S5**: Invite QR photographed/shared after organizer closes invite -> join fails with closed/expired outcome; no admission.
- **S6**: DSID+GSID mismatch in same group -> claim action adds DSID as member, clears GSID, and unlocks full app (**PLANNED**).

## 8. Logging Guidance (server)

Use structured logs with at least:

- `traceId`
- `groupId`
- `tokenKind` (`ignite`, `invite`, `claim`)
- `sessionKind` (`full`, `igniteGrace`, `none`)
- hashed identifiers (hashed email/session prefixes only)
- `result` (`ok`, `denied`, `closed`, `expired`, `mismatch`, `upgraded`)

Required event names:

- `JOIN_MODE` (DSID vs GSID decision)
- `NO_UPGRADE` (explicit no-auto-upgrade enforcement)
- `CLAIM_START`, `CLAIM_FAIL`, `CLAIM_OK`
- `INVITE_CLOSED` (close action + denied join attempts after close)
- `IGNITE_JOIN_GRACE_ISSUED` (GSID issuance)
- `GROUP_JOIN_RESULT` (including whether durable session was rotated)
