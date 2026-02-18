# Runbook

## 1. Local development setup (intended flow)

> Note: implementation code is not present yet; this describes intended operation.

1. Install Node.js LTS and pnpm.
2. Install dependencies:
   - `pnpm install`
3. Start local services (once implemented):
   - `pnpm --filter api dev`
   - `pnpm --filter web dev`
4. Open web app and interact via prompt input.

## 2. Storage modes

### `STORAGE_MODE=local` (default)

- Zero Azure dependency.
- Reads/writes local state file at `LOCAL_STATE_PATH` (default `./.local/state.json`).
- ETag simulated using content hash of serialized state.

### `STORAGE_MODE=azure`

- Uses Azure Blob Storage via SAS URL.
- Required env vars:
  - `BLOB_SAS_URL`
  - `STATE_BLOB_NAME` (default `state.json`)
- ETag uses blob ETag headers.

## 3. Initialize local state file

Intended initial path:

- `./.local/state.json` (or `LOCAL_STATE_PATH` override)

Intended JSON shape:

```json
{
  "version": 1,
  "people": [],
  "appointments": [],
  "availability": [],
  "history": []
}
```

## 4. Azure Blob SAS usage and SWA configuration

For deploy/runtime configuration (once app exists):

1. Generate a SAS URL with read/write/list permissions scoped to target container.
2. Set `BLOB_SAS_URL` in Azure Static Web Apps configuration.
3. Set `STATE_BLOB_NAME` (typically `state.json`).
4. Validate API can read/write state blob and preserve ETag behavior.

## 5. Passkey rotation

1. Choose new 6-digit family passkey.
2. Update `FAMILY_PASSKEY` in environment/secrets.
3. Redeploy/restart services.
4. Notify family users of passkey change through secure channel.

## 6. SAS rotation

1. Create new SAS token with overlapping validity.
2. Update `BLOB_SAS_URL` secret in deployment target.
3. Redeploy/restart API.
4. Revoke old SAS token once traffic confirms healthy on new token.

## 7. Backups

Backup naming convention:

- `backups/state-YYYYMMDD-HHMMSS.json`

`backup now` should create a new backup entry before/while preserving current state snapshot.

Local mode:

- Store backups under local `backups/` directory adjacent to state path.

Azure mode:

- Store backups in blob namespace/prefix `backups/`.

## 8. Restore procedure

1. List backups (`list backups` or `GET /api/backups` if enabled).
2. Request restore using backup name.
3. Receive proposal with impacted summary.
4. Confirm restore.
5. Validate state version increment and snapshot response.

## 9. Recovery from corrupted state

1. Stop writes (maintenance mode if needed).
2. Identify latest good backup from index/list.
3. Execute restore flow (requires confirmation).
4. Validate state integrity and critical appointment codes.
5. Resume normal operations.

## 10. Rate limiting notes

Default configurable values:

- `RATE_LIMIT_WINDOW_SEC=300`
- `RATE_LIMIT_MAX_CALLS=20`

Recommended default policy:

- Max 20 `/api/chat` calls per 5-minute window per session/token.
- Return clear rate-limit message and retry hint when exceeded.
