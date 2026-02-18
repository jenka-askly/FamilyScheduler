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

### Azure mode troubleshooting

- `403` from blob calls: SAS token invalid, missing permission, or expired.
- `404` on initial read: expected if blob does not exist yet; API attempts auto-init create-if-missing.
- `412` on write: optimistic concurrency conflict (`If-Match` failed); user should retry and confirm again.

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

