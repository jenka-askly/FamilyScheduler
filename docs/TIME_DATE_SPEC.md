# Time & Date Specification

- Spec Version: 1.1
- Last Updated: 2026-02-21
- Scope: FamilyScheduler time parsing / storage / conflicts

## 1) Overview

FamilyScheduler uses a single **TimeSpec** paradigm for both appointments and person rules so ingestion, confirmation, storage, and conflict checks all operate on the same shape.

Key terms:

- **intent**: User- or AI-provided natural-language time expression retained for editability and traceability.
- **resolved**: Time text has been deterministically converted into a valid concrete interval.
- **unresolved**: Time text cannot yet be safely converted into a concrete interval.
- **resolved interval**: Canonical machine interval (`startUtc`, `endUtc`, `timezone`) used for ordering and conflict math.

## 2) Data Model

Pseudo-TypeScript model (documentation only):

```ts
type TimeSpecStatus = "resolved" | "partial" | "unresolved";

interface TimeIntent {
  originalText: string;
  status: TimeSpecStatus;
  missing?: string[];
  assumptions?: string[];
  evidenceSnippets?: string[];
}

interface ResolvedInterval {
  startUtc: string; // ISO-8601 UTC
  endUtc: string;   // ISO-8601 UTC
  timezone: string; // IANA zone id
}

interface TimeSpec {
  intent: TimeIntent;
  resolved?: ResolvedInterval;
}
```

Notes:

- UI display label collapses `partial` and `unresolved` into a single user-facing **Unresolved** badge/state.

Invariants:

- A TimeSpec is `resolved` **iff** a valid `resolved` interval is present.
- `endUtc > startUtc` is mandatory.
- `timezone` is required whenever `resolved` exists.
- Time arithmetic (sorting by instant, overlap checks, slicing, availability math) is allowed only when resolved.

## 3) Appointments Behavior

- Appointments may be saved unresolved.
- Unresolved appointments sort to the top; within unresolved, newest `updatedAt` first.
- UI semantics for unresolved appointments:
  - Badge: **Unresolved**
  - Availability label: **Unreconcilable**
  - Clicking unresolved indicators opens edit.
- Clicking a resolved time value opens edit.
- Edit form is prefilled from the last stored `intent.originalText` (may be AI-trimmed).
- Confirm never blocks for appointments due solely to unresolved time.
- Conflict evaluation runs only after confirm.
- Cross-day appointments are supported.

## 4) Rules Behavior (People tab)

- Rules must be resolved to save/confirm.
- Confirm blocks unresolved rules with a clear error.
- Unresolved rules are not persisted.
- Rules participate in availability computation only when resolved.

## 5) Time Interpretation Rules (Deterministic)

### Date-only

- Date-only input resolves to local all-day interval: `00:00` at date start through `00:00` next day.

### Fuzzy windows (local, start-inclusive/end-exclusive)

- early morning: `05:00-08:00`
- morning: `08:00-12:00`
- afternoon: `12:00-17:00`
- evening: `17:00-21:00`
- night: `21:00-24:00`

### Relative-date hard-codes (local)

- Week starts Monday at `00:00`.
- this week / next week: Monday `00:00` -> following Monday `00:00`.
- this weekend: Saturday `00:00` -> Monday `00:00`.
- next month: first day `00:00` -> first day of following month `00:00`.

### No silent default duration

- Timed phrases without explicit end/duration remain unresolved; the system no longer assumes 60 minutes.

### Unsupported/open-ended phrases

Remain unresolved in v1 (examples):

- `soon`
- `later`
- `after 5`
- `around 3`
- `late morning`

## 6) Conflict Evaluation (v1)

- User-visible states:
  - **No Conflict**
  - **Conflict**
  - **Unreconcilable**
- Any overlap with an unavailable rule is a Conflict, including 1-minute overlap.
- Cross-day appointments are sliced by local day boundaries and each slice is evaluated against day-partitioned rules.
- Compute conflicts only after confirm.
- Internal detail (segments, overlap minutes) may be stored for future use, while UI remains 3-state in v1.

