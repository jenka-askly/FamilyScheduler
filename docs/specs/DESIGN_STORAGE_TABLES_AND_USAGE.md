# Storage + Analytics + Usage Design (Tables + Blobs)

## Outcomes
- Logged-out homepage remains marketing.
- Logged-in homepage (DashboardHomePage) shows:
  - “Your groups”: all groups the current user is a member of (active + invited/pending supported).
  - Group activity: NYI/TBD (planned separately).
- Backend supports “list my groups” without scanning blobs.
- Track invited/pending membership (invitedAt, joinedAt, removedAt).
- Appointment canonical document remains JSON in Blob; Tables store only promoted/index fields for listing.
- High-level analytics (counts) and per-user OpenAI usage tracking are stored in Tables.
- Application Insights remains enabled for service health; add a simple health endpoint.
- Auto-provision Tables on cold start / first use (no manual table creation).
- No migration/backfill required (pre-ship; treat existing data as disposable).

## Identity
- API auth is session-based: `x-session-id` -> session blob -> `email`.
- Email normalization: `trim().toLowerCase()`.
- Derive `userKey = sha256(normalizedEmail)`.
- Canonical member identity key for cross-table references is `memberKey`:
  - `auth:{oidOrSub}` for authenticated identities.
  - `guest:{gsid}` for ignite guest/grace identities.
- Do not use raw email in keys; store email as an entity property where needed (e.g., GroupMembers).

## Source of Truth
- Membership and authorization truth: `GroupMembers` + `UserGroups` tables only.
- Roster/display truth: table-driven (`GroupMembers` joined to `UserProfiles`, or equivalent cached display fields on `GroupMembers`).
- `state.json` is not membership/roster truth. `people[]` / `members[]` in blob state may exist for compatibility but MUST NOT be used as authoritative membership.
- Groups metadata truth: `Groups` table.
- Appointment full detail truth: appointment JSON blob.
- Appointment listing/index truth: `AppointmentsIndex` table.
- Appointment detail existence check: `AppointmentsIndex` row (`isDeleted != true`) + `appointment.json` blob; `state.json.appointments` is not authoritative.
- Usage/cost tracking truth: Tables (`UserDailyUsage*`, `DailyUsageByModel`).
- Blob remains for media/binaries (profile photos, scan images, appointment JSON docs).

## Azure Tables (schemas)

Conventions:
- All timestamps are UTC ISO strings.
- Soft delete uses: `isDeleted`, `deletedAt`, `deletedByUserKey`, `purgeAfterAt` (set to deletedAt + 30 days; purge job NYI).
- Membership removal uses: `status=removed` + `removedAt` (soft delete semantics).

### 1) Groups
Table: `Groups`
- PK: `"group"`
- RK: `groupId`
Columns:
- groupId
- groupName
- createdAt
- updatedAt
- createdByUserKey
- isDeleted (bool; default false)
- deletedAt (ISO|null)
- deletedByUserKey (string|null)
- purgeAfterAt (ISO|null)

### 2) UserGroups (user -> groups)
Table: `UserGroups`
- PK: `userKey`
- RK: `groupId`
Columns:
- groupId
- status: `active | invited | removed`
- invitedAt (ISO|null)
- joinedAt (ISO|null)
- removedAt (ISO|null)
- updatedAt

### 3) GroupMembers (group -> members)
Table: `GroupMembers`
- PK: `groupId`
- RK: `userKey`
Columns:
- userKey
- email (normalized email)
- status: `active | invited | removed`
- invitedAt (ISO|null)
- joinedAt (ISO|null)
- removedAt (ISO|null)
- updatedAt

### 4) AppointmentsIndex (promoted fields)
Table: `AppointmentsIndex`
- PK: `groupId`
- RK: `YYYYMMDDHHmmssZ|appointmentId` (time-ordered key; current implementation uses `|` delimiter)
Columns:
- appointmentId
- startTime (ISO)
- status (e.g., active|canceled; plus soft delete fields below)
- hasScan (bool)
- scanCapturedAt (ISO|null)
- createdAt
- updatedAt
- isDeleted (bool; default false)
- deletedAt (ISO|null)
- deletedByUserKey (string|null)
- purgeAfterAt (ISO|null)

