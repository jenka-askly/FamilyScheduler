# PROJECT_STATUS

## Current milestone

Local runnable baseline implemented.

## What works now

- Monorepo is runnable locally with `pnpm dev`.
- Prompt-only web UI is implemented at `apps/web`:
  - transcript area
  - single prompt input
  - Enter submits prompt
  - initial hint: `Type 'help' for examples.`
- Stub Azure Functions API endpoint is implemented at `POST /api/chat`:
  - request `{ "message": "..." }`
  - deterministic response `{ "kind":"reply", "assistantText":"echo: <message>", "stateVersion":0 }`
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

## Known limitations

- No authentication/passkey yet.
- No deterministic help/list/confirm protocol yet.
- No storage integration (local/blob) yet.
- No OpenAI integration yet.

## Next steps

1. Add deterministic help/list/confirm protocol and auth.
2. Add state storage abstraction and persistence.
3. Add OpenAI-backed response path behind deterministic command handling.

## Continuity rule

After every merged PR, update this file with:

- what changed,
- local/deploy status,
- next steps.
