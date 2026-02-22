## 2026-02-22 update (TimeSpec AI-first fallback cleanup)

- Removed `TIME_RESOLVE_OPENAI_FALLBACK` from runtime paths so time preview now always attempts AI first, then falls back to deterministic parsing only when AI fails.
- Corrected `usedFallback`/`fallbackAttempted` semantics for `/api/direct` time preview: `fallbackAttempted` is always `true`, `usedFallback` is `true` when AI output is used and `false` when deterministic fallback is used.
- Confirmed TimeSpec parsing uses Responses API structured outputs via `text.format.json_schema` (no `response_format` on this path).

## 2026-02-22 update (Responses API text.format + fallback semantics)

- Fixed TimeSpec AI structured output payload for Responses API (OpenAI `/v1/responses` and Azure `/openai/responses`) by migrating from `response_format` to `text.format.json_schema` (`time_spec_parse`, `strict: true`).
- Corrected `resolveTimeSpecWithFallback` semantics: `fallbackAttempted` now tracks whether AI was attempted, and `usedFallback` is true only when AI output is used; deterministic parse paths report `usedFallback: false`.
- Restored feature-flag behavior for `TIME_RESOLVE_OPENAI_FALLBACK`: when disabled, AI is skipped and deterministic parsing is returned directly.
- Updated tests to assert the new Responses API request contract and corrected fallback-flag expectations in direct/time resolver tests.
- Note: `docs/discovery-photo-extract-appointment-feasibility.md` is currently stale (it claims no Responses API usage) and should be refreshed in a docs pass.

## 2026-02-22 update (schedule row actions + click-away cancel)

- Re-added Edit icon next to Delete in Schedule row actions, including explicit accessible labels (`Edit appointment`, `Delete appointment`).
- Added click-away cancel for the inline appointment editor: clicking outside the active row + editor container now triggers the same cancel path (discard unsaved changes, no mutation).
- Files touched: `apps/web/src/AppShell.tsx`, `PROJECT_STATUS.md`, `CODEX_LOG.md`.

## 2026-02-22 update (AI time parse opId/model null debugging)

- Traced the AI time parsing path end-to-end and added explicit pre-request diagnostics that log configured model wiring (`TIME_RESOLVE_MODEL`, `OPENAI_MODEL`) before the time parse request is sent.
- Added explicit OpenAI result diagnostics after response decode to log `opId` from `resp.id` and `model` from `resp.model`.
- Updated metadata propagation so `resolve_appointment_time` logging now prefers runtime response model (`resp.model`) while preserving configured model as fallback.
- Removed the `TIME_RESOLVE_OPENAI_FALLBACK=0` bypass in the time resolver so AI is always attempted first, then deterministic parser fallback is used only for call/config failures.
- Added startup config log line in `api/src/index.ts` so deployments confirm time-parse model settings at boot.
- Updated tests for always-attempt-AI behavior and response-model propagation.

## 2026-02-22 update (time_spec_parse schema flattening fix)

- Fixed AI time parsing structured output request to use `response_format.json_schema` with a minimal flat `time_spec_parse` schema (`status`, nullable `startUtc`/`endUtc`, nullable `missing`/`assumptions`) to avoid OpenAI HTTP 400 invalid schema errors.
- Updated AI output mapping to align with the simplified schema while preserving fallback behavior in `resolveTimeSpecWithFallback` (call/config failures still fallback; bad AI payloads still surface).
- Added/updated tests to assert `response_format` payload shape and verify AI-first resolution for `"tomorrow 1am"` returns `usedFallback=false` with non-null `opId`.

## 2026-02-22 update (provider-aware AI time parsing + actionable telemetry)

- Added provider-aware AI client adapter for time parsing (`openai` vs `azure`) with explicit selection: Azure when `AZURE_OPENAI_ENDPOINT` is set, otherwise OpenAI.
- Fixed Azure configuration mismatch by targeting Azure Responses API endpoint (`/openai/responses`) with `api-version` and using deployment name (`AZURE_OPENAI_DEPLOYMENT`) in the request model field.
- Kept OpenAI path clean (`OPENAI_API_KEY` bearer auth; no Azure base URL/version mixing).
- Improved `ai_time_parse` telemetry: success now logs `status:"ok"` with `opId`, provider, model/deployment, and parse status; failure logs actionable safe diagnostics (`errName`, trimmed message/body preview, status/code/type, provider, model/deployment, `nowIso`, `timezone`).
- Tightened fallback behavior so deterministic fallback only occurs on actual call/config failures (`OPENAI_CALL_FAILED` / `OPENAI_NOT_CONFIGURED`), while invalid AI payloads surface instead of being silently masked.

## 2026-02-22 update (AI-first time parsing with explicit now+timezone)

- Implemented AI-first time parsing for `resolve_appointment_time` with explicit `nowIso` and IANA `timezone` passed in the model prompt (no implicit server clock assumptions).
- Switched AI call to OpenAI Responses API with strict `json_schema` structured output and UTC `startUtc`/`endUtc` validation.
- Added deterministic safe fallback to local `parseTimeSpec` on missing API key, timeout, HTTP errors, or schema/parse failures (no hard parse-related 500/502s).
- Added `ai_time_parse` logging (`traceId` + `opId` + parse status) and optional `nowIso` debug field in direct response payloads.
- Added multilingual smoke coverage (`mañana a la 1pm`) through AI parser tests.

## 2026-02-22 update (OpenAI opId propagation)

- Added opId (OpenAI response id) propagation to API responses and logs for debugging.

## 2026-02-22 update (direct time resolve observability + fallback)

- Added `/api/direct` correlation headers on responses: `x-trace-id`, `x-invocation-id`, optional `x-traceparent`, plus `access-control-expose-headers` and `cache-control: no-store` so browser tools can read trace metadata.
- Added resolve preview metadata in `resolve_appointment_time` responses: `directVersion`, `fallbackAttempted`, and `usedFallback`.
- Added OpenAI fallback path behind `TIME_RESOLVE_OPENAI_FALLBACK=1` for unresolved local parses (including `tomorrow`), with explicit `ok:false` + typed error on fallback failures.
- Added optional single-line structured log event (`kind=time_resolve`) behind `TIME_RESOLVE_LOG_ENABLED=1` for Kusto-friendly diagnostics.
- Time point-in-time results continue returning `startUtc` only (no invented duration/end time).

### Instrumentation
- Added structured OpenAI logging in /api/direct
- Exposed invocationId and opId in API responses
- Enables Kusto correlation without dependency auto-collection

# PROJECT_STATUS

## Current milestone

BYO-only web-to-API routing with Managed Identity Blob-only state persistence and fail-fast config validation.

## What works now