Canonical appointment JSON blob (source of truth for full appointment):
- `familyscheduler/groups/<groupId>/appointments/<appointmentId>/appointment.json`

Scan image blobs remain:
- `familyscheduler/groups/<groupId>/appointments/<appointmentId>/scan/scan.<ext>`

### 5) DailyMetrics (global counters)
Table: `DailyMetrics`
- PK: `YYYY-MM`
- RK: `YYYY-MM-DD`
Columns:
- newUsers
- newGroups
- newAppointments
- invitesSent
- invitesAccepted
- updatedAt

### 6) UserDailyUsage (per-user counters)
Table: `UserDailyUsage`
- PK: `userKey`
- RK: `YYYY-MM-DD`
Columns:
- openaiCalls
- openaiTokensIn
- openaiTokensOut
- openaiErrors
- updatedAt

### 7) UserDailyUsageByModel (per-user per-model)
Table: `UserDailyUsageByModel`
- PK: `userKey#YYYY-MM-DD`
- RK: `model`
Columns:
- calls
- tokensIn
- tokensOut
- errors
- updatedAt

### 8) DailyUsageByModel (global per-model)
Table: `DailyUsageByModel`
- PK: `YYYY-MM`
- RK: `YYYY-MM-DD#model`
Columns:
- calls
- tokensIn
- tokensOut
- errors
- updatedAt

### 9) AppointmentParticipants
Table: `AppointmentParticipants`
- PK: `g:{groupId}|a:{apptId}`
- RK: `m:{memberKey}`
Columns:
- status
- role
- assignedAt (ISO|null)
- assignedBy (memberKey|string|null)
- updatedAt

### 10) UserProfiles
Table: `UserProfiles`
- PK: `memberKey`
- RK: `profile`
Columns:
- displayName
- photoKey (blob path)
- email (optional)
- timezone (optional)
- createdAt
- updatedAt

## Auto-provisioning
- Add env var: `AZURE_TABLES_CONNECTION_STRING` (same storage account as blobs; tables do not use containers).
- On Function cold start / first use, create tables if not exist:
  - Groups, UserGroups, GroupMembers, AppointmentsIndex, DailyMetrics, UserDailyUsage, UserDailyUsageByModel, DailyUsageByModel
- Prefer an in-memory “already initialized” flag to avoid repeating work per request.

## API contracts (minimum)
- GET `/api/me/groups`
  - Auth: session required (x-session-id).
  - Returns all groups where membership is active or invited (as needed by UI).
  - Should filter out groups where `Groups.isDeleted=true`.
- GET `/api/health`
  - Cheap: no deep dependency checks; returns `{ ok: true, time: ..., version: ... }`.

## Endpoint conformance matrix (membership table-gating)

These endpoints MUST authorize via `GroupMembers`/`UserGroups` table membership (not blob roster arrays):

- `POST /api/chat`
- `POST /api/direct`
- `POST /api/ignite/start`
- `POST /api/ignite/close`
- `GET /api/ignite/photo`
- `POST /api/ignite/photo`
- `GET /api/ignite/meta`
- `POST /api/ignite/meta`
- `POST /api/ignite/join`
- `POST /api/ignite/spinoff`

Implementation note: current code still blob-gates a subset of these paths. Refactoring to strict table-gated membership is required.

## Invited tracking
- Invites are represented as membership rows with `status=invited` and `invitedAt`.
- Accept invite/join flips to `status=active` and sets `joinedAt`.
- “Invited but not accepted” is computed by `status=invited`.

## Query-per-operation budgets (guidelines)
- Dashboard load: 1 partition query (UserGroups) + bounded group meta reads (join via API).
- Group rename: 1 update (Groups only; avoid fan-out writes).
- Appointment write: 1 blob write (appointment.json) + 1 table upsert (AppointmentsIndex).
- OpenAI tracking: update UserDailyUsage (+ optional per-model tables) with bounded ops; no per-request ledger for now.

## Deletions
- Groups: soft delete (isDeleted + deletedAt + purgeAfterAt), never hard delete yet.
- Appointments: soft delete in AppointmentsIndex; appointment blob may remain until purge job exists.
- Membership: status=removed + removedAt.

---
