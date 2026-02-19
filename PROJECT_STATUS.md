# PROJECT_STATUS

## Current milestone

Local runnable baseline with persistent API state in local JSON and Azure Blob (SAS) modes, both using optimistic ETag concurrency for confirm/apply flow.

## What works now

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