- Fixed scan appointment UI: camera icon visibility + click behavior.
- Standardized appointment row editing to a single row-level editor model: default rows now show plain text for Description/Location/Notes, and the When editor panel now includes editable When/Description/Location/Notes fields with the existing Preview/Confirm/Cancel flow.
- Updated command input guidance with placeholder `Add, edit, or assign (e.g., "edit APPT-4")…` and a compact italic helper tip for email/CSV paste support.
- Tightened group header spacing and muted micro-typography for the group link + explainer so title/link/explainer read as one cohesive block.
- Made support email clickable (mailto link).

- Updated support contact email to `support@yapper-app.com` in `apps/web/src/components/layout/FooterHelp.tsx` (replacing prior support mailbox).

- People table now shows **Last seen** instead of status. Backend snapshots include `lastSeen` (fallback to `createdAt`) and direct person mutations update `lastSeen` timestamps so the column reflects recent person activity.

- Deploy Web (SWA) workflow now deploys `apps/web/dist` via `@azure/static-web-apps-cli` (`npx ... deploy`) instead of `Azure/static-web-apps-deploy@v1`, eliminating Docker/MCR pulls that were flaking with MCR anonymous token 429 rate limits.
- Added a pre-deploy built-output diagnostic step (`ls -la apps/web/dist` + script-tag grep) immediately before SWA CLI deploy to make artifact correctness easier to triage in CI logs.

- SWA deploy corrected to publish `apps/web/dist` as app root (`app_location: apps/web/dist` with no `output_location`); previous config published source, resulting in `/src/main.tsx` in production HTML and a blank page.

- SWA workflows now prebuild `apps/web/dist` using pnpm before deploy and pass `skip_app_build: true` while publishing `app_location: apps/web/dist` (no `output_location`), preventing Azure/static-web-apps-deploy from invoking its internal Oryx/Docker build path and ensuring built assets are deployed as app root.
- Added lightweight pre-deploy diagnostics in SWA workflows (`docker --version || true`, `df -h`, `du -sh . || true`, `ls -la`) to aid future runner resource triage when deploy issues recur.

- Renamed the Appointments pane label to **Schedule** in the shared workspace header while keeping the internal `appointments` view key unchanged.
- Reverted the Schedule/People segmented-tab experiment back to two standard side-by-side buttons for UI stability and readability, while keeping internal view keys unchanged (`appointments` / `people`).
- Standardized primary action labels and sizing to **+ Add appointment** and **+ Add person** across populated and empty-state panes.
- Removed Schedule/People header add buttons and introduced a compact bottom-of-table CTA row in both panes (`+ Add…` / `+ Add another…`) to avoid header CTA CSS conflicts and keep add actions consistently discoverable inside the table card.
- Fixed circular **+** FAB styling regression caused by shared/global button CSS by introducing dedicated `fs-fabAdd` class with explicit background, border, text color, hover, and focus-ring styling.
- Tightened helper guidance under "What would you like to do?" into a single compact muted block with minimal internal spacing.

- Page header group identity block is now tightly packed as a single vertical unit: group name has zero default heading margin, group link + copy icon remain center-aligned in one compact row, and the “save this link” explainer uses smaller muted styling with reduced top spacing to avoid large gaps.
- Header identity stack spacing was tightened further into one compact unit (`groupName` → link+copy row → explainer) with ~3px internal gaps and ~16px separation before pane tabs/content to reduce “floaty” whitespace.
- People rules rows now render as a compact right-aligned cluster (`range`, truncated description, status tag, actions) with reduced per-row/panel spacing so each rule reads as one cohesive line.
- Tightened people→rules spacing and compacted rule rows so rule lists hug the person row with reduced vertical whitespace while keeping badges/text readable.
- People rules range formatting now suppresses misleading default times for all-day entries by showing date-only labels with `(all day)`, including multi-day inclusive ranges such as `Mar 21–Mar 31 (all day)`.

- Workspace header hierarchy updated for both Appointments and People panes: group name is now the primary heading, shareable group link (with copy button) sits immediately beneath it, pane title is secondary, and access guidance is grouped below the pane description.
- People rules list now renders human-readable ranges without minute-count suffixes, including explicit all-day labels for single-day and multi-day ranges (for example, `Mar 21–Mar 31 (all day)`).
- Appointment “Assign people” availability badges now compute overlap by UTC interval intersection (including multi-day/all-day rules), so overlapping `unavailable` rules correctly surface as **Unavailable** instead of **Unknown**.
- Appointment composer now shows muted helper guidance under “What would you like to do?” with concise action hints and an example email/appointment phrase, without changing input/send behavior.
- People table now shows explicit **Accept** and **Cancel** buttons in the Actions column when editing a newly-added blank person row (`pendingBlankPersonId`), hiding rules/edit/delete icons for that new-row state only.
- New-person inline inputs now support keyboard submit/cancel: **Enter** triggers the same save handler as Accept, and **Escape** triggers cancel for the new-row editing state.
- Person rule detail lines are now right-aligned and reordered to show date/time, description, then status tag (`Available`/`Unavailable`) at the far right with description truncation to keep layout stable.
- Rules confirm API now accepts `draftedIntervals` from the web draft preview and persists those intervals directly when present (no OpenAI call on this path); logs include `source:"draftedIntervals"` and `persistedIntervalsCount` for traceability.
- Confirm fallback remains intact: when `draftedIntervals` is absent, confirm still uses the model path and now logs `code:"ZERO_INTERVALS_FROM_MODEL"` when confirm parsing yields zero intervals.
- Rules modal confirm request now sends the exact drafted interval payload and keeps Confirm disabled until at least one drafted interval exists, so People pane updates immediately from the returned snapshot after confirm.

- Rules dialog action labels now read **Draft Rule** and **Add Rule** (previously Draft/Confirm) to make intent clearer while preserving the same draft/confirm behavior and guards.


