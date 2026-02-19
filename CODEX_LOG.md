# CODEX_LOG

## 2026-02-18 UTC

### Objective

Create a PR-ready repository scaffold and full documentation/workflow skeletons for FamilyScheduler with no app/API implementation code.

### Approach

- Created target monorepo directory/file structure.
- Authored required specification documents and ADRs.
- Added GitHub workflow/template scaffolds.
- Added baseline tooling/environment files.
- Added continuity docs (`PROJECT_STATUS.md`, `CODEX_LOG.md`).

### Files changed

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/pull_request_template.md`
- `.github/CODEOWNERS`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/feature.yml`
- `apps/web/README.md`
- `api/README.md`
- `packages/shared/README.md`
- `docs/architecture.md`
- `docs/api.md`
- `docs/data-model.md`
- `docs/runbook.md`
- `docs/prompt-help.md`
- `docs/decisions/ADR-0001-monorepo.md`
- `docs/decisions/ADR-0002-prompt-only-ui.md`
- `docs/decisions/ADR-0003-storage-etag.md`
- `docs/decisions/ADR-0004-confirmation-protocol.md`
- `docs/decisions/ADR-0005-openai-structured-outputs.md`
- `docs/decisions/ADR-0006-local-first-storage-mode.md`
- `scripts/README.md`
- `PROJECT_STATUS.md`
- `README.md`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.editorconfig`
- `.gitignore`
- `.env.example`

### Commands run + outcomes

- `mkdir -p ...` ✅ created scaffold directories.
- Multiple `cat > <file>` commands ✅ wrote required scaffold/config/spec files.
- `git status --short` (to verify pending changes) ✅ expected new files.

### Follow-ups

- Implement API and web runtime code per spec.
- Add executable scripts and real CI lint/typecheck/test commands.
- Add package manifests and lockfile.

## 2026-02-18 UTC (follow-up)

### Objective

Enable meaningful local verification in scaffold-only state by adding a safe root `package.json` and wiring CI to run pnpm commands.

### Approach

- Added minimal root `package.json` with placeholder scripts and workspace-safe CI command.
- Updated README with scaffold-stage verification instructions.
- Updated project status checklist and recorded this PR's changes.
- Updated CI workflow to run `pnpm install` and `pnpm run ci`.
- Added `.vs/` to `.gitignore` for editor hygiene.

### Files changed

- `package.json`
- `README.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`
- `.github/workflows/ci.yml`
- `.gitignore`

### Commands run + outcomes

- `pnpm -v` ⚠️ failed in this environment because Corepack could not download pnpm (`Proxy response (403)`).
- `pnpm install` ⚠️ blocked by the same Corepack/network issue in this environment.
- `pnpm run ci` ⚠️ blocked by the same Corepack/network issue in this environment.
- `git status --short` ✅ only expected repository edits.

### Follow-ups

- Add real package manifests in `apps/web`, `api`, and `packages/shared`.
- Replace placeholder lint/typecheck/test scripts with executable project checks.

## 2026-02-18 UTC (deploy workflow non-blocking update)

### Objective

Prevent CI/deploy failures when `AZURE_STATIC_WEB_APPS_API_TOKEN` is not configured while preserving the deploy workflow for future use.

### Approach

- Updated SWA deploy action inputs to skip deployment when required secrets are missing.
- Changed `output_location` from `dist` to `.` to match current scaffold state (no build output yet).
- Updated continuity documentation in `PROJECT_STATUS.md` to record non-blocking deploy behavior.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `python - <<'PY' ...` ✅ updated `PROJECT_STATUS.md` deployment checklist and recent update section.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified targeted minimal diff.

### Follow-ups

- Configure `AZURE_STATIC_WEB_APPS_API_TOKEN` in repository secrets to enable actual deployments.
- Replace `output_location: .` with real build output path once `apps/web` implementation exists.

## 2026-02-18 UTC (pnpm CI version alignment)

### Objective

Fix CI pnpm setup so GitHub Actions uses the pnpm version declared in `package.json` (`packageManager`) and avoids version conflicts.

### Approach

- Removed explicit `version: 10` from `pnpm/action-setup@v4` in CI.
- Kept `packageManager: pnpm@10.30.0` unchanged in `package.json`.
- Performed targeted checks to confirm workflow and package manager alignment.

### Files changed

- `.github/workflows/ci.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,220p' .github/workflows/ci.yml && cat package.json` ✅ verified current setup and package manager declaration.
- `git diff -- .github/workflows/ci.yml` ✅ confirmed only pnpm version pin removal.

### Follow-ups

- Verify on next GitHub Actions run that pnpm installs at `10.30.0` without "Multiple versions" errors.

## 2026-02-18 20:21 UTC (chunk 1 local runnable prompt UI + stub chat API)

### Objective

Implement the first runnable milestone: local prompt-only UI + stub `POST /api/chat` echo endpoint, with workspace/tooling/docs/CI updates.

### Approach

- Added workspace package manifests and TypeScript configs for `apps/web`, `api`, and `packages/shared`.
- Implemented Azure Functions v4 HTTP trigger for `/api/chat` with request validation and deterministic echo reply.
- Implemented Vite + React prompt-only UI with transcript and single input submit flow.
- Added Vite dev proxy for `/api` to `http://localhost:7071`.
- Updated root scripts for `dev`, `dev:web`, `dev:api`, and workspace-oriented `ci` checks.
- Updated runbook and project status to reflect runnable local workflow and next milestones.
- Updated CI workflow to run install and `pnpm -r --if-present build`.

### Files changed

- `package.json`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/types.ts`
- `packages/shared/src/index.ts`
- `api/package.json`
- `api/tsconfig.json`
- `api/host.json`
- `api/src/functions/chat.ts`
- `api/README.md`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/index.html`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/README.md`
- `docs/runbook.md`
- `PROJECT_STATUS.md`
- `.github/workflows/ci.yml`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm install` ⚠️ failed in this environment due to Corepack/proxy restriction downloading pnpm (`Proxy response (403)`).
- `func --version` ⚠️ failed because Azure Functions Core Tools is not installed in this environment (`command not found: func`).
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ used to timestamp this log entry.

### Follow-ups

- Run `pnpm install`, `pnpm dev`, and API/web smoke tests in an environment with registry access and Functions Core Tools.
- Add deterministic help/list/confirm protocol + auth in next PR.

## 2026-02-18 20:32 UTC (docs continuity: lockfile + approve-builds)

### Objective

Document lockfile/caching continuity and local `pnpm approve-builds` guidance after recent GitHub and local setup changes.

### Approach

- Updated `PROJECT_STATUS.md` with explicit local dev and CI checklist items.
- Added a recent changes section capturing both lockfile purpose and esbuild approval step.
- Updated runbook local setup with the `Ignored build scripts: esbuild` remediation.

### Files changed

- `PROJECT_STATUS.md`
- `docs/runbook.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `python - <<'PY' ...` ✅ inserted local setup note in `docs/runbook.md`.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.
- `git diff -- PROJECT_STATUS.md docs/runbook.md CODEX_LOG.md` ✅ verified targeted documentation-only changes.

### Follow-ups

- Confirm next CI run uses committed `pnpm-lock.yaml` with `setup-node` pnpm cache without lockfile errors.

## 2026-02-18 20:39 UTC (chunk 2 proposal + confirm protocol)

### Objective

Implement deterministic in-memory confirmation protocol for the stub chat API and update the web client to handle new response kinds.

### Approach

- Updated `POST /api/chat` classification to deterministic `mutation` / `confirm` / `query` handling.
- Added module-level in-memory `pendingProposal` with proposal creation and confirm/apply semantics.
- Updated web transcript handling to accept `reply`, `proposal`, and `applied` response kinds.
- Updated `PROJECT_STATUS.md` to reflect current behavior and revised next milestones.

### Files changed

- `api/src/functions/chat.ts`
- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -r --if-present build` ⚠️ failed in this environment because Corepack could not download pnpm (`Proxy response (403)`).
- `pnpm -r --if-present test` ⚠️ failed in this environment for the same Corepack/network reason.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- Add persistent proposal/state storage and operation codes.
- Add structured action schema to replace prefix-based classification.

## 2026-02-18 20:43 UTC (api build fix: add Node type definitions)

### Objective

Fix workspace build failure `TS2688: Cannot find type definition file for 'node'` in the API package.

### Approach

