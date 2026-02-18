# Architecture Specification

## 1. System overview

FamilyScheduler follows a simple three-tier flow:

1. **Web client (prompt-only UI)**
2. **API service**
3. **Storage adapter**
   - Local file mode (default)
   - Azure Blob mode (SAS)

Logical path:

`Web Prompt -> POST /api/chat -> API classifies/parses -> (query response | mutation proposal) -> confirmation -> storage write`

## 2. Prompt-only interaction model

The client sends natural language to `POST /api/chat` and receives one of four response kinds:

- `reply` (query answer, no state change)
- `proposal` (pending mutation plan, requires confirm)
- `clarify` (missing/ambiguous data)
- `error` (safe failure)

There is no separate editing UI. All control occurs through prompt text.

## 3. Confirmation protocol

Mutation safety protocol is mandatory:

1. User asks for mutation.
2. API returns a proposal with `needsConfirmation=true` and confirmation instructions.
3. User sends `confirm` / `confirm <proposalId>`.
4. API executes write using ETag guard.

Cancellation path:

- User sends `cancel` or calls `/api/cancel` with proposal id.

Policy:

- No mutation may execute on first request.
- Proposal TTL: 10 minutes.
- One pending proposal per session; newest proposal replaces prior pending proposal.

## 4. Query vs mutation behavior

- **Queries**: respond immediately (no confirmation).
- **Mutations**: always produce proposal first.

Deterministic command classifier handles control commands directly (without OpenAI).

## 5. Concurrency model

State persistence uses optimistic concurrency with ETag.

- Read endpoints return current `etag`.
- Write endpoints require `If-Match` behavior (request carries etag).
- On mismatch (`409`), API returns state-changed message and latest summary snippet.
- Client/session must re-propose mutation against newest state.

## 6. Undo / backup / restore (high-level)

- Every applied mutation batch records inverse actions for undo.
- Undo is itself a mutation and requires confirmation.
- Backup creates timestamped state snapshot.
- Restore selects named backup and requires confirmation before application.

## 7. Identity binding for “me” references

Session supports identity binding from prompts like `I am <name>`.

- Session maps current user identity to `Person`.
- Subsequent prompts resolving `me` use that mapping.
- If identity is not set or ambiguous, API returns a clarify response.

## 8. Snapshot echo after confirmed mutation

After a confirmed mutation is applied, assistant response must include:

1. `Done.`
2. Affected codes list
3. Upcoming appointments section (next 5), one line each:

`CODE — YYYY-MM-DD hh:mm(am/pm) — Title — Assigned: ... — Status: ...`
