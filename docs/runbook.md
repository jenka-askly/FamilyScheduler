# Runbook

## 1. Local development setup (current)

### Prerequisites

- Node.js 20+
- pnpm 10+
- Azure Functions Core Tools v4 (`func` command)

### Run commands

```bash
pnpm install
cp api/local.settings.example.json api/local.settings.json
pnpm dev
```

If you see `Ignored build scripts: esbuild`, run `pnpm approve-builds`, allow `esbuild`, then re-run `pnpm install`.

What this starts:

- Web app (Vite) at `http://localhost:5173`
- Azure Functions API at `http://localhost:7071`

The web app proxies `/api/*` requests to the Functions host.

### Quick verification

1. Open `http://localhost:5173`.
2. Confirm transcript starts with `Type 'help' for examples.`.
3. Enter `hello` and press Enter.
4. Confirm assistant reply renders and no `unable to fetch reply` error appears.

## 2. API smoke test (without UI)

From `api/`:

```bash
pnpm run build
func start
```

Then from another shell:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:7071/api/chat" -ContentType "application/json" -Body '{"message":"hello"}'
```

Expected behavior:

- Functions startup output lists the `chat` HTTP function route.
- API returns JSON payload (not 404), for example:

```json
{
  "kind": "reply",
  "assistantText": "You asked: hello"
}
```

Validation failure behavior:

```json
{"kind":"error","message":"message is required"}
```


## 3. Troubleshooting

### Azure Functions shows `entry point dist/index.js does not exist`

If you see `entry point dist/index.js does not exist`, ensure the API build emits `api/dist/index.js` by setting `api/tsconfig.json` `rootDir` to `src` and `outDir` to `dist`.

This indicates a mismatch between the Azure Functions entrypoint expected by the host and the TypeScript build output layout under `api/dist`.

For this repo, `api/tsconfig.json` should emit `src/index.ts` to `api/dist/index.js` and `src/functions/chat.ts` to `api/dist/functions/chat.js`. If output lands under `api/dist/src/...`, Functions may fail to load the expected entrypoint.

Quick checks:

```bash
pnpm -C api run build
find api/dist -maxdepth 4 -type f
```

Expected files include:

- `api/dist/index.js`
- `api/dist/functions/chat.js`

The API build now runs a clean step first (`pnpm -C api run clean`) so stale `dist/` files do not mask entrypoint issues.

## 4. Local persistence (JSON state file)

The API now persists state to a local JSON file using optimistic concurrency.

- Default mode: `STORAGE_MODE=local`
- Default state file: `./.local/state.json` (resolved from repository root)
- Override path: set `LOCAL_STATE_PATH` in `api/local.settings.json`

### Reset / delete local state

Options:

1. Prompt command (confirm required):
   - Send `reset state`
   - Send `confirm`
2. Manual delete:

```bash
rm -f ./.local/state.json
```

The next API request recreates the file with empty seeded state.

### Conflict behavior

Each proposal stores the state ETag at proposal time. On `confirm`, the API checks whether the file changed.

- If unchanged, mutation is applied and written atomically.
- If changed, mutation is rejected with:
  - `State changed since proposal. Please retry.`
  - fresh appointments/availability snapshot

Recovery:

1. Re-run the original command to generate a new proposal.
2. Confirm again.


## 5. Storage modes

### Local mode (default, recommended for development)

- `STORAGE_MODE=local`
- `LOCAL_STATE_PATH=./.local/state.json`

Behavior:
- Uses local JSON file persistence.
- Uses file-hash ETag optimistic concurrency during confirm/apply writes.

### Azure Blob mode (recommended for staging/production)

Environment variables:

- `STORAGE_MODE=azure`
- `BLOB_SAS_URL=<container-sas-url-or-blob-sas-url>`
- `STATE_BLOB_NAME=state.json` (only used when `BLOB_SAS_URL` is container-level)
- Optional: `BLOB_KIND=container|blob` (current adapter auto-detects based on URL path; mostly for operator clarity)

SAS URL forms supported:

1. Container SAS URL (example):
   - `https://<account>.blob.core.windows.net/<container>?sv=...`
   - API will write/read blob `<STATE_BLOB_NAME>` in that container.
2. Blob SAS URL (example):
   - `https://<account>.blob.core.windows.net/<container>/state.json?sv=...`
   - API uses this blob directly and ignores `STATE_BLOB_NAME`.

High-level setup:

1. Create a storage account + blob container.
2. Generate a SAS token with read/write/create permissions for the desired scope (container or blob).
3. Configure API environment variables.
4. Start API and call `/api/chat`; first read initializes blob with default empty state if missing.


### Azure host shows `0 functions found (Custom)`

This means the Functions host booted, but your Node entrypoint did not register any HTTP handlers. Use the startup instrumentation added in `api/src/index.ts`.

1. Enable startup debug logs in your Function App settings (or `api/local.settings.json`):

```json
{
  "Values": {
    "FUNCTIONS_STARTUP_DEBUG": "true"
  }
}
```

2. Redeploy/restart, then inspect `Log stream` for JSON lines from `component=api-startup`:
   - `loading-functions-entrypoint`
   - `registered-function` (one line per route)
   - `startup-debug-enabled` (includes `modulePath`, `cwd`, and host/package existence checks)

3. Expected signal: at least one `registered-function` log per endpoint (`chat`, `direct`, `group/create`, `group/join`, `group/meta`).

4. If `registered-function` lines are missing:
   - verify the deployed package root contains `host.json`, `package.json`, `dist/index.js`, and `dist/functions/*.js`
   - verify `package.json` has `"main": "dist/index.js"`
   - verify your build output is not nested under `dist/src/`