- Added `@types/node` to `api` `devDependencies`.
- Kept `api/tsconfig.json` `types: ["node"]` unchanged so the type reference resolves.
- Attempted to run root dependency install and workspace build verification.
- Updated continuity docs with this build-fix status.

### Files changed

- `api/package.json`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm install` ⚠️ failed in this environment because Corepack could not download pnpm (`Proxy response (403)`).
- `pnpm -r --if-present build` ⚠️ not runnable for the same Corepack/network reason (pnpm unavailable).
- `rg -n "@types/node|types": \[\"node\"\]" api/package.json api/tsconfig.json` ✅ confirmed package/tsconfig wiring.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- Re-run `pnpm install` and `pnpm -r --if-present build` in CI or a network-enabled local environment to regenerate/confirm `pnpm-lock.yaml` and verify no `TS2688` remains.

## 2026-02-18 21:01 UTC (fix build: workspace TypeScript dependency)

### Objective

Fix workspace builds where `tsc` is not found by adding TypeScript at the workspace root and updating continuity docs.

### Approach

- Added root `devDependencies.typescript` with specifier `^5.5.0` in `package.json`.
- Updated `pnpm-lock.yaml` root importer to include workspace-root `typescript` dependency mapping.
- Updated `PROJECT_STATUS.md` recent changes to document the workspace TypeScript dependency addition for local/CI builds.
- Attempted dependency install and workspace build verification.

### Files changed

- `package.json`
- `pnpm-lock.yaml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm install --no-frozen-lockfile` ⚠️ failed in this environment because Corepack could not download pnpm (`Proxy response (403)`).
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- Run `pnpm install --no-frozen-lockfile` in a network-enabled environment to fully regenerate lockfile metadata if needed.
- Run `pnpm -r --if-present build` to confirm `tsc` resolution across workspaces in local/CI.

## 2026-02-18 21:06 UTC (chunk 3 in-memory appointment state + codes)

### Objective

Add real in-memory appointment state with identifiable codes and deterministic add/list/show command handling while preserving confirmation-before-mutation behavior.

### Approach

- Replaced generic mutation classification with explicit command handling for `add appt`, `confirm`, `list appointments`, and `show <code>`.
- Added API module-level in-memory `state.appointments` array and runtime `appointmentCodeCounter` for stable `APPT-n` generation.
- Implemented add flow proposal text and confirm apply path that persists appointment data in memory and returns an "Upcoming appointments" snapshot.
- Implemented list/show query flows without confirmation requirement.
- Updated continuity docs (`PROJECT_STATUS.md`) to reflect current capabilities and revised next steps.

### Files changed

- `api/src/functions/chat.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -r --if-present build` ⚠️ failed in this environment because Corepack could not download pnpm (`Proxy response (403)`).
- `pnpm run ci` ⚠️ failed in this environment for the same Corepack/proxy restriction while fetching pnpm.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured this log timestamp.

### Follow-ups

- Replace naive command parsing with structured action schema + validation.
- Add update/delete mutation flows with confirmation protocol.
- Introduce availability model and assignment logic.

## 2026-02-18 21:16 UTC (fix local Functions discovery + chat route registration)

### Objective

Fix local Azure Functions discovery so `func start` loads the Node worker + chat HTTP trigger and `POST /api/chat` no longer returns 404.

### Approach

- Switched to a single v4 programming-model registration entrypoint (`api/src/index.ts`) and imported the chat handler there.
- Removed trigger registration side-effect from `api/src/functions/chat.ts` so registration is centralized.
- Updated `api/package.json` `main` to `dist/index.js` so Functions host can discover compiled entrypoint.
- Added tracked `api/local.settings.example.json` and ignored `api/local.settings.json` in `.gitignore`.
- Updated runbook/API docs with copy-step for local settings and verification flow using `func start` + `Invoke-RestMethod`.
- Updated `PROJECT_STATUS.md` with discovery fix and local endpoint reachability status.

### Files changed

- `api/src/index.ts`
- `api/src/functions/chat.ts`
- `api/package.json`
- `api/local.settings.example.json`
- `.gitignore`
- `docs/runbook.md`
- `api/README.md`
- `PROJECT_STATUS.md`

### Commands run + outcomes

- `npm run build` (in `api/`) ⚠️ failed (`TS2688: Cannot find type definition file for 'node'`) because required packages are not installed in this network-restricted environment.
- `npm install` (in `api/`) ⚠️ failed with `403 Forbidden` fetching `@types/node` from npm registry in this environment.
- `func start --port 7071` (in `api/`) ⚠️ could not run because Azure Functions Core Tools are not installed here (`func: command not found`).
- `rg -n "app\.http\(|route:\s*'chat'|local.settings" api docs apps/web .gitignore PROJECT_STATUS.md` ✅ verified single `chat` registration entrypoint plus local settings wiring/documentation updates.

### Follow-ups

- Verify Windows PowerShell `Invoke-RestMethod` flow on developer machine exactly as documented in runbook.
- Keep API response shape stable while introducing structured action schema in later milestone.

## 2026-02-18 21:20 UTC (fix Functions entrypoint pattern vs tsc output)

### Objective

Align Azure Functions Node worker discovery with TypeScript output layout so compiled handlers are emitted where the worker expects them.

### Approach

- Updated `api/tsconfig.json` `rootDir` from `src` to `.` while keeping `outDir` at `dist`.
- This preserves source layout in compiled output and produces `api/dist/src/functions/*.js`.
- Added runbook troubleshooting guidance for `Found zero files matching ...` startup errors caused by output-path mismatch.
- Updated `PROJECT_STATUS.md` milestone/recent-changes to record this alignment fix.

### Files changed

- `api/tsconfig.json`
- `docs/runbook.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api run build` ❌ failed (`TS2688: Cannot find type definition file for 'node'`) because package installation is incomplete in this environment.
- `pnpm install` ⚠️ failed due registry/network restriction (`ERR_PNPM_FETCH_403` downloading `undici-types`).
- `find api/dist -maxdepth 4 -type f | sort` ✅ confirmed compiled artifacts currently include `api/dist/src/index.js` and `api/dist/src/functions/chat.js`.
- `pnpm dev` ⚠️ failed in this environment because web dependencies are not installed (`vite: not found`).
- `pnpm -C api run dev` ❌ failed at build step with same missing Node type dependency.

### Follow-ups

- Re-run `pnpm install` in an environment with npm registry access.
- Re-run `pnpm -C api run build` then start API via `pnpm -C api run dev` (or root `pnpm dev`) and verify `POST /api/chat` returns JSON.

## 2026-02-18 21:23 UTC (functions worker entrypoint mismatch verification)

### Objective

Ensure local Azure Functions worker indexing matches TypeScript output path (`dist/src/functions/*.js`) and document troubleshooting so `/api/chat` can be discovered by `pnpm dev`.

### Approach

- Verified `api/tsconfig.json` already uses `rootDir: "."` to emit `src/functions` under `dist/src/functions`.
- Added a concise troubleshooting line in the runbook keyed to the exact worker error string.
- Added a continuity update in `PROJECT_STATUS.md` documenting re-verification of build output path expectations.
- Attempted local build/dev/runtime checks; captured environment blockers.

### Files changed

- `docs/runbook.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api run build` ❌ failed in this environment: missing `@types/node` package due blocked registry fetch.
- `pnpm install` ❌ failed in this environment: `ERR_PNPM_FETCH_403` fetching `@types/node` tarball from npm registry.
- `test -f api/dist/src/functions/chat.js && echo 'exists' || echo 'missing'` ✅ confirmed existing compiled file at `api/dist/src/functions/chat.js`.
- `pnpm dev` ❌ failed in this environment: `vite: not found` because dependencies are not installed.

### Follow-ups

- In a network-enabled local environment, run `pnpm install`, then `pnpm -C api run build`, then `pnpm dev` and POST to `http://localhost:7071/api/chat` to confirm JSON response.

## 2026-02-18 21:32 UTC (fix dist/index.js entrypoint emission for Azure Functions)

### Objective

Fix Azure Functions startup mismatch so the API build emits `dist/index.js` (not `dist/src/index.js`) and keep `/api/chat` discoverable.

### Approach

- Updated `api/tsconfig.json` to use `rootDir: "src"` with `outDir: "dist"` so `src/index.ts` compiles to `dist/index.js` and `src/functions/chat.ts` compiles to `dist/functions/chat.js`.
- Searched for stale worker/glob references to `dist/src/functions/*.js` and removed that guidance from docs.
- Updated runbook troubleshooting to address the exact error `entry point dist/index.js does not exist` and document the correct expected output files.
- Updated `PROJECT_STATUS.md` to record the entrypoint fix and local `/api/chat` reachability status.

### Files changed

- `api/tsconfig.json`
- `docs/runbook.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api run build` ✅ succeeded.
- `python - <<'PY' ... shutil.rmtree('api/dist') ...` ✅ cleaned previous build artifacts.
- `pnpm -C api run build` ✅ rebuilt API after cleaning.
- `find api/dist -maxdepth 3 -type f | sort` ✅ confirmed `api/dist/index.js` and `api/dist/functions/chat.js` are emitted.
- `rg -n "dist/src/functions" api docs` ✅ no remaining config/docs references under `api/` to old worker glob path.
- `pnpm -C api run dev` ⚠️ build succeeds but runtime start is blocked here because Azure Functions Core Tools are unavailable (`func: not found`).

### Follow-ups

- On a machine with Azure Functions Core Tools installed, run `pnpm dev` and `Invoke-RestMethod` against `http://localhost:7071/api/chat` to confirm end-to-end JSON response.

## 2026-02-18 21:37 UTC (clean dist before API build)

### Objective

Ensure API builds always produce a clean Functions entrypoint (`dist/index.js`) without stale `dist/` leftovers.

### Approach

- Added an explicit `clean` script in `api/package.json` using Node's `fs.rmSync` (no extra dependency required in this environment).
- Updated `api` `build` script to run `clean` before `tsc`.
- Updated runbook troubleshooting to note the clean-first build behavior.
- Updated `PROJECT_STATUS.md` with continuity note for the clean-build safeguard.

### Files changed

- `api/package.json`
- `docs/runbook.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api run build` ❌ initially failed when trying `rimraf` (`sh: rimraf: not found`).
- `pnpm install` ❌ failed in this environment (`ERR_PNPM_FETCH_403` for `rimraf`), so dependency-based clean was removed.
- `pnpm -C api run build` ✅ succeeded after switching clean script to Node `fs.rmSync`.
- `test -f api/dist/index.js && test -f api/dist/functions/chat.js` ✅ confirmed required compiled files exist.
- `pnpm dev` ⚠️ API start blocked in this environment by missing Azure Functions Core Tools (`func: not found`); web dev server starts.

### Follow-ups

- On a machine with Azure Functions Core Tools, run `pnpm dev`, then POST `http://localhost:7071/api/chat` to verify end-to-end JSON response.

## 2026-02-18 21:48 UTC (chunk 4 delete/update deterministic mutations)

### Objective

Add deterministic in-memory delete/update appointment mutation flows with confirm/cancel safety, and keep prompt-only web UI text rendering aligned.

### Approach

- Extended API command parsing to support `delete APPT-n` and `update APPT-n title <new title>`.
- Added normalized case-insensitive code matching (`APPT-n` canonical output) and pending proposal actions for add/delete/update.
- Ensured `confirm` applies exactly one pending action and `cancel` clears pending change.
- Standardized mutation apply responses to include an `Upcoming appointments:` snapshot (up to 5 lines).
- Updated web client response typing for `clarify` and ensured transcript lines preserve multi-line formatting.
- Updated prompt help and project continuity status for new commands and revised next steps.

### Files changed

- `api/src/functions/chat.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -r --if-present build` ✅ succeeded for `api`, `apps/web`, and `packages/shared`.
- `node <<'NODE' ...` ✅ simulated required add/confirm/delete/update/cancel flows against built API handler and validated expected responses.
- `pnpm dev` ⚠️ failed in this environment because Azure Functions Core Tools (`func`) is not installed.
- `pnpm exec vite --host 0.0.0.0` ✅ started web dev server for visual check.
- `mcp__browser_tools__run_playwright_script` ✅ captured UI screenshot artifact.

### Follow-ups

- Install Azure Functions Core Tools locally/CI images when end-to-end `pnpm dev` runtime verification is required.
- Next milestone remains availability + local persistence before OpenAI integration.

## 2026-02-18 21:59 UTC (chunk 5 availability blocks + availability queries)

### Objective

Implement deterministic in-memory availability management and month-range availability queries while preserving confirmation safety for mutations.

### Approach

- Extended chat API in-memory state to include people and availability blocks.
- Added deterministic identity binding via `I am <Name>` (applies immediately) with a documented global identity limitation.
- Added mutation flow for `mark ... unavailable` and `delete AVL-...` with confirm/cancel proposals.
- Added queries for listing/showing availability, monthly availability summary, and `check conflicts`.
- Updated prompt help and project status continuity docs.

### Files changed

- `api/src/functions/chat.ts`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -r --if-present build` ✅ passed for `api`, `packages/shared`, and `apps/web`.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ used for this log timestamp.

### Follow-ups

- Add persistent storage (local file first) for identity, proposals, appointments, and availability blocks.
- Replace deterministic parser with OpenAI-assisted parsing once persistence is stable.

## 2026-02-18 22:11 UTC (chunk 6 local json persistence + etag concurrency)

### Objective

Add local JSON persistence for API state with optimistic concurrency, wire ETag checks into proposal/confirm flow, and update docs/status continuity.

### Approach

- Added storage abstraction and local-file adapter with SHA256 ETag computation and atomic temp-write+rename commits.
- Introduced shared `AppState` model and empty-state initializer (seeded people + empty arrays + version/history).
- Reworked `chat` function to load state from storage on each request, carry `expectedEtag` in pending proposals, and reject stale confirmations with a fresh snapshot.
- Added deterministic debug commands: `export json` and local-only `reset state` (confirm-required).
- Updated local settings example and docs to explain persistence location, reset/delete, and conflict recovery.
- Updated project continuity doc for current milestone + next adapter work.

### Files changed

- `api/src/lib/state.ts`
- `api/src/lib/storage/storage.ts`
- `api/src/lib/storage/localFileStorage.ts`
- `api/src/functions/chat.ts`
- `api/local.settings.example.json`
- `docs/runbook.md`
- `docs/architecture.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api run build` ✅ TypeScript build succeeds with new storage/state modules.
- `pnpm -r --if-present build` ✅ workspace build succeeds.
- `pnpm -r --if-present test` ✅ completes (current test script outputs `no tests yet`).
- `git diff -- api/src/functions/chat.ts api/src/lib/state.ts api/src/lib/storage/storage.ts api/src/lib/storage/localFileStorage.ts docs/runbook.md docs/architecture.md PROJECT_STATUS.md api/local.settings.example.json` ✅ reviewed targeted patch.

### Follow-ups

- Add Azure Blob storage adapter implementing `StorageAdapter` with the same ETag semantics.

## 2026-02-18 22:22 UTC (chunk 7 azure blob storage adapter with SAS + ETag)

### Objective

Add `STORAGE_MODE=azure` support for API state persistence using Azure Blob SAS URLs while preserving existing local mode behavior and optimistic concurrency semantics.

### Approach

- Added a new storage factory that selects local vs azure adapters from environment config.
- Implemented a lightweight Azure Blob adapter over raw `fetch` (Node 20 runtime) with:
  - container/blob SAS URL auto-detection,
  - blob create-if-missing initialization via `If-None-Match: *`,
  - read/write support and ETag normalization,
  - optimistic concurrency on writes via `If-Match`,
  - conflict mapping (`409`/`412`) to existing `ConflictError` path.
- Updated chat handler to use storage factory so confirm flow and proposal ETag checks work across both storage modes.
- Updated env/docs/status to include azure storage contract, setup, troubleshooting, and manual verification plan.

### Files changed

- `api/src/lib/storage/azureBlobStorage.ts`
- `api/src/lib/storage/storageFactory.ts`
- `api/src/lib/storage/localFileStorage.ts`
- `api/src/functions/chat.ts`
- `.env.example`
- `api/local.settings.example.json`
- `docs/runbook.md`
- `docs/architecture.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "createStorageAdapter|AzureBlobStorage|STORAGE_MODE|BLOB_SAS_URL|STATE_BLOB_NAME|BLOB_KIND" api/src docs .env.example PROJECT_STATUS.md api/local.settings.example.json` ✅ verified wiring and env/doc coverage.
- `pnpm -r --if-present build` ✅ passed for all workspaces.
- `pnpm ci` ❌ failed because pnpm has no built-in `ci` command in this setup (`ERR_PNPM_CI_NOT_IMPLEMENTED`).
- `pnpm run ci` ✅ passed (build/lint/typecheck/test script chain).
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured timestamp.

### Follow-ups

- Manually validate Azure mode against a real SAS URL in staging (non-secret local environment variables).
- Add automated adapter-level tests with mocked `fetch` responses for 404/409/412/403 paths in a follow-up if desired.

## 2026-02-18 22:52 UTC (chunk 8 azure initIfMissing handles 409 BlobAlreadyExists)

### Objective

Fix Azure blob initialization so `initIfMissing` treats `409 BlobAlreadyExists` as a successful already-exists outcome (same as `412`), preventing false startup errors on repeated init attempts.

### Approach

- Updated `AzureBlobStorage.initIfMissing()` success condition to accept HTTP `409` in addition to existing `ok`/`412`.
- Added a runbook note clarifying `409`/`412` init responses are interpreted as already-exists success conditions.
- Updated project continuity status with the behavior change.

### Files changed

- `api/src/lib/storage/azureBlobStorage.ts`
- `docs/runbook.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api run build` ✅ TypeScript build passed after the Azure init behavior update.
- `pnpm -r --if-present build` ✅ workspace build passed.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured timestamp for continuity log.

### Follow-ups

- Manually run Azure acceptance scenarios with a real SAS token/environment: repeat startup with existing `state.json`, then startup after deleting `state.json` to confirm auto-create behavior remains correct.


## 2026-02-18 23:05 UTC (chunk 8: OpenAI parser + strict action schema)

### Objective

Implement feature-flagged OpenAI natural-language parsing that outputs strict structured actions, preserve confirm safety for mutations, and centralize deterministic execution.

### Approach

- Added a versioned strict action schema parser and model response validation.
- Added OpenAI parser client + constrained prompting that requires JSON-only action output.
- Centralized action execution in `executeActions()` and routed all mutations through this executor.
- Updated chat routing to: deterministic-first, then OpenAI fallback (flagged), with `clarify` on parse/validation failure.
- Added lightweight diagnostics (`traceId`, parser usage logs) and updated docs/env/runbook continuity.
- Added unit tests for schema rejection rules and deterministic executor behavior.

### Files changed

- `.env.example`
- `api/package.json`
- `api/src/functions/chat.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/actions/executor.test.ts`
- `api/src/lib/openai/prompts.ts`
- `api/src/lib/openai/openaiClient.ts`
- `docs/runbook.md`
- `docs/prompt-help.md`
- `docs/architecture.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` (pending run)
- `pnpm --filter @familyscheduler/api test` (pending run)
- `pnpm --filter @familyscheduler/api exec tsc -p tsconfig.json --noEmit` (pending run)

### Follow-ups

- Validate OpenAI parser end-to-end locally with real `OPENAI_API_KEY` and the NL scenario matrix.


### Command result update

- `pnpm --filter @familyscheduler/api build` ✅ passed.
- `pnpm --filter @familyscheduler/api test` ✅ passed.
- `pnpm ci` ❌ failed (`ERR_PNPM_CI_NOT_IMPLEMENTED` in pnpm).
- `pnpm run ci` ✅ passed (workspace build/lint/typecheck/test sequence).

## 2026-02-18 23:17 UTC (normalize availability NL query matching)

### Objective

Fix deterministic availability query fallback by normalizing chat input and making month-query matching robust to punctuation/case variants, while preserving confirm guards for mutations.

### Approach

- Added shared text normalization helper for deterministic routing (`trim` + lowercase + whitespace collapse + trailing punctuation removal).
- Applied normalized text in chat routing while retaining raw input for value-carrying commands and OpenAI fallback payload.
- Upgraded availability query parser to support month names and abbreviations (`march`/`mar`) with next-occurrence year resolution.
- Added targeted clarify fallback for malformed availability-only queries.
- Added API tests covering normalization equivalence for availability query and non-regression for mutation-confirm + delete command parsing.

### Files changed

- `api/src/lib/text/normalize.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ passed.
- `pnpm run ci` ✅ passed.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured timestamp for continuity log.

### Follow-ups

- If desired, add a dedicated parser unit test module for availability query month resolution with an injected clock to make year-rollover behavior fully deterministic in tests.

## 2026-02-18 23:29 UTC (clarification follow-up resolution)

### Objective

Fix clarify follow-up behavior so the next user message is consumed as missing parameter input, avoid misclassifying bare names as identity resets, and add coverage for canceling clarifications.

### Approach

- Added module-level `pendingClarification` state in the API chat handler.
- Added deterministic clarify path for `list my availability` that records missing `personName` and asks `Whose availability?`.
- At chat start, if clarification is pending and message is not `cancel`, fill the missing value from the user reply, clear clarification state, and execute the resolved action immediately.
- Unified `cancel` behavior to clear both pending proposal and pending clarification, returning `Cancelled.`.
- Added a guard that prevents bare-name input from being treated as `set_identity`; identity remains explicit via `I am <Name>`.
- Added/updated tests for acceptance cases A/B/C.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api test` ✅ passed (build + node test suite, including new clarification tests).
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ used for log timestamp.

### Follow-ups

- Extend pending clarification extraction to additional clarify intents returned from OpenAI structured outputs as more missing-field patterns are introduced.

## 2026-02-18 23:45 UTC (clarify intent binding + code normalization)

### Objective

Fix the multi-turn clarify bug where follow-up code replies (e.g., `APPt1`) lose the original delete intent, and normalize APPT/AVL code variants reliably in delete/update/show flows.

### Approach

- Added `api/src/lib/text/normalizeCode.ts` with canonical code normalization helpers:
  - `normalizeAppointmentCode` (`appt1`, `APPT 1`, etc. => `APPT-1`)
  - `normalizeAvailabilityCode` (supports canonical + relaxed `AVL-<name>1` => `AVL-<name>-1`)
  - `looksLikeSingleCodeToken`
- Reworked chat pending clarification state to preserve intended action, missing slots, candidate codes, and optional ETag for mutation proposal handoff.
- Added slot-aware clarify filling at the top of `chat()` that:
  - handles `cancel`
  - fills `code`/`personName`/`action`
  - re-asks without losing state on invalid input
  - executes query actions immediately or creates mutation proposals directly without re-routing through top-level parsing.
- Added deterministic disambiguation for `Delete the <title> one` when multiple appointment title matches exist, returning a code candidate clarify and preserving delete intent.
- Updated deterministic code parsing to use normalization for `delete`, `show`, and `update ... title ...` commands.
- Added coverage for the main repro flow, clarify persistence on nonsense replies, and code normalizer behavior.
- Updated prompt help and project status continuity notes.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `api/src/lib/text/normalizeCode.ts`
- `api/src/lib/text/normalizeCode.test.ts`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api test` ❌ failed initially (TypeScript pending-clarification action typing mismatch + one assertion regex mismatch in new test).
- `pnpm -C api test` ✅ passed after type and test fixes.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured timestamp.

### Follow-ups

- If/when OpenAI parser schema is expanded, wire explicit structured clarify candidates/action metadata through `ParsedModelResponseSchema` to avoid fallback text parsing for clarify candidates.

## 2026-02-18 23:55 UTC (identity-aware availability + clarification precedence)

### Objective

Fix availability query behavior so "my availability" uses active identity when available, otherwise clarifies for person name, and ensure pending clarification resolution runs before identity-style parsing.

### Approach

- Reordered chat flow to evaluate `confirm` before pending clarification handling, and to resolve pending clarification before deterministic identity parsing.
- Added availability query resolution helper that injects current identity into `list_availability` actions when `personName` is missing, else creates a `personName` clarification.
- Updated clarification slot fill for `personName` to match existing people case-insensitively and execute immediately as query flow.
- Added deterministic parsing for `show my availability` to route into `list_availability` with identity-aware resolution.
- Added focused chat tests covering identity-backed "my availability", clarify-then-resolve behavior without identity reset, and bare-name non-identity behavior.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ all API tests passed (11/11).
- `pnpm run ci` ✅ workspace build/typecheck/tests passed.
- `pnpm ci` ❌ command unsupported in pnpm (`ERR_PNPM_CI_NOT_IMPLEMENTED`), used `pnpm run ci` instead.

### Follow-ups

- If future action schema introduces `show_availability` with `personName`, extend identity-aware resolver to that action type as well.

## 2026-02-19 00:11 UTC (dashboard-first UX + snapshot responses)

### Objective

Implement dashboard-first UX (always-visible appointments/availability, collapsed history, proposal confirm modal) and add API `snapshot` payload on all chat responses without changing existing action semantics/routes.

### Approach

- Extended API chat responses to include `snapshot` derived from current state for reply/proposal/applied/clarify responses.
- Added deterministic snapshot sorting (appointments by start or code fallback; availability by start).
- Updated web app to render always-visible dashboard panels from `snapshot`, a history toggle that collapses to last exchange by default, and a proposal confirm/cancel modal that sends `confirm` / `cancel` prompts.
- Updated docs/continuity files with UX behavior changes.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ passed all API tests after snapshot/test updates.
- `pnpm --filter @familyscheduler/web build` ✅ passed web typecheck/build.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ launched dev server for screenshot capture (stopped via SIGINT after capture).
- Playwright screenshot capture ✅ saved artifact `browser:/tmp/codex_browser_invocations/b487b67cfffc40a5/artifacts/artifacts/dashboard-refresh.png`.

### Follow-ups

- Run end-to-end manual acceptance flow with local API host (`pnpm dev`) in an environment with Azure Functions Core Tools installed.


## 2026-02-19 UTC (web UX tables for appointments + availability)

### Objective

Implement table-based task panels in `apps/web` for appointments and availability, including sorting and optional code copy UX.

### Approach

- Replaced list rendering with compact table rendering for both dashboard panels.
- Added deterministic date/time formatting helpers and sorting in the React layer.
- Added code click-to-copy buttons and an `Unassigned` badge when appointment assignees are empty/missing.
- Added table styling for compact rows and horizontal overflow on small screens.
- Captured a browser screenshot artifact with mocked API response data to verify visible table rendering.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started local Vite server for screenshot capture.
- `playwright script via mcp__browser_tools__run_playwright_script` ✅ captured screenshot artifact with populated tables using mocked `/api/chat` snapshot.

### Follow-ups

- If desired, add explicit toast/feedback for successful clipboard copy action.

## 2026-02-19 00:28 UTC (UX improvements for rescheduling defaults/timezone/flexible dates)

### Objective

Implement API parsing + executor UX upgrades for rescheduling defaults, fuzzy time-of-day, timezone aliases, query shortcuts, and robust confirm/cancel detection.

### Approach

- Added a dedicated flexible date parser in `api/src/lib/time/parseDate.ts` with unit coverage.
- Added deterministic reschedule parsing for `change <appt-code> to <date|date time-of-day>`.
- Added `update_appointment_schedule` action in schema + executor to apply reschedules.
- Updated chat command handling to:
  - treat any message containing `confirm`/`cancel` as proposal control,
  - support `show my appt`/`show my appointments` direct listing,
  - only ask for code on `show appointment` when there are more than 5 appointments,
  - map Seattle/LA/Pacific timezone aliases with explicit response text.
- Added acceptance-style chat tests covering requested scenarios A–E.

### Files changed

- `api/src/lib/time/parseDate.ts`
- `api/src/lib/time/parseDate.test.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/actions/executor.test.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ❌ initial failure due new `March 10 morning` parse/time formatting gaps.
- `pnpm --filter @familyscheduler/api test` ✅ pass after adding optional-year month/day parsing + local-time formatting in executor output.
- `pnpm -r --if-present test` ✅ workspace tests pass.
- `date '+%Y-%m-%d %H:%M %Z'` ✅ captured log timestamp.

### Follow-ups

- If DST-sensitive scheduling is needed later, replace fixed `-08:00` reschedule offset generation with timezone-aware conversion based on `America/Los_Angeles` rules.


## 2026-02-19 00:38 UTC (UX fix: show list default + reschedule clarification time fill)

### Objective

Implement deterministic `show list` defaults and preserve pending reschedule context so time-only follow-ups fill missing slots before any new intent parsing.

### Approach

- Added `parseTimeRange` helper for supported `to`/`-` formats in 12h and 24h time.
- Extended chat clarification state for reschedule slot filling (`date`, `timezone`, missing `start`/`end`) and resolved time-only clarification replies into proposal mutations immediately.
- Added deterministic default handling for `show list`, `list`, `show`, `show all`, and `list all` before OpenAI parsing.
- Added explicit no-context behavior for standalone time ranges (`What date and what are you changing?`).
- Added `reschedule_appointment` action support in schema/executor and wired proposal rendering/mutation handling.
- Added acceptance-oriented API tests for show list, reschedule follow-up, and no-pending time-only input.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `api/src/lib/time/parseTimeRange.ts`
- `api/src/lib/time/parseTimeRange.test.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/actions/executor.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ❌ first run failed with TypeScript syntax error from malformed string literal in `chat.ts`.
- `pnpm --filter @familyscheduler/api test` ✅ second run passed (19 tests).

### Follow-ups

- Consider extracting fixed `-08:00` offset handling into timezone-aware formatting if DST-sensitive scheduling is required.


## 2026-02-19 UTC (chunk 10 full-context OpenAI parsing + per-session runtime scope)

### Objective

Implement full-context OpenAI parsing with per-session runtime state and safety boundaries (deterministic-first routing, confirmation hard-stop for mutations, bounded history/token controls).

### Approach

- Added per-session runtime map keyed by `x-session-id` (`default` fallback) to store identity, pending proposal, pending clarification, and chat history.
- Added `buildContext` envelope builder for OpenAI with timezone, identity, pending context, full data snapshot, and history truncation guardrails.
- Extended parser schema/prompt for `confidence` and `needsConfirmation`; enforced confidence threshold clarify fallback.
- Preserved deterministic routing first; OpenAI only used as fallback.
- Ensured all mutations require confirmation (including identity updates).
- Added ambiguity clarify for `mark 9 2026` and test coverage updates.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/lib/openai/buildContext.ts`
- `api/src/lib/openai/openaiClient.ts`
- `api/src/lib/openai/prompts.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/functions/chat.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ passed (20/20 tests).

### Follow-ups

- Add unit tests for `buildContext` truncation behavior (assistant-first truncation and hard character cap).

## 2026-02-19 01:22 UTC (OpenAI request/response NDJSON logging)

### Objective

Implement API-only OpenAI request/response logging with redaction, per-session correlation, NDJSON append/rotation, and default-off behavior.

### Approach

- Added a reusable NDJSON logger utility with directory creation and file size rotation.
- Added deep redaction helper for sensitive key names and `sig=` query values.
- Integrated logging in OpenAI client wrapper before/after OpenAI calls, including `traceId`, `sessionIdHash`, request/response payloads, parser validation errors, and latency.
- Updated chat handler to generate short trace IDs, hash session IDs, and pass both into OpenAI client calls.
- Added API tests to verify logging on/off behavior and redaction signals.
- Updated `PROJECT_STATUS.md` with new debug switches and logging behavior.

### Files changed

- `api/src/lib/logging/ndjsonLogger.ts`
- `api/src/lib/logging/redact.ts`
- `api/src/lib/openai/openaiClient.ts`
- `api/src/lib/openai/openaiClient.test.ts`
- `api/src/functions/chat.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ pass (build + full API test suite, including new logging tests).
- `rg -n "parseToActions\(" api/src` ✅ confirmed only updated call sites/signature usage.

### Follow-ups

- If needed later, split logs per day/session file for easier operational browsing in long-running environments.

## 2026-02-19 01:28 UTC (deterministic explicit update command + confirm/cancel synonyms)

### Objective

Fix deterministic update parsing to support explicit `update appointment ... start ... end ...` / `reschedule ... start ... end ...`, add confirm/cancel synonyms for pending proposal + yes/no clarification handling, and prevent standalone timezone acknowledgment replies from stranding the flow.

### Approach

- Added deterministic explicit reschedule command parser with strict patterns, appointment code normalization, ISO datetime parsing with and without offsets, and `end > start` validation.
- Implemented no-offset fallback to Pacific-local interpretation (`-08:00`) and a pending timezone-ack clarification (`confirmTimezone`) that proceeds to proposal on yes/confirm synonyms.
- Updated confirmation/cancellation logic to exact normalized synonyms instead of substring matching.
- Added/updated tests covering explicit deterministic command proposal/apply, `yes` as confirm, and timezone clarify -> `yes` -> proposal progression.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ passed.
- `pnpm --filter @familyscheduler/api build` ✅ passed.

### Follow-ups

- Consider DST-aware conversion for offset-less local timestamps if runtime needs seasonal offset correctness beyond current `-08:00` behavior.

## 2026-02-19 01:46 UTC (AI-first parser routing + strict response contract)

### Objective

Implement AI-first intent parsing with deterministic confirm/cancel gate, remove most regex command parsing, enforce strict parser response schema, add post-processing validation, and cover acceptance scenarios.

### Approach

- Reworked `chat.ts` routing to:
  - deterministically handle pending proposal (confirm/cancel/"Please confirm or cancel."),
  - send pending clarification turns to OpenAI with clarification context,
  - use OpenAI for all other non-help/non-session-init messages.
- Simplified deterministic parsing surface to only help, confirm/cancel synonyms, and passkey/session init handling.
- Migrated parser schema to `kind: reply|proposal|clarify` with required `message`, optional `actions`, and optional `confidence`.
- Added post-processing in chat for code normalization + existence validation + proposal action/summary guards.
- Added logging for full context envelope, raw model response, and validation errors.
- Replaced chat tests with acceptance tests matching the requested scenarios and fetch-mocked OpenAI responses.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/openai/prompts.ts`
- `api/src/lib/openai/openaiClient.ts`
- `api/src/lib/openai/openaiClient.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ❌ failed initially (schema test compile errors from old response shape).
- `pnpm --filter @familyscheduler/api test` ❌ failed second run (schema rejected non-canonical code before chat post-processor normalization).
- `pnpm --filter @familyscheduler/api test` ✅ passed (5/5 tests in current suite).

### Follow-ups

- Consider adding a dedicated unit test for chat post-processor code normalization to catch regressions independently from end-to-end acceptance tests.

## 2026-02-19 02:06 UTC (schema v2 date/startTime/duration with all-day default)

### Objective

Implement the new action schema semantics: appointment/availability mutations use `date + startTime? + durationMins?` (no end in schema), with date-only requests defaulting to all-day behavior.

### Approach

- Reworked action schema and parser validation for new fields and action names.
- Updated executor to compute start/end ISO via `resolveAppointmentTimes(...)`, default all-day when `startTime` is missing, and preserve backward compatibility by keeping legacy `start/end` optional.
- Updated chat snapshot shaping to return `desc/date/startTime?/durationMins?/isAllDay` and derive those from legacy stored `start/end` when needed.
- Updated OpenAI planner prompt schema instructions and help docs with new semantics/examples.
- Added/updated tests for validation rules and acceptance scenarios A/B/C.

### Files changed

- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/state.ts`
- `api/src/functions/chat.ts`
- `api/src/lib/openai/prompts.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/actions/executor.test.ts`
- `api/src/functions/chat.test.ts`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ❌ first run failed (`RangeError: Invalid time value` in timezone offset formatting).
- `pnpm --filter @familyscheduler/api test` ✅ pass after timezone offset normalization fix.

### Follow-ups

- Consider a future DST-focused utility for timezone-aware end-time rendering consistency if user-facing local-time display needs strict wall-clock semantics across all zones.


## 2026-02-19 02:16 UTC (people ops + appointment location schema v3)

### Objective

Implement ACTION_SCHEMA_VERSION v3 for full appointment people operations (add/remove/replace/clear, multi-person) plus optional appointment location end-to-end.

### Approach

- Extended action schema and parser validation for new people/location mutations.
- Added executor support with idempotent, case-insensitive people handling and location set/clear preview text.
- Added state/storage normalization for backward-compatible reads from older blobs lacking `people`/`location`.
- Updated chat snapshot/UI fields and OpenAI planner prompt guidance.
- Added acceptance-focused tests for schema, executor, and chat flow.

### Files changed

- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/actions/executor.test.ts`
- `api/src/lib/state.ts`
- `api/src/lib/storage/localFileStorage.ts`
- `api/src/lib/storage/azureBlobStorage.ts`
- `api/src/lib/openai/prompts.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `apps/web/src/App.tsx`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`

### Commands run + outcomes

- `pnpm -r --filter api test` ✅ pass.
- `pnpm -r --if-present build` ✅ pass.

### Follow-ups

- Consider removing legacy `assigned` from appointment model once all consumers are migrated.

## 2026-02-19 02:34 UTC (web UX simplify dashboard + minimal history)

### Objective

Apply UI-only polish in `apps/web`: hide Availability pane, reduce baseline typography/spacing, and collapse transcript by default while preserving clarify/proposal attention handling.

### Approach

- Updated dashboard rendering to remove the Availability section while leaving snapshot data contracts untouched.
- Added response-kind-driven UI state (`lastResponseKind`) and compact assistant callout shown only for clarify responses.
- Kept full transcript behind a subtle expandable/collapsible History link, with default hidden state.
- Reduced typography baseline to 14px and tightened table/card/input spacing for denser layout.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C apps/web build` ✅ build passed.
- `pnpm -C apps/web lint` ⚠️ script not defined in `apps/web/package.json`.

### Follow-ups

- Run full app manual QA (`pnpm dev`) to exercise clarify/proposal paths end-to-end against API.

## 2026-02-19 02:55 UTC (UEX notes column + persisted appointment notes)

### Objective

Add an appointment Notes column in web UI and implement persisted `notes` support end-to-end (schema/action/executor/snapshot) with backward compatibility for older blobs.

### Approach

- Added `notes` to appointment state model with normalization default `""` and max length clamp for legacy loads.
- Bumped action schema to v4 and added `set_appointment_notes {code,notes}` parser validation (trim + max 500).
- Extended executor mutation handling + preview text for set/clear notes; included notes in add/show flows.
- Included `notes` in chat snapshot + mutation gate list; updated planner prompt instructions.
- Added Notes column in `apps/web` appointments table with muted `—` fallback and ellipsis+hover for long notes.
- Expanded tests for schema/executor/chat plus a state normalization test for old blobs without notes.
- Updated prompt help and project status docs.

### Files changed

- `api/src/lib/state.ts`
- `api/src/lib/state.test.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/actions/executor.test.ts`
- `api/src/lib/openai/prompts.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`

### Commands run + outcomes

- `pnpm -r --filter api test` ❌ initial run failed (prompt string syntax error).
- `pnpm -r --filter api test` ✅ pass after prompt fix.
- `pnpm -C apps/web build` ✅ pass.
- `pnpm -C apps/web dev --host 0.0.0.0 --port 4173` ✅ launched for screenshot capture.
- Playwright screenshot capture ✅ artifact at `browser:/tmp/codex_browser_invocations/c4cc1b47ab8eba1c/artifacts/artifacts/notes-column.png`.

### Follow-ups

- Optionally add an explicit UI integration test for Notes column cell truncation behavior.

## 2026-02-19 03:00 UTC (ux title rename to Scheduler)

### Objective

Rename user-visible web UI branding from `FamilyScheduler` to `Scheduler` within `apps/web` only.

### Approach

- Updated static document title in web entry HTML.
- Updated visible application header label in React app shell.
- Verified no remaining `FamilyScheduler` user-facing string references in `apps/web`.

### Files changed

- `apps/web/index.html`
- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "FamilyScheduler|document.title|<title>" apps/web` ✅ located UI branding occurrences.
- `rg -n "FamilyScheduler" apps/web` ✅ no remaining matches after edits.

### Follow-ups

- Run local web app (`pnpm dev:web`) and confirm browser tab/header text visually in host environment.

## 2026-02-19 04:20 UTC (People pane + phone validation + rules + appt picker)

### Objective

Implement people-management overhaul across API/web with phone validation, availability rules, and appointment people picker while keeping confirm gate.

### Approach

- Migrated state model to `people` and `rules` with legacy availability back-compat.
- Added phone validation utility and server-side validations in executor for people add/update.
- Expanded action schema/planner surface for people/rules actions and updated chat snapshot structure.
- Reworked web UI with Appointments/People toggle, People table actions, rule shortcuts, and appointment picker status tags.
- Updated prompt help + continuity docs.

### Files changed

- `api/src/lib/state.ts`
- `api/src/lib/validation/phone.ts`
- `api/src/lib/availability/computeStatus.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/functions/chat.ts`
- `api/src/lib/openai/buildContext.ts`
- `api/src/lib/openai/prompts.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api add libphonenumber-js` ⚠️ blocked by npm registry 403 (no auth header in environment).
- `pnpm -r --filter @familyscheduler/api test` (pending; run after compile fixes).
- `pnpm -C apps/web build` (pending; run after compile fixes).

### Follow-ups

- Replace fallback phone validation helper with `libphonenumber-js` once registry access is available.

### Verification addendum

- `pnpm -r --filter @familyscheduler/api test` ✅ pass.
- `pnpm -C apps/web build` ✅ pass.
- `pnpm -C apps/web dev --host 0.0.0.0 --port 4173` ✅ launched for screenshot capture.
- Playwright screenshot capture ✅ artifact at `browser:/tmp/codex_browser_invocations/2a3f08c69739c60e/artifacts/artifacts/people-view.png`.

## 2026-02-19 04:10 UTC (people pane ux: icon actions, delete confirm, rule modal)

### Objective

Implement People-pane UX actions: icon action buttons, delete/deactivate confirmation flow, and a modal-based availability/unavailability rule proposal form.

### Approach

- Replaced People-row text action buttons with compact icon-only buttons and hover tooltips.
- Added dedicated delete-confirm modal that submits a deactivation command for the selected person.
- Added rule proposal modal with date, all-day toggle, native time input, duration select, and optional notes/reason.
- Ensured active-only filtering is applied in People table view (inactive hidden by default), while appointment people picker continues to list active people only.
- Updated project continuity status notes.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm install` ⚠️ failed for new dependency fetch attempt due to registry access restriction (`ERR_PNPM_FETCH_403`).
- `pnpm -C apps/web typecheck` ✅ passed.
- `pnpm -C apps/web build` ✅ passed.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- If strict shadcn primitives are required (Tooltip/Popover/Calendar/Switch/Button components), install and wire those UI dependencies once registry access is available; current implementation preserves requested UX behavior with existing stack.

## 2026-02-19 04:33 UTC (people rules visibility + snapshot refresh)

### Objective

Implement People view availability rules visibility and delete flow, ensure confirm/cancel updates UI snapshot state, and include complete rule fields in API snapshot.

### Approach

- Updated API response snapshot mapping for rules to include `timezone`.
- Added acceptance test coverage that confirms `add_rule` + confirm returns `snapshot.rules` with expected fields.
- Updated web People table with collapsed per-person Rules section toggled by Clock icon.
- Added inline rule rows with status badge/date/time/notes and delete button.
- Added delete-rule confirmation modal that sends a rule-delete command.
- Kept confirm/cancel message flow routed through `sendMessage`, which updates snapshot from response payload.
- Updated `PROJECT_STATUS.md` recent changes.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter api test` ✅ passed.
- `pnpm --filter web build` ✅ passed.
- `pnpm -r --if-present build` ✅ passed.

### Follow-ups

- Optional: add UI-level automated test for People rules expand/delete interactions.

## 2026-02-19 04:58 UTC (people inline rules + prompt hide + add_rule conflict auto-resolve)

### Objective

Implement People UX updates (inline rules + no prompt label/input) and API conflict policy for overlapping opposite-kind availability rules, including explicit conflict preview messaging.

### Approach

- Removed People row clock-toggle behavior and always render rules inline when a person has at least one rule.
- Added rule sorting (date asc, then all-day first, then start time) for People rule rows.
- Scoped prompt input rendering to Appointments view only, leaving backend prompt system unchanged.
- Introduced shared availability interval helper (`intervalBounds` + `overlaps`) and reused it in status computation and rule conflict handling.
- Updated `add_rule` executor path to auto-remove overlapping opposite-kind rules for same person/date, then insert the new rule.
- Added explicit effect lines for proposal/confirm text, including `This will remove X conflicting rule(s).` and per-rule removal details.
- Updated proposal response generation to use executor dry-run effects so preview text in confirm modal is explicit.
- Added executor tests for both conflict directions and same-kind overlap allowance.

### Files changed

- `apps/web/src/App.tsx`
- `api/src/lib/availability/interval.ts`
- `api/src/lib/availability/computeStatus.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/functions/chat.ts`
- `api/src/lib/actions/executor.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter api test` ❌ failed initially due temporary TypeScript syntax error introduced during edit; fixed.
- `pnpm --filter api test` ✅ passed after fix.
- `pnpm --filter web build` ✅ passed.
- `pnpm --filter web dev --host 0.0.0.0 --port 4173` ✅ launched for screenshot capture.
- Playwright screenshot capture ✅ artifact at `browser:/tmp/codex_browser_invocations/843d72d0688e6550/artifacts/artifacts/people-inline-rules.png`.

### Follow-ups

- Optional: add web UI automation test for People inline rule rendering + prompt input hidden in People view.

## 2026-02-19 05:09 UTC (assign people modal alignment + UX polish)

### Objective

Fix Assign People modal alignment issue by rendering each person as a single row and improve selection interaction clarity.

### Approach

- Reworked assign-people modal row rendering to one row per person with left-side checkbox/name and right-side status badge.
- Added shared toggle helper so row click and checkbox click both update selected people deterministically.
- Added list/row styles for hover affordance, consistent spacing, optional separators, and fixed badge column width to prevent jitter.
- Updated continuity docs with behavior change and captured verification commands.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed and produced Vite build output.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ launched for visual check (stopped with SIGINT after capture).
- Playwright screenshot capture via browser tool ✅ artifact: `browser:/tmp/codex_browser_invocations/0423b99c7793512f/artifacts/artifacts/assign-people-ui.png`.

### Follow-ups

- Validate assign-people modal interactions end-to-end against live appointment data in local full-stack run (`pnpm dev`) to visually confirm row behavior in the modal itself.

## 2026-02-19 05:32 UTC (AI question dialog + structured clarify options)

### Objective

Replace text-only `clarify` handling with structured AI `question` responses and add a blocking web dialog that supports up to 5 suggested answer buttons plus optional free-text reply, while keeping proposal confirm flow unchanged.

### Approach

- Extended parser response schema to include `kind="question"`, `options` (max 5), and `allowFreeText`, with compatibility mapping from legacy `clarify` to `question`.
- Updated OpenAI planner system prompt to instruct `question` usage, 2–5 short options when clear, natural-language option values, and max-5 cap.
- Updated chat function response routing from clarify -> question semantics, including no-proposal confirm fallback and validation/parse fallback questions.
- Added pending-question state on web client and introduced a dedicated `QuestionDialog` modal that:
  - blocks while pending,
  - renders up to 5 option buttons,
  - supports free-text input when allowed,
  - sends selected option value or typed text as the next `/api/chat` message,
  - supports Close to dismiss without mutation.
- Left proposal confirm/cancel modal behavior unchanged.
- Updated docs and project continuity notes to document dialog behavior.

### Files changed

- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/openai/prompts.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `docs/prompt-help.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` (pending)
- `pnpm --filter @familyscheduler/web typecheck` (pending)
- `pnpm --filter @familyscheduler/web build` (pending)

### Follow-ups

- Run manual full-stack QA for Excel-paste duplicate appointment scenario and validate API question options + question->proposal->confirm progression end-to-end.

### Verification updates (post-implementation)

- `pnpm --filter @familyscheduler/api test` ✅ passed (8 tests).
- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ launched for screenshot capture (stopped with SIGINT after capture).
- Playwright screenshot with mocked `/api/chat` response ✅ artifact: `browser:/tmp/codex_browser_invocations/5eb466f6dede5a7d/artifacts/artifacts/question-dialog.png`.

## 2026-02-19 05:49 UTC (appointments location/notes multiline display)

### Objective

Fix the appointments table so long `Location` and `Notes` values are readable without excessive horizontal scrolling.

### Approach

- Added a targeted `multiline-cell` class to appointments `Location` and `Notes` table cells only.
- Added scoped CSS for `.data-table td.multiline-cell` to enable `pre-wrap` and apply bounded width so content wraps into multiple lines while the rest of the table remains unchanged.
- Updated continuity docs to reflect the UI behavior change.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ launched for visual verification (stopped with SIGINT after screenshot capture).
- Playwright screenshot capture ✅ artifact: `browser:/tmp/codex_browser_invocations/199c65cc30e725c7/artifacts/artifacts/appointments-multiline.png`.

### Follow-ups

- Optional: add visual regression coverage for appointment table cell wrapping behavior.

## 2026-02-19 05:52 UTC (appointments description multiline display)

### Objective

Change the Appointments pane `Description` column to render as multi-line wrapped content, matching Location/Notes readability behavior.

### Approach

- Applied existing `multiline-cell` table cell class to the Description `<td>` in appointments rows.
- Reused existing CSS (`.data-table td.multiline-cell`) to avoid new style surface area and keep smallest-change scope.
- Updated continuity docs to reflect Description now wraps in the appointments table.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` (pending)
- `pnpm --filter @familyscheduler/web build` (pending)

### Follow-ups

- Optional: include Description wrapping in any future visual regression coverage for appointments table layout.

### Verification updates (post-implementation)

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ launched for visual verification (stopped with SIGINT after screenshot capture).
- Playwright screenshot capture ✅ artifact: `browser:/tmp/codex_browser_invocations/46723266d1c1da17/artifacts/artifacts/appointments-description-multiline.png`.

## 2026-02-19 06:15 UTC (appointments inline direct editing + add/delete)

### Objective

Implement deterministic inline appointment editing with direct API mutations, plus add-row and delete-row controls in the Appointments pane.

### Approach

- Added `/api/direct` Azure Function endpoint to execute a single deterministic action against storage and return updated snapshot (`{ ok, snapshot }`).
- Extended action schema + executor for direct appointment actions (`create_blank_appointment`, field setters, delete reuse).
- Updated Appointments table UX to include:
  - `Add` button (creates blank appointment row directly)
  - inline editable date/time/description/location/notes cells
  - per-row delete icon with confirm modal
- Kept AI chat pathway intact for complex operations; inline edits bypass `/api/chat`.

### Files changed

- `api/src/index.ts`
- `api/src/functions/direct.ts`
- `api/src/functions/direct.test.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/actions/executor.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ passed (10 tests).
- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ launched for screenshot attempt.
- Playwright screenshot attempt ⚠️ failed due browser container Chromium SIGSEGV on launch.

### Follow-ups

- Optional: switch appointments table to click-to-open popovers for date/time pickers and textarea editors if stricter interaction parity is required.

## 2026-02-19 06:19 UTC (location normalization + map link)

### Objective

Implement deterministic appointment location formatting with raw fidelity storage, backward-compatible action payloads, and a web map link UX.

### Approach

- Added a deterministic location normalizer utility and unit tests.
- Expanded appointment model/state normalization to persist `locationRaw`, `locationDisplay`, and `locationMapQuery`, including legacy `location` migration defaults.
- Updated action schema/executor and direct endpoint parsing to accept either `{location}` or `{locationRaw}` and always persist normalized display/query fields.
- Updated appointments table location cell UX: raw textarea edit on blur, normalized multi-line preview clamp, and external Google Maps search link.
- Updated continuity docs with behavior changes.

### Files changed

- `api/src/lib/location/normalize.ts`
- `api/src/lib/location/normalize.test.ts`
- `api/src/lib/state.ts`
- `api/src/lib/state.test.ts`
- `api/src/lib/actions/schema.ts`
- `api/src/lib/actions/schema.test.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/actions/executor.test.ts`
- `api/src/functions/direct.ts`
- `api/src/functions/direct.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ passed (build + node test suite).
- `pnpm --filter @familyscheduler/web build` ✅ passed (typecheck + vite build).
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; terminated with SIGINT after capture.

### Follow-ups

- Optional: implement feature-flagged AI-assisted location reformatting path (`LOCATION_AI_FORMATTING`) as a non-blocking enhancement if desired.

## 2026-02-19 06:35 UTC (appointments UX: row edit mode + full width + compact typography)

### Objective

Implement appointments UX cleanup in `apps/web`: single-row edit mode with Edit/Done actions, auto-edit on Add, full-width layout, and reduced typography scale.

### Approach

- Added `editingApptCode` state and single-row edit toggling behavior.
- Updated direct action helper to return latest snapshot so Add can detect the newly created appointment and immediately place it in edit mode.
- Reworked appointments table render logic:
  - Read-only text cells by default.
  - Inputs/textareas shown only for the active editing row.
  - Added Duration column with compact numeric editor in edit mode.
  - Added Edit/Done + Delete actions in each row.
- Updated CSS for full-width main layout, slightly denser controls, and read-only multiline clamps for description/notes/location.
- Captured screenshot artifact of updated UI.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture.
- Playwright screenshot capture via browser tool ✅ succeeded (`appointments-ux-fullwidth.png`).
- Stopped dev server with SIGINT after capture ✅ expected.

### Follow-ups

- Optional: add keyboard shortcut (Esc) to exit row edit mode for faster data entry ergonomics.

## 2026-02-19 06:31 UTC (appointments row edit cancel UX)

### Objective

Make appointment row edit mode easier to exit by adding explicit cancel affordances beyond the Done icon.

### Approach

- Added keyboard cancel: while an appointment row is in edit mode, pressing `Escape` exits edit mode.
- Added pointer cancel: clicking/tapping outside the active editing row exits edit mode.
- Added an edit-row `ref` and scoped outside-click detection to the currently edited `<tr>`.
- Updated Done icon tooltip to `Done (Esc/outside click)` so the behavior is discoverable.
- Updated `PROJECT_STATUS.md` continuity notes.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started successfully (terminated with SIGINT after verification).

### Follow-ups

- Optional: add visible helper text in the Actions column for edit mode keyboard shortcuts if discoverability is still an issue for first-time users.

## 2026-02-19 06:47 UTC (web density toggle + compact spacing)

### Objective

Implement a compact/normal density switch in the web UI that persists across reloads and reduces typography/spacing in compact mode without changing default normal behavior.

### Approach

- Added density CSS variables on `:root` and a compact override via `body[data-density='compact']`.
- Applied tokens to main container padding, panel blocks, form controls, table cells, picker rows, rule rows, and modal padding.
- Added a density toggle button in the App header row, persisted choice to `localStorage` (`ui-density`), and synced `document.body.dataset.density` in `useEffect`.
- Captured before/after screenshots for normal and compact densities.

### Files changed

- `apps/web/src/styles.css`
- `apps/web/src/App.tsx`
## 2026-02-19 06:46 UTC (AI-assisted location parsing into structured fields)

### Objective

Implement optional API-side AI location parsing into structured fields (`name/address/directions`) with safe fallback heuristic behavior, and wire display/map-link behavior in web UI to the new fields.

### Approach

- Extended appointment state with `locationName`, `locationAddress`, and `locationDirections` defaults/migration support while preserving legacy `location` compatibility.
- Added `aiParseLocation` module with OpenAI JSON parsing, field trimming/clamping, privacy-aware logging (`LOCATION_AI_LOG_RAW`), and automatic fallback to existing heuristic normalizer.
- Hooked `set_appointment_location` execution path to always store `locationRaw`; use AI parsing when `LOCATION_AI_FORMATTING=true`, otherwise keep heuristic normalization and empty structured fields.
- Updated API snapshots (chat/direct) and web types/UI map-link fallback chain to use `locationMapQuery || locationAddress || locationDisplay || locationRaw` and preserve multiline display clamping.
- Added/updated tests for async executor behavior, migration defaults, and AI parser fallback/JSON parse behavior.

### Files changed

- `api/src/lib/state.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/actions/executor.test.ts`
- `api/src/lib/location/aiParseLocation.ts`
- `api/src/lib/location/aiParseLocation.test.ts`
- `api/src/lib/state.test.ts`
- `api/src/functions/direct.ts`
- `api/src/functions/chat.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `packages/shared/src/types.ts`
- `api/local.settings.example.json`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg --files -g 'AGENTS.md'` ✅ confirmed no additional AGENTS instructions inside repo tree.
- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 5173` ✅ started Vite dev server for screenshot capture (stopped via SIGINT after capture).
- Playwright browser script (normal + compact screenshots) ✅ captured artifact images.

### Follow-ups

- Optional: add density toggle placement/styling refinement if product wants a dedicated settings area.
- `pnpm --filter @familyscheduler/api test` ✅ passed after TypeScript test mock-cast fix.
- `pnpm -r --if-present build` ✅ passed for shared/api/web workspaces.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started locally for screenshot capture.

### Follow-ups

- With `LOCATION_AI_FORMATTING=true` and valid `OPENAI_API_KEY`, run a manual end-to-end verification using the provided EvergreenHealth sample to validate extracted address/directions quality.
