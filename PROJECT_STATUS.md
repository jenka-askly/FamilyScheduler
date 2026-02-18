# PROJECT_STATUS

## Current status

**Scaffold + docs only**.

No application/runtime implementation code has been added yet.

## What is implemented

- Monorepo folder scaffold (`apps/web`, `api`, `packages/shared`, `docs`, `scripts`).
- Root and per-folder README documentation.
- Full specification docs for architecture, API contracts, data model, prompt help, and runbook.
- ADR set (0001-0006) covering architecture and product constraints.
- GitHub workflow skeletons:
  - CI placeholder flow
  - Deploy (Azure Static Web Apps) skeleton
- GitHub governance templates:
  - PR template
  - CODEOWNERS
  - Issue templates (bug/feature)
- Tooling scaffolds:
  - `pnpm-workspace.yaml`
  - `tsconfig.base.json`
  - `.editorconfig`
  - `.gitignore`
  - `.env.example`

## Next tasks

1. Implement API endpoints in order:
   - `/api/auth/login`
   - `/api/state`
   - `/api/chat`
   - `/api/confirm`
   - `/api/cancel`
   - `/api/undo`
   - `/api/backup`
   - `/api/restore`
2. Implement deterministic command classification and proposal protocol.
3. Implement prompt-only web page (transcript + single input only).
4. Implement storage abstraction:
   - local file + hashed ETag
   - Azure blob + native ETag

## Environment variables checklist

- [x] `STORAGE_MODE`
- [x] `LOCAL_STATE_PATH`
- [x] `FAMILY_PASSKEY`
- [x] `TOKEN_SECRET`
- [x] `OPENAI_API_KEY`
- [x] `OPENAI_MODEL`
- [x] `BLOB_SAS_URL`
- [x] `STATE_BLOB_NAME`
- [x] `RATE_LIMIT_WINDOW_SEC`
- [x] `RATE_LIMIT_MAX_CALLS`

## Local development checklist

- [x] Local-first mode documented (`STORAGE_MODE=local`)
- [x] Local state path and initial shape documented
- [x] Intended local run commands documented (pending implementation)
- [ ] App/API runnable locally (pending code)

## Deployment checklist

- [x] Deploy workflow skeleton committed
- [x] Required secrets documented in workflows/docs
- [ ] Azure Static Web Apps configured with real secrets
- [ ] Production deployment validated

## Continuity rule

After every merged PR, update this file with:

- what changed,
- local/deploy status,
- next steps.
