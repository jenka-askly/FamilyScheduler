> **Outdated note:** TimeSpec AI parsing now uses the OpenAI Responses API (`/v1/responses`) structured output format (`text.format`).

# Discovery: Photo -> Extract Appointment feasibility in Azure Static Web Apps

Date: 2026-02-20

## A) Current OpenAI integration

### OpenAI-backed API routes/endpoints

1. `POST /api/chat`
   - Entry point: `chat` function.
   - OpenAI invocation path: `chat` -> `parseWithOpenAi` -> `parseToActions` -> `POST https://api.openai.com/v1/chat/completions`.
   - Request body contract accepted by route: `{ message, groupId, sessionId/header, traceId? }`.
   - Typical success response contracts are discriminated by `kind` and include an attached `snapshot`:
     - `{ kind: 'reply', assistantText, snapshot }`
     - `{ kind: 'question', message, options?, allowFreeText, snapshot }`
     - `{ kind: 'proposal', proposalId, assistantText, snapshot }`
     - `{ kind: 'applied', assistantText, snapshot }`

2. `GET /api/diagnose/openai`
   - Entry point: `diagnoseOpenAi` function.
   - OpenAI invocation path: `diagnoseOpenAiConnectivity` -> `GET https://api.openai.com/v1/models/{model}`.
   - Success response (200): `{ ok: true, model, hasApiKey: true, latencyMs }`
   - Failure response (503): `{ ok: false, model, hasApiKey, latencyMs?, lastError? }`

3. OpenAI usage without direct HTTP route exposure
   - `aiParseLocation` can call `POST https://api.openai.com/v1/chat/completions` for location normalization when `LOCATION_AI_FORMATTING=true`.
   - This is reached indirectly through action execution (`executeActions` -> `applyAppointmentLocation` -> `aiParseLocation`), including direct mutation flows.

### Where `OPENAI_API_KEY` is read

- `api/src/lib/openai/openaiClient.ts`
  - `parseToActions` reads `process.env.OPENAI_API_KEY` and throws if missing.
  - `diagnoseOpenAiConnectivity` reads `process.env.OPENAI_API_KEY` and returns a safe non-throwing diagnostic result when missing.
- `api/src/lib/location/aiParseLocation.ts`
  - `aiParseLocation` reads `process.env.OPENAI_API_KEY`; when missing it silently falls back to heuristic normalization.

### Error handling and non-200 behavior

- `/api/chat`:
  - For OpenAI upstream failures in-flight (`openAiCallInFlight=true`), handler catches and returns **HTTP 502** with payload:
    `{ ok: false, error: 'OPENAI_CALL_FAILED', message, traceId }`.
  - Non-OpenAI failures return typed errors (`400/403/404/409/500`) via `errorResponse` pathways.
  - OpenAI client logs non-OK OpenAI HTTP status and throws (`Error("OpenAI HTTP <status>")`), which bubbles to route-level catch.

- `/api/diagnose/openai`:
  - Does not throw for known OpenAI connectivity states; returns 200/503 with safe fields.
  - Timeout and fetch exceptions are converted to `lastError` strings.

- Location AI parsing:
  - `aiParseLocation` catches all OpenAI/parse errors and **does not throw**; it logs warning and returns deterministic fallback location.

### Signal relevant to image/vision feasibility

- All OpenAI calls currently target `chat/completions` text JSON mode or `models/{model}` diagnostics.
- No usage found of `responses`, `vision`, `image_url`, or `data:image` payload patterns in runtime code.

## B) SWA API wiring + routes

### Deployment wiring observed

- Both SWA workflows use `Azure/static-web-apps-deploy@v1` with:
  - `app_location: apps/web`
  - `output_location: dist`
  - `api_location: ""`
  - `skip_api_build: true`
- This indicates the SWA deployment is configured as **BYO API** (no SWA-managed `/api` function app build from this repo path during SWA deploy).

### API folder and route definitions present in repo

- There is a standalone `api/` Azure Functions project with `function.json` files for:
  - `chat`, `diagnose/openai`, `direct`, `group/create`, `group/join`, `group/meta`
- Code-first registrations in `api/src/index.ts` match those routes.
- No `staticwebapp.config.json`, `routes.json`, or `swa-cli.config.json` found in the repo root subtree searched.

## C) Frontend API call pattern + auth header

### Client helper

- Web app uses `apiUrl(path)` (`apps/web/src/lib/apiUrl.ts`):
  - If `VITE_API_BASE_URL` is set, prepends that base URL.
  - Otherwise sends relative path (e.g. `/api/chat`).

### Current API call style

- Calls are plain `fetch` from `App.tsx` and `AppShell.tsx`.
- Header usage is currently only `content-type: application/json` for POSTs.
- No `Authorization` header is sent by the web client today.
- Auth/identity is body-based (`groupId`, session identity, optional `traceId`) plus server-side membership checks.

## Feasibility readout for “Photo -> Extract Appointment” on current architecture

- Technically feasible with current architecture, but it requires:
  1. Extending request contract (likely `POST /api/chat` or a new `POST /api/extract-appointment`) to accept image input reference/payload.
  2. Updating OpenAI client path to a multimodal-capable payload format (not currently implemented).
  3. Updating frontend API call layer to submit image content and preserve current `groupId/session` auth model.
- Deployment-wise, because SWA workflows are BYO API (`api_location: ""`), backend changes for photo extraction must be deployed to the external API host alongside current `/api` endpoints.
