# Architecture Specification

## 1. System overview

Yapper currently runs as a web + API + storage system:

1. **Web client (structured UI + chat-assisted flows)**
2. **Azure Functions API**
3. **Storage + index layer**
   - Group snapshot blob (`state.json`) for broad app state (compatibility/non-auth state)
   - Appointment canonical docs (`appointment.json`) + appointment event chunks
   - Azure Tables indexes (`Groups`, `GroupMembers`, `UserGroups`, `AppointmentsIndex`, usage/metrics tables)

Primary runtime path:

`Web UI -> /api/* -> auth + membership gate -> deterministic action handlers -> blob/table writes`

## 2. Interaction model (current)

The app is no longer prompt-only.

- The web app provides structured panes for Schedule, Members, and Appointment Drawer workflows.
- `POST /api/direct` handles deterministic UI actions (create/update/delete/restore, appointment detail actions, constraints/suggestions/proposals, email update flows).
- `POST /api/chat` still exists for natural-language interactions and returns snapshot-backed responses.

## 3. Auth and authorization

- Durable client credential is `localStorage['fs.sessionId']`.
- Protected routes send `x-session-id`.
- API resolves session and enforces **active group membership** for group-scoped operations.
- Identity is email-based; telephony is not an auth primitive.

## 4. Storage model (current)

### Group-level state

- Group snapshot blob: `{STATE_BLOB_PREFIX}/{groupId}/state.json`
- Used for broad group state and compatibility paths only.
- Membership/authorization and roster truth are table-first (`GroupMembers`, `UserGroups`, plus profile joins) and not blob membership arrays.
- Canonical storage/source-of-truth rules are defined in `docs/specs/DESIGN_STORAGE_TABLES_AND_USAGE.md`.

### Appointment domain state

- Canonical appointment document: `{STATE_BLOB_PREFIX}/{groupId}/appointments/{appointmentId}/appointment.json`
- Event log chunks: `{STATE_BLOB_PREFIX}/{groupId}/appointments/{appointmentId}/events/{chunkId}.json`
- Scan image assets: `{STATE_BLOB_PREFIX}/{groupId}/appointments/{appointmentId}/scan/*`
- Appointment listing/index projection in `AppointmentsIndex` table.

### Membership/domain indexes

- `Groups`, `GroupMembers`, and `UserGroups` are source-of-truth for group/member listing and authorization checks.

## 5. Concurrency and idempotency

- Blob writes use optimistic concurrency (ETag/conditional writes).
- Appointment event stream is append-only with chunk rollover.
- Direct appointment mutation endpoints use `clientRequestId` for idempotency on critical action families.

## 6. Command routing boundary

- Deterministic handlers are authoritative for state mutation.
- Chat/classification may use AI assistance, but writes are executed through validated deterministic action paths.
- Time parsing for `resolve_appointment_time` may use AI-assisted parsing with deterministic fallback.

## 7. Current UX status notes

- Appointment Drawer supports discussion, changes, constraints, and suggestion/proposal workflows.
- Deep-link inbound open via `appointmentId` is supported.
- Some previously spec'd controls (for example legacy Share button placement) may be de-scoped or moved during cleanup; `PROJECT_STATUS.md` is the implementation ledger.
