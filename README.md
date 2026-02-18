# FamilyScheduler

FamilyScheduler is a **prompt-only** family coordination scheduler. The product is designed around natural-language scheduling with strict mutation safety and stable human-readable codes for every schedulable item.

## Current repository state

This repository currently contains **scaffold + specifications only** (no app/API implementation code yet).

## Prompt-only behavior (core rule)

- The user experience is centered on a transcript and one prompt input.
- **Questions/queries** respond immediately.
- **Mutations** (add/update/delete/assign/undo/backup/restore) must follow:
  1. Proposal
  2. Explicit confirmation request
  3. Execute only after `confirm`
- Mutations are never executed immediately.

## Local-first development model

FamilyScheduler defaults to local development mode:

- `STORAGE_MODE=local`
- State persisted to `LOCAL_STATE_PATH` (default `./.local/state.json`)
- No Azure resources required to start local development

Production storage mode uses Azure Blob with SAS.

## Documentation index

- Architecture: [`docs/architecture.md`](docs/architecture.md)
- API contract: [`docs/api.md`](docs/api.md)
- Data model and code rules: [`docs/data-model.md`](docs/data-model.md)
- Prompt command help content: [`docs/prompt-help.md`](docs/prompt-help.md)
- Runbook and operations: [`docs/runbook.md`](docs/runbook.md)
- Architectural decisions (ADRs): [`docs/decisions/`](docs/decisions)
- Continuity status: [`PROJECT_STATUS.md`](PROJECT_STATUS.md)

## Monorepo layout

- `apps/web` — prompt-only web client scaffold/docs
- `api` — API service scaffold/docs
- `packages/shared` — shared contracts/types scaffold/docs
- `docs` — product + technical specifications
- `scripts` — documented script placeholders

## Local verification (scaffold stage)

1. Install pnpm (version 10 recommended).
2. Run `pnpm install` at the repository root.
3. Run `pnpm run ci` (this should pass with placeholder scripts while the repo is scaffold-only).

Actual app/API build and dev commands will be added in the next PR when `apps/web` and `api` packages are implemented.

## CI and deploy workflow skeletons

- CI skeleton: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
- Deploy skeleton: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

These workflows are intentionally scaffold-level and include TODO markers until implementation code exists.

## Deployment (high level)

1. Implement app/API according to docs.
2. Configure required secrets for deploy workflow (see `PROJECT_STATUS.md` and `docs/runbook.md`).
3. Enable Azure Static Web Apps deploy pipeline.

## Help command usage

The command `help` (or `?`) returns canonical command guidance documented in [`docs/prompt-help.md`](docs/prompt-help.md).

## Important continuity rule

After each merge, update `PROJECT_STATUS.md` with:
- what changed,
- local/deploy status,
- and next steps.
