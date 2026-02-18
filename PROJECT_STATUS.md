# PROJECT_STATUS

## Current milestone

Local runnable baseline with persistent API state in local JSON and Azure Blob (SAS) modes, both using optimistic ETag concurrency for confirm/apply flow.

## What works now

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
- Deterministic identity binding supported with `I am <Name>` (applies immediately).
- Limitation: identity is currently stored globally (`activePersonId`) because auth/session tokens are not implemented yet.
- No persistence yet for pending proposals.
- Monorepo is runnable locally with `pnpm dev`.
- Prompt-only web UI is implemented at `apps/web`:
  - transcript area
  - single prompt input
  - Enter submits prompt
  - initial hint: `Type 'help' for examples.`
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
