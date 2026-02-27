# 1. Overview

## Purpose
The Appointment Pane Enhancement defines a unified, implementation-ready interaction model for viewing, discussing, reconciling, and notifying appointment decisions within a single pane experience.

## High-Level Goals
- Replace fragmented appointment interactions with one structured pane-based workflow.
- Make reconciliation state explicit, deterministic, and auditable.
- Separate conversational context from material change history.
- Provide notification traceability through immutable snapshots.
- Support shareable deep links for direct appointment access.

## Popover Replacement
- The existing Popover interaction model is fully replaced by a Drawer-based appointment pane.
- Drawer behavior adapts by form factor while preserving one information architecture.

## Release Scope
- This enhancement is delivered as a single cohesive release.
- UX, data model, event stream, API actions, and notification snapshot behavior are part of the same release boundary.

# 2. UX Architecture

## 2.1 Drawer Behavior

### Desktop
- Appointment opens in a right-side Drawer.
- Drawer preserves surrounding context while exposing full appointment workflow.

### Mobile
- Appointment opens in a fullscreen Drawer presentation.
- Mobile layout prioritizes primary metadata and tab navigation for constrained viewports.

### Deep Link Support
- Inbound deep links with `appointmentId` are supported.
- When present and authorized, the corresponding appointment Drawer auto-opens.

### URL Mutation Policy
- Normal open/close interactions do not mutate URL state.
- URL handling is inbound only for deep-link entry.

## 2.2 Header

### Expanded State
- Displays appointment title.
- Displays appointment time.
- Displays appointment location.
- Displays reconciliation status (`Reconciled` or `Unreconciled`).
- Displays suggestion badges.
- Displays Share button.
- Displays Notify section.
- Displays badge in the format `X changes since last notification`.

### Collapsed State
- Displays one-line appointment summary.
- Applies attention color treatment when status is `Unreconciled`.

## 2.3 Tabs
- `Discussion`
- `Changes`
- `Constraints`

# 3. Discussion Model

## 3.1 Message Loading
- Initial payload returns 20 messages.
- Older messages are loaded through cursor pagination.
- `Load earlier` retrieves the next historical page and prepends to the discussion list.

## 3.2 Event Types Visible in Discussion
- `USER_MESSAGE`
- `SYSTEM_CONFIRMATION`
- `PROPOSAL_CREATED`
- `RECONCILIATION_CHANGED`
- `NOTIFICATION_SENT`

## 3.3 Countdown Proposal System
- Exactly one active pending proposal is allowed at a time.
- Pending proposal has a 5-second auto-apply countdown.
- Available actions: `Apply`, `Pause`, `Cancel`, `Edit`.
- `Edit` path is deterministic and non-AI.

# 4. Suggestion System

- Maximum 3 active suggestions per member per field.
- Suggestions expire silently after 3 days.
- Expired suggestions remain visible in history.
- Conflicted suggestions remain visible and are marked with a conflict badge.
- Applying one suggestion does not remove other active suggestions.
- Dismissal rules:
  - Only the original proposer can dismiss a suggestion.
  - Other members may react with 👍 or 👎.
- Reactions are social-only signals.
- Reactions have no reconciliation impact.
- Suggestion tooltip lists members who reacted.

# 5. Changes Tab

The Changes tab displays only material event records.

Included event types:
- `FIELD_CHANGED`
- `CONSTRAINT_ADDED`
- `CONSTRAINT_REMOVED`
- `SUGGESTION_DISMISSED`
- `SUGGESTION_APPLIED`
- `RECONCILIATION_CHANGED`
- `NOTIFICATION_SENT`

Excluded content:
- Countdown lifecycle events.
- Raw chat message entries.

# 6. Constraints

- Constraints are appointment-scoped.
- Constraints are grouped by member.
- Manual add and edit are allowed.
- Ambiguous statements require explicit clarification before they can be treated as structured constraints.
- Structured constraints influence reconciliation deterministically.

# 7. Reconciliation Rules

