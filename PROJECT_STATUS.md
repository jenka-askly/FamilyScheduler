# PROJECT_STATUS

## Current milestone

Local runnable baseline with persistent API state in local JSON and Azure Blob (SAS) modes, both using optimistic ETag concurrency for confirm/apply flow.

## What works now

- Hard route gate is now enforced for `/#/g/:groupId/app`: app UI only renders after a successful `/api/group/join`; denied sessions are redirected with `err` + `trace` query params to join.
- Debug auth logging is available behind `VITE_DEBUG_AUTH_LOGS` (web) and `DEBUG_AUTH_LOGS` (api), including join and gate decision stages.
- Create group now initializes creator as the first active person in `people[]` with normalized phone values and creation metadata.
- Create Group page now shows a share link (with Copy) before navigating, plus a Continue button to enter the app.
- Optional AI-assisted location parsing is now available behind `LOCATION_AI_FORMATTING` (default `false`), with fallback heuristic normalization preserved when disabled or parsing fails.
- Appointment location now persists as `locationRaw`, `locationDisplay`, and `locationMapQuery` (legacy `location` migrated automatically), and direct edits deterministically normalize formatting without OpenAI.
- Appointments Location column now supports raw textarea editing + inline normalized preview (line-clamped) + Google Maps `Map` link using map query text.
- Appointment notes are now persisted end-to-end (`notes`, default empty string), including backward-compatible normalization for older blobs missing notes.
- Chat/action layer supports `set_appointment_notes` (set/clear) behind the existing proposal+confirm mutation gate.
- Appointments table includes Description, Location, and Notes columns with wrapped multi-line rendering so longer content is visible without horizontal scrolling; empty values render as `—`.
- Dashboard-first web UI now renders appointments and availability as compact, sortable tables with code-copy buttons, horizontal overflow support, unassigned badge, and date/time columns.
- Azure persistence mode available with `STORAGE_MODE=azure` using SAS URL + blob ETag optimistic concurrency (`If-Match`).
- Azure init creates missing blob with `If-None-Match: *` and same seeded empty state as local mode.
- API state persists locally across restarts using `./.local/state.json`.
- Confirm/apply path enforces optimistic ETag checks to reject stale proposals safely.
- Fixed Azure Functions v4 discovery by registering HTTP trigger from `api/src/index.ts` (compiled to `api/dist/index.js`).
- Local `/api/chat` route reachable via Functions host (`POST http://localhost:7071/api/chat`) with JSON response.
- Tracked `api/local.settings.example.json`; local copy workflow documented in runbook.
- Confirmation protocol implemented (in-memory only).
- In-memory appointment state in API (`appointments[]`) with runtime-stable generated codes (`APPT-1`, `APPT-2`, ...).
- `list appointments` command returns one appointment per line (`APPT-n — <title>`).
- `show APPT-n` command returns appointment details or a not-found message.
- Mutation-like commands require explicit `confirm` before apply.
- Delete appointment (`delete APPT-n`) with confirm/cancel guard.
- Update appointment title (`update APPT-n title <new title>`) with confirm/cancel guard.
- In-memory availability blocks supported with stable codes (`AVL-<PERSON>-<N>`) via confirm/cancel (`mark ... unavailable`, `delete AVL-...`).
- Availability queries supported: `list availability`, `list availability for <Name>`, `show AVL-...`, `who is available ...`, and `check conflicts`.
- Deterministic identity binding supported with `I am <Name>` via the same proposal/confirm modal flow as other mutations.
- Runtime chat context is now scoped per session (`x-session-id`, default `default`) for identity, pending proposal, pending clarification, and chat history.
- No persistence yet for pending proposals.
- Monorepo is runnable locally with `pnpm dev`.
- Dashboard-first web UI is implemented at `apps/web`:
  - always-visible `Appointments` and `Availability` panels hydrated from API `snapshot`
  - conversation transcript collapsed to last user/assistant exchange by default with `History (N)` toggle
  - proposal responses open a confirm/cancel modal (`Confirm this change?`)
  - prompt label/placeholder: `What would you like to do?`