5. Increase host log verbosity while debugging by setting:
   - `AzureFunctionsJobHost__logging__logLevel__default=Debug`
   - optional per-category: `AzureFunctionsJobHost__logging__logLevel__Host.Results=Trace`

6. If the host still shows `0 functions found (Custom)`, capture and share:
   - one `loading-functions-entrypoint` line
   - one `registration-summary` line (must report `expectedCount: 5` and `registeredCount: 5`)
   - any `startup-debug-enabled` line
   - output of `az functionapp config appsettings list -g <rg> -n <app> --query "[?name=='FUNCTIONS_WORKER_RUNTIME'||name=='WEBSITE_RUN_FROM_PACKAGE'||name=='FUNCTIONS_EXTENSION_VERSION'||name=='WEBSITE_NODE_DEFAULT_VERSION'].{name:name,value:value}"`
   - package top-level listing from `unzip -l <artifact>.zip | head -n 40`


### API deploy packaging invariant (Linux/Flex)

Use Node-based packaging only:

```bash
pnpm deploy:api:package
pnpm deploy:api:verifyzip
```

`pnpm deploy:api:package` now stages runtime files under `.artifacts/deploy/api-package`, installs production dependencies with `pnpm --filter @familyscheduler/api deploy --prod`, then writes `.artifacts/deploy/familyscheduler-api.zip` using an in-repo Node zip writer (`scripts/zip-utils.mjs`) to keep path separators deterministic across Windows/Linux.

Required zip-root/runtime invariant (enforced by script self-test + verify command):

- `host.json`
- `package.json` (must include `"main": "dist/index.js"`)
- `dist/index.js`
- `dist/functions/*.js`
- `node_modules/**` (production runtime dependencies)

Deploy command:

```bash
az functionapp deployment source config-zip \
  --name familyscheduler-api-prod \
  --resource-group familyscheduler-prod-rg \
  --src .artifacts/deploy/familyscheduler-api.zip
```

### Post-deploy verification (prod)

1) Confirm functions were indexed:

```bash
az functionapp function list -g familyscheduler-prod-rg -n familyscheduler-api-prod -o table
```

2) Invoke `GET /api/group/meta` (contract: `groupId` required, no `phone` parameter required):

```powershell
$host = "https://familyscheduler-api-prod.azurewebsites.net"
$hostKey = "<host-key>"
$groupId = "<group-id>"

Invoke-RestMethod -Method Get -Uri "$host/api/group/meta?groupId=$groupId&code=$hostKey"
```

3) Invoke `POST /api/group/create` (requires `groupName`, 6-digit `groupKey`, `creatorPhone`, `creatorName`):

```powershell
$host = "https://familyscheduler-api-prod.azurewebsites.net"
$hostKey = "<host-key>"
$body = @{
  groupName = "Family HQ"
  groupKey = "123456"
  creatorPhone = "+1 206-555-0100"
  creatorName = "Alex"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$host/api/group/create?code=$hostKey" -ContentType "application/json" -Body $body
```

4) Print full error body for 400 responses (PowerShell):

```powershell
try {
  Invoke-WebRequest -Method Post -Uri "$host/api/group/create?code=$hostKey" -ContentType "application/json" -Body '{"groupName":"","groupKey":"abc"}'
} catch {
  $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
  $reader.BaseStream.Position = 0
  $reader.DiscardBufferedData()
  $body = $reader.ReadToEnd()
  Write-Host "Status:" $_.Exception.Response.StatusCode.value__
  Write-Host "Body:" $body
}
```

### Azure mode troubleshooting

- `403` from blob calls: SAS token invalid, missing permission, or expired.
- `404` on initial read: expected if blob does not exist yet; API attempts auto-init create-if-missing.
- `412` on write: optimistic concurrency conflict (`If-Match` failed); user should retry and confirm again.
- `409`/`412` on init create-if-missing are treated as already-exists success conditions by the API.

## 6. Storage verification scenarios

### A) Local regression

1. Set local env:
   - `STORAGE_MODE=local`
2. Run:
   - `pnpm dev`
3. In UI/API:
   - `add appt Family dinner`
   - `confirm`
4. Restart `pnpm dev`.
5. Verify `list appointments` still includes the saved appointment.

### B) Azure manual verification (real SAS required)

1. Set env for API process:
   - `STORAGE_MODE=azure`
   - `BLOB_SAS_URL=...`
   - `STATE_BLOB_NAME=state.json` (if using container SAS)
2. Run:
   - `pnpm dev`
3. Create + confirm appointment.
4. Restart and verify appointment persists.
5. Open two clients/tabs and produce two competing proposals; confirm one, then confirm the stale one.
6. Verify stale confirm is rejected with `State changed since proposal...`.

CI note:
- CI should continue to pass without Azure credentials.
- Azure integration tests remain manual/optional and must not require secrets.



## 7. OpenAI natural-language parser (feature-flagged)

Environment variables (API):

- `OPENAI_API_KEY=<secret>`
- `OPENAI_MODEL=gpt-4.1-mini`
- `LOCATION_AI_FORMATTING=false`
- `LOCATION_AI_MODEL=<optional override, defaults to OPENAI_MODEL>`
- `LOCATION_AI_LOG_RAW=false`
- `OPENAI_PARSER_ENABLED=true` (set `false` in production until validated)
- `OPENAI_MAX_CONTEXT_CHARS=8000`

Local steps:

1. Set the values in `.env` / `api/local.settings.json`.
2. Keep `STORAGE_MODE=local` during initial validation.
3. Use natural language prompts (for example, "Who is available in March?").
4. Confirm all mutation intents still return `kind: proposal` and require `confirm`.