## 7) Versioning & Migration (per-entry)

- `schemaVersion` is per entry (appointment or rule), not global.
- Legacy entries with missing `schemaVersion` are supported through deterministic in-memory derivation.
- On edit + confirm, upgraded entries are written as v2-only (`schemaVersion: 2`) and legacy fields are dropped for that entry.
- If deterministic resolution of a legacy entry is not possible:
  - Appointment renders as **Unresolved** with availability **Unreconcilable**.
  - Rule cannot be newly saved unresolved (confirm blocks).

## 8) Timezone (v1)

- Timezone is implied from the current system/user timezone at create/edit time and stored per entry.
- Explicit timezone tokens in free text are not parsed in v1 (deferred).

## 9) Acceptance Criteria

### A) Resolution semantics

- TimeSpec has deterministic statuses: `resolved | partial | unresolved`.
- UI collapses `partial` + `unresolved` to one visible **Unresolved** label.
- Time math executes only for resolved entries.

### B) Save/confirm behavior

- Appointments can be confirmed while unresolved.
- Rules cannot be confirmed unresolved and must block with clear feedback.

### C) UI ordering and editability

- Unresolved appointments appear first, newest-updated first.
- Clicking unresolved indicators or resolved time cells opens editor with last stored intent text.

### D) Conflicts

- Post-confirm conflict state is exactly one of No Conflict / Conflict / Unreconcilable.
- Any overlap with unavailable rule produces Conflict.
- Cross-day conflict checks use local day slicing.

### E) Versioning

- Legacy rows are read via deterministic derivation.
- Edited-and-confirmed rows are persisted as v2-only for that entry.

### F) Timezone

- Per-entry timezone is stored from current system/user context.
- Explicit textual timezone parsing is out of scope for v1.

## 10) Canonical Examples

Assumptions:

- Timezone: `America/Los_Angeles`
- Reference date: Saturday, 2026-02-21

1. **March 7**
   - Input: `March 7`
   - Result: resolved all-day interval `2026-03-07T00:00` -> `2026-03-08T00:00` (local), stored as UTC bounds.

2. **Friday morning**
   - Input: `Friday morning`
   - Result: resolved `08:00-12:00` on Friday in local timezone.

3. **Doctor soon**
   - Input: `Doctor soon`
   - Result: unresolved (`missing` includes concrete date/time).

4. **Cross-day explicit range**
   - Input: `Mar 7 10pm-2am`
   - Result: resolved appointment from `2026-03-07 22:00` to `2026-03-08 02:00` local.

5. **Invalid range swap (draft-only assumption)**
   - Input: `Mar 7 2pm-10am`
   - Draft assumption: parser notes assumption such as `interpreted as next-day end` or marks unresolved based on confidence policy; no silent destructive rewrite.

6. **Email paste with evidence snippet**
   - Input: pasted message containing `Let's meet March 7 around 3 at clinic`.
   - Result: unresolved due to `around 3`; keep bounded `evidenceSnippets[]` and normalized `originalText`, not full raw blob by default.

7. **Rule unresolved blocks**
   - Input rule: `Unavailable later`
   - Result: unresolved and confirm is blocked; rule not persisted.

8. **Next week**
   - Input: `next week`
   - Result: resolved Monday `2026-02-23 00:00` -> Monday `2026-03-02 00:00` local.

9. **This weekend**
   - Input: `this weekend`
   - Result: resolved Saturday `2026-02-21 00:00` -> Monday `2026-02-23 00:00` local.

10. **Next month**
    - Input: `next month`
    - Result: resolved Sunday `2026-03-01 00:00` -> Wednesday `2026-04-01 00:00` local.

## 11) TODO / Deferred Features

- Recurrence support (including expressions like `last Thursday of every month`).
- Timezone change/travel behavior across entry lifecycle.
- Localized date/week rules beyond current hard-coded defaults.
- Richer fuzzy phrases and per-user fuzzy-window preferences (`morning means ...`).
- Notifications and first-class workflows to find unresolved items.