- Stub Azure Functions API endpoint is implemented at `POST /api/chat` with deterministic command handling:
  - request `{ "message": "..." }`
  - queries return `{ "kind":"reply", "assistantText":"You asked: <message>" }`
  - mutation-like commands return `{ "kind":"proposal", ... }` and require explicit `confirm`
  - `confirm` applies the pending proposal and returns `{ "kind":"applied", ... }`
  - validation error for missing/empty message.
- Shared package has initial placeholder type (`Person`) and builds.
- CI installs dependencies and runs workspace build checks with `pnpm -r --if-present build`.

## How to run locally

1. Install prerequisites:
   - Node.js 20+
   - pnpm 10+
   - Azure Functions Core Tools v4
2. Run:
   - `pnpm install`
   - `cp api/local.settings.example.json api/local.settings.json`
   - `pnpm dev`
3. Open `http://localhost:5173` and submit a prompt.

## Local dev checklist

- `pnpm install` generates/uses `pnpm-lock.yaml`.
- If pnpm warns about ignored build scripts, run `pnpm approve-builds` and select `esbuild`.

## CI checklist

- CI requires `pnpm-lock.yaml` to be present (or dependency caching disabled); current state: lockfile is committed.

## Recent changes

- 2026-02-19: People pane now uses row-based editing UX consistent with Appointments: Add Person inserts inline blank row in edit mode, per-row Edit/Done/Delete, outside-click/Esc cancel (with auto-delete for untouched blank drafts), and direct deterministic person actions (`create_blank_person`, `update_person`, `delete_person`) with server-side phone/name validation and duplicate checks. Join gate now only admits active people with non-empty phone allowlist entries.
- 2026-02-19: Added `GroupAuthGate` around `/#/g/:groupId/app` so unauthenticated or mismatched sessions are redirected to join before app mount; initial `list appointments` chat bootstrap now has a StrictMode-safe one-time ref guard with debug stage `initial_chat_triggered` behind `VITE_DEBUG_AUTH_LOGS`.
- 2026-02-19: Enforced join gate on `/#/g/:groupId/app` (session/phone required, mismatched group clears session, failed join redirects to join page with `?err=not_allowed`), added creator display-name capture (`creatorName`) in create flow/API seed, removed UI density toggle and made compact spacing the default.
- 2026-02-19: Fixed Create Group flow end-to-end: API seeds creator into `people[]` on create, create response includes `creatorPersonId`, Create page shows copyable share link before navigation, and app shell shows a dev-only warning if snapshot has zero people.
- 2026-02-19: Added UI density mode toggle (Normal/Compact) with `localStorage` persistence and `body[data-density]` binding; introduced root density tokens applied across main layout, panels, controls, table cells, picker rows, rule rows, and modal padding so compact mode reduces font/whitespace while normal stays default.
- 2026-02-19: Added AI-assisted appointment location parsing (name/address/directions/display/mapQuery) behind `LOCATION_AI_FORMATTING`, added new location fields to appointment state/snapshots, and kept deterministic heuristic fallback for disabled/failure paths.
- 2026-02-19: Location editing flow now stores raw + normalized fields (`locationRaw`, `locationDisplay`, `locationMapQuery`), migrates legacy `location`, and renders an inline Google Maps link in the appointments table with multi-line clamped display.
- 2026-02-19: Appointments table UX tweak in `apps/web`: Description, Location, and Notes cells now render as wrapped multi-line content (pre-wrap) with bounded width to reduce horizontal scrolling for long text.
- 2026-02-19: Assign People modal UX polish in `apps/web`: each person now renders as one clickable row (checkbox + name + right-aligned fixed-width status badge), row hover and separators improve scanability, and checkbox/row toggles stay in sync for better selection on desktop/mobile widths.
- 2026-02-19: People view now shows per-person rules in a collapsed section (Clock toggle) with badge/date/time/notes and inline delete action (Trash), and confirm/cancel apply flow refreshes UI snapshots for appointments/people/rules immediately.
- 2026-02-19: API chat snapshot now includes rule timezone in `snapshot.rules` and acceptance coverage validates rules are returned after add-rule confirm.
- 2026-02-19: People pane UX refresh in `apps/web`: row actions are now compact icon buttons with hover tooltips, added delete confirmation that deactivates a person, added availability/unavailability rule modal with date/all-day/time/duration/notes controls, and active-only filtering in People table and appointment people picker.
- 2026-02-19: UI branding update in `apps/web` changed browser tab title and visible app header from “FamilyScheduler” to “Scheduler” with no functional behavior changes.
- 2026-02-19: Web UX polish in `apps/web`: Availability panel hidden from dashboard rendering (snapshot data unchanged), baseline typography reduced to 14px with tighter table/card spacing, and transcript minimized by default with clarify-only assistant callout plus subtle expandable History toggle.

