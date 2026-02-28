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
# Breakout Join DSID vs GSID + Invite Member by QR Contract

Spec ID: `breakout-qr-join-dsid-gsid`
Status: **Authoritative (contract + implementation snapshot)**
Last reviewed against code: `0fc63b27cc968485bfa5f7e3578c91dfb97e60f4`

This spec defines the session/storage/server contract for two QR flows:

1. **Breakout QR** (`/#/s/:groupId/:sessionId`) — guest allowed.
2. **Invite Member by QR** (member panel invite) — guest **not** allowed.

---

## 1) Terminology

- **Durable session (DSID concept)**
  - `localStorage["fs.sessionId"]`
  - Optional profile/display metadata:
    - `localStorage["fs.sessionEmail"]`
    - `localStorage["fs.sessionName"]`

- **Grace session (GSID concept)**
  - `localStorage["fs.igniteGraceSessionId"]`
  - `localStorage["fs.igniteGraceGroupId"]`
  - `localStorage["fs.igniteGraceExpiresAtUtc"]`

- **Breakout/Invite `sessionId` token (scan token)**
  - The route token in `/#/s/:groupId/:sessionId`.
  - This token identifies an active ignite invite session.
  - **Do not store this route token in localStorage as durable auth.**

---

## 2) Invariants (explicit bug preventers)

These invariants are normative and prevent prior DSID/GSID regressions:

1. **Scanning Breakout QR with no durable session MUST NOT create/store `fs.sessionId`.**
2. **Grace MUST remain grace until explicit upgrade (magic link).**
3. **`/api/group/join` MUST NOT auto-upgrade igniteGrace into durable during normal navigation/auth gating.**
4. **Invite Member by QR MUST NOT allow guest/grace access; sign-in is required first.**
5. **Invite QR becomes invalid immediately when organizer closes dialog (server-enforced).**

### Current implementation snapshot vs invariant intent

- Current web breakout join code already keeps guest breakout joins on GSID (no `fs.sessionId` write on guest path).
- Current server `POST /api/group/join` **does** issue a durable session when request auth kind is `igniteGrace` (auto-upgrade). This diverges from invariant #3 and is the historical bug source this spec locks down.
- Current member-panel QR label is “Show QR (Anyone can join)” and uses ignite sessions. The intended Invite Member by QR contract in this spec is stricter (sign-in required) and should be treated as the required target behavior.

---

## 3) Breakout QR flow (Organizer “scan to join meeting”)

### Preconditions

- Route: `/#/s/:groupId/:sessionId`.
- If DSID present (`fs.sessionId`): join as durable/member path.
- If DSID absent: join as guest/grace path.

### Client/API sequence

1. Client hits `IgniteJoinPage` for `/#/s/:groupId/:sessionId`.
2. Client calls `POST /api/ignite/join` with:
   - `groupId`, `sessionId`, `traceId`, and when unauthed also `name`, `email` (optional `photoBase64`).
3. On success, client applies session storage semantics:
   - DSID-present path: keep DSID, clear stale GSID keys.
   - DSID-absent path: set GSID keys from response (`sessionId`, `graceExpiresAtUtc`, `breakoutGroupId`).
4. Client navigates to `/#/g/:breakoutGroupId/app`.
5. Group gate calls `POST /api/group/join` for access validation/membership state.

### Storage writes

- **DSID present before join:**
  - Must not overwrite `fs.sessionId` from breakout join response.
  - Clear GSID keys.

- **DSID absent before join:**
  - Set:
    - `fs.igniteGraceSessionId` = response `sessionId`
    - `fs.igniteGraceGroupId` = resolved target group
    - `fs.igniteGraceExpiresAtUtc` = response `graceExpiresAtUtc`
  - Must not set `fs.sessionId`.

### UX: “Guest access (limited)” banner

Banner is shown when:

- GSID exists for current group and
- DSID is absent.

### Error handling

- `IGNITE_CLOSED` from `/api/ignite/join`:
  - Show session closed/expired messaging.
- `AUTH_IGNITE_GRACE_EXPIRED` from guarded API calls:
  - Clear all GSID keys and require rejoin/re-auth.
- Invite closed after QR capture/photo reuse:
  - Join fails server-side; show expired/closed invite message.

---

## 4) Invite Member by QR flow (Member panel)

> This section is normative for the split contract: Invite Member by QR is membership-oriented and not a guest flow.

### Rules

- Guest/grace is **not allowed**.
- Scan result must never grant GSID access.
- This flow must not write any GSID keys.

### Flow

