# Breakout QR Join DSID/GSID Behavior Specification

Spec ID: `breakout-qr-join-dsid-gsid`

## 1) Background

This document defines the intended authentication/session behavior for breakout and member-invite QR flows, with explicit DSID/GSID rules so future implementation and troubleshooting stay consistent.

Storage-key model:

- **DSID** (durable signed-in session):
  - `localStorage["fs.sessionId"]`
  - display metadata keys: `localStorage["fs.sessionEmail"]`, `localStorage["fs.sessionName"]`
- **GSID** (grace/guest scoped session):
  - `localStorage["fs.igniteGraceSessionId"]`
  - `localStorage["fs.igniteGraceGroupId"]`
  - `localStorage["fs.igniteGraceExpiresAtUtc"]`

Product scenario:

- An organizer, already signed in with DSID, starts a breakout and shares a QR.
- Scanners/joiners may be either:
  - already signed in on their device (DSID exists), or
  - new/unsigned devices (no DSID), which must still be able to join breakout via temporary GSID with limited capability.

## 2) Definitions

- **DSID**: durable authenticated session token used for normal app access.
- **GSID**: temporary scoped "grace" token used for limited access (group-scoped + expiring).
- **Breakout QR entrypoint #1**: the QR generated for quick join from organizer/burger breakout UX.
- **Member invite QR entrypoint #2**: QR from member panel intended for adding as full member (DSID).

## 3) Requirements

- **R1**: Breakout QR join (entrypoint #1) must support both:
  - If DSID exists on device: join as DSID (no grace labeling).
  - If DSID does NOT exist: join as GSID (show grace labeling + limit features).
- **R2**: Member invite QR (entrypoint #2) is DSID-only.
- **R3**: GSID must be scoped to the target `groupId`; `groupId` is part of the guest identity boundary.
- **R4**: Feature gating: GSID users must see "Guest access (limited)" and specific blocked actions.
- **R5**: Upgrade path: signing in (magic link) transitions user to DSID; GSID keys cleared; full features unlocked.

## 4) Decision table (normative)

Inputs:

- `hasDSID`
- `hasGSID(valid+scoped)`
- `route`: `breakoutJoin` vs `memberInviteJoin`

Outputs:

- token used for `x-session-id`
- keys written/cleared
- whether "Guest access (limited)" is shown
- whether to redirect to login/join

| Route | hasDSID | hasGSID (valid+scoped) | `x-session-id` used | Keys written/cleared | Guest banner | Redirect expectation |
|---|---:|---:|---|---|---|---|
| breakoutJoin | yes | no/yes | **DSID** | MUST NOT write GSID; SHOULD clear GSID keys if present | No | No forced redirect |
| breakoutJoin | no | no | GSID returned by breakout join response | MUST write GSID keys; MUST NOT write `fs.sessionId` | Yes | No forced redirect after successful join |
| breakoutJoin | no | yes | GSID | Keep/refresh GSID keys per response/expiry policy | Yes | No forced redirect |
| memberInviteJoin | yes | no/yes | **DSID** | MAY clear GSID keys to avoid mixed state | No | Continue member invite flow |
| memberInviteJoin | no | no/yes | none (no DSID available) | MUST NOT treat GSID as sufficient for member invite | N/A for invite gate; if in app with GSID, banner remains | MUST redirect to login/join path |

Normative precedence statement:

- **DSID ALWAYS takes precedence for API calls when present, except where flow explicitly forces GSID (only for breakout joiners with no DSID).**

## 5) Storage rules (normative)

- On breakout join success when DSID absent:
  - MUST set GSID keys (`sessionId`, `expiresAtUtc`, `groupId`)
  - MUST NOT set `fs.sessionId`
- On breakout join when DSID present:
  - MUST NOT set GSID keys
  - SHOULD clear any existing GSID keys to avoid mixed state
- On sign-in completion:
  - MUST set `fs.sessionId`
  - MUST clear GSID keys
- On sign-out:
  - MUST clear `fs.sessionId` + display keys
  - MUST clear GSID keys

## 6) API contract expectations (normative, client/server boundary)

Breakout join endpoint behavior:

- When DSID absent:
  - server returns session kind `igniteGrace` + `graceExpiresAtUtc` (or equivalent fields)
  - server enforces GSID scope (`groupId`) and expiry
- When DSID present:
  - server treats join as member session

Session status (optional future):

- Optional `GET /api/session/status` may return authoritative:
  - `kind` (e.g., `durable`, `igniteGrace`)
  - `scope` (e.g., `groupId`)
  - `expiry` (`expiresAtUtc`)
- If added, UI labeling should prefer this authoritative response over inferred local state.

## 7) UX requirements

GSID users:

- Banner location: under header in group app.
- Copy: `Guest access (limited)… Sign in`.
- Blocked features list (explicit intended restrictions):
  - Invite members
  - Manage group settings
  - Create breakout
  - Edit membership/roles
  - Other privileged admin/member-management actions

DSID users:

- No guest-access banner.

## 8) Debugging requirements (mobile)

Debug burger menu must expose:

- Show debug snapshot including:
  - current hash/route
  - `groupId`
  - DSID present/absent
  - GSID present/absent
  - GSID expiry
  - computed auth IDs used for requests
- Clear DSID
- Clear GSID
- Clear ALL

Security/diagnostic hygiene:

- Session IDs MUST be masked in UI/debug output.

## 9) Acceptance criteria

- **AC1**: New device (no DSID) scanning breakout QR results in GSID keys present and DSID absent.
- **AC2**: Existing signed-in device scanning breakout QR stays DSID and does not store GSID.
- **AC3**: GSID user sees banner + blocked features; DSID user does not.
- **AC4**: Completing magic link removes banner and upgrades to DSID.
- **AC5**: Sign-out clears all session keys.

## 10) Non-goals

- No change to server auth model beyond what is needed for the contract.
- No reliance on user-entered email strings for session binding.