- 2026-02-19: Bumped action schema to v3 with appointment people operations (`add/remove/replace/clear`) and `set_appointment_location`, added storage/state migration normalization (`people[]` and `location` defaults), and exposed people/location in chat snapshot for UI tables.
- OpenAI request/response NDJSON logging (feature-flagged) added in API parser wrapper: `OPENAI_LOG_ENABLED` (default `false`), `OPENAI_LOG_DIR` (default `api/.local/logs`), and `OPENAI_LOG_MAX_BYTES` for rotation. Logs include per-request trace IDs, session hashes, redacted request/response payloads, and parser validation diagnostics.
- 2026-02-19: OpenAI parser now receives a full context envelope (now/timezone, identity, pending proposal/clarification, full appointments/availability/people snapshot, and bounded session history). Added per-session in-memory runtime state, confidence-based safe-clarify fallback, and strict mutation confirmation behavior (including identity changes).
- 2026-02-19: Chat UX fix for list defaults + reschedule clarifications: deterministic `show list|list|show|show all|list all` now lists appointments first (or availability if no appointments), reschedule date-only commands now create pending clarification for start/end times, and follow-up time ranges like `9am to 10am` resolve directly into a reschedule proposal before any new intent parsing.
- 2026-02-19: API UX upgrade for rescheduling: added flexible date parsing (`YYYY-MM-DD`, `DD-MM-YYYY`, `Month DD YYYY`), deterministic time-of-day mapping (`morning`/`afternoon`/`evening`), default all-day interpretation for date-only reschedules, and robust pending proposal controls that trigger on messages containing `confirm` or `cancel`.
- 2026-02-19: Added timezone alias handling for `Seattle time`, `LA time`, and `Pacific` to map to `America/Los_Angeles`; chat now answers `Seattle time vs LA time` with `Same Pacific timezone.`
- 2026-02-19: Improved query UX for `show my appt` / `show my appointments` to list directly, and only asks for a code on `show appointment` when more than five appointments exist.
- 2026-02-19: Appointments and availability panels now use table layouts with sorting (appointments: start then code fallback; availability: start), code click-to-copy, unassigned badge display, and compact horizontal-scroll styling.
- 2026-02-19: UX refresh shipped: API now includes a response `snapshot` (appointments/availability/historyCount) on reply/proposal/applied/clarify responses; web now renders always-visible dashboard panels, collapses history by default behind `History (N)`, and uses a confirm/cancel modal for proposal flows.
- 2026-02-18: Prioritized pending clarification resolution before identity parsing in chat flow, made `list/show my availability` identity-aware (uses current identity when set, otherwise asks `Whose availability?`), and updated clarification slot-filling to resolve `personName` case-insensitively against existing people names without changing identity state.
- 2026-02-19: Fixed multi-turn clarification binding for delete/update/query follow-ups by persisting intended action + missing slots, added resilient APPT/AVL code normalization (`appt1` => `APPT-1`), and ensured invalid clarify replies re-prompt without losing intent.
- 2026-02-18: Added pending clarification handling in chat flow so follow-up replies (e.g. `Joe`) can fill missing query fields (currently `list_availability.personName`) and execute immediately; `cancel` now clears both pending proposals and pending clarifications with reply `Cancelled.`; bare-name messages no longer trigger identity changes (identity remains explicit via `I am <Name>`).
- 2026-02-18: Normalized chat input (trim/lower/whitespace/trailing punctuation) for deterministic routing so `Who is available in March?` and `who is available in march` resolve identically; availability month parsing now accepts month names/abbreviations with next-occurrence year resolution, and availability-query parse failures return a focused clarify prompt without code guidance.
- 2026-02-18: Azure blob init now treats `409 BlobAlreadyExists` and `412` as already-initialized success conditions so repeated startup init attempts do not fail when `state.json` already exists.
- 2026-02-18: Added in-memory availability blocks and deterministic availability commands (`I am <Name>`, mark/list/show/delete availability, who-is-available month queries, and `check conflicts`) with confirm/cancel protections for mutations.
- 2026-02-18: Added deterministic delete/update appointment mutation proposals (`delete APPT-n`, `update APPT-n title <new title>`) with confirm/cancel application and post-apply appointment snapshot output.
- 2026-02-18: Added API clean-build script (`pnpm -C api run clean`) and wired `api` build to clean `dist/` before compilation so stale artifacts cannot mask the Functions entrypoint (`dist/index.js`) path.
- 2026-02-18: Fixed Azure Functions entrypoint mismatch by setting `api/tsconfig.json` `rootDir` to `src` (with `outDir` `dist`) so builds emit `api/dist/index.js` and `api/dist/functions/chat.js`; updated runbook troubleshooting for `entry point dist/index.js does not exist` and confirmed `/api/chat` is reachable locally.
- 2026-02-18: Fixed local Azure Functions runtime discovery by moving v4 trigger registration to `api/src/index.ts`, added tracked `api/local.settings.example.json`, and updated runbook for `local.settings.json` copy so local `POST /api/chat` no longer 404s.
- 2026-02-18: Added in-memory appointment mutation/query support in API (`add appt <title>`, `confirm`, `list appointments`, `show APPT-n`) with runtime-generated human-readable appointment codes and post-apply snapshot output.
- 2026-02-18: Added workspace-root `typescript` devDependency (`^5.5.0`) so workspace `tsc` invocations resolve during local/CI builds.
- 2026-02-18: Fixed API TypeScript build configuration by adding `@types/node` to `api` devDependencies to resolve `TS2688` (Cannot find type definition file for `node`).
- 2026-02-18: Added `pnpm-lock.yaml` to the repository so GitHub Actions (`setup-node` cache: pnpm) can run without failing.
- 2026-02-18: Local dev note: run `pnpm approve-builds` and select `esbuild` to avoid pnpm warning and allow the Vite/esbuild toolchain to function.