- Production outage root cause documented: deploy zip contained pnpm store-style dependency layout where `@azure/core-util` existed only under `.pnpm/...` and not at `node_modules/@azure/core-util`, causing Azure runtime `ERR_MODULE_NOT_FOUND` during function execution.
- Deploy packaging fix: workflow now installs production dependencies inside `api_deploy/`, then materializes workspace-hoisted deps via `cp -RL ../node_modules ./node_modules` so `api_deploy/node_modules/@azure/*` are real directories in the final zip artifact.
- Deploy guardrails now prioritize functional checks over strict symlink bans: staged artifact must contain `@azure/core-util`, `@azure/storage-common`, `@azure/storage-blob`, and pass import smoke checks before zip/deploy.
- CI deploy staging now writes a `dist/index.js` shim that imports `dist/api/src/index.js`, matching `api/package.json` `main` and restoring Azure Functions indexing so deployed functions appear in Portal.
- Workspace pnpm behavior note: `pnpm install --prod --frozen-lockfile --config.node-linker=hoisted` in `api_deploy/` may populate workspace-root `node_modules`; deploy flow now explicitly copies from `../node_modules` and dereferences symlinks for Azure runtime compatibility.
- Deploy staging now includes function folders for discovery + portable prod deps to avoid @azure module gaps.
- API prod deploy now stages a clean `api_deploy/` package root (host.json + package.json + built `dist/`) and installs production dependencies in-place via `(cd api_deploy && pnpm install --prod --frozen-lockfile --config.node-linker=hoisted)` before zip packaging.
- Deploy workflow now validates the staged runtime by importing `@azure/storage-blob` from `api_deploy/` so transitive packages such as `@azure/core-rest-pipeline` are present in the artifact.
- Zip packaging now archives `api_deploy` (app root at zip root) and post-deploy smoke test now calls `POST /api/group/join` and fails only on HTTP 500, directly guarding against runtime module-load failures.
- Flex Consumption API deploy no longer sets `FUNCTIONS_WORKER_RUNTIME`; workflow now relies on platform-managed runtime settings to avoid appsettings rejection during deploy.
- Root cause (Flex function discovery): deploy archive was packaged with the wrong zip root, so `host.json` and function folders (`chat/`, `direct/`, `groupCreate/`, etc.) were not positioned at the archive root for indexing.
- Root cause (Function indexing regression): `api_deploy/` staging omitted function trigger folders (`chat/`, `groupJoin/`, etc.), so Azure Functions could not discover/index triggers even though dependencies were present.
- Fix applied: deploy workflow now copies every `api/*/` folder containing `function.json` into `api_deploy/`, packages **only** `api_deploy/` into `api.zip`, and validates trigger presence before deploy.
- Smoke test hostname fix: deploy workflow no longer hardcodes `familyscheduler-api-prod.azurewebsites.net` (which could be non-resolving); it now queries Azure for `defaultHostName` via `az functionapp show` and builds `FUNCTION_APP_URL` dynamically before curl checks.
- Verify step robustness: previous deploy verification could fail with empty `APP_HOST`; workflow now prints Azure context + RG app listing, explicitly guards for empty hostname, dumps raw `az functionapp show` JSON on failure, and exits with a clear error before curl checks.
- Workflow verify-step Azure context hardening: deployment now prints Azure account/subscription debug context immediately after `azure/login`, forces subscription `99690a90-d117-4c79-bf85-bd491615b10d`, and keeps verify-step RG function app listing to prevent CLI context/subscription mismatch failures.
- Deploy verify host resolution fix: Function App smoke-check now resolves host via `az functionapp show --query "properties.defaultHostName"` (Flex shape), falls back to `properties.hostNames[0]` when empty, and builds `FUNCTION_APP_URL` from the resolved host.
- Rule-mode chat is now hard-routed in `/api/chat`: when `ruleMode` is `draft` or `confirm`, the handler runs rules-only parsing, never returns `kind:"question"`, rejects appointment/disallowed actions with deterministic `draftError`, and does not fall through to generic chat.
- Rules-only OpenAI prompt now uses `buildRulesOnlyPrompt(...)` with strict instructions: availability rules only, no appointments, no follow-up questions, missing time => all-day, and mode-locked action type output.
- Rules modal state/handlers now use `rulePrompt`, `ruleDraft`, `ruleDraftError`, `isDrafting`, and `isConfirming`; Draft performs exactly one `/api/chat` call and treats any `kind:"question"` as a user-facing draft error without rendering question chips.
- Rules modal Confirm button is now enabled only when a valid draft with `draftRules.length > 0` exists (and not currently confirming).
- People table action icons are verified to render in order `Rules`, `Edit`, `Delete` with exactly three buttons per row.
- Draft/confirm verification focus: use prompt like “I am busy tomorrow”, confirm draft reply contains either `draftRules` or `draftError`, and verify snapshot has no appointment mutations until Confirm is clicked.


- People table actions now render exactly three non-wrapping icons in stable order: Rules (clock icon), Edit person, Delete person; aria-labels/tooltips align with those labels.
- People action cells now use `.actions-cell` + `.action-icons` nowrap styles, and icon buttons are fixed-size flex items to prevent wrapping on desktop widths.
- Rules detail rows now use `rules-row` and `rules-indent` for visual nesting; rule lines are compact flex rows with no-wrapping metadata and right-aligned grouped rule actions.
- Manual UI checks for this patch: open People view, confirm icon order/labels and no wrap at typical desktop width, then expand a person with rules and verify indentation + compact alignment.

- Rules modal is now single-shot for rule drafting: prompt + Draft/Confirm/Cancel only, no rule-mode question chips/free-text loops; Draft overwrites prior proposal and Confirm stays disabled until a valid draft exists.
- `/api/chat` ruleMode draft/confirm now hard-rejects question/invalid/non-rule model outputs and returns deterministic `{ kind: "reply", draftError }`; both modes require `personId`, and confirm requires `promptId`.
- Rule-mode prompt instructions now force availability-only proposals, default missing times to all-day, and encourage assumptions/warnings instead of follow-up questions.
- Rule confirm now applies overlap replacement + same-status normalization per person before insert, then enforces max 20 normalized interval rules per person (`rule_limit_exceeded` on overflow).
- Rules modal copy/layout refreshed: prompt area now uses "Availability rule" + helper text, sections are structured (header/prompt/actions/preview), actions are right-aligned, and draft preview is rendered in a bordered output panel for readability.
- `/api/chat` now supports rule-focused AI parsing when `ruleMode` is `draft` or `confirm`; `personId` is required and rule-mode responses reject appointment flows by forcing rule-only prompts and a deterministic clarification fallback when required rule fields are missing.
- Rules modal now handles `kind: "question"` from rule drafting: users can answer via options or free text, then re-submit draft requests with the same trace ID until a draft preview is produced.
- BYO API routing is now enforced at web build-time via `VITE_API_BASE_URL` pointing to the dedicated Function App URL.
- SWA-managed API deployment is disabled in both SWA workflows (`api_location: ""`), so web traffic no longer depends on SWA `/api/*` routing.
- API storage mode is Blob-only via Managed Identity (`DefaultAzureCredential`) using `STORAGE_ACCOUNT_URL` + `STATE_CONTAINER` (+ optional `STATE_BLOB_PREFIX`).
- Removed SAS/local storage toggles from runtime config (`BLOB_SAS_URL`, `STORAGE_MODE`, `LOCAL_STATE_PREFIX`) and removed LocalFileStorage implementation.
- Added centralized fail-fast config error envelope with trace IDs: `{ ok:false, error:"CONFIG_MISSING", message, traceId, missing[] }`.
- `/api/chat` error classification now differentiates config/storage failures from OpenAI upstream failures (only true upstream failures map to `OPENAI_CALL_FAILED`).
- Added a pre-flight planning brief for multi-select availability date ranges at `docs/multi-select-date-range-preflight.md`, documenting current constraints and recommended v1 decisions before implementation.
- Web deploy workflow now injects `VITE_BUILD_SHA=${{ github.sha }}` and `VITE_BUILD_TIME=${{ github.run_id }}-${{ github.run_number }}` into the SWA Oryx build step, so every main-branch run bakes unique build metadata into the Vite bundle.
- Web UI now reads build metadata from `apps/web/src/lib/buildInfo.ts` and renders an always-visible footer stamp: `Build: <sha7> <time>`.
- Production verification is now explicit: after a main merge, open the app footer and confirm the SHA prefix matches the commit that triggered the GitHub Actions `Deploy Web (SWA)` run.
- SWA web deploy workflow now uses an Oryx-compatible API build override (`npm --prefix api run build`) while keeping `api_location: api` enabled.
- SWA deploy trigger is now push-only on `main` (no `pull_request` trigger) to prevent automatic preview/staging environment creation and avoid SWA staging quota exhaustion blocking production deploys.
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



