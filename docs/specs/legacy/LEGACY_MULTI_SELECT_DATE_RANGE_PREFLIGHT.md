# CODEX Pre-Flight Questionnaire — Multi-Select Date Range (People → Availability/Unavailable)

This pre-flight captures **current system behavior** and **recommended product decisions** before implementation.

## 1) Functional Scope

- **Replace or add mode?**
  - **Recommendation:** Add an additional mode; keep existing single-date flow fully supported for backward compatibility.
- **Multiple non-contiguous ranges?**
  - **Recommendation:** Yes. Model as multiple segments under one user intent in UI; persist as multiple rule rows initially.
- **Mix single days + ranges?**
  - **Recommendation:** Yes. A single day is a range where `startDate === endDate`.
- **Available + Unavailable?**
  - **Current:** Rules support both `kind: 'available' | 'unavailable'`.
  - **Recommendation:** New range UX should support both kinds consistently.
- **Full-day only or partial-day?**
  - **Current:** Supports full-day and partial-day (`startTime` + optional `durationMins`).
  - **Recommendation:** Keep both.
- **Allow overlapping ranges for same person?**
  - **Current:** Same-kind overlap is allowed; opposite-kind overlap is removed on add.
  - **Recommendation:** Keep this behavior for v1 ranges to minimize rule-engine change.
- **Conflict precedence?**
  - **Current effective precedence at evaluation:** `unavailable` wins over `available`.
  - **Current write-time behavior:** new rule deletes overlapping opposite-kind rules for same person/date.
  - **Recommendation:** Keep write-time normalization + runtime precedence unchanged for v1.

## 2) Recurrence & Patterns

- **Recurrence support for ranges?**
  - **Current:** No recurrence in action schema/state.
  - **Recommendation:** Out of scope for first range release.
- **Interaction with existing recurrence?**
  - **Current:** N/A (no recurrence).
- **Exclusions within a range?**
  - **Current:** Not supported.
  - **Recommendation:** Out of scope for v1; represent exclusions as additional explicit rules later.

## 3) Data Model & Backend

- **Current availability schema:**
  - `AvailabilityRule = { code, personId, kind, date, startTime?, durationMins?, timezone?, desc? }`.
- **Storage pattern today:**
  - Single-day rules keyed by `date` (no `endDate`, no recurrence object).
- **Migration needed?**
  - **Recommendation:** No mandatory migration for v1 if ranges are expanded into multiple existing rule rows.
- **One rule with multiple segments vs grouped rule objects?**
  - **Recommendation:**
    1. **v1:** Expand into multiple rule objects (lowest risk).
    2. **v2:** Optional grouping metadata (`groupId`) if UX needs “delete/edit as one set”.

## 4) UX / UI Behavior

- **Selection mechanics:**
  - **Recommendation:** Start simple with click-start → click-end, then “Add another range”.
- **Auto-merge contiguous ranges?**
  - **Recommendation:** Yes, normalize contiguous/overlapping segments before submit.
- **Edit individual segments?**
  - **Recommendation:** Yes, if segment list is shown in modal before save.
- **Delete semantics:**
  - **Recommendation:**
    - If grouped in UI pre-submit: delete segment or all.
    - Persisted v1 rows: delete acts per rule row unless explicit grouped delete is added.
- **Conflict display:**
  - **Recommendation:** Show a pre-submit note: “X opposite-kind rule(s) will be replaced”.

## 5) Validation Rules

- **Maximum span / count:**
  - **Recommendation:**
    - Max 180 days per segment.
    - Max 20 segments per submit.
- **Past dates editable?**
  - **Recommendation:** Keep editable (needed for corrections/audit continuity).
- **Auto-normalize overlaps?**
  - **Recommendation:** Yes; merge same-kind touching/overlapping segments in client payload before submit.

## 6) Scheduler Logic Impact

- **How resolution works today:**
  - Status is computed per appointment interval/date against matching rules; `unavailable` outranks `available`.
- **Performance impact:**
  - Minor at current scale; complexity increases linearly with number of rules.
  - **Recommendation:** If rules grow significantly, add person/date indexing in memory.
- **Recalc/caching hooks needed?**
  - **Current:** Snapshot-driven recalculation already happens after mutations.
  - **Recommendation:** No additional cache layer required for v1.

## 7) Permissions & Multi-User

- **Who can edit availability?**
  - **Current:** Any authenticated active person in a group can issue mutations.
  - **Recommendation:** Keep as-is unless role-based access is introduced.
- **Notifications on edits?**
  - **Current:** None.
  - **Recommendation:** Optional future enhancement.
- **Audit history required?**
  - **Current:** `history` exists but no dedicated per-rule audit trail.
  - **Recommendation:** Nice-to-have, not required for v1.

## 8) Edge Cases

- **Time zone handling:**
  - **Current:** Rule stores optional timezone; defaults to person/context timezone.
  - **Recommendation:** Continue per-rule timezone capture.
- **DST transitions:**
  - **Current:** Time handling depends on existing interval math and timezone offset resolver.
  - **Recommendation:** Add dedicated tests for DST boundary dates when range feature lands.
- **Cross-midnight ranges:**
  - **Current:** Not modeled directly (single date + duration, clamped interval logic).
  - **Recommendation:** Treat as out-of-scope for v1; require split into two date segments.

## 9) API & Integration

- **Single-range API assumptions?**
  - **Current:** `add_rule` action accepts one rule payload.
  - **Recommendation:** For v1, submit multiple `add_rule` actions in one proposal.
- **Versioned endpoints needed?**
  - **Recommendation:** No for v1 if API contract remains unchanged.
- **Mobile impact?**
  - **Current:** No dedicated mobile client in this repo.
  - **Recommendation:** Document payload strategy so external clients can mirror it.

## 10) Testing & Rollout

- **Feature flag?**
  - **Recommendation:** Yes (`VITE_MULTI_RANGE_RULES` + mirrored API guard if needed).
- **Backward compatibility?**
  - **Recommendation:** Must remain backward compatible with existing single-rule data.
- **Migration scripts?**
  - **Recommendation:** Not required for v1 expansion approach.
- **Acceptance criteria (proposed):**
  1. User can create 2+ non-contiguous date ranges for Available and Unavailable.
  2. Saved ranges persist and render as expected after refresh.
  3. Opposite-kind overlap handling remains identical to current behavior.
  4. Existing single-date rule flows and tests remain green.