## Known limitations

- Next planned milestone: add persistence first (local file), then OpenAI natural-language parsing.
- No authentication/passkey yet.
- No persistence yet (proposal confirmation is in-memory only).
- No storage integration (local/blob) yet.
- No OpenAI integration yet.

## Next steps

- Wishlist: AI ingestion from uploaded artifacts (text/PDF/image) with confirm gate.
1. Replace naive parsing with a structured action schema.
2. Add availability model for assignment/scheduling decisions.
3. Add persistent local file storage for appointments/proposals.
4. Add OpenAI integration after local deterministic/storage milestones.

## Continuity rule

After every merged PR, update this file with:

- what changed,
- local/deploy status,
- next steps.

## Next

- Add passkey/session-backed identity so `I am <Name>` is not global across users.


## Azure mode env checklist

- `STORAGE_MODE=azure`
- `BLOB_SAS_URL=<container or blob SAS URL>`
- `STATE_BLOB_NAME=state.json` (required for container-level SAS URL; ignored for blob-level SAS URL)
- Optional: `BLOB_KIND=container|blob` (for operator clarity; adapter auto-detects by URL path)

## Deployment readiness notes

- Local mode remains the default and unchanged for developer workflows.
- Azure mode is ready for staging/production where shared persistent state is required.
- CI remains secret-free; Azure behavior is verified manually with real SAS credentials only.