### UI Structure (CODEX-003)
- Added reusable Page layout component
- Added PageHeader component
- Added FooterHelp component
- No page migrations yet


### Join Gate UX (CODEX-004)
- Join page moved to Form layout
- Added PageHeader + FooterHelp
- Shows group name (when available) and group ID as metadata
- Button no longer spans full width
- Improved error copy


### Create Group UX (CODEX-005)
- Create page moved to Form layout with header + guidance
- Shows share link prominently after creation with Copy button
- Displays group name + group ID with proper hierarchy
- Added “Next steps” checklist + help footer


### Workspace UX + Polish (CODEX-006/007/008)
- Appointments page migrated to workspace layout with header/footer and empty state
- Prompt/notes uses multiline textarea in edit mode with auto-grow
- People page migrated to workspace layout with access clarity, empty state, and monospace phone display
- Replaced “Add blank row” with “Add Appointment” / “Add Person”
- Standardized button labeling and avoided full-width buttons

### UI Polish (CODEX-002)
- Replaced default Vite favicon with minimal calendar SVG
- Set browser title to “Family Scheduler”

### UI Baseline (CODEX-001)
- Added global ui.css design tokens
- Installed and imported Inter font
- Standardized typography, spacing, controls
- No layout/page changes yet

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

- 2026-02-22: Fixed scan time mapping so parsed date/time now populates canonical `time.intent` + `time.resolved` (with computed `startUtc`/`endUtc`) in addition to legacy timed fields; scan rows now resolve the Schedule **When** column instead of remaining `Unresolved` when scan parsing finds concrete date/time.
- 2026-02-22: Fixed scan UX and scan field population deterministically. Frontend: scan viewer modal now constrains image content with contained sizing; appointment Actions icons now align in a fixed-width right-aligned flex container; camera icon renders only when `scanImageKey` exists; rescan is wired to the same scan capture flow as Scan Appointment and uses camera preview via `getUserMedia` when available (falling back to file input) without `label/htmlFor`-driven file picker coupling. Backend: scanned appointment defaults are now empty-field defaults (blank title/location/notes/date, no forced all-day), added `scanAutoDate` to treat scan-initial date placeholders as empty-equivalent, and updated parse application to normalize `startTime` vs `isAllDay` while preserving fill-only-empty behavior for initial scans and overwrite behavior for rescans.
- 2026-02-22: Added `directVersion` response stamping across `/api/direct` for deployment verification, expanded `resolve_appointment_time` contract with `usedFallback`/`fallbackAttempted`/`fallbackError`, switched resolve logging to one Kusto-friendly structured line gated by `TIME_RESOLVE_LOG_ENABLED=1`, and made OpenAI fallback failures return explicit `ok:false` 502 responses without masking errors.
- 2026-02-22: Added `/api/direct` appointment-time preview fallback resolver for natural-language text (for example, "tomorrow at 1pm"): deterministic `parseTimeSpec()` still runs first, and OpenAI fallback is attempted only when unresolved and `TIME_RESOLVE_OPENAI_FALLBACK=1`. OpenAI fallback errors now return `ok:false` with explicit error codes (`OPENAI_NOT_CONFIGURED`, `OPENAI_CALL_FAILED`, `OPENAI_BAD_RESPONSE`) instead of being masked as missing date hints. Added optional structured telemetry for resolve-time requests behind `TIME_RESOLVE_LOG_ENABLED=1` (traceId, appointmentId, timezone, whenText, usedFallback, finalStatus, missing). Known limitation: single-point fallback results intentionally do not invent duration and may omit `endUtc` with assumption "No duration provided.".
- 2026-02-22: Added appointment camera-scan MVP flow with private-blob image storage + backend proxy endpoints (`/api/scanAppointment`, `/api/appointmentScanImage`, `/api/appointmentScanDelete`, `/api/appointmentScanRescan`). Appointment rows now include scan metadata (`scanStatus`, `scanImageKey`, `scanImageMime`, `scanCapturedAt`), images are stored at `familyscheduler/groups/<groupId>/appointments/<appointmentId>/scan/scan.<ext>`, first-scan AI fill only populates empty fields, and rescan overwrites extracted fields wholesale. Added best-effort `deleteAfter` blob metadata (~180 days) for lazy cleanup later.
- 2026-02-21: Tightened helper text spacing under the Schedule action prompt so the two guidance lines render as one compact muted block with ~8px top separation from input and ~2px internal gap (no paragraph-default margins).
- 2026-02-21: Unified workspace header metadata across People/Appointments panes: group name is now primary heading, pane title is secondary, shareable group app-link (`/#/g/<groupId>/app`) is shown with copy control and helper text, and duplicated People-only access text was removed from body content. Appointment assignment availability now resolves by UTC interval overlap (including multi-day rules), and People rule rows now render human-readable date/time ranges (no raw minute suffixes and no `UTC` suffix in UI).
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

- Function startup instrumentation is available in `api/src/index.ts`; set `FUNCTIONS_STARTUP_DEBUG=true` to emit `component=api-startup` JSON logs for entrypoint load and route registration diagnostics.
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

### Appointments UX (CODEX-006)
- Appointments page moved to Workspace layout with header + footer.
- Added empty state panel with Add Appointment CTA.
- Prompt/notes field uses multiline textarea in edit mode with auto-grow.
- Buttons no longer span full width.

### Workspace Layout Normalization (CODEX-009)
- Workspace pages now use centered wide container (max-width 1200px)
- Added horizontal scroll wrapper for tables
- Removed duplicate headings for cleaner hierarchy

## Recent update (2026-02-20 21:15 UTC)

- Updated `.github/workflows/deploy.yml` Azure auth to use `azure/login@v2` with `creds: ${{ secrets.AZURE_CREDENTIALS }}`.
- `deploy-api-prod` now expects repository secret `AZURE_CREDENTIALS` containing JSON fields: `clientId`, `clientSecret`, `tenantId`, `subscriptionId`.
- Deploy job steps after login are unchanged (runtime setting + zip deploy mechanics remain the same).

## Recent update (2026-02-20 00:44 UTC)

