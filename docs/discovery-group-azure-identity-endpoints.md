# Discovery: Group Logic, Azure Storage, Identity Fields, and Function Routes

Date: 2026-02-23 (UTC)

## Scope

Search targets requested:
- Group-related logic: `Group`, `groups/`, `createGroup`, `joinGroup`, `member`
- Azure storage usage: `TableClient`, `@azure/data-tables`, `BlobServiceClient`, `@azure/storage-blob`
- Identity fields: `x-ms-client-principal`, `claims`, `oid`, `sub`, `preferred_username`, `email`
- Azure Function endpoints: all `function.json` files + routing configuration

## Findings

### 1) Group-related logic

- Frontend create/join flows exist in `apps/web/src/App.tsx`:
  - `CreateGroupPage` UI and `/api/group/create` call.
  - `JoinGroupPage` UI and `/api/group/join` call.
  - `GroupAuthGate` gate that posts to `/api/group/join` to validate session.
- Backend handlers exist in:
  - `api/src/functions/groupCreate.ts`
  - `api/src/functions/groupJoin.ts`
  - `api/src/functions/groupMeta.ts`
- Blob path conventions include `groups/<groupId>/...` under:
  - `api/src/lib/scan/appointmentScan.ts`

### 2) Azure storage usage

- `@azure/storage-blob` is used; `BlobServiceClient` is instantiated in:
  - `api/src/lib/storage/azureBlobStorage.ts`
  - `api/src/lib/usageMeter.ts`
- `@azure/data-tables` / `TableClient` were not found.

### 3) Identity fields

- No code references were found for:
  - `x-ms-client-principal`
  - `claims`
  - `oid`
  - `sub`
  - `preferred_username`
- `email` was only found in wishlist documentation text, not in auth/identity handling code.

### 4) Azure Function endpoints and routing

#### Endpoints defined by `function.json`

- `POST /api/chat` (`api/chat/function.json`)
- `GET /api/diagnose/openai` (`api/diagnoseOpenAi/function.json`)
- `POST /api/direct` (`api/direct/function.json`)
- `POST /api/group/create` (`api/groupCreate/function.json`)
- `POST /api/group/join` (`api/groupJoin/function.json`)
- `GET /api/group/meta` (`api/groupMeta/function.json`)
- `GET /api/usage` (`api/usage/function.json`)

#### Additional route registrations in code

- `api/src/index.ts` registers the above and also these routes:
  - `POST /api/scanAppointment`
  - `GET /api/appointmentScanImage`
  - `POST /api/appointmentScanDelete`
  - `POST /api/appointmentScanRescan`

#### Routing configuration files

- `api/host.json` exists (runtime/logging config).
- No `staticwebapp.config.json`, `routes.json`, or `swa-cli.config.json` found in this repository scan.