## Recent update (2026-02-18 23:05 UTC)

- Added feature-flagged OpenAI natural-language parser (`OPENAI_PARSER_ENABLED`) that emits strict structured actions only.
- Added versioned action schema (`ActionSchemaVersion=1`) with strict validation and unknown-field rejection.
- Added centralized deterministic action executor as the only mutation path.
- Updated chat routing: deterministic commands first, OpenAI fallback, clarify/query/proposal handling, and traceId in responses.
- Added API unit tests for schema validation and deterministic executor behavior.


## Debug switches and artifacts

- OpenAI logging is off by default. Enable with `OPENAI_LOG_ENABLED=true`.
- Default log path: `api/.local/logs/openai.ndjson` (gitignored via repo `.gitignore` rule for `.local/`).
- Rotation: when file size exceeds `OPENAI_LOG_MAX_BYTES` (default `5242880`), current file is renamed with a timestamp suffix and a fresh file is used.
- Sensitive fields are redacted (`apiKey`, `sas`, `passkey`, and `sig=` query parameters in strings).
- 2026-02-19: Deterministic explicit reschedule parsing now supports `update appointment APPT-<n> to start <ISO> end <ISO>` and `reschedule APPT-<n> start <ISO> end <ISO>` (case-insensitive), including timezone-default behavior for offset-less timestamps (interpreted as `America/Los_Angeles`) with explicit yes/no timezone clarification before proposal when needed. Pending proposal/clarification confirmation now accepts synonyms (`yes/y/ok/okay/sure` and `no/n/stop/nevermind/never mind`).

## Recent update (2026-02-19 01:46 UTC)

- Refactored chat routing to AI-first mode with deterministic confirm/cancel gate and pending-proposal short-circuit (`Please confirm or cancel.` without OpenAI calls).
- Removed most deterministic regex parsing in chat; retained only help, confirm/cancel synonyms, and session/passkey bootstrap responses.
- Upgraded parser schema to strict `kind: reply|proposal|clarify` + `message` + optional `actions` + `confidence`.
- Added action post-processing in chat: appointment/availability code normalization, referenced-code existence checks, and proposal validity guard (must include summary + actions).
- Added explicit logging for OpenAI context envelope, raw model responses, and schema/post-processing validation errors.
- Replaced chat acceptance tests with AI-first acceptance scenarios (show appt, update->proposal->confirm, deterministic yes on pending proposal, random yes clarify, unknown code clarify).

## Recent update (2026-02-19 02:06 UTC)

- Updated planner action schema to v2 with appointment/availability date-centric fields: required `date` + `desc`, optional `startTime` + `durationMins` + `timezone`.
- Replaced mutation action names with `update_appointment_desc` and date-based `reschedule_appointment`.
- Executor now resolves start/end deterministically from `date/startTime/durationMins/timezone`; date-only actions are stored as all-day (`isAllDay=true`) with no start/end ISO.
- Storage model remains backward compatible: snapshot shaping derives `date/startTime/durationMins/isAllDay` from legacy `start/end` when needed.
- Updated parser prompt contract, chat snapshot schema, action tests, and acceptance tests for: date-only add, timed add, and date-only reschedule behavior.


## Recent update (2026-02-19 02:55 UTC)

- Added persisted appointment notes (`notes`) with default-empty normalization for legacy state blobs.
- Added `set_appointment_notes {code,notes}` planner action + executor previews for set/clear.
- Included `notes` in API snapshots consumed by web UI.
- Updated appointments table with a compact Notes column (`—` when empty, ellipsis + title on long values).
- Updated help docs with note-setting/clearing examples.

## Recent update (2026-02-19 04:20 UTC)

