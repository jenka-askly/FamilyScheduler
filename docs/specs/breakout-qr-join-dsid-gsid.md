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
