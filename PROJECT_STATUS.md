# PROJECT_STATUS

## Current milestone

Local runnable baseline implemented.

## What works now

- Confirmation protocol implemented (in-memory only).
- Mutation-like commands require explicit `confirm` before apply.
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
   - `pnpm dev`
3. Open `http://localhost:5173` and submit a prompt.

## Local dev checklist

- `pnpm install` generates/uses `pnpm-lock.yaml`.
- If pnpm warns about ignored build scripts, run `pnpm approve-builds` and select `esbuild`.

## CI checklist

- CI requires `pnpm-lock.yaml` to be present (or dependency caching disabled); current state: lockfile is committed.

## Recent changes

- 2026-02-18: Added `pnpm-lock.yaml` to the repository so GitHub Actions (`setup-node` cache: pnpm) can run without failing.
- 2026-02-18: Local dev note: run `pnpm approve-builds` and select `esbuild` to avoid pnpm warning and allow the Vite/esbuild toolchain to function.

## Known limitations

- No authentication/passkey yet.
- No persistence yet (proposal confirmation is in-memory only).
- No storage integration (local/blob) yet.
- No OpenAI integration yet.

## Next steps

1. Add persistent state + operation codes for proposal/apply flows.
2. Replace naive text-prefix classification with a structured action schema.
3. Add auth and OpenAI-backed response path behind deterministic command handling.

## Continuity rule

After every merged PR, update this file with:

- what changed,
- local/deploy status,
- next steps.