- Reconciliation logic is deterministic only.
- Only explicit structured constraints participate in reconciliation evaluation.
- Social reactions do not affect reconciliation state.
- Reconciliation state flips emit a system message.

# 8. Finalize / Notify

## 8.1 Rules
- Notify is allowed when status is `Unreconciled`, with warning shown in review dialog.
- Notify is blocked when appointment time is not set.
- Notifications are sent only to active members.

## 8.2 Email Snapshot
Each notification email snapshot includes:
- Title
- Time
- Location
- Reconciliation status
- Conflict details
- Deep link
- ICS link

## 8.3 ICS
- ICS payload is generated from stored notification snapshot data.
- ICS retrieval requires authentication.

## 8.4 Notification Record
- UI displays only the latest notification send record.
- Record fields:
  - Sent by
  - Sent at
  - Recipient count
  - `View Email Content`
- Header badge displays `X changes since last notification`.

# 9. Backend Architecture

## 9.1 Storage Layout

Base path:
`{STATE_BLOB_PREFIX}/{groupId}/appointments/{appointmentId}/`

### Storage Components

| Component | Purpose |
| --- | --- |
| `appointment.json` | Canonical structured appointment state and latest notification summary |
| `events/` | Append-only chunked JSON arrays with unified typed events (200 events per file) |
| `notifications/` | Immutable notification snapshot JSON documents |

## 9.2 Event Envelope

Each event record uses the following envelope fields:
- `id`
- `tsUtc`
- `type`
- `actor`
- `payload`
- `sourceMessageId`
- `clientRequestId`
- `proposalId`

## 9.3 Event Types (Full List)

The unified appointment event stream includes the following event types:
- `USER_MESSAGE`
- `SYSTEM_CONFIRMATION`
- `PROPOSAL_CREATED`
- `PROPOSAL_PAUSED`
- `PROPOSAL_RESUMED`
- `PROPOSAL_CANCELLED`
- `PROPOSAL_EDITED`
- `PROPOSAL_APPLIED`
- `FIELD_CHANGED`
- `CONSTRAINT_ADDED`
- `CONSTRAINT_REMOVED`
- `SUGGESTION_CREATED`
- `SUGGESTION_APPLIED`
- `SUGGESTION_DISMISSED`
- `SUGGESTION_REACTED`
- `RECONCILIATION_CHANGED`
- `NOTIFICATION_SENT`

# 10. API Surface (via /api/direct)

| Action | Purpose |
| --- | --- |
| `get_appointment_detail` | Returns appointment pane data, including structured state, tab content inputs, and pagination cursors as applicable. |
| `append_appointment_message` | Appends a user message to appointment discussion and records it in the unified event stream. |
| `apply_appointment_proposal` | Applies the active proposal decision path to canonical appointment state through deterministic update logic. |
| `dismiss_suggestion` | Dismisses a suggestion when requested by the original proposer and records dismissal outcome. |
| `react_suggestion` | Adds or updates a social reaction (👍/👎) for a suggestion without affecting reconciliation. |
| `send_notification` | Finalizes notification send flow, persists immutable snapshot, and records notification event and summary metadata. |
| `get_notification_snapshot` | Retrieves stored notification snapshot content for review and rendering. |
| `get_notification_ics` | Retrieves authenticated ICS content generated from a stored notification snapshot. |

# 11. Concurrency Model

- `appointment.json` is the canonical snapshot source.
- Event log is append-only.
- Event chunk rollover occurs at 200 entries per chunk file.
- Idempotency is enforced via `clientRequestId`.

# 12. Deep Linking

- Supports inbound `appointmentId` query parameter.
- Drawer auto-opens when valid and authorized `appointmentId` is present.
- Invalid (`404`) or unauthorized (`403`) deep-link access redirects to safe appointment list context.
- Share button copies appointment deep link.

# 13. Non-Goals (Explicit)

- No event-sourced-only state model.
- No URL synchronization during routine Drawer open/close.
- No public ICS links.
- No reaction-based reconciliation.
- No automatic deletion of suggestions.
