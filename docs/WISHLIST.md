# Wishlist

## AI Ingestion

- Upload/paste appointment artifacts (text/email/PDF/image) → AI extracts fields → proposal → confirm → apply.
  - Supported formats: text, PDF (text-based), image via vision (later).
  - Multi-appointment extraction (one upload can yield multiple `add_appointment` actions).
  - Clarify when extracted details are ambiguous before proposing actions.
  - Logging/privacy: default **NO** raw artifact logging; store redacted/hashed metadata only, with an optional dev flag for raw capture.

## Backlog / Wish List (captured 2026-02-21)

- Unresolved appointments allowed (saved even without date/time).
- UI badge: show only `Unresolved` (collapses partial/unresolved in UI).
- Unresolved items sort to top, newest updated first.
- Unresolved availability label: `Unreconcilable` (click opens edit).
- Click resolved date/time cell to edit via natural language (prefill last stored prompt text).
- Preserve only last stored prompt text for edits (may be AI-trimmed).
- Pasted blobs: do not store full raw text by default; store only evidence snippets (size-capped).
- Future: notifications / find unresolved items.
- Date parsing preference override per-user (MDY/DMY/ISO), default from system for now.
- Future: localized date/week rules (currently hard-coded reasonable defaults).
- Hard-coded fuzzy windows (05-08, 08-12, 12-17, 17-21, 21-24).
- Relative date hard-codes: week starts Monday; this/next week; this weekend; next month.
- Cross-day appointments supported in v1.
- Conflict model v1: No Conflict / Conflict / Unreconcilable; any overlap with unavailable => Conflict.
- Store internal conflict detail later (segments/overlap minutes) but UI remains 3-state for v1.
- Rules must be resolved to save (confirm blocks unresolved).
- TODO: recurrence later (including `last Thursday of every month`).
- TODO: timezone change/travel behavior later.
- TODO: richer fuzzy phrases and per-user meaning preferences.

## Status updates (2026-02-26)

- ✅ Implemented: Dashboard "Your groups" now loads from `GET /api/me/groups` (active + invited).
- NYI: Group activity feed (events model + endpoints).
- NYI: Purge job for soft-deleted groups/appointments after `purgeAfterAt`.
