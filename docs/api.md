# API Contract Specification

Base style: JSON over HTTPS.

## 1. Authentication model

- Session auth uses `x-session-id`.
- Group-scoped endpoints validate active membership for `groupId`.
- `/api/chat` and `/api/direct` requests are group-scoped (`groupId` required for most actions).
- Email/session auth is authoritative; request-body identity auth is not supported.

## 2. Core endpoints

## 2.1 `POST /api/group/create`

Creates a new group and seeds creator membership.

Request (typical):

```json
{
  "groupName": "Family HQ",
  "creatorName": "Alex",
  "creatorEmail": "alex@example.com"
}
```

Notes:
- If a valid session is present, server may derive creator identity from session.
- Returns `groupId` and `linkPath`.

## 2.2 `POST /api/group/join`

Validates/group-joins current identity into a group and returns session/group access metadata.

## 2.3 `POST /api/chat`

Natural-language entrypoint.

Request:

```json
{ "groupId": "<groupId>", "message": "appointments" }
```

Response:
- Returns structured payloads and includes a snapshot for UI refresh paths.
- Deterministic command routes are used for common commands.

## 2.4 `POST /api/direct`

Deterministic action endpoint used by structured UI.

Request shape:

```json
{
  "groupId": "<groupId>",
  "action": { "type": "get_appointment_detail", "appointmentId": "<appointmentId>" },
  "traceId": "<optional-client-trace>"
}
```

Error responses include `traceId` for diagnostics.

## 3. `/api/direct` action families (current)

### Schedule + people

- `create_blank_appointment`
- `delete_appointment`
- `restore_appointment`
- `set_appointment_date`
- `set_appointment_start_time`
- `set_appointment_duration`
- `set_appointment_location`
- `set_appointment_notes`
- `set_appointment_desc`
- `reschedule_appointment`
- `resolve_appointment_time`
- `create_blank_person`
- `update_person`
- `delete_person`
- `reactivate_person`

### Appointment Drawer

- `get_appointment_detail`
- `append_appointment_message`
- Proposal lifecycle:
  - `apply_appointment_proposal`
  - `pause_appointment_proposal`
  - `resume_appointment_proposal`
  - `edit_appointment_proposal`
  - `dismiss_appointment_proposal`
- Constraints:
  - `add_constraint`
  - `edit_constraint`
  - `remove_constraint`
- Suggestions:
  - `create_suggestion`
  - `dismiss_suggestion`
  - `react_suggestion`
  - `apply_suggestion`

### Appointment update email

- `preview_appointment_update_email`
- `send_appointment_update_email`

## 4. Time parsing / resolution

- `resolve_appointment_time` supports deterministic + AI-assisted parsing flows.
- For unresolved time-only input, server returns deterministic `timeChoices` (`today`, `tomorrow`, `appointment`) with timezone-anchored ranges.

## 5. Diagnostic expectations

- Client may send `traceId`; server returns/propagates `traceId` in errors.
- Auth/session logs and direct-action logs include correlation metadata to support root-cause debugging.

## 6. Compatibility note

Older docs that describe confirm/cancel-only mutation flows are historical. The current app uses hybrid operation:
- structured UI -> deterministic `/api/direct`
- chat NLP -> `/api/chat` with deterministic execution boundaries.