- Added a deploy workflow guard step that explicitly sets `FUNCTIONS_WORKER_RUNTIME=node` on the production Function App before zip deploy.
- This addresses host indexing cases where logs show `0 functions found (Custom)` due to missing/incorrect worker runtime app setting.
- Deployment artifact and command remain unchanged.

## Recent update (2026-02-20 01:20 UTC)

- Root cause captured: Azure Flex deploy package created on Windows via `Compress-Archive` contained backslash zip entries (`dist\index.js`), which can prevent Linux worker indexing and surface as `0 functions found (Custom)`.
- Permanent packaging fix (superseded by latest update): switched from Windows `Compress-Archive` to deterministic scripted packaging and zip verification to guarantee `dist/index.js` and forward-slash entry paths.
- Added deterministic artifact verifier (`pnpm deploy:api:verifyzip`) requiring `host.json`, `package.json`, and `dist/index.js` in the deploy archive.
- Local ship script now runs zip verification before `az functionapp deployment source config-zip`.
- Deploy workflow now includes both tooling and CI guard checks that fail if zip entries include `\` or if `dist/index.js` is missing.

## Recent update (2026-02-20 00:00 UTC)

- Fixed Azure Flex deployment packaging path: deploy artifact root is now the `api/` runtime shape (`host.json`, `package.json`, `dist/**`, runtime `node_modules/**`) so host indexing can load Node v4 registrations from `dist/index.js`.
- Added deterministic packaging script: `node scripts/package-api-deploy.mjs` (invoked by `pnpm deploy:api:package`).
- Added one-step ship script: `bash scripts/ship-api.sh` to install, build, package, and zip-deploy to `familyscheduler-api-prod` in `familyscheduler-prod-rg`.
- Replaced previous Static Web Apps deploy workflow with Functions Flex deploy workflow (`.github/workflows/deploy.yml`) that builds on GitHub runner (pnpm), installs production deps in the artifact via npm, then deploys zip with Azure CLI (no remote pnpm requirement).

### Azure resources (prod)

- Resource group: `familyscheduler-prod-rg`
- Function App: `familyscheduler-api-prod`
- Plan: Flex Consumption (Linux)
- Runtime: Node.js 22

### Deployment method (chosen)

- Preferred: GitHub Actions workflow `.github/workflows/deploy.yml` (environment: `prod`)
- Local/manual fallback: `pnpm deploy:api:ship`

### Required environment variables (Function App)

- `STORAGE_MODE=azure`
- `BLOB_SAS_URL=<secret>`
- `STATE_BLOB_PREFIX=familyscheduler/groups` (default if omitted)
- `FAMILY_PASSKEY=<secret>`
- `TOKEN_SECRET=<secret>`
- `OPENAI_API_KEY=<secret>`
- `OPENAI_MODEL=<model-name>`
- Optional: `DEFAULT_COUNTRY=US`, `OPENAI_PARSER_ENABLED`, `LOCATION_AI_FORMATTING`

### Known issues / next steps

- Verify first post-fix deploy in Azure Portal: Functions list should show `chat`, `direct`, `groupCreate`, `groupJoin`, `groupMeta`.
- Confirm host logs no longer report `0 functions found (Custom)`.
- Add a dedicated post-deploy smoke-test job (curl against `/api/group/meta`) after prod credentials/policies are finalized.


## Recent update (2026-02-20 00:58 UTC)

- Added Azure Functions startup instrumentation in `api/src/index.ts` with structured JSON logs (`component=api-startup`) for entrypoint load + per-route registration.
- Added optional startup diagnostics behind `FUNCTIONS_STARTUP_DEBUG=true` to log module path, cwd, and deploy artifact existence checks (`dist/index.js`, `host.json`, `package.json`).
- Updated runbook troubleshooting for `0 functions found (Custom)` with concrete App Settings and expected log signals.

## Recent update (2026-02-20 00:57 UTC)

- Clarified startup diagnostics to avoid false expectations: the API should register exactly 5 functions (`groupCreate`, `groupJoin`, `groupMeta`, `chat`, `direct`) and now emits a `registration-summary` startup log with expected vs actual count.
- Expanded the runbook with an explicit “what to share” checklist when Azure still reports `0 functions found (Custom)`.

## Recent update (2026-02-20 04:55 UTC)

- Synced `pnpm-lock.yaml` with `apps/web/package.json` after adding `@fontsource/inter@^5.2.6`, so frozen-lockfile installs now pass in CI.
- Verified workspace install succeeds with `pnpm install --frozen-lockfile` across all 4 workspace projects.
- No runtime behavior changes; this is dependency metadata alignment only.

## Recent update (2026-02-20 06:15 UTC)

- Replaced API deploy zip creation with Node-only tooling in `scripts/package-api-deploy.mjs` (shared utilities in `scripts/zip-utils.mjs`) to avoid platform-specific archive behavior and keep Windows + GitHub Actions packaging consistent.
- Packaging flow now always stages `api/host.json`, `api/package.json`, and `api/dist` into `.artifacts/deploy/api-package`, then copies production `node_modules` from `pnpm --filter @familyscheduler/api deploy --prod`.
- Added packaging invariant self-test + standalone verifier script requiring `host.json`, `package.json`, `dist/index.js`, and `dist/functions/groupCreate.js` in `.artifacts/deploy/familyscheduler-api.zip`.
- Added `.github/workflows/swa-web.yml` for deterministic SWA deploys (build with pnpm first, then upload prebuilt `apps/web/dist` with `skip_app_build: true`).
- Runbook now includes exact zip deploy command, post-deploy verification commands (`az functionapp function list`, `group/meta`, `group/create`), and a PowerShell 400 error-body snippet.



## Recent update (prod 405 fix: web API routing)

- Root cause: Azure Static Web Apps deploy is configured with `api_location: ''`, so `https://<swa-domain>/api/*` is not served by this repo’s Function App code. Web requests to SWA `/api/group/create` could therefore hit a non-matching endpoint and return `405`.
- Fix selected: Option A (minimal-risk) — web now resolves API URLs via `VITE_API_BASE_URL` and targets the deployed Function App host in production.
- Local behavior preserved: when `VITE_API_BASE_URL` is unset in dev, web still uses relative `/api/*` and Vite proxy to `http://localhost:7071`.
- Safety guard: production startup now throws a clear error if `VITE_API_BASE_URL` is missing.
- Deployment wiring: `.github/workflows/swa-web.yml` now injects `VITE_API_BASE_URL` from GitHub secret `VITE_API_BASE_URL` during the web build.

### Verification notes

- Local build succeeds for web after URL-routing changes.
- Expected prod signal after deploy: browser network request for Create Group should be `POST https://familyscheduler-api-prod.azurewebsites.net/api/group/create` (or configured Function App host), no longer `POST https://<swa-domain>/api/group/create`.
- Expected outcome: request no longer returns `405`, and group creation response includes expected fields (`groupId`, etc.).

## Recent update (2026-02-20 07:05 UTC)

- Disabled auto-generated SWA workflow `.github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml` triggers (manual `workflow_dispatch` only) because it conflicted with `.github/workflows/swa-web.yml` and caused canceled deployments.



## Recent update (2026-02-20 07:34 UTC)

- Updated `.github/workflows/swa-web.yml` so Azure Static Web Apps builds from `apps/web` source (`app_location: apps/web`, `output_location: dist`, `skip_app_build: false`) instead of uploading prebuilt `apps/web/dist` artifacts.
- Removed the explicit web build step from the workflow to prevent stale `dist` deployments.
- Kept workflow triggers/tokens unchanged and retained `VITE_API_BASE_URL` configuration assertion.

## Recent update (2026-02-20 07:41 UTC)

- Root cause: production Create Group was coupled to an external Function App hostname (`familyscheduler-api-prod.azurewebsites.net`) that failed DNS resolution in-browser (`ERR_NAME_NOT_RESOLVED`), while SWA `/api/*` was not attached to this repo API and could return placeholder `405` behavior.
- Fix: updated `.github/workflows/swa-web.yml` to attach the repo API via SWA integrated Functions (`api_location: api`) and enabled API build in deploy (`api_build_command`, `skip_api_build: false`) so `/api/group/create` resolves to this repository’s function implementation.
- Fix: updated `apps/web/src/lib/apiUrl.ts` so `VITE_API_BASE_URL` is optional in both dev and prod; if unset, frontend defaults to same-origin relative `/api/*` calls.
- Workflow interference status: existing competing auto-generated SWA workflow remains manual-dispatch only; no automatic competing deploy trigger was re-enabled.

### Verification notes

- Expected production network call after deploy: `POST https://<swa-domain>/api/group/create` (same-origin), not external Function App hostname.
- Expected response signal: non-405 status (e.g., 200/4xx/5xx based on payload), and no `Allow: GET, HEAD, OPTIONS` placeholder signature.


## Recent update (2026-02-20 08:00 UTC)

- Updated `.github/workflows/swa-web.yml` triggers to remove `pull_request` runs; workflow now deploys only on `push` to `main`.
- Rationale: SWA preview/staging environment quota can block deploys when PR environments accumulate; push-only deploy keeps production deployment path reliable.
- Operational note: if PR previews are re-enabled later, add an explicit cleanup process for stale SWA staging environments.


## Recent update (2026-02-20 08:29 UTC)

- Root cause for SWA `/api/chat` 404: the repository still contained a legacy SWA workflow (`.github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml`) that deployed with `api_location: ""`, so integrated Functions routes were not packaged from `api/` when that workflow was used.
- Fix: updated the legacy SWA workflow to deploy the API (`api_location: "api"`, `api_build_command: "npm run build"`, `skip_api_build: false`) and made its job condition include `workflow_dispatch` so manual runs actually execute.
- Verified API route registration source: `api/src/index.ts` registers `chat` as `route: "chat"` with method `POST` (SWA exposes as `/api/chat`).
- Added non-PII invocation log in `chat` handler and OpenAI request lifecycle logs (traceId, status, latency only) for fast production diagnosis.

### Verification notes

- Build signal: `pnpm --filter @familyscheduler/api build` succeeds and emits `api/dist/index.js` with `registerHttp('chat', 'chat', ['POST'], chat)`.
- Test signal: `pnpm --filter @familyscheduler/api test` passes existing API chat tests.
- Post-deploy App Insights KQL (expect 200s for `/api/chat`):

```kusto
requests
| where timestamp > ago(30m)
| where url endswith "/api/chat"
| project timestamp, resultCode, success, url, operation_Id
| order by timestamp desc
```

- Optional failure drilldown by trace ID (from API logs):

```kusto
traces
| where timestamp > ago(30m)
| where message has "chat invoked" or message has "openai request"
| project timestamp, message, customDimensions
| order by timestamp desc
```

## Recent update (2026-02-20 08:38 UTC)

- Root cause for SWA `POST /api/chat` 404: API code relied on Azure Functions Node v4 code-first registration (`api/src/index.ts`) and emitted only `dist/**` JS artifacts, but SWA integrated Functions indexing expects discoverable function directories with `function.json` metadata under `api_location`.
- Resolution: added explicit Azure Functions descriptors for all HTTP routes (`api/chat/function.json`, `api/direct/function.json`, `api/groupCreate/function.json`, `api/groupJoin/function.json`, `api/groupMeta/function.json`) pointing to compiled handlers in `dist/functions/*.js`.
- Confirmed `chat` route metadata is explicit (`route: "chat"`, `methods: ["post"]`, `entryPoint: "chat"`) so SWA can expose `/api/chat`.
- Workflow alignment: kept SWA deploy workflow using `api_location: api` with `api_build_command: npm run build` so deployment includes both function descriptors and compiled runtime output.

### Verification notes

- Build signal: `pnpm --filter @familyscheduler/api build` passes and emits `api/dist/functions/chat.js`.
- Test signal: `pnpm --filter @familyscheduler/api test` passes all API tests.
- Route metadata signal: `api/chat/function.json` exists with route `chat` and entryPoint `chat`.
- Environment limitation: Functions Core Tools are not installed in this environment (`func: command not found`), so local HTTP smoke (`POST http://localhost:7071/api/chat`) and SWA portal blade validation must be run in CI/Azure.

## Recent update (2026-02-20 09:10 UTC)

- Added `/api/diagnose/openai` HTTP endpoint (safe health probe) to verify OpenAI API key presence and model connectivity without logging secrets or raw model output.
- Added structured `/api/chat` diagnostics logs with `traceId`, route, hashed phone, message length, OpenAI pre-fetch metadata (`model`, `contextLen`) and post-fetch metrics (`status`, `latencyMs`).
- Added structured OpenAI exception logs from chat (`errorName`, `errorMessage`, `statusIfAny`) to improve prod triage in Application Insights.
- Added OpenAI client helper for low-cost connectivity checks against OpenAI model metadata endpoint with timeout handling.
- Updated runbook with SWA-integrated Functions configuration requirements for `OPENAI_API_KEY`, `OPENAI_MODEL`, and optional `LOCATION_AI_MODEL`, plus KQL snippets for `/api/chat`, OpenAI dependencies, and trace correlation.
- Added production validation sequence for `/api/diagnose/openai` + `/api/chat` trace/dependency verification.

## Recent update (2026-02-20 UTC)

- Deployment instrumentation: build version stamp added.
- Web now exposes non-sensitive build metadata from Vite env (`VITE_BUILD_SHA`, `VITE_BUILD_TIME`) and renders `Version: <7-char SHA> · <build time token>` in a low-opacity bottom-right footer for production deploy verification.
- SWA web workflow now injects build metadata from GitHub Actions context before app build (`github.sha`, `github.run_number-github.run_id`) so each deploy gets a deterministic visible stamp.
- Root cause note (redeploy verification): prior production validation had no deterministic, user-visible build identifier, so deployments could complete without an easy way to confirm which commit was live.

## Production redeploy verification (post-merge)

1. Open the production site and look at the bottom-right version label.
2. Confirm the SHA shown in UI matches the first 7 characters of the merge commit SHA from GitHub.
3. Trigger the next deployment (new commit to `main`) and confirm the version label changes (SHA and/or build time token).
4. Confirm only non-sensitive metadata is displayed (7-char SHA prefix + run token), with no secrets or full env dumps.


## Build stamp deployment verification

1. Merge/push to `main` and wait for **Deploy Web (SWA)** workflow to finish successfully.
2. Open the production web app and look at the footer build stamp (`Build: <sha7> <runId-runNumber>`).
3. Compare `<sha7>` with the triggering commit SHA in GitHub Actions; they must match the same commit prefix.
4. For a manual redeploy without code changes, push an empty commit and confirm the new SHA appears in the footer.

## Recent update (2026-02-20 10:13 UTC)

- `/api/chat` now returns HTTP `502` (never `200`) when upstream OpenAI calls fail, with structured error payload: `{ "error": "OPENAI_CALL_FAILED", "message": "..." }`.
- OpenAI client now logs `openai_http_error` (status + response body truncated to 500 chars) for non-2xx responses, and logs `openai_call_failed` with sanitized error message before rethrowing.
- Chat handler now logs `chat_handler_failed` and surfaces upstream failures as 502 while preserving successful response behavior unchanged.
- Production verification: temporarily set an invalid `OPENAI_API_KEY`, invoke `POST /api/chat`, verify HTTP 502 and JSON payload above, and confirm App Insights includes either `openai_http_error` or `openai_call_failed` (and typically `chat_handler_failed`).

## Recent update (2026-02-20 12:20 UTC)

- Added rule-v2 draft/confirm server flow hooks in `/api/chat` with request fields `ruleMode`, `replacePromptId`, and `replaceRuleCode`, plus structured trace logging for interval counts/cap checks/warnings.
- Added v2 rule normalization/merge utility (`normalizeRulesV2`) for same-person + same-status + same-prompt overlap/adjacent interval merging.
- Added timezone fallback assumptions and max interval guardrail (`14 days`) in draft/confirm processing paths.
- Added per-person rule cap check (`20`) in confirm path, returning `RULE_LIMIT_EXCEEDED` without persisting on violations.
- Added draft overlap warnings to response payload (`warnings[]`) and wired web rule modal to display non-blocking warnings/preview with confirm enabled.
- Added legacy rule replacement UX hint and confirm wiring to send `replaceRuleCode` when replacing a rule that lacks `promptId`.
## Discovery update (2026-02-20 19:08 UTC)

- Completed feasibility discovery for “Photo -> Extract Appointment” in current SWA + BYO API topology.
- Confirmed active OpenAI integrations are `POST /api/chat` (planner parse via `chat/completions`) and `GET /api/diagnose/openai` (model endpoint connectivity check).
- Confirmed optional location enrichment path uses OpenAI only through server-side action execution when `LOCATION_AI_FORMATTING=true`.
- Confirmed SWA workflows are configured for BYO API (`api_location: ""`, `skip_api_build: true`), so backend changes for image extraction must deploy to external API host, not SWA-managed `/api` build artifacts.
- Confirmed web client API helper uses `VITE_API_BASE_URL` override and currently sends only JSON `content-type` (no `Authorization` header).
- Added detailed discovery notes at `docs/discovery-photo-extract-appointment-feasibility.md`.

- 2026-02-20: Fixed TS2322 in `api/src/functions/chat.ts` where `RuleRequestItem.status` was inferred as `string`; replaced defaulting behavior with runtime validation + explicit type narrowing (`available`/`unavailable`) and a strict HTTP 400 `invalid_rule_status` response that returns early.
- Verification command used: `pnpm --filter @familyscheduler/api build` (currently blocked in this environment by missing Azure SDK modules: `@azure/identity`, `@azure/storage-blob`).

## Recent update (2026-02-21 00:43 UTC)

- Root cause: API deploy artifact had incomplete production `node_modules` (missing transitive Azure packages), which caused Azure Functions runtime `ERR_MODULE_NOT_FOUND` at startup (`@azure/storage-common`, then `@azure/core-util`) and surfaced as HTTP 500.
- Fix: in `.github/workflows/deploy.yml`, removed portable deploy/copy flow (`pnpm deploy --legacy --prod ./api_deploy_install` + node_modules copy), copied `pnpm-lock.yaml` into `api_deploy/`, and now runs `pnpm install --prod --frozen-lockfile` *inside* `api_deploy` before zipping.
- Guardrails: added hard directory assertions for `@azure/storage-blob`, `@azure/storage-common`, and `@azure/core-util` directly inside `api_deploy/node_modules`; added runtime ESM import checks for all three packages with explicit success markers.

## Verification for Azure transitive dependency runtime fix

1. Run GitHub Actions workflow **Deploy API (prod)** from `main`.
2. In workflow logs, confirm all lines appear during staging validation:
   - `storage-blob-import-ok`
   - `storage-common-import-ok`
   - `core-util-import-ok`
3. After deployment, call `POST /api/group/join` and confirm response status is non-500.
4. In Azure Portal/App Insights, confirm new exceptions no longer show `ERR_MODULE_NOT_FOUND` for `@azure/storage-common` or `@azure/core-util`.

## Recent update (2026-02-21 00:55 UTC)

- Deploy workflow staging validation now uses `set -x` plus explicit `CHECK ...` / `IMPORT ...` log markers in the `Validate deploy staging directory` step.
- Validation now also prints the first 20 symlinks found in `api_deploy/node_modules` before enforcing the strict `no symlinks` assertion.
- Operational impact: when Deploy API (prod) fails in staging validation, the final printed marker identifies the first failing check/import for faster diagnosis.

## Recent update (2026-02-21 01:16 UTC)

- Fixed deploy staging install-path diagnostics in `.github/workflows/deploy.yml`: after `cd api_deploy` + `pnpm install --prod --frozen-lockfile --config.node-linker=hoisted`, debug logging now inspects `.`/`node_modules` and `../node_modules` (plus both `@azure` tops) using paths relative to the current working directory.
- Replaced incorrect post-install assertions that referenced `api_deploy/node_modules` while already inside `api_deploy`; install-step assertion now correctly enforces `test -d node_modules` in the current folder.
- Expected verification signal on next **Deploy API (prod)** run: logs will show whether dependencies were created under local `api_deploy/node_modules`, workspace root `../node_modules`, or both.

## Recent update (2026-02-21 02:08 UTC)

- Rule draft mode now normalizes missing model `personId` from request `personId` before rule-item parsing; confirm mode remains strict (no draft-style defaulting).
- Draft-mode failures now return deterministic `draftError` metadata: `code`, `traceId`, and `details` (`MODEL_QUESTION`, `DISALLOWED_ACTION`, `ZERO_VALID_RULE_ITEMS`, `ZERO_INTERVALS`, `SCHEMA_VALIDATION_FAILED`).
- Added structured draft-failure log event `rule_mode_draft_fail` including `{ rulesDraftFail, traceId, code, incomingRulesCount, validRuleItemsCount, intervalsCount, modelKind, actionType }` for fast diagnosis.
- Added optional env-flagged raw rules-model logging (`RULES_DRAFT_DEBUG_RAW=1`) tied to traceId for development debugging.
- Rules modal now surfaces `draftError.code` and `draftError.traceId` under the draft error text when present.

## Recent update (2026-02-21 UTC)

- Rules modal UX update shipped in web app: prompt textarea and Draft button are now grouped in one composer card, redundant helper sentence removed, preview now renders styled rule chips (status + UTC range + optional all-day indicator), and Confirm stays disabled until a successful draft produces at least one proposed interval.
- Confirm gating is defensive in both UI state and click handler (`hasProposedRules`), so draft errors never enable Confirm.
- Cancel behavior and People/Appointments panes were intentionally left unchanged.

## Recent update (2026-02-21 04:36 UTC)

- Updated `apps/web/src/styles/ui.css` workspace container sizing so `.fs-workspaceWrap` keeps centered `max-width: 1200px` and now uses wider horizontal page padding (`32px` desktop, `16px` on <=640px).
- Replaced Schedule/People add CTAs in `apps/web/src/AppShell.tsx` with a reusable circular 40x40 `+` FAB component for both header actions and empty-state actions.
- Tightened People rules spacing by reducing rules-row top/bottom spacing and compacting per-rule list/item spacing in `apps/web/src/styles.css`.

- 2026-02-21: Replaced Schedule/People header Add FABs with table-footer style CTA rows (including empty-state wording updates) so add actions stay visible and avoid global button style collisions; added dedicated `.fs-tableCtaRow`/`.fs-tableCtaBtn` styles with hard fallback link color (`#2563eb`).

## Recent update (2026-02-21 05:09 UTC)

- Compacted `PageHeader` spacing so the group name, group link row, and “This link is required…” explainer render as one tight vertical unit.
- Replaced ad-hoc inline spacing in `PageHeader` with dedicated CSS classes (`fs-groupBlock`, `fs-groupLinkRow`, `fs-groupExplain`, `fs-headerMeta`) to avoid default element margin drift.
- Preserved readable micro-separation between lines (~2–4px) while keeping a slightly larger gap before Schedule/People controls.

## 2026-02-21 — TimeSpec v2 end-to-end pass (API + UI)
- Added shared `TimeSpec` / `TimeIntent` / `ResolvedInterval` definitions and wired API + web snapshots to use `time` as the canonical source.
- Added deterministic server-side parsing/normalization utility for date-only/all-day, fuzzy windows, relative windows, unresolved handling, range normalization assumptions, and bounded evidence snippets.
- Updated action execution paths to write `schemaVersion: 2` + `time` on touched appointments/rules, allow unresolved appointments, and block unresolved rules with explicit confirm error.
- Updated appointment list rendering/sorting to prioritize unresolved items and show unresolved badge + unreconcilable availability labels.
- Updated TIME_DATE_SPEC to v1.1 to document removal of implicit duration defaults.


## Recent update (2026-02-21 20:04 UTC)

- Fixed deploy artifact path assumptions: CI and packaging validations now assert compiled API entrypoints at `dist/api/src/index.js` and `dist/api/src/functions/*.js` instead of legacy `dist/index.js`/`dist/functions/*`.
- Packaging/build output format was left unchanged; only invariant checks were aligned to the actual TypeScript emit layout so deploy validation matches runtime artifacts.

## Recent update (2026-02-21 20:20 UTC)

- Fix: deploy packaging now writes a `dist/index.js` ESM shim (`import './api/src/index.js';`) into the staging artifact so Azure Functions can load `package.json#main` while preserving the existing TypeScript emit layout under `dist/api/src/**`.
- Packaging invariant checks now require both `dist/index.js` (shim) and `dist/api/src/index.js` (actual compiled entry), plus existing function file checks, to prevent regressions.
- Deploy workflow staging validation now checks `api_deploy/dist/index.js` in addition to `api_deploy/dist/api/src/index.js`.

## Update: 2026-02-21 UTC (SWA production deploy target + post-deploy guard)

- Updated `.github/workflows/swa-web.yml` SWA CLI deploy command to deploy the built folder directly (`apps/web/dist`) with `--env production --verbose` and no `--app-location/--output-location` flags.
- Added a hard post-deploy verification step that fetches production HTML and fails if `/assets/` is missing or `/src/main.tsx` is still present.
- Behavior change: the workflow now explicitly enforces that production serves built assets after deploy.

- API deploy packaging no longer relies on a `dist/index.js` shim; `api/package.json` now points `main` to the actual TypeScript emit at `dist/api/src/index.js`, preventing Azure Functions indexing regressions where no functions were detected.

## 2026-02-22 update

- `/api/chat` now refreshes the authenticated active person's `lastSeen` on successful auth-gated requests (with a 60-second write threshold) and persists it through storage save.
- Chat snapshots now guarantee `people[*].lastSeen` with fallback order: `lastSeen` → `createdAt` → current server timestamp for legacy records.
- Added `GET /api/usage` endpoint returning deterministic default usage state payload (`unknown`, summary text, `updatedAt`).
- Web footer build line now includes a non-blank usage label: `Usage: loading…`, `Usage: unavailable`, or `Usage: <state> (<summary>)`.

## Update — 2026-02-22

- Implemented persisted daily usage metering for OpenAI chat calls with Azure Blob backing (`familyscheduler/usage/meter.json` by default), including success/error timestamps and token counters when present.
- `/api/chat` now records usage on successful OpenAI calls (general chat + rule-mode model path) and records last error metadata when an OpenAI call fails.
- `/api/usage` now returns computed deterministic states (`ok`, `warning`, `limit_reached`, `unknown`) using configurable limits:
  - `USAGE_DAILY_REQUEST_LIMIT` (default `200`)
  - `USAGE_DAILY_TOKEN_LIMIT` (default `200000`)
- Usage summary is always non-empty and includes request/token counters when available.
- Added backend tests for usage endpoint state transitions and chat usage metering hooks.

## 2026-02-21 — Schedule When-column UEX update
- Replaced appointment Date/Time/Duration columns with a single **When** column using compact TimeSpec labels and unresolved badge handling.
- Added per-row natural language **When** editor with Preview + Confirm + Cancel and preview-only assumptions/missing summary rendering.
- Added appointment Status cell behavior for unresolved rows (`Unreconcilable`, clickable to open When editor).