1. User scans Invite Member QR.
2. If user is not signed in (no DSID):
   - Show sign-in email dialog.
   - Send magic link.
   - Do not join yet.
3. After auth consume:
   - Re-attempt invite join **only if invite is still active**.
   - If organizer closed QR in the meantime: show “Invite expired — ask organizer to reopen QR”.
4. If user is already signed in when scanning:
   - Join immediately if invite is active.

### Non-goals in this flow

- No GSID issuance.
- No guest banner semantics.
- No auto-upgrade assumptions.

---

## 5) Server contract (authoritative)

## 5.1 `POST /api/ignite/start`

Creates an active invite session for a group.

- Auth: organizer must be authenticated and active member.
- Input: `groupId`, `traceId`.
- Side effects:
  - Creates/overwrites `state.ignite` with `sessionId`, `status: OPEN`, `createdAt`, creator metadata.
  - Initializes `joinedPersonIds` and photo metadata map.
- Invite/session cap:
  - `joinedPersonIds` is capped at 100 entries (implementation-enforced in join).
- Close semantics:
  - Invite is invalid once status is not OPEN or `sessionId` does not match (including explicit close).

## 5.2 `POST /api/ignite/join`

Input:
- Body: `groupId`, `sessionId`, `traceId`, and optional `name`, `email`, `photoBase64`.
- Header: optional `x-session-id` for authenticated callers.

Response variants:

- **Breakout join, unauthed**
  - `200 { ok: true, breakoutGroupId, sessionId, graceExpiresAtUtc, requiresVerification: true }`
  - `sessionId` in this variant is GSID token to store in `fs.igniteGraceSessionId`.

- **Breakout join, authed**
  - `200 { ok: true, breakoutGroupId }`
  - No GSID issuance needed.

- **Invite join, unauthed (required contract)**
  - Should return auth-required shape (e.g., `401/403` with `requiresAuth: true`) and **must not issue GSID**.

- **Invite join, authed**
  - `200 { ok: true, ... }` with membership behavior consistent with invite policy.

Common errors:
- `403 IGNITE_CLOSED` when closed/mismatched session token.

## 5.3 `POST /api/group/join`

Role:
- Validates/admits signed-in user into group and handles invited→active transition.

Contract for DSID vs GSID:
- DSID callers: membership check/update only.
- igniteGrace callers: permit scoped temporary access checks, **but must not auto-upgrade to durable session during normal gate navigation**.
- Must preserve invite/active membership counter integrity.

---

## 6) Storage + clearing rules

### Debug clear actions (exact key sets)

- **Clear DSID** removes:
  - `fs.sessionId`
  - `fs.sessionEmail`
  - `fs.sessionName`

- **Clear GSID** removes:
  - `fs.igniteGraceSessionId`
  - `fs.igniteGraceGroupId`
  - `fs.igniteGraceExpiresAtUtc`

- **Clear ALL** removes all DSID + GSID keys above.

### Sign-out

Sign-out must remove:

- DSID keys (`fs.sessionId`, `fs.sessionEmail`, `fs.sessionName`)
- GSID keys (`fs.igniteGraceSessionId`, `fs.igniteGraceGroupId`, `fs.igniteGraceExpiresAtUtc`)
- Pending invite/auth markers (`sessionStorage["fs.pendingAuth"]` and any temporary invite marker used by the client flow).

### Auth consume

After magic link consume:

- Set durable session (`fs.sessionId` + sanitized profile keys).
- Clear GSID keys.
- Resume pending return path/invite continuation logic.

---

## 7) Acceptance / test matrix (copy-paste checklist)

- [ ] Fresh device -> Breakout scan -> GSID keys set, durable absent, guest banner visible.
- [ ] Durable present -> Breakout scan -> durable kept, no GSID keys, no guest banner.
- [ ] Invite scan (not signed in) -> sign-in required; if QR closed before completion, join fails with invite-expired UX.
- [ ] Invite scan (signed in) -> join succeeds only while QR active.
- [ ] QR photo/reuse after organizer closes dialog -> server rejects with closed/expired invite error.

---

## 8) Source-of-truth implementation references

- Web join route and DSID/GSID write semantics:
  - `apps/web/src/App.tsx`
  - `apps/web/src/lib/igniteJoinSession.ts`
  - `apps/web/src/lib/apiUrl.ts`
- Invite modal/session controls:
  - `apps/web/src/AppShell.tsx`
- Server endpoints:
  - `api/src/functions/igniteStart.ts`
  - `api/src/functions/igniteJoin.ts`
  - `api/src/functions/groupJoin.ts`
