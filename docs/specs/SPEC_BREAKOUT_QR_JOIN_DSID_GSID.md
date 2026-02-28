# Breakout/Invite QR Join Session Contract (DSID vs GSID)

Spec ID: `breakout-qr-join-dsid-gsid`
Status: Authoritative implementation contract.

## 1. Overview

This spec defines the current join/session contract for:

- Breakout QR join (`/#/s/:groupId/:sessionId`) with guest/grace support.
- Invite Member by QR (member add flow) where guest access is not allowed (`requiresAuth`).
- DSID+GSID mismatch handling and claim flow.

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
  - Grace is scoped and non-upgrading by default.

- **Canonical member identity key (storage alignment)**
  - `auth:{oidOrSub}` for authenticated identities.
  - `guest:{gsid}` for guest/grace identities.

- **Scanned QR token**
  - Route shape: `/#/s/:groupId/:sessionId`
  - This URL token is request input only. It is **not** persisted as a durable storage key.

## 3. Invariants

1. Breakout scan with no DSID MUST NOT create/store `fs.sessionId`.
2. Grace sessions remain grace by default; upgrade requires explicit auth completion/claim flow.
3. Invite Member by QR MUST NOT allow guest/grace access; sign-in is required before join.
4. Invite QR is invalid immediately when organizer closes dialog/session (server-enforced via ignite session status).
5. At most one GSID group scope is active per device (overwrite rule via `fs.igniteGraceGroupId` + grace key replacement).

## 4. Flows

### 4.1 Breakout QR

- Entry route: `/#/s/:groupId/:sessionId`
- Client call: `POST /api/ignite/join`

**CURRENT**

- If request has valid auth session header (`x-session-id`):
  - Server treats request as authed and returns `{ ok: true, breakoutGroupId, traceId }` (no grace issuance).
  - Client DSID path clears any `fs.igniteGrace*` keys.
- If request has no valid auth session:
  - Server requires `name` + `email`, may trigger magic-link send, and issues igniteGrace session:
    - Response includes `sessionId` (GSID), `graceExpiresAtUtc`, `breakoutGroupId`, `requiresVerification: true`.
  - Client stores `fs.igniteGraceSessionId`, `fs.igniteGraceGroupId`, `fs.igniteGraceExpiresAtUtc`.
  - Client MUST NOT write `fs.sessionId` in this branch.

### 4.2 Invite Member by QR

**CURRENT**

- Invite-member QR is auth-required (`requiresAuth`) and does not admit guest/grace members.
- Scan while invite is active:
  - If not signed in: show email dialog, send magic link.
  - After auth: attempt join; succeeds only while invite remains active.
  - If organizer has already closed invite: show expired/closed.
- If already signed in: join immediately when invite active.
- This flow must not write `fs.igniteGrace*` keys.

### 4.3 DSID+GSID mismatch + Claim

Scenario: device has DSID, but DSID identity is not yet a member in target group; device also has GSID scoped to that group.

**CURRENT**

- `POST /api/group/claim` is implemented.
- Claim requires DSID + GSID proof for the same group scope.
- On success:
  - DSID identity is added/activated as group member.
  - `fs.igniteGraceSessionId`, `fs.igniteGraceGroupId`, `fs.igniteGraceExpiresAtUtc` are cleared.
  - User continues on DSID full access.

## 5. Server Contracts

### 5.1 `POST /api/ignite/start`

**CURRENT**

- Auth required and caller must be active group member.
- Request body: `{ groupId, traceId? }`.
- Creates/overwrites invite session state.
- Response: `{ ok: true, sessionId, status, traceId }`.

### 5.2 `POST /api/ignite/join`

**CURRENT**

- Required body fields: `groupId`, `sessionId` (+ `traceId` optional).
- Unauthed breakout requires `name` + `email`; authed request does not.
- Validates ignite session is OPEN and matches `sessionId`; otherwise returns `403` with `IGNITE_CLOSED`.
- Breakout authed response: `{ ok: true, breakoutGroupId, traceId }`.
- Breakout unauthed response: `{ ok: true, breakoutGroupId, sessionId: <GSID>, graceExpiresAtUtc, requiresVerification: true, traceId }`.
- Invite-member join path is auth-required and must not issue GSID.

### 5.3 `POST /api/group/join`

**CURRENT**

- Requires `x-session-id`.
- Request body: `{ groupId, traceId? }`.
- Membership checks and promotion use table membership records.
- Session semantics are preserved by kind (`full` / `provisional` / `igniteGrace`); grace remains scoped/non-upgrading by default.

### 5.4 `POST /api/group/claim`

**CURRENT**

- Requires both DSID and GSID proofs.
- GSID must be unexpired and scoped to requested group.
- DSID identity must authenticate and be claimable for that group scope.
- Success promotes DSID membership and ends grace continuity for that group.

## 6. Option 1 storage alignment

Ignite join/spinoff and membership admission flows must write/read canonical table truth:

- `Groups`
- `GroupMembers`
- `UserGroups`

Blob roster arrays are not source of truth for membership.

## 7. Storage & Clearing Rules

- Durable keys: `fs.sessionId`, `fs.sessionEmail`, `fs.sessionName`
- Grace keys: `fs.igniteGraceSessionId`, `fs.igniteGraceGroupId`, `fs.igniteGraceExpiresAtUtc`

Sign-out clears DSID + GSID keys.

## 8. Acceptance checklist

- New device breakout scan -> GSID keys set, DSID absent.
- Signed-in breakout scan -> DSID retained, GSID keys cleared/ignored.
- Invite-member scan while signed-out -> sign-in required first; no guest access.
- Invite-member scan while signed-in -> join only while invite active.
- DSID+GSID mismatch -> claim adds DSID membership and clears GSID keys.