- Started People system overhaul: state now uses `people` + `rules` (availability rules) with legacy `availability` migration into `rules` (`kind=unavailable` default).
- API snapshot now returns people/rules and appointment `peopleDisplay` values.
- Added phone validation/normalization helper (E.164-like validation fallback due registry restrictions).
- Added/updated action schema + executor paths for people CRUD, rules CRUD, and appointment person assignment with unavailable warnings.
- Web now has `Appointments | People` toggle, People table actions, and appointment people picker with Available/Unavailable/Unknown tags.
- Confirm gate remains in place for mutations.
- Known limitation: could not install `libphonenumber-js` (npm registry 403 in this environment), so validation currently uses local fallback logic.

## Recent update (2026-02-19 04:58 UTC)

- People view now renders per-person rules inline by default whenever rules exist (clock toggle removed), sorted by date then time with all-day rules first.
- People view prompt header/input is hidden; Appointments view prompt input remains unchanged.
- Rule conflict policy now auto-resolves contradictory overlaps on `add_rule`: overlapping opposite-kind rules for the same person/date are removed before inserting the new rule.
- Proposal previews are now generated from executor dry-run effects so confirm modals explicitly show conflict removals (e.g., `This will remove X conflicting rule(s).`).

## Recent update (2026-02-19 06:10 UTC)

- Question dialog implemented for AI clarifications.
- API model/schema now supports `kind="question"` with optional up-to-5 button options (`label`/`value`/`style`) and `allowFreeText`.
- Backward compatibility retained: legacy model `kind="clarify"` is normalized into `kind="question"` with free-text enabled by default.
- Web now blocks with a dedicated question modal whenever `pendingQuestion` exists; users can answer by button click or typed response, and Close dismisses without mutation.
- Proposal confirm/cancel modal behavior remains unchanged.

## Recent update (2026-02-19 06:15 UTC)

- Added deterministic direct-mutation API endpoint: `POST /api/direct` for inline appointment edits without OpenAI.
- Added direct appointment actions: `create_blank_appointment`, `set_appointment_date`, `set_appointment_start_time`, `set_appointment_desc`, `set_appointment_location`, `set_appointment_notes`, `set_appointment_duration`, and `delete_appointment`.
- Appointments pane now supports direct inline editing for date/time/description/location/notes and add/delete row UX.
- Delete appointment remains confirmation-gated; inline edits apply immediately with no confirm modal.

## Recent update (2026-02-19 06:35 UTC)

- Appointments table now defaults to read-only rows and uses per-row edit mode with Edit/Done toggle in Actions.
- Add appointment now auto-opens edit mode on the newly created APPT row.
- Appointments table includes inline duration editing while in row edit mode; read-only rows show compact text values and clamped multi-line content.
- Web layout is now full-width (`main` no longer constrained to centered max width) with consistent page padding.
- Typography and control sizing were reduced for denser system-like UI defaults.
- 2026-02-19: Appointments row edit mode now supports cancel by keyboard/mouse: pressing `Esc` or clicking/tapping outside the active row exits edit mode; Done tooltip now hints at `Esc/outside click` to improve discoverability.


## Recent update (2026-02-19 07:20 UTC)

- Added v1 group create/join flow with hash routes (`/#/`, `/#/g/:groupId`, `/#/g/:groupId/app`) and localStorage session wiring (`groupId` + `phone`).
- API now has deterministic endpoints: `POST /api/group/create` and `POST /api/group/join`.
- `/api/chat` and `/api/direct` now require `groupId` + `phone`, normalize/validate phone, and return `403 { error: "not_allowed" }` when phone is not in active People.
- Storage is now per-group (`familyscheduler/groups/<groupId>/state.json`) for both Azure and local modes.
- App state schema now carries `schemaVersion`, `groupId`, `groupName`, `createdAt`, `updatedAt`.

### Debug switches / env notes

- `STATE_BLOB_PREFIX` defaults to `familyscheduler/groups`.
- `DEFAULT_COUNTRY` defaults to `US` for phone normalization.
- Local state root defaults to `.localstate/familyscheduler/groups`.
