# CODEX_LOG

## 2026-02-21 03:42 UTC (page header group block vertical packing)

### Objective

Tighten vertical spacing for the group name + share link + copy icon + explainer so the block reads as one unit in `PageHeader`.

### Approach

- Wrapped group name + link row + explainer into a single compact vertical container rendered only when `groupName` is present.
- Removed default heading/paragraph margins in the group block (`h1` margin set to `0`, pane title paragraph margin set to `0`).
- Kept link row as a wrapping flex line with centered item alignment and `0.5rem` gap so the copy icon stays aligned with the link at narrow widths.
- Reduced explainer spacing and typography (`marginTop: 0`, tighter line height, slightly smaller font) to remove large vertical gaps.
- Captured a browser screenshot using API route interception to validate visual spacing without requiring the API server.

### Files changed

- `apps/web/src/components/layout/PageHeader.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,140p' apps/web/src/components/layout/PageHeader.tsx` ✅ inspected current structure before edit.
- `pnpm --filter @familyscheduler/web build` ✅ TypeScript + Vite build passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started local web app for visual verification (stopped after screenshot).
- `run_playwright_script` (with `/api/group/meta` and `/api/group/join` route interception) ✅ captured `pageheader-group-tight-pack.png`.

### Follow-ups

- Validate on a real API-backed join route in local human-run environment to confirm identical spacing under live metadata responses.

## 2026-02-21 UTC (deploy staging node_modules guarantee + diagnostics)

### Objective

Fix deploy workflow failure at `Validate deploy staging directory` caused by missing `api_deploy/node_modules`, and add deterministic diagnostics to prove install/copy stages.

### Approach

- Replaced the deploy staging step script in `.github/workflows/deploy.yml` with a traced (`set -x`) flow that:
  - rebuilds clean staging directories (`api_deploy`, `api_deploy_install`),
  - runs `pnpm --filter @familyscheduler/api deploy --legacy --prod ./api_deploy_install`,
  - asserts `api_deploy_install/node_modules` exists,
  - copies dependencies into staging via `cp -RL` to dereference symlinks,
  - hard-asserts key Azure package directories under `api_deploy/node_modules`.
- Kept the separate staging validation step for redundant guardrails.
- Updated continuity docs to record root failure point and new staging diagnostics/guarantees.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,240p' .github/workflows/deploy.yml` ✅ verified staging script replacement and assertions.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified targeted minimal diff and continuity updates.

### Follow-ups

- Re-run GitHub Actions workflow **Deploy API (prod)** and inspect new DEBUG markers if any failure remains.
- If failure persists, compare whether `api_deploy_install/node_modules` assert or `cp -RL` post-copy asserts fail first.

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

## 2026-02-19 07:20 UTC (group link + phone-gated join + per-group state)

### Objective

Implement lightweight group creation/join with phone allowlist gating, move storage to per-group blob/file layout, and wire web hash routes/session propagation.

### Approach

- Refactored API storage adapter contract to `load(groupId)` / `save(groupId, ...)` / `initIfMissing(groupId, initialState?)`.
- Implemented per-group local and Azure state paths under `STATE_BLOB_PREFIX/<groupId>/state.json`.
- Added `group/create` and `group/join` endpoints; join checks active People allowlist by normalized E.164 phone.
- Gated `/api/chat` and `/api/direct` by required `groupId` + `phone`.
- Added web create/join/app routing and localStorage session checks; all API calls now include `groupId` + `phone`.
- Updated docs and replaced API tests with focused coverage for group gating behavior.

### Files changed

- `api/src/lib/state.ts`
- `api/src/lib/storage/storage.ts`
- `api/src/lib/storage/localFileStorage.ts`
- `api/src/lib/storage/azureBlobStorage.ts`
- `api/src/lib/groupAuth.ts`
- `api/src/functions/groupCreate.ts`
- `api/src/functions/groupJoin.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/direct.ts`
- `api/src/index.ts`
- `api/src/functions/chat.test.ts`
- `api/src/functions/direct.test.ts`
- `api/src/lib/state.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/AppShell.tsx`
- `README.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` ✅
- `pnpm --filter @familyscheduler/api test` ✅
- `pnpm --filter @familyscheduler/web build` ✅
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ (started for screenshot; stopped with SIGINT)
- Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/cdff90f504036a32/artifacts/artifacts/create-group-page.png`

### Follow-ups

- Replace local phone parser with `libphonenumber-js` once registry access is available in the environment.

## 2026-02-19 07:42 UTC (create group seed + share link + create page polish)

### Objective

Fix Create Group flow so creator is automatically added to People, share link is visible immediately after create, and form layout is polished.

### Approach

- Updated `POST /api/group/create` to seed creator into `people[]` with normalized phone + createdAt and return `groupName`, `creatorPersonId`, and `linkPath`.
- Added debug log for successful creates (`traceId`, `groupId`, `peopleCount`).
- Updated web Create page to keep user on create screen post-submit, show share link + copy button, and add Continue-to-app action.
- Added initial app snapshot fetch on AppShell mount and a dev-only warning banner when snapshot people is empty.
- Polished create form spacing/alignment via scoped CSS utility classes.
- Added API tests for group create success path (creator seeded) and invalid phone rejection.

### Files changed

- `api/src/functions/groupCreate.ts`
- `api/src/lib/state.ts`
- `api/src/functions/groupCreate.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/AppShell.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` ✅
- `pnpm --filter @familyscheduler/api test` ✅
- `pnpm --filter @familyscheduler/web build` ✅

### Follow-ups

- Consider passing normalized creator phone from create response/session write to avoid keeping raw input formatting in local session payload.

## 2026-02-19 07:58 UTC (remove density toggle + creator name + app-route join gate)

### Objective

Implement the requested focused updates across web+api: remove density toggle, collect/store creator display name, and enforce authorization gating when entering `/#/g/:groupId/app`.

### Approach

- Removed density toggle state/UI wiring from `AppShell` and retained compact spacing as the default CSS token set.
- Added required `Your name` field on create-group page and sent `creatorName` to API.
- Updated `groupCreate` API validation to require trimmed `creatorName` (max 40) and seed creator person with that name.
- Strengthened app-route guard: session/phone required; group mismatch clears session; join verification failure clears session and redirects with `?err=not_allowed`; join page surfaces this error.
- Added explicit `group_not_found` handling by introducing `GroupNotFoundError` from storage adapters and mapping it in `groupJoin`, `chat`, and `direct`.
- Added/updated API tests for creator name persistence and missing-group gate responses.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/AppShell.tsx`
- `apps/web/src/styles.css`
- `api/src/functions/groupCreate.ts`
- `api/src/functions/groupJoin.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/direct.ts`
- `api/src/lib/storage/storage.ts`
- `api/src/lib/storage/localFileStorage.ts`
- `api/src/lib/storage/azureBlobStorage.ts`
- `api/src/functions/groupCreate.test.ts`
- `api/src/functions/chat.test.ts`
- `api/src/functions/direct.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/api test` ✅ passed (8 tests).
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; terminated with SIGINT after capture.

### Follow-ups

- Validate full end-to-end join redirect behavior in local integrated `pnpm dev` environment with API host running.

## 2026-02-19 08:17 UTC (hard route gate + auth trace logs)

### Objective

Enforce a hard access gate for `/#/g/:groupId/app` (no app render before join authorization), propagate deny reasons to join page, and add traceable auth logs across web and API.

### Approach

- Reworked web guarded route flow to explicit `authStatus` (`checking|allowed|denied`) and deny reason codes.
- Added per-navigation `traceId`, hard non-render policy until allow, and `replace` redirects to avoid back-loop.
- Propagated `err` + `trace` query params to join page and added join-page error banner mapping + debug logs.
- Added API auth logging utility and instrumented `/api/group/join`, `/api/chat`, and `/api/direct` gate stages behind `DEBUG_AUTH_LOGS`.
- Documented auth debug flags in README and PROJECT_STATUS.

### Files changed

- `apps/web/src/App.tsx`
- `api/src/lib/logging/authLogs.ts`
- `api/src/functions/groupJoin.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/direct.ts`
- `README.md`
- `PROJECT_STATUS.md`

### Commands run + outcomes

- `pnpm -r --if-present test` ✅ all existing API tests passed.
- `pnpm -r --if-present build` ❌ first run failed on a TypeScript narrowing issue in `apps/web/src/App.tsx`.
- `pnpm -r --if-present build` ✅ second run passed after fixing denied-error narrowing.

### Follow-ups

- Run manual browser QA script for incognito / wrong phone / allowed scenarios and capture trace-linked logs.

## 2026-02-19 08:45 UTC (route gate hardening + initial chat dedupe)

### Objective

Enforce join gating for `/#/g/:groupId/app` and stop duplicate/early `/api/chat` bootstrap calls.

### Approach

- Reworked app-route protection into `GroupAuthGate` that checks session presence/group match and validates with `/api/group/join` before mounting `AppShell`.
- Added debug log stages requested for gate enter/request/result/redirect.
- Ensured `AppShell` initial snapshot bootstrap executes exactly once via `useRef` guard and emits `initial_chat_triggered` only once when enabled.
- Updated continuity doc (`PROJECT_STATUS.md`) with the new gate + dedupe behavior.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `git diff -- apps/web/src/App.tsx apps/web/src/AppShell.tsx PROJECT_STATUS.md CODEX_LOG.md` ✅ verified scoped diffs.

### Follow-ups

- Manual browser QA in incognito for hash-route redirect and network-call verification with `VITE_DEBUG_AUTH_LOGS=true`.


## 2026-02-19 UTC (people pane row-edit parity + direct people actions)

### Objective

Make People pane match Appointments pane UX (row-based add/edit/delete), add deterministic direct people actions, and enforce join allowlist semantics for active people with phones only.

### Approach

- Added `/api/direct` actions: `create_blank_person`, `update_person`, and `delete_person` (soft delete to `removed`).
- Added server-side validation in direct update path for required name, valid phone normalization, and duplicate active-phone rejection.
- Updated state normalization/status handling to preserve blank draft people and map legacy inactive status to removed.
- Updated People pane to inline row edit mode with draft state, Done save, outside-click/Esc cancel, and auto-delete newly created blank rows when canceled untouched.
- Kept People availability-rule controls and table styling aligned with existing appointments table density/action icon styling.

### Files changed

- `api/src/functions/direct.ts`
- `api/src/functions/direct.test.ts`
- `api/src/lib/state.ts`
- `api/src/lib/groupAuth.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/functions/chat.ts`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -w --filter ./api test` ✅ pass (including new direct people-action test).
- `pnpm -w --filter ./apps/web build` ✅ pass.
- `pnpm --filter ./apps/web dev --host 0.0.0.0 --port 4173` ✅ starts locally; manually stopped after screenshot attempt.
- `mcp__browser_tools__run_playwright_script` ⚠️ failed in this environment due Chromium crash (`SIGSEGV`), so no screenshot artifact available.

### Follow-ups

- If Playwright/browser container stability improves, capture a People-pane screenshot for visual QA documentation.

## 2026-02-19 18:01 UTC (CODEX-001 global UI baseline)

### Objective

Add a compact global UI baseline (typography, spacing, controls, table density) and wire Inter font imports without performing layout refactors.

### Approach

- Added a new global stylesheet at `apps/web/src/styles/ui.css` with baseline tokens and compact control/table defaults.
- Imported Inter font weights (`400/500/600`) and global UI CSS once in `apps/web/src/main.tsx`.
- Added `@fontsource/inter` dependency to `apps/web/package.json` (install blocked in this environment by npm registry 403).
- Updated `PROJECT_STATUS.md` with the requested `UI Baseline (CODEX-001)` status section.

### Files changed

- `apps/web/src/styles/ui.css`
- `apps/web/src/main.tsx`
- `apps/web/package.json`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm add @fontsource/inter` ❌ blocked by pnpm workspace root check (requires `-w` or package filter).
- `pnpm --filter @familyscheduler/web add @fontsource/inter` ⚠️ failed in this environment due to npm registry access error (`ERR_PNPM_FETCH_403`).
- `pnpm --filter @familyscheduler/web build` ❌ failed because `@fontsource/inter` could not be resolved (dependency install blocked by registry 403).

### Follow-ups

- Run `pnpm --filter @familyscheduler/web add @fontsource/inter` in a network-enabled environment.
- Run `pnpm install` then `pnpm dev` to visually verify compact typography/controls/table density and no layout breakage.

## 2026-02-19 18:06 UTC (CODEX-002 favicon + browser title)

### Objective

Replace the default favicon with a minimal calendar SVG and set browser tab title to `Family Scheduler`.

### Approach

- Added a new static favicon at `apps/web/public/favicon.svg`.
- Updated `apps/web/index.html` to reference `/favicon.svg` and set a single `<title>Family Scheduler</title>`.
- Updated continuity documentation in `PROJECT_STATUS.md` with a dedicated `UI Polish (CODEX-002)` section.

### Files changed

- `apps/web/public/favicon.svg`
- `apps/web/index.html`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `mkdir -p apps/web/public && cat > apps/web/public/favicon.svg ...` ✅ created favicon asset.
- `python - <<'PY' ...` ✅ updated `apps/web/index.html` favicon link and title.
- `python - <<'PY' ...` ✅ inserted `UI Polish (CODEX-002)` notes into `PROJECT_STATUS.md`.
- `pnpm dev` ⚠️ failed due existing environment/dependency issues (`@fontsource/inter/*` unresolved in web and missing `func` binary for API), preventing full browser verification in this container.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- Install/restore web font dependencies and Azure Functions Core Tools to run `pnpm dev` end-to-end and manually confirm favicon/title in browser.
- Hard refresh the browser tab (`Shift+Reload`) after startup to force favicon cache refresh.

## 2026-02-19 18:14 UTC (CODEX-003 layout primitives)

### Objective

Add reusable layout primitives (`Page`, `PageHeader`, `FooterHelp`) without migrating existing pages.

### Approach

- Created new `apps/web/src/components/layout/` folder and added the three layout components with the exact requested structure.
- Updated `PROJECT_STATUS.md` with a new CODEX-003 UI Structure section.
- Ran local dev startup check to verify compilation and catch runtime startup issues.

### Files changed

- `apps/web/src/components/layout/Page.tsx`
- `apps/web/src/components/layout/PageHeader.tsx`
- `apps/web/src/components/layout/FooterHelp.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.
- `pnpm dev` ⚠️ web host started, but startup failed due existing environment issues (`@fontsource/inter/latin-*.css` unresolved and missing `func` binary for API).

### Follow-ups

- Migrate existing pages to the new layout primitives in a separate task.

## 2026-02-19 22:43 UTC (CODEX-004 join gate UX upgrade)

### Objective

Upgrade the join gate route UX to use form layout primitives, show group metadata, improve error copy, and keep controls professionally sized.

### Approach

- Updated `JoinGroupPage` in `apps/web/src/App.tsx` to render with `Page`, `PageHeader`, and `FooterHelp`.
- Added a new anonymous API endpoint `GET /api/group/meta?groupId=...` to fetch public group metadata (`groupName`, `groupId`) without requiring phone.
- Added lightweight API tests for `groupMeta` success and missing-group behavior.
- Added CSS for form-card layout and join action/button sizing so the primary button is no longer full width.
- Updated continuity status in `PROJECT_STATUS.md`.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/components/layout/PageHeader.tsx`
- `api/src/functions/groupMeta.ts`
- `api/src/functions/groupMeta.test.ts`
- `api/src/index.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api test` ✅ passed (11/11 tests).
- `pnpm --filter @familyscheduler/web build` ✅ passed (TypeScript + Vite build).
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 5173` ✅ started local web server for visual verification.
- Playwright screenshot capture ✅ created artifact at `browser:/tmp/codex_browser_invocations/fb78986d48e7e915/artifacts/artifacts/join-gate-ux.png`.

### Follow-ups

- Optional: if preferred, include a secondary cancel button in the join action row.
- Optional: surface API trace IDs in join errors for deep support diagnostics.

## 2026-02-19 22:53 UTC (CODEX-005 create group UX upgrade)

### Objective

Upgrade the Create Group page to use form layout primitives and present a polished post-create sharing experience.

### Approach

- Migrated `CreateGroupPage` in `apps/web/src/App.tsx` to the `Page` + `PageHeader` + `FooterHelp` form layout.
- Replaced the old full-width create submit styling with `fs-btnPrimary` action-row controls.
- Added post-create “Your schedule is ready” section with group name hierarchy, group ID metadata, read-only share link, copy-to-clipboard interaction, and compact next-steps checklist.
- Added `fs-alert` styles to support the checklist callout.
- Updated `PROJECT_STATUS.md` with a `Create Group UX (CODEX-005)` section.
- Captured a UI screenshot with Playwright using a mocked `/api/group/create` response (API host unavailable in this container because `func` is missing).

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 5173` ✅ started for visual verification.
- `pnpm --filter @familyscheduler/api dev` ⚠️ failed (`func: not found`) in this environment.
- `mcp__browser_tools__run_playwright_script` ✅ captured screenshot artifact `create-group-ux-upgrade.png` with mocked create API.

### Follow-ups

- Install Azure Functions Core Tools (`func`) in local dev/runtime to run full-stack `pnpm dev` and verify create flow against real API.

## 2026-02-19 23:00 UTC (CODEX-006 appointments workspace UX upgrade)

### Objective

Upgrade the appointments workspace UX with page layout primitives, empty-state CTA, and multiline auto-growing description editing.

### Approach

- Updated `AppShell` to use `Page variant="workspace"`, `PageHeader`, and `FooterHelp` for app-level workspace framing.
- Added group metadata loading for the header (`groupName`) via `/api/group/meta` fallback.
- Updated appointments panel UX:
  - `Add Appointment` button now uses `fs-btnPrimary` and non-full-width behavior.
  - Added empty-state alert panel with CTA wired to existing `addAppointment` flow.
- Updated appointment description edit control to use `<textarea>` with auto-grow helper and edit-entry grow trigger.
- Updated continuity docs in `PROJECT_STATUS.md`.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 5173` ✅ started for browser verification (stopped with SIGINT after capture).
- `mcp__browser_tools__run_playwright_script` ✅ captured screenshot artifact `appointments-workspace-ux.png`.

### Follow-ups

- Optional: convert more row-edit textareas (location/notes) to auto-grow for full consistency.

## 2026-02-19 23:06 UTC (CODEX-006/007/008 workspace pages + multiline + polish)

### Objective

Complete workspace UX and polish updates across Appointments and People views, including empty states, access clarity copy, multiline auto-grow editing, and button/style consistency.

### Approach

- Updated `AppShell` header content to reflect active tab (`Appointments` vs `People`) while preserving shared workspace layout + footer.
- Added People access clarity copy under the page header.
- Added People empty state panel with “Add Person” CTA using existing add-person handler.
- Ensured “Add Person” uses `fs-btnPrimary` styling and non-full-width behavior.
- Rendered read-only phone values in monospace (`var(--font-mono)`) without changing validation/edit flows.
- Kept Appointments empty state + “Add Appointment” label and enabled auto-grow behavior for notes textarea during edit mode.
- Updated `PROJECT_STATUS.md` with CODEX-006/007/008 status bullets.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "Add blank row"` ✅ confirmed legacy copy no longer present.
- `pnpm -r --if-present build` ✅ workspace build succeeded for `api`, `apps/web`, and `packages/shared`.
- `pnpm dev` ⚠️ failed because Azure Functions Core Tools (`func`) is not installed in this environment.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ launched web UI for visual check/screenshot capture.

### Follow-ups

- Run full `pnpm dev` in an environment with Azure Functions Core Tools installed to validate end-to-end app routing and auth gate behavior with API online.

## 2026-02-20 00:31 UTC (CODEX-009 workspace layout normalization)

### Objective

Normalize workspace pages to a centered wide column, add horizontal overflow behavior for wide tables, and remove duplicate Appointments/People headings.

### Approach

- Added `fs-workspaceWrap` and `fs-tableScroll` helpers in `apps/web/src/styles/ui.css`.
- Updated workspace variant in `Page` to wrap children in `fs-workspaceWrap`; kept form variant unchanged.
- Updated `AppShell` table wrappers for both Appointments and People to include `fs-tableScroll` and removed duplicated in-panel `h2` titles.
- Updated `PROJECT_STATUS.md` with CODEX-009 status.

### Files changed

- `apps/web/src/styles/ui.css`
- `apps/web/src/components/layout/Page.tsx`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm dev` ⚠️ failed because Azure Functions Core Tools (`func`) is not installed in this environment.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for browser screenshot.
- `mcp__browser_tools__run_playwright_script` ✅ captured screenshot artifact.

### Follow-ups

- Run full-stack `pnpm dev` in an environment with Azure Functions Core Tools installed.
## 2026-02-20 00:00 UTC (Flex deploy indexing fix: non-zero function discovery)

### Objective

Fix Azure Functions Flex deployment so Node v4 functions are discoverable (avoid `0 functions found (Custom)`) and provide deterministic CI/local deployment without requiring pnpm on Azure.

### Approach

- Confirmed API uses Node v4 programming model (`@azure/functions` + `app.http(...)` registrations in `api/src/index.ts`) and no `customHandler` block in `api/host.json`.
- Identified deployment-shape risk: Function runtime files (`host.json`, `package.json`, `dist/**`, deps) must be at deployed root for Node worker indexing.
- Added packaging script that creates a clean deploy root with required runtime files and production dependencies.
- Replaced prior deploy workflow (Static Web Apps) with Azure Function App zip deployment for Flex from a runner-built artifact.
- Added local ship script for repeatable manual deploys.
- Updated continuity docs with Azure resource + env + verification guidance.

### Files changed

- `scripts/package-api-deploy.mjs`
- `scripts/ship-api.sh`
- `.github/workflows/deploy.yml`
- `package.json`
- `PROJECT_STATUS.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` ✅ passed.
- `node scripts/package-api-deploy.mjs` ✅ passed (produced `.artifacts/deploy/familyscheduler-api.zip`).
- `unzip -l .artifacts/deploy/familyscheduler-api.zip | head -n 40` ✅ confirmed package contains `host.json`, `package.json`, `dist/index.js`, and runtime deps.

### Follow-ups

- Configure GitHub OIDC secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) for `prod` environment.
- Run workflow and validate Azure Portal function list + host logs.


## 2026-02-20 00:39 UTC (Windows deploy packaging fallback for zip)

### Objective

Fix `pnpm deploy:api:package` on Windows where `zip` is unavailable (`'zip' is not recognized`) while preserving existing Linux/macOS packaging behavior and artifact path.

### Approach

- Updated `scripts/package-api-deploy.mjs` to select archiver by platform:
  - Windows: use PowerShell `Compress-Archive` with `-Force`.
  - non-Windows: keep existing `zip -qr` behavior.
- Kept output filename unchanged: `.artifacts/deploy/familyscheduler-api.zip`.
- Updated `PROJECT_STATUS.md` to document behavior change and continuity.

### Files changed

- `scripts/package-api-deploy.mjs`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `node --check scripts/package-api-deploy.mjs` ✅ passed syntax check.
- `pnpm deploy:api:package` ✅ passed and produced `.artifacts/deploy/familyscheduler-api.zip`.

### Follow-ups

- Re-run your original Azure CLI deployment command on Windows; packaging should now complete without needing to install a separate `zip` executable.

## 2026-02-20 00:44 UTC (prod deploy fix: worker runtime app setting)

### Objective

Fix Azure Functions production deployment indexing where host logs report `0 functions found (Custom)` after zip deploy.

### Approach

- Added a pre-deploy Azure CLI step in `.github/workflows/deploy.yml` to set `FUNCTIONS_WORKER_RUNTIME=node` on the Function App.
- Kept packaging and zip deploy flow unchanged.
- Updated continuity doc (`PROJECT_STATUS.md`) with this behavior change and rationale.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pwd && rg --files -g 'AGENTS.md'` ❌ no AGENTS.md found via rg (exit 1 from no matches).
- `find .. -maxdepth 3 -name AGENTS.md` ✅ confirmed no AGENTS.md files in scope.
- `sed -n '1,220p' .github/workflows/deploy.yml` ✅ inspected existing deploy pipeline.
- `git status --short` ✅ verified modified files before/after edits.
- `git checkout -- pnpm-lock.yaml` ✅ reverted unrelated lockfile changes.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured timestamp.

### Follow-ups

- Re-run the deploy workflow and confirm Azure host logs now discover HTTP functions.
- If functions are still not discovered, inspect Function App settings for `WEBSITE_RUN_FROM_PACKAGE`, `FUNCTIONS_EXTENSION_VERSION`, and Node runtime stack.

## 2026-02-20 00:51 UTC (startup instrumentation for "0 functions found")

### Objective

Add actionable diagnostics for Azure Functions deployments that report `0 functions found (Custom)` even though the host is running.

### Approach

- Added structured startup logs in `api/src/index.ts` so each route registration emits a deterministic JSON line.
- Added optional startup-deploy checks behind `FUNCTIONS_STARTUP_DEBUG=true` (module path, cwd, and artifact existence checks).
- Updated runbook troubleshooting with concrete App Settings/logging guidance and expected signals.
- Updated project continuity notes with the new debug switch and milestone update.

### Files changed

- `api/src/index.ts`
- `docs/runbook.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm -C api run build` ❌ failed initially due to TypeScript type mismatches in the new helper signature.
- `pnpm -C api run build` ✅ passed after tightening helper types to `HttpMethod[]` and `HttpHandler`.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured timestamp for continuity log.

### Follow-ups

- In Azure App Service/Function App settings, temporarily set `FUNCTIONS_STARTUP_DEBUG=true` and inspect `component=api-startup` logs after deploy.
- Once root cause is resolved, set `FUNCTIONS_STARTUP_DEBUG=false` to reduce startup verbosity.

## 2026-02-20 00:57 UTC (clarify expected function count and debug payload)

### Objective

Address feedback that diagnostics must reflect `0 functions` (not ambiguous counts) and tighten what to collect when prod still reports `0 functions found (Custom)`.

### Approach

- Extended startup instrumentation in `api/src/index.ts` with a deterministic `registration-summary` log that reports both expected and actual registration counts.
- Added debug fields (`FUNCTIONS_WORKER_RUNTIME`, process executable path) to improve environment verification from log stream alone.
- Updated runbook troubleshooting with a concrete “what to share” checklist (startup log lines, app settings query output, artifact top-level listing).
- Updated `PROJECT_STATUS.md` continuity section for this behavior clarification.

### Files changed

- `api/src/index.ts`
- `docs/runbook.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `git checkout -- pnpm-lock.yaml` ✅ reverted unrelated lockfile drift.
- `pnpm -C api run build` ✅ passed.
- `pnpm -C api run test` ✅ passed (11 tests, 0 failures).

### Follow-ups

- Redeploy API and check for `component=api-startup` / `registration-summary` in Azure log stream.
- If host still reports `0 functions found (Custom)`, share the checklist payload from `docs/runbook.md` for next iteration.

## 2026-02-20 04:49 UTC (fix deploy zip path separators permanently)

### Objective

Eliminate Azure Linux/Flex function indexing failures caused by Windows-generated deploy ZIP entries using backslashes (for example `dist\\index.js`).

### Approach

- Reworked `scripts/package-api-deploy.mjs` to package deploy artifacts with POSIX path separators by default:
  - first attempt `tar -a -c -f` from staging root;
  - validate ZIP signature;
  - if tar does not produce a valid ZIP on the platform, fallback to Python `zipfile` that writes POSIX arcnames.
- Removed all packaging reliance on PowerShell `Compress-Archive` and shell `zip`.
- Added deterministic verification command `pnpm deploy:api:verifyzip` (`scripts/verify-api-deploy-zip.py`) to assert required files and reject backslash entry names.
- Updated `scripts/ship-api.sh` to run zip verification before `az functionapp deployment source config-zip`.
- Updated deploy workflow to run zip verification in two layers (tooling script + explicit Python CI guard).
- Updated runbook, scripts docs, and project continuity notes with the root cause and permanent packaging guidance.

### Files changed

- `scripts/package-api-deploy.mjs`
- `scripts/verify-api-deploy-zip.py`
- `scripts/ship-api.sh`
- `scripts/README.md`
- `package.json`
- `.github/workflows/deploy.yml`
- `docs/runbook.md`
## 2026-02-20 04:55 UTC (lockfile sync for @fontsource/inter)

### Objective

Resolve CI install failure caused by `ERR_PNPM_OUTDATED_LOCKFILE` where `apps/web/package.json` declared `@fontsource/inter` but `pnpm-lock.yaml` was stale.

### Approach

- Reviewed the lockfile diff and confirmed the required `@fontsource/inter` entries were present for `apps/web`.
- Validated deterministic install behavior using frozen lockfile mode to match CI.
- Updated continuity docs with this change and verification result.

### Files changed

- `pnpm-lock.yaml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` ✅ passed.
- `pnpm deploy:api:package` ✅ passed; tar output was non-zip on this host, Python fallback produced valid zip.
- `pnpm deploy:api:verifyzip` ✅ passed.
- `python - <<'PY' ...` (zip entry check for `dist/index.js` and no backslashes) ✅ passed.

### Follow-ups

- On Windows operator machines, run `pnpm deploy:api:package && pnpm deploy:api:verifyzip` before any manual deploy.
- After next prod deploy, if host still reports `0 functions found (Custom)`, inspect `released-package.zip` entries for backslashes as documented in the runbook.
- `git diff -- pnpm-lock.yaml` ✅ confirmed lockfile now includes `@fontsource/inter` importer, package, and snapshot entries.
- `pnpm install --frozen-lockfile` ✅ passed for all 4 workspace projects.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- Push this lockfile update so CI can install with default frozen-lockfile behavior.

## 2026-02-20 05:46 UTC (api zip invariant + SWA workflow)

### Objective

Implement deterministic API deploy packaging that prevents `0 functions found (Custom)` regressions, add SWA deploy workflow for `apps/web`, and document post-deploy verification.

### Approach

- Replaced deploy zip creation with Node-only scripts:
  - `scripts/package-api-deploy.mjs` now stages `host.json`, `package.json`, and `dist/`, pulls production deps via `pnpm --filter @familyscheduler/api deploy --legacy --prod`, creates zip, and runs required-entry self-test.
  - `scripts/verify-api-deploy-zip.mjs` validates invariant entries (`host.json`, `package.json`, `dist/index.js`, `dist/functions/groupCreate.js`) plus `node_modules/**`.
  - Added shared zip helpers in `scripts/zip-utils.mjs` for deterministic zip creation/listing without platform `zip` tooling.
- Added `.github/workflows/swa-web.yml` to build with pnpm and upload prebuilt `apps/web/dist` via `Azure/static-web-apps-deploy@v1` (`skip_app_build: true`, `api_location: ''`).
- Updated deploy workflow references from Python verifier to Node verifier.
- Updated runbook/README/scripts docs and PROJECT_STATUS with packaging invariant, deploy command, SWA secret, and post-deploy verification commands.

### Files changed

- `scripts/package-api-deploy.mjs`
- `scripts/verify-api-deploy-zip.mjs`
- `scripts/zip-utils.mjs`
- `scripts/verify-api-deploy-zip.py` (removed)
- `scripts/README.md`
- `package.json`
- `.github/workflows/deploy.yml`
- `.github/workflows/swa-web.yml`
- `docs/runbook.md`
- `README.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm install --frozen-lockfile` ✅ passed.
- `pnpm deploy:api:package` ✅ passed (self-test passed).
- `pnpm deploy:api:verifyzip` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ used to timestamp this entry.

### Follow-ups

- Set repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` before enabling SWA deploys.
- After first prod deploy with new artifact, run the runbook verification commands and confirm Azure lists all expected functions.

## 2026-02-20 06:41 UTC (prod 405 fix: route web to Function App)

### Objective

Fix production 405 on Create Group by routing web API calls to the deployed Function App instead of SWA `/api` (which is detached).

### Approach

- Added a centralized web API URL helper using `VITE_API_BASE_URL` with trailing-slash normalization and path validation.
- Preserved local dev fallback (`/api/*` relative URLs) when env var is unset in dev.
- Added production guard: app throws clear configuration error if `VITE_API_BASE_URL` is missing.
- Updated web fetch calls (`group/create`, `group/join`, `group/meta`, `chat`, `direct`) to use the helper.
- Wired SWA build step to inject `VITE_API_BASE_URL` from GitHub Actions secrets.
- Updated docs and env example for local/prod configuration and rollout expectations.
- Updated PROJECT_STATUS with root cause, chosen fix, and verification guidance.

### Files changed

- `apps/web/src/lib/apiUrl.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/AppShell.tsx`
- `apps/web/.env.example`
- `apps/web/README.md`
- `README.md`
- `.github/workflows/swa-web.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "group/create|/api/|createGroup|groupCreate" apps/web/src apps/web/README.md README.md` ✅ located API call sites and docs references.
- `pnpm --filter @familyscheduler/web build` ✅ web typecheck/build passed after changes.

### Follow-ups

- Set GitHub Actions secret `VITE_API_BASE_URL` to the prod Function App origin (for example `https://familyscheduler-api-prod.azurewebsites.net`).
- Deploy web and validate in browser DevTools that Create Group requests target Function App host and no longer return 405.

## 2026-02-20 07:05 UTC (disable competing SWA workflow triggers)

### Objective

Stop duplicate production SWA deploys on `main` by disabling automatic triggers on the auto-generated Azure Static Web Apps workflow while keeping `.github/workflows/swa-web.yml` as the primary deployment workflow.

### Approach

- Updated only the `on:` block in `.github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml` from `push`/`pull_request` triggers to `workflow_dispatch`.
- Left all workflow jobs, steps, and secrets unchanged.
- Added continuity note in `PROJECT_STATUS.md` explaining the conflict and manual-only status of the auto-generated workflow.

### Files changed

- `.github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,220p' .github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml` ✅ reviewed existing triggers before edit.
- `git diff -- .github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified minimal targeted diff.

### Follow-ups

- Merge and push to `main`, then verify only `Deploy Web (SWA)` runs on push.
- If needed, manually dispatch the auto-generated workflow for one-off operations.


## 2026-02-20 07:34 UTC (SWA source-build for stale dist fix)

### Objective

Fix stale frontend deployment risk by making SWA build the web app from source at deploy time instead of uploading a potentially stale prebuilt `dist` folder.

### Approach

- Removed the `Build web app` step from `.github/workflows/swa-web.yml`.
- Updated SWA deploy action inputs:
  - `app_location: apps/web/dist` → `app_location: apps/web`
  - `output_location: ''` → `output_location: dist`
  - `skip_app_build: true` → `skip_app_build: false`
- Kept triggers and deploy tokens unchanged.
- Adjusted the VITE env assertion step to validate configuration only (no pre-build `dist` scan).

### Files changed

- `.github/workflows/swa-web.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,220p' .github/workflows/swa-web.yml` ✅ verified workflow now builds from `apps/web` source.
- `git diff -- .github/workflows/swa-web.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified targeted minimal changes.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- Merge and push to `main`.
- Verify deployed web bundle references runtime `apiUrl(...)`-based API calls (not hardcoded `'/api/...'`).

## 2026-02-20 07:41 UTC (CODEX step 7: attach SWA integrated API)

### Objective

Fix Create Group production failures by attaching `/api` to the deployed Static Web App and removing production dependence on `VITE_API_BASE_URL`.

### Approach

- Updated SWA deploy workflow to publish integrated Functions from repo `api/`.
- Enabled API build during SWA deploy using existing package build script.
- Removed production-only hard requirement for `VITE_API_BASE_URL` in web API URL helper; now defaults to same-origin when unset in both dev/prod.
- Confirmed competing auto-generated SWA workflow remains manual-trigger only and unchanged.
- Updated PROJECT_STATUS with root cause, fix summary, and deployment verification expectations.

### Files changed

- `.github/workflows/swa-web.yml`
- `apps/web/src/lib/apiUrl.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,220p' .github/workflows/swa-web.yml` ✅ inspected current SWA deploy settings before edit.
- `sed -n '1,220p' apps/web/src/lib/apiUrl.ts` ✅ inspected current API base URL behavior before edit.
- `rg -n "static-web-apps-deploy|api_location" .github/workflows` ✅ confirmed all SWA workflow API-location settings and competing workflow state.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `git diff -- .github/workflows/swa-web.yml apps/web/src/lib/apiUrl.ts PROJECT_STATUS.md CODEX_LOG.md` ✅ verified targeted changes.

### Follow-ups

- Merge and deploy `swa-web.yml`, then verify browser POST to `https://<swa-domain>/api/group/create` is non-405 and reaches integrated Functions.
- Validate Create Group end-to-end in production UI.


## 2026-02-20 07:46 UTC (SWA Oryx API build fix)

### Objective

Fix SWA integrated API build failure caused by `pnpm` not being available in Oryx.

### Approach

- Updated SWA workflow API build override to use npm with API prefix targeting.
- Updated API `build` script to avoid `pnpm` usage so Oryx can execute the build with npm.
- Kept `api_location: api` unchanged.

### Files changed

- `.github/workflows/swa-web.yml`
- `api/package.json`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,240p' .github/workflows/swa-web.yml && sed -n '1,220p' api/package.json` ✅ verified current workflow and API scripts.
- `npm --prefix api run build` ✅ succeeded; API build script runs under npm and completes.
- `git diff -- .github/workflows/swa-web.yml api/package.json PROJECT_STATUS.md CODEX_LOG.md` ✅ verified minimal targeted changes.

### Follow-ups

- Re-run SWA deploy workflow to confirm Oryx API build succeeds with npm override.
- Validate `/api/group/create` on the SWA domain after deployment completes.

## 2026-02-20 07:58 UTC (CODEX step 10: prevent SWA staging quota deploy blocks)

### Objective

Prevent SWA staging environment quota exhaustion from blocking production deploys by ensuring the SWA workflow deploys only on push to `main`.

### Approach

- Removed the `pull_request` trigger block from `.github/workflows/swa-web.yml`.
- Kept the existing `push` to `main` trigger unchanged.
- Updated `PROJECT_STATUS.md` to document quota-driven rationale and cleanup guidance if PR previews are reintroduced.

### Files changed

- `.github/workflows/swa-web.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,120p' .github/workflows/swa-web.yml` ✅ verified trigger now contains only `push` to `main`.
- `git diff -- .github/workflows/swa-web.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified minimal targeted diff.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- Merge to `main` and confirm SWA deploy runs for push events only.
- If PR previews are needed later, add explicit SWA preview-environment cleanup automation/policy.

## 2026-02-20 08:29 UTC (SWA /api/chat 404 fix)

### Objective

Fix SWA-integrated `POST /api/chat` returning `404 Function not found` by ensuring the API is deployed/indexed and by adding traceable logging around chat + OpenAI invocation.

### Approach

- Inspected API registration entrypoint and verified current route map in `api/src/index.ts`.
- Identified deployment drift: legacy SWA workflow had `api_location: ""` and therefore could publish web-only artifacts without API functions.
- Updated legacy workflow to include API deployment/build settings and fixed manual-dispatch condition.
- Added minimal non-PII structured logs:
  - chat handler invocation (`traceId`, route)
  - OpenAI request lifecycle (`traceId`, status, latencyMs)
- Rebuilt and ran API tests to confirm no regression.

### Files changed

- `.github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml`
- `api/src/functions/chat.ts`
- `api/src/lib/openai/openaiClient.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,220p' api/src/index.ts && sed -n '1,260p' api/src/functions/chat.ts` ✅ confirmed route registration and chat handler export/signature.
- `cat api/package.json && cat api/tsconfig.json && cat api/host.json` ✅ verified compile/package configuration.
- `rg -n "registerHttp\(|app\.http\(|chat" api/src api -g '!node_modules'` ✅ confirmed `chat` route exists and is registered.
- `sed -n '1,220p' .github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml` ✅ confirmed legacy workflow had `api_location: ""` before fix.
- `pnpm --filter @familyscheduler/api build` ✅ passed.
- `rg -n "registerHttp\('chat'|export async function chat" api/dist -g '*.js'` ✅ confirmed compiled output includes chat registration + handler.
- `pnpm --filter @familyscheduler/api test` ✅ passed.

### Follow-ups

- Trigger a SWA deploy using the corrected workflow path and verify `POST https://<swa-domain>/api/chat` returns non-404.
- In App Insights, run `requests` query for `/api/chat` and validate successful `resultCode == "200"` after deploy.

## 2026-02-20 08:38 UTC (SWA API function indexing fix)

### Objective

Fix SWA-integrated `POST /api/chat` returning 404 by making Azure Functions routes discoverable in SWA deployment artifacts.

### Approach

- Inspected API build/deploy shape and confirmed the API compiled TS to `dist/**` but did not include per-function descriptors (`function.json`) under `api/`.
- Added explicit Azure Functions folders and `function.json` descriptors for all HTTP functions (`chat`, `direct`, `groupCreate`, `groupJoin`, `groupMeta`) with routes/methods and `scriptFile` + `entryPoint` mapping to compiled handlers.
- Kept SWA workflow model unchanged (`api_location: api`, `api_build_command: npm run build`) so SWA receives both metadata and compiled JS.
- Rebuilt and reran API tests to validate no behavior regressions.

### Files changed

- `api/chat/function.json`
- `api/direct/function.json`
- `api/groupCreate/function.json`
- `api/groupJoin/function.json`
- `api/groupMeta/function.json`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` ✅ passed and generated `dist/functions/*.js`.
- `pnpm --filter @familyscheduler/api test` ✅ passed (11/11).
- `which func || true && func --version || true` ⚠️ `func` not installed in this environment, so local HTTP smoke test cannot be executed here.

### Follow-ups

- Trigger SWA deploy and verify `/api/chat` returns non-404 from the production SWA domain.
- Validate function presence in SWA portal Functions blade (`chat`, `direct`, `groupCreate`, `groupJoin`, `groupMeta`).

## 2026-02-20 08:54 UTC (/api/chat OpenAI production diagnostics)

### Objective

Diagnose why SWA production `/api/chat` yields low-value outcomes by making OpenAI invocation and failures observable, and by adding a safe production OpenAI connectivity endpoint.

### Approach

- Traced `/api/chat` request flow and early-return branches in `api/src/functions/chat.ts` and OpenAI call stack in `api/src/lib/openai/openaiClient.ts`.
- Added structured logs at chat entry (`traceId`, route, `groupId`, hashed phone, message length), immediately before OpenAI fetch (`model`, `contextLen`), after OpenAI fetch (`status`, `latencyMs`), and on exception (`errorName`, `errorMessage`, optional status).
- Added `diagnoseOpenAiConnectivity` helper in OpenAI client with timeout and safe error normalization.
- Added new `GET /api/diagnose/openai` function endpoint and registered route in API index.
- Updated runbook + README with SWA-integrated environment configuration placement and App Insights KQL verification queries.
- Added OpenAI diagnostics unit tests for missing-key and successful-connectivity cases.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/lib/openai/openaiClient.ts`
- `api/src/functions/diagnoseOpenAi.ts`
- `api/src/index.ts`
- `api/diagnoseOpenAi/function.json`
- `api/src/lib/openai/openaiClient.test.ts`
- `docs/runbook.md`
- `README.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` ✅ passed.
- `pnpm --filter @familyscheduler/api test` ✅ passed.
- `git diff -- api/src/functions/chat.ts api/src/lib/openai/openaiClient.ts api/src/functions/diagnoseOpenAi.ts api/src/index.ts docs/runbook.md README.md PROJECT_STATUS.md CODEX_LOG.md` ✅ reviewed targeted diagnostics changes.

### Follow-ups

- Deploy SWA and call `GET /api/diagnose/openai` on the production SWA hostname.
- Send one explicit date/time chat message and correlate `requests`, `dependencies`, and `traces` in Application Insights by `operation_Id`/`traceId`.

## 2026-02-20 UTC (production redeploy instrumentation)

### Objective

Force a clean production redeploy and add a deterministic, user-visible build version stamp tied to commit SHA + build run metadata.

### Approach

- Added web build metadata module (`BUILD_SHA`, `BUILD_TIME`) sourced from Vite env vars with safe `dev` fallbacks.
- Added a minimal, low-opacity bottom-right version indicator to the app shell showing `Version: <7-char SHA> · <build token>`.
- Updated SWA workflow to inject `VITE_BUILD_SHA` and `VITE_BUILD_TIME` from GitHub Actions context for each deployment.
- Updated `PROJECT_STATUS.md` with deployment instrumentation notes, redeploy root-cause note, and post-merge verification steps.

### Files changed

- `apps/web/src/buildInfo.ts`
- `apps/web/src/AppShell.tsx`
- `apps/web/src/styles.css`
- `.github/workflows/swa-web.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.
- `pnpm --filter @familyscheduler/web exec vite preview --host 0.0.0.0 --port 4173` ✅ preview server started.
- `mcp__browser_tools__run_playwright_script` ⚠️ failed in this environment due to Chromium `SIGSEGV`, so screenshot capture could not be completed.

### Follow-ups

- After merge to `main`, confirm SWA production deploy job runs and version label matches commit SHA prefix.
- Validate that a subsequent deploy updates the visible stamp.

## 2026-02-20 09:41 UTC (web build stamp wiring + visibility)

### Objective

Ensure every `main` deployment produces a visible build/version stamp in the web UI tied to the triggering commit.

### Approach

- Updated SWA deploy workflow env so Oryx build receives `VITE_BUILD_SHA` and `VITE_BUILD_TIME`.
- Added canonical web build metadata helper in `apps/web/src/lib/buildInfo.ts`.
- Updated app shell footer to always show `Build: <sha7> <time>`.
- Documented force-redeploy via empty commit in `README.md`.
- Updated `PROJECT_STATUS.md` with production verification steps for build stamps.

### Files changed

- `.github/workflows/swa-web.yml`
- `apps/web/src/lib/buildInfo.ts`
- `apps/web/src/AppShell.tsx`
- `apps/web/src/buildInfo.ts` (removed)
- `README.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg --files -g 'AGENTS.md'` ✅ confirmed no additional AGENTS.md files in repo scope.
- `VITE_BUILD_SHA=abc1234 VITE_BUILD_TIME=test-run pnpm --filter @familyscheduler/web build` ✅ web build succeeded with injected env values.
- `rg -n "abc1234|test-run" apps/web/dist` ✅ verified build artifact contains injected build stamp values.

### Follow-ups

- After merge to `main`, confirm production footer SHA prefix matches the commit shown in the successful `Deploy Web (SWA)` run.

## 2026-02-20 10:13 UTC (OpenAI upstream failure handling hardening)

### Objective

Ensure `/api/chat` never returns `200` on OpenAI upstream failure and instead returns structured `502` with explicit logging.

### Approach

- Updated `parseToActions` to:
  - log `openai_http_error` with non-2xx status and response body truncated to 500 chars,
  - throw `Error("OpenAI HTTP <status>")` for non-OK responses,
  - wrap the full call in `try/catch`, log `openai_call_failed`, and rethrow.
- Updated top-level `chat` handler to wrap chat logic in `try/catch`, log `chat_handler_failed`, and return:
  - `status: 502`
  - `jsonBody: { error: "OPENAI_CALL_FAILED", message: ... }`.
- Added tests validating both client-level logging/throw behavior and chat-level 502 structured error response.
- Updated `PROJECT_STATUS.md` with production verification steps.

### Files changed

- `api/src/lib/openai/openaiClient.ts`
- `api/src/functions/chat.ts`
- `api/src/lib/openai/openaiClient.test.ts`
- `api/src/functions/chat.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `npm test` (in `api/`) ✅ built TypeScript and ran Node test suite; all tests passed, including new OpenAI failure-path checks.
- `rg -n "chat_openai_exception|OPENAI_CALL_FAILED|chat_handler_failed|openai_http_error|openai_call_failed" api/src` ✅ confirmed legacy swallow-log path removed and required failure logs/error code present.

### Follow-ups

- Validate in production/staging telemetry by rotating to an invalid key briefly and confirming App Insights signals (`openai_http_error`/`openai_call_failed` + 502 response envelope).

## 2026-02-20 10:43 UTC (multi-select availability pre-flight questionnaire)

### Objective

Produce a concrete pre-flight questionnaire response for multi-select availability/unavailability date ranges, grounded in the current codebase behavior.

### Approach

- Reviewed availability state schema, rule execution/conflict logic, status resolution, and People UI rule-entry flow.
- Wrote a dedicated pre-flight doc with current behavior + recommended v1 decisions to minimize implementation risk.
- Updated `PROJECT_STATUS.md` to reflect the new planning artifact.

### Files changed

- `docs/multi-select-date-range-preflight.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,320p' api/src/lib/state.ts` ✅ confirmed current `AvailabilityRule` schema.
- `sed -n '1,260p' api/src/lib/availability/computeStatus.ts` ✅ confirmed precedence (`unavailable` over `available`).
- `rg -n "add_rule|conflicts|overlap" api/src/lib/actions/executor.ts && sed -n '120,220p' api/src/lib/actions/executor.ts` ✅ confirmed opposite-kind overlap removal on write.
- `sed -n '1,280p' apps/web/src/AppShell.tsx` ✅ confirmed current UI captures single-date rule input.

### Follow-ups

- Implement multi-range UX behind a feature flag while preserving current single-rule API contract via batched `add_rule` actions.
- Add DST and overlap regression tests once implementation begins.

## 2026-02-20 11:35 UTC (BYO-only API + MI Blob-only storage)

### Objective

Switch web/API topology to BYO-only API routing and migrate API state storage to Managed Identity Blob-only mode with fail-fast config error handling.

### Approach

- Updated both SWA workflows to inject `VITE_API_BASE_URL`, added a pre-deploy guard step, and disabled SWA managed API packaging (`api_location: ""`, `skip_api_build: true`).
- Replaced storage factory branching with Blob-only lazy creation requiring `STORAGE_ACCOUNT_URL` + `STATE_CONTAINER`, and introduced `MissingConfigError`.
- Rewrote `AzureBlobStorage` from SAS/fetch to Azure SDK (`BlobServiceClient` + `DefaultAzureCredential`) while preserving group-path naming, ETag normalization, 404 -> GroupNotFound, and 409/412 -> Conflict semantics.
- Added shared `errorResponse` helpers for trace-aware, consistent config/storage error envelopes and structured config-missing logs.
- Moved storage adapter resolution to request-time in handlers; added config failure handling in `chat`, `direct`, `groupCreate`, `groupJoin`, and `groupMeta`.
- Fixed `chat` catch behavior so only true OpenAI path failures return `OPENAI_CALL_FAILED`; config/storage errors now map to explicit non-200 envelopes with `traceId`.
- Removed local storage implementation and updated tests to use `setStorageAdapterForTests(...)` adapter injection (no local mode reliance).

### Files changed

- `.github/workflows/swa-web.yml`
- `.github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml`
- `api/package.json`
- `api/local.settings.example.json`
- `api/src/lib/storage/azureBlobStorage.ts`
- `api/src/lib/storage/azureBlobStorage.test.ts`
- `api/src/lib/storage/storageFactory.ts`
- `api/src/lib/storage/localFileStorage.ts` (deleted)
- `api/src/lib/errors/configError.ts`
- `api/src/lib/http/errorResponse.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/direct.ts`
- `api/src/functions/groupCreate.ts`
- `api/src/functions/groupJoin.ts`
- `api/src/functions/groupMeta.ts`
- `api/src/functions/chat.test.ts`
- `api/src/functions/direct.test.ts`
- `api/src/functions/groupCreate.test.ts`
- `api/src/functions/groupMeta.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm install --frozen-lockfile` ⚠️ failed as expected due lockfile drift after dependency additions.
- `pnpm install --no-frozen-lockfile` ⚠️ failed with `ERR_PNPM_FETCH_403` fetching `@azure/storage-blob` from npm registry in this environment.
- `pnpm --filter @familyscheduler/api run build` ⚠️ blocked by missing installed Azure SDK packages due registry fetch failure.
- `rg -n "STORAGE_MODE|LOCAL_STATE_PREFIX|BLOB_SAS_URL|localFileStorage" api/src api/local.settings.example.json` ✅ confirmed runtime/template removal in edited codepaths.

### Follow-ups

- Run dependency install/build/tests in an environment with npm registry access to complete full compile/test validation.
- Deploy and validate acceptance checklist A/B/D against live Azure resources and Function App configuration.

## 2026-02-20 12:20 UTC (rule-v2 guardrails + idempotency addendum)

### Objective

Apply addendum updates for rule-v2 confirm idempotency/replace semantics, rule-cap guardrails, normalization, draft overlap warnings, timezone fallback assumptions, and legacy replacement wiring.

### Approach

- Extended `interval.ts` with `normalizeRulesV2` (group/sort/merge by person+status+promptId).
- Added rule-v2 helper pipeline in executor (`prepareRuleDraftV2`, `confirmRuleDraftV2`) including timezone fallback assumptions, 14-day interval guardrail, draft overlap warnings, confirm idempotent replacement, and cap checks.
- Extended state + chat/direct snapshots with optional v2 rule metadata (`promptId`, `originalPrompt`, `startUtc`, `endUtc`).
- Added `/api/chat` request-body wiring for `ruleMode`, `replacePromptId`, `replaceRuleCode`, `rules`, and draft/confirm response shaping.
- Updated AppShell rule modal flow to call draft/confirm API mode, show preview+warnings, keep confirm enabled, and include legacy replacement hint path.
- Added/updated executor tests for draft warnings/fallback and confirm idempotency+cap behavior.

### Files changed

- `api/src/lib/availability/interval.ts`
- `api/src/lib/actions/executor.ts`
- `api/src/lib/actions/executor.test.ts`
- `api/src/lib/state.ts`
- `api/src/functions/chat.ts`
- `api/src/functions/direct.ts`
- `apps/web/src/AppShell.tsx`
## 2026-02-20 19:08 UTC (Photo -> Extract Appointment feasibility discovery)

### Objective

Run a focused discovery query to determine feasibility of adding photo-to-appointment extraction in the current Azure Static Web Apps deployment model.

### Approach

- Ran targeted repository search for OpenAI integrations and image/vision patterns.
- Enumerated function/app host files to map API route surface.
- Inspected SWA workflow wiring to determine whether API is SWA-managed or BYO.
- Traced frontend API helper and request headers to establish current client auth/request model.
- Captured findings in a standalone discovery document for implementation planning.

### Files changed

- `docs/discovery-photo-extract-appointment-feasibility.md`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter api test` ❌ failed build due missing Azure SDK modules in environment and a transient TS typing issue (fixed typing issue afterward).
- `pnpm install` ⚠️ failed with `ERR_PNPM_FETCH_403` fetching npm package tarballs (registry/network auth limitation in environment).
- `rg -n "ruleMode|replacePromptId|replaceRuleCode|normalizeRulesV2|RULE_LIMIT_PER_PERSON|MAX_INTERVAL_DAYS" api/src apps/web/src` ✅ confirmed key wiring points present.

### Follow-ups

- Re-run `pnpm install` + `pnpm --filter api test` in a network-enabled environment with npm registry access.
- Run web/manual verification for draft warning rendering and legacy replace flow in browser.
- `rg -n "OPENAI_API_KEY|openai|OpenAI|chat_handler_failed|responses|chat.completions|vision|image_url|data:image" .` ✅
- `find . -maxdepth 5 -type f \( -name "function.json" -o -name "host.json" -o -name "*.ts" -o -name "*.js" -o -name "*.cs" \) | sort` ✅
- `rg -n "api_location|app_location|output_location|Azure/static-web-apps-deploy@v1|staticwebapp.config.json" .github/workflows -S` ✅
- `find . -maxdepth 4 -name "staticwebapp.config.json" -o -name "routes.json" -o -name "swa-cli.config.json"` ✅
- `rg -n "fetch\(|/api/|Authorization|x-group|x-pass|groupId|passkey|headers" apps/web/src api/src -S` ✅
- `rg -n "aiParseLocation|LOCATION_AI_FORMATTING|parseToActions|diagnoseOpenAiConnectivity" api/src -S` ✅

### Follow-ups

- If implementing photo extraction, decide between extending `POST /api/chat` vs adding dedicated `POST /api/extract-appointment` for clearer contract and failure isolation.
- Add explicit payload size/type limits and trace-aware rejection responses before enabling image ingestion.

## 2026-02-20 19:25 UTC (TS2322 RuleRequestItem.status narrowing in chat)

### Objective

Fix TypeScript TS2322 in `api/src/functions/chat.ts` caused by `RuleRequestItem.status` being treated as `string` during rule parsing.

### Approach

- Added a dedicated type guard `isRuleStatus` to narrow `unknown` values to `'available' | 'unavailable'`.
- Reworked `parseRuleItems` to return either parsed items or an `invalidStatus` marker.
- In the chat handler, added a non-fallthrough HTTP 400 return when invalid status is found:
  - `error: "invalid_rule_status"`
  - `message: "status must be 'available' or 'unavailable'"`
  - `got: <invalid value>`

### Files changed

- `api/src/functions/chat.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `nl -ba api/src/functions/chat.ts | sed -n '60,110p'` ✅ located failing region and existing parse path.
- `rg -n "RuleRequestItem|status|available|unavailable" api/src/functions/chat.ts api/src -S` ✅ traced type usage and status literals.
- `rg -n "type RuleRequestItem" api/src -S` ✅ found type definition in chat handler.
- `pnpm --filter @familyscheduler/api build` ⚠️ failed due missing modules `@azure/identity` and `@azure/storage-blob` in this environment.
- `pnpm deploy:api:package` ⚠️ failed for the same upstream build dependency reason.

### Follow-ups

- Re-run build/package commands in an environment with required Azure SDK dependencies installed.


## 2026-02-20 20:00 UTC (ruleMode rules-only drafting + modal clarification handling)

### Objective

Make `/api/chat` honor `ruleMode` for rules drafting/confirm with rules-only OpenAI prompting (no appointment actions), and update Rules modal UX to support server-returned clarification questions.

### Approach

- Added a dedicated rule-mode OpenAI prompt builder (`buildRulesPrompt`) with explicit rule-only constraints and required `add_rule_v2_draft` / `add_rule_v2_confirm` action expectations.
- Updated `/api/chat` ruleMode path to require `personId`, call OpenAI using the rules-only prompt, validate required action type, and return deterministic rule clarification question when output is missing/invalid.
- Kept existing rule draft/confirm execution pipeline (`prepareRuleDraftV2` + `confirmRuleDraftV2`) once valid rules are parsed from model output.
- Updated Rules modal to render `kind:"question"` content (message/options/free-text) and re-call `/api/chat` in `ruleMode:"draft"` with the same trace ID until draft preview is available.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/lib/openai/prompts.ts`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter api build` ⚠️ failed due missing local Azure SDK deps (`@azure/identity`, `@azure/storage-blob`) in this environment.
- `pnpm --filter web build` ✅ passed (TypeScript + Vite production build).
- `pnpm --filter web dev --host 0.0.0.0 --port 4173` ✅ launched for screenshot capture (terminated with SIGINT after capture).
- Playwright screenshot capture ✅ artifact created at `browser:/tmp/codex_browser_invocations/7f3e4bb745e39e74/artifacts/artifacts/rules-modal-change.png`.

### Follow-ups

- Run end-to-end rule drafting flow against configured OpenAI credentials and seeded group/person data to confirm expected draft-vs-question behavior for travel-style prompts.

## 2026-02-20 20:17 UTC (rules modal copy + layout cleanup)

### Objective

Apply CODEX UI patch requirements for the Rules modal: remove Mae wording, align modal layout/sections, and tighten edit semantics with no extra API behavior.

### Approach

- Reworked Rules modal JSX into explicit sections (header, prompt, optional question, optional draft output, actions).
- Updated prompt copy to `Availability rule` plus helper text and retained existing draft/confirm flow.
- Added modal-specific CSS for width/padding, full-width textarea sizing, right-aligned action row, and bordered draft output.
- Verified TypeScript for the web package and attempted browser screenshot capture of the updated UI.

### Files changed

- `apps/web/src/AppShell.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg --files -g 'AGENTS.md'` ✅ (no additional AGENTS.md files found under repo path).
- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; later stopped with SIGINT intentionally.
- `run_playwright_script` ⚠️ first attempt timed out; second attempt succeeded but only captured a fallback page screenshot artifact because the Rules modal trigger could not be reached in this environment state.

### Follow-ups

- If needed, provide a seeded local state with at least one person row so the Rules modal can be opened deterministically for an updated screenshot artifact.

## 2026-02-20 UTC

### Objective

Implement rules-mode single-shot drafting/confirmation (no dynamic question UI), all-day default behavior, and conflict/cap handling updates.

### Approach

- Tightened rules-mode OpenAI prompt + parser guards to allow only rule draft/confirm proposal actions.
- Updated `/api/chat` ruleMode flow to return `draftError` for invalid/question outputs and require `personId`/`promptId` contracts.
- Simplified rules modal UX to prompt + Draft/Confirm/Cancel + proposal/error panels only.
- Updated rule confirm executor to replace overlapping intervals and normalize same-status intervals before cap enforcement.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/lib/openai/prompts.ts`
- `api/src/lib/actions/executor.ts`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter api test` ✅ pass.
- `pnpm --filter web build` ✅ pass.
- `pnpm --filter web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture.

### Follow-ups

- Manually validate rule draft examples in a real authenticated group flow (`I am busy tomorrow`, Cancun date range) and confirm assignment status chips reflect applied rules.

## 2026-02-20 20:42 UTC (people/rules table alignment + icon order + nowrap)

### Objective

Apply a minimal UI patch to People/Rules table alignment: enforce person action icon order/labels, prevent action wrapping, and compact+indent rule rows for clearer hierarchy.

### Approach

- Updated People action cell markup to enforce exactly three buttons in order: Rules, Edit person, Delete person.
- Replaced duplicate Rules icon (Pencil) with a distinct clock icon component.
- Added `actions-cell`, `rules-row`, `rules-indent`, and `rule-actions` structure/classes in `AppShell.tsx`.
- Updated CSS for no-wrap icon rows and compact rule-row layout/alignment.
- Updated `PROJECT_STATUS.md` with behavior changes and manual verification steps.

### Files changed

- `apps/web/src/AppShell.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg --files -g 'AGENTS.md'` ✅ checked for repository-scoped agent instructions (none found in repo tree).
- `rg -n "Actions|rules-row|rule-item|action-icons|people" apps/web/src/AppShell.tsx` ✅ located relevant table/action/rules sections before editing.
- `rg --files apps/web/src | rg -n "css$"` ✅ identified active stylesheet (`apps/web/src/styles.css`).
- `rg -n "notes-text|actions-cell|rules-row|rules-indent|rule-actions|action-icons|rule-item" apps/web/src/styles.css apps/web/src/AppShell.tsx` ✅ verified class usage and no duplicate competing selectors after patch.

### Follow-ups

- Run local UI smoke in browser at desktop widths to validate non-wrapping behavior across target breakpoints.

## 2026-02-20 20:54 UTC (ruleMode rules-only routing + rules modal gating fix)

### Objective

Enforce `ruleMode=draft|confirm` as a strict rules-only backend path and fix rules modal UI behavior to avoid question loops/double-calls while tightening Confirm enablement.

### Approach

- Updated API chat handler to hard-route ruleMode requests through rules-only parsing.
- Added strict rule-only prompt builder usage and updated prompt content constraints.
- Added backend guards to reject question/disallowed/appointment actions with deterministic draftError reply payload.
- Updated rules modal state shape and handlers to use dedicated drafting/confirming booleans and valid-draft gating.
- Ensured draft handler performs a single direct fetch without routing through generic chat follow-ups.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/lib/openai/prompts.ts`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed.

### Follow-ups

- Run interactive browser validation for “I am busy tomorrow” to confirm one draft network request and no appointment mutations in snapshot before confirm.

## 2026-02-20 21:15 UTC (API deploy Azure creds login fix)

### Objective

Fix deploy workflow Azure authentication failures (`SERVICE_PRINCIPAL missing client-id/tenant-id`) by switching to JSON-credentials login.

### Approach

- Replaced the Azure login step in `.github/workflows/deploy.yml` with `azure/login@v2` using `creds: ${{ secrets.AZURE_CREDENTIALS }}`.
- Removed step-level SP field inputs (`client-id`, `tenant-id`, `subscription-id`) in favor of unified credentials JSON secret.
- Updated `PROJECT_STATUS.md` to document required repository secret format and that deploy mechanics after login are unchanged.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `python - <<'PY' ...` ✅ updated deploy workflow login block and project status note.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified minimal targeted changes.

### Follow-ups

- Add/update repository secret `AZURE_CREDENTIALS` with valid service principal JSON before running `deploy-api-prod`.
- Verify next GitHub Actions run shows successful `Azure login` step before app settings and zip deploy steps.

## 2026-02-20 21:25 UTC (flex deploy appsettings fix)

### Objective

Fix production deploy workflow failure on Flex Consumption by removing unsupported `FUNCTIONS_WORKER_RUNTIME` app setting update.

### Approach

- Removed the `az functionapp config appsettings set --settings FUNCTIONS_WORKER_RUNTIME=node` step from `.github/workflows/deploy.yml`.
- Kept all other deploy workflow settings and commands unchanged.
- Updated `PROJECT_STATUS.md` to document Flex Consumption appsettings behavior and workflow update.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,220p' .github/workflows/deploy.yml` ✅ located the appsettings set step.
- `python - <<'PY' ...` ✅ inserted project status note for Flex Consumption appsettings rejection.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified minimal targeted diff.

### Follow-ups

- Run the `Deploy API (prod)` workflow on `main` and verify zip deploy succeeds without appsettings validation errors.

## 2026-02-20 21:45 UTC (Flex zip root packaging + post-deploy smoke check)

### Objective

Fix Function App deployment packaging so Azure Functions on Flex discovers functions (`chat`, `direct`, `groupCreate`, etc.) by ensuring `host.json` and function folders are at the zip root.

### Approach

- Updated `.github/workflows/deploy.yml` to package deploy artifact as `api.zip` from **contents** of `api/` (`(cd api && zip -r ../api.zip .)`).
- Updated deploy command to use `--src api.zip`.
- Added a post-deploy verification step that logs root status and performs `POST /api/chat`, failing only on `404` (non-discovery signal).
- Updated `PROJECT_STATUS.md` with root cause and fix summary for Flex function discovery.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,240p' .github/workflows/deploy.yml` ✅ confirmed previous packaging/deploy source path.
- `pnpm --filter @familyscheduler/api build` ✅ passed.
- `rm -f api.zip && (cd api && zip -r ../api.zip .)` ✅ produced deploy zip with `api/` contents at archive root.
- `zipinfo -1 api.zip | rg -n '^(host.json|chat/|direct/|groupCreate/|groupJoin/|groupMeta/)'` ✅ verified required root entries are present.

### Follow-ups

- Run the `Deploy API (prod)` GitHub Action and confirm Azure Portal function list includes `chat`, `direct`, `groupCreate`, `groupJoin`, and `groupMeta`.
- Confirm deployed `/api/chat` smoke-check step reports a non-404 status.

## 2026-02-20 21:49 UTC (deploy smoke hostname lookup fix)

### Objective

Fix production deploy smoke test hostname resolution by removing hardcoded Function App host and resolving the active `defaultHostName` from Azure at runtime.

### Approach

- Updated `.github/workflows/deploy.yml` verification step to derive `FUNCTION_APP_URL` dynamically:
  - `APP_HOST=$(az functionapp show --name familyscheduler-api-prod --resource-group familyscheduler-prod-rg --query defaultHostName -o tsv)`
  - `FUNCTION_APP_URL="https://$APP_HOST"`
- Kept existing smoke-check semantics and curl usage, now targeting the dynamically resolved host for both root and `POST /api/chat` checks.
- Updated `PROJECT_STATUS.md` to document the root cause (non-existent hardcoded hostname) and the Azure API-based fix.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,260p' .github/workflows/deploy.yml` ✅ verified smoke test step location and current curl usage.
- `rg -n "FUNCTION_APP_URL|defaultHostName|Verify deployed Function App responds" .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified dynamic hostname wiring and continuity docs.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ confirmed minimal targeted diff.

### Follow-ups

- Run `Deploy API (prod)` in GitHub Actions and verify no `curl: (6) Could not resolve host` errors.
- Confirm `POST $FUNCTION_APP_URL/api/chat` returns non-404 in smoke step logs.

## 2026-02-20 21:56 UTC (deploy verify robustness + APP_HOST guard)

### Objective

Make deploy verification in GitHub Actions robust when Function App hostname lookup returns empty and improve diagnosability.

### Approach

- Replaced verify step script in `.github/workflows/deploy.yml` with stricter shell settings and Azure context diagnostics.
- Added `APP_HOST` empty guard with explicit failure message and raw `az functionapp show` debug output.
- Logged resolved `FUNCTION_APP_URL` before curl checks.
- Updated `/api/chat` smoke payload to include `groupId` and `phone` for stricter endpoint compatibility.
- Updated continuity docs in `PROJECT_STATUS.md` to capture the previous failure mode and the guardrail change.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,240p' .github/workflows/deploy.yml` ✅ inspected existing verify step before patching.
- `python - <<'PY' ...` ✅ inserted deploy verify robustness note into `PROJECT_STATUS.md`.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ confirmed minimal targeted diff.

### Follow-ups

- Trigger the deploy workflow in GitHub Actions to confirm verify diagnostics in a real Azure-authenticated run.

## 2026-02-20 22:03 UTC (deploy verify azure subscription context stabilization)

### Objective

Stabilize deploy workflow verification by eliminating Azure CLI subscription/context drift after login.

### Approach

- Added a dedicated workflow step immediately after `azure/login@v2` to print Azure account debug context.
- Forced Azure CLI subscription selection to `99690a90-d117-4c79-bf85-bd491615b10d` before deploy/verify operations.
- Kept verify-step `APP_HOST` empty guard and explicit `az functionapp list --resource-group familyscheduler-prod-rg -o table` output for diagnosability.
- Updated continuity status in `PROJECT_STATUS.md` with the Azure context mismatch fix details.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,240p' .github/workflows/deploy.yml` ✅ inspected current deploy workflow before change.
- `python - <<'PY' ...` ✅ updated `PROJECT_STATUS.md` with Azure context/subscription mismatch resolution note.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified targeted minimal diff for requested patch.

### Follow-ups

- Re-run the deploy workflow in GitHub Actions and confirm verify step resolves `APP_HOST` without context-related failures.

## 2026-02-20 22:11 UTC (deploy verify APP_HOST query fix for Flex)

### Objective

Fix deploy workflow verify-step host resolution for Flex Function App by querying the correct Azure property shape and adding a fallback host lookup.

### Approach

- Updated `.github/workflows/deploy.yml` verify step to query `properties.defaultHostName` instead of top-level `defaultHostName`.
- Added fallback query to `properties.hostNames[0]` when `APP_HOST` is empty.
- Kept URL composition dynamic and explicit as `FUNCTION_APP_URL="https://${APP_HOST}"`.
- Updated `PROJECT_STATUS.md` continuity notes with the Flex host-resolution fix.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,240p' .github/workflows/deploy.yml` ✅ inspected current verify step before edit.
- `python - <<'PY' ...` ✅ updated `PROJECT_STATUS.md` with the requested host-resolution note.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ confirmed focused diffs.

### Follow-ups

- Run `Deploy API (prod)` and confirm verify step logs show non-empty `APP_HOST` from primary or fallback query.

## 2026-02-20 22:34 UTC (deploy fix: complete prod deps in zip)

### Objective

Fix prod Azure Functions deploy packaging so the deployed artifact includes complete production dependencies and avoids runtime `ERR_MODULE_NOT_FOUND` for `@azure/core-rest-pipeline`.

### Approach

- Updated deploy workflow to create a clean `api_deploy/` staging directory containing only runtime-required files (`host.json`, `package.json`, `dist/`).
- Used `pnpm --filter @familyscheduler/api deploy --legacy --prod ./api_deploy_install` and copied staged `node_modules` into `api_deploy/` to avoid workspace-hoisted dependency gaps.
- Added staged-runtime validation that imports `@azure/storage-blob` from `api_deploy/` before zipping.
- Changed zip source root from `api/` to `api_deploy/` and updated post-deploy smoke check to call `POST /api/group/join` and fail on HTTP 500.
- Updated continuity docs in `PROJECT_STATUS.md`.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api build` ✅ build succeeded.
- `pnpm --filter @familyscheduler/api deploy --legacy --prod ./api_deploy_install` ✅ produced standalone deploy install tree.
- `(cd api_deploy && node -e "import('@azure/storage-blob').then(() => console.log('storage-blob-import-ok'))")` ✅ import succeeded in staging context.
- `(cd api_deploy && zip -r ../api.zip .)` ✅ zip created with deploy root contents.
- `unzip -l api.zip | rg "host.json|dist/index.js|node_modules/.pnpm/.+core-rest-pipeline" -n` ✅ verified key runtime entries in artifact.

### Follow-ups

- Run the updated deploy workflow in GitHub Actions and confirm `/api/group/join` is non-500 in prod.
- Confirm App Insights no longer logs entry-point load failures for `@azure/core-rest-pipeline`.

## 2026-02-20 22:43 UTC (deploy packaging: restore function discovery from api_deploy)

### Objective

Fix Azure Functions trigger discovery regression by ensuring function folders are present in `api_deploy/` and `api.zip` is built from `api_deploy` only.

### Approach

- Updated `.github/workflows/deploy.yml` staging to copy all `api/*/` directories that contain `function.json` into `api_deploy/` (e.g., `chat/`, `groupJoin/`, `direct/`).
- Kept the existing clean production dependency staging path (`pnpm deploy --legacy --prod` + `@azure/storage-blob` import validation) unchanged to preserve the prior module-resolution fix.
- Added a pre-deploy artifact validation step to require `api_deploy/host.json`, ensure at least one staged `function.json` exists, and print top-level zip listing for diagnostics.
- Confirmed packaging remains single-root from `api_deploy` only.
- Updated `PROJECT_STATUS.md` continuity notes with root cause + fix.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg --files api | rg 'function\\.json$'` ✅ confirmed function trigger folders present in source.
- `for d in api/*/; do if [ -f "${d}function.json" ]; then echo "will-copy $(basename "$d")"; fi; done` ✅ confirmed staging loop will copy expected trigger folders.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified minimal targeted patch.

### Follow-ups

- Run `Deploy API (prod)` and confirm Azure Portal `Functions` list is populated after deployment.
- Verify `POST /api/group/join` returns non-404/non-500 from deployed host.

## 2026-02-20 22:59 UTC (deploy packaging hardening for Azure module/runtime + trigger discovery)

### Objective

Fix Azure 500s caused by missing `@azure/*` runtime dependencies in deploy artifacts while preserving Azure Functions trigger discovery in the deployed zip.

### Approach

- Added `@azure/core-rest-pipeline` as a direct runtime dependency in `api/package.json` and updated `pnpm-lock.yaml` importer entries.
- Kept `api_deploy/` as the deploy staging root and retained copying of all `api/*/` directories containing `function.json` so trigger folders are present for portal discovery.
- Hardened deploy staging validation to require `api_deploy/groupJoin/function.json` in addition to `host.json`, `dist/index.js`, and runtime import validation of `@azure/storage-blob` from staged output.
- Extended post-deploy smoke to also call `POST /api/chat` and fail on `404` to catch trigger discovery regressions.
- Updated `PROJECT_STATUS.md` continuity note as requested.

### Files changed

- `api/package.json`
- `pnpm-lock.yaml`
- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/api add @azure/storage-blob @azure/core-rest-pipeline` ⚠️ failed in this environment with npm registry 403; applied equivalent dependency update manually using locked versions already present in `pnpm-lock.yaml`.
- `pnpm --filter @familyscheduler/api build` ✅ build succeeded.
- `rm -rf api_deploy api_deploy_install api.zip && mkdir -p api_deploy` ✅ clean staging reset succeeded.
- `cp api/host.json api_deploy/host.json && cp api/package.json api_deploy/package.json && cp -R api/dist api_deploy/dist` ✅ runtime files copied.
- `for d in api/*/; do if [ -f "${d}function.json" ]; then cp -R "$d" "api_deploy/$(basename "$d")"; fi; done` ✅ function folders copied into staging.
- `pnpm --filter @familyscheduler/api deploy --legacy --prod ./api_deploy_install` ✅ portable production install created.
- `cp -R api_deploy_install/node_modules api_deploy/node_modules` ✅ portable node_modules copied to deploy root.
- `test -f api_deploy/host.json && test -f api_deploy/groupJoin/function.json && test -f api_deploy/dist/index.js` ✅ staging assertions passed.
- `(cd api_deploy && node -e "import('@azure/storage-blob').then(()=>console.log('storage-blob-import-ok'))")` ✅ runtime import succeeded.
- `(cd api_deploy && zip -r ../api.zip .)` ✅ zip created from staging root.

### Follow-ups

- Run GitHub Actions `Deploy API (prod)` to execute Azure `config-zip` deploy and remote smoke calls with environment credentials.

## 2026-02-21 00:43 UTC (deploy artifact: dereference pnpm symlinks for Azure runtime)

### Objective

Fix Azure Functions production 500 (`ERR_MODULE_NOT_FOUND` for `@azure/storage-common`) caused by pnpm-linked `node_modules` in zip deployment artifacts.

### Approach

- Updated API deploy staging copy in `.github/workflows/deploy.yml` from `cp -R` to `cp -RL` so symlinked pnpm dependency entries are dereferenced into real directories/files inside `api_deploy/node_modules`.
- Added explicit deploy-staging assertions for `@azure/storage-blob` and `@azure/storage-common` top-level runtime package directories and `package.json` presence.
- Added a symlink absence check (`find ... -type l`) to fail early if any symlink remains in staged `node_modules`.
- Added runtime ESM import check for `@azure/storage-common` and retained the existing `@azure/storage-blob` import check.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,260p' .github/workflows/deploy.yml` ✅ inspected current staging/validation steps.
- `apply_patch` on `.github/workflows/deploy.yml` ✅ updated copy behavior and validation/import assertions.
- `git diff -- .github/workflows/deploy.yml` ✅ verified minimal targeted workflow diff.

### Follow-ups

- Run GitHub Actions **Deploy API (prod)** and confirm logs show both `storage-common-import-ok` and `storage-blob-import-ok`.
- Confirm `/api/group/join` returns non-500 after deployment.
- Confirm App Insights no longer reports `ERR_MODULE_NOT_FOUND` for `@azure/storage-common`.

## 2026-02-21 01:05 UTC (deploy artifact: install prod deps inside staged zip root)

### Objective

Fix Azure Functions production 500 caused by incomplete deploy artifact dependencies (missing transitive `@azure/*` packages such as `@azure/core-util`) by installing production dependencies directly inside `api_deploy/` prior to zipping.

### Approach

- Removed portable install/copy flow from `.github/workflows/deploy.yml` (`pnpm --filter @familyscheduler/api deploy --legacy --prod ./api_deploy_install` and copying `api_deploy_install/node_modules`).
- Copied `pnpm-lock.yaml` into `api_deploy/` and ran `pnpm install --prod --frozen-lockfile` from inside `api_deploy` so the exact zipped folder contains a complete production dependency tree, including transitives.
- Extended staging validations with hard assertions for:
  - `api_deploy/node_modules/@azure/storage-blob`
  - `api_deploy/node_modules/@azure/storage-common`
  - `api_deploy/node_modules/@azure/core-util`
- Extended runtime import checks to print all required markers:
  - `storage-blob-import-ok`
  - `storage-common-import-ok`
  - `core-util-import-ok`
- Updated continuity docs in `PROJECT_STATUS.md` to document root cause, fix, and guardrails.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,260p' .github/workflows/deploy.yml` ✅ inspected existing deploy workflow staging/install behavior.
- `python - <<'PY' ...` ✅ updated `PROJECT_STATUS.md` continuity section for transitive dependency fix + verification signals.
- `rg -n "pnpm --filter @familyscheduler/api deploy --legacy --prod|api_deploy_install|cp -RL api_deploy_install/node_modules|pnpm install --prod --frozen-lockfile|@azure/core-util|core-util-import-ok" .github/workflows/deploy.yml` ✅ confirmed old flow removal and new transitive guardrails/import check presence.

### Follow-ups

- Run GitHub Actions **Deploy API (prod)** and confirm all three markers are present in logs: `storage-blob-import-ok`, `storage-common-import-ok`, `core-util-import-ok`.
- Confirm `/api/group/join` returns non-500 after deployment.
- Confirm App Insights no longer reports `ERR_MODULE_NOT_FOUND` for `@azure/storage-common` or `@azure/core-util`.

## 2026-02-21 00:55 UTC (deploy validation verbose markers)

### Objective

Make deploy staging validation logs deterministic so the failing assertion/import line is obvious in GitHub Actions output.

### Approach

- Updated only the `Validate deploy staging directory` step script in `.github/workflows/deploy.yml`.
- Added `set -x` for command echo.
- Added explicit `echo "CHECK ..."` markers before each file/dir/assert/import check.
- Added symlink debug listing (`find ... -type l | head -n 20 || true`) immediately before strict no-symlink assertion.

### Files changed

- `.github/workflows/deploy.yml`
- `CODEX_LOG.md`
- `PROJECT_STATUS.md`

### Commands run + outcomes

- `sed -n '1,260p' .github/workflows/deploy.yml` ✅ inspected current validation step.
- `git diff -- .github/workflows/deploy.yml` ✅ verified only validation script was changed as requested.

### Follow-ups

- Re-run GitHub Actions workflow **Deploy API (prod)** and use the last emitted `CHECK ...` / `IMPORT ...` marker to pinpoint first failure.

## 2026-02-21 01:06 UTC (deploy core-util diagnostics)

### Objective

Diagnose whether `@azure/core-util` is present only under pnpm store layout (`.pnpm`) or missing entirely in `api_deploy` staging.

### Approach

- Added targeted debug commands in `.github/workflows/deploy.yml` validation step immediately before the failing `test -d api_deploy/node_modules/@azure/core-util` assertion.
- The diagnostics now:
  - search `api_deploy/node_modules` for `core-util` directory names up to depth 6,
  - list matching `@azure+core-util` entries under `api_deploy/node_modules/.pnpm`.
- This output will disambiguate “present only in `.pnpm`” vs “not installed at all.”

### Files changed

- `.github/workflows/deploy.yml`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,260p' .github/workflows/deploy.yml` ✅ confirmed diagnostic commands are placed directly before core-util assert.
- `git diff -- .github/workflows/deploy.yml CODEX_LOG.md` ✅ verified minimal targeted change and continuity log update.

### Follow-ups

- Re-run GitHub Actions workflow **Deploy API (prod)** and inspect the new `DEBUG search core-util` output.
- Decision rule:
  - If only `.pnpm` entries appear: adjust copy/materialization so `api_deploy/node_modules/@azure/core-util` exists.
  - If no entries appear at all: add `@azure/core-util` to `api/package.json` dependencies and refresh lockfile.

## 2026-02-21 01:11 UTC (deploy artifact fix: hoisted api_deploy install)

### Objective

Fix production deploy packaging so Azure Functions resolves `@azure/*` modules from top-level `node_modules` instead of pnpm store-only layout.

### Approach

- Updated deploy workflow to stop copying `node_modules` from `api_deploy_install`.
- Kept clean `api_deploy/` assembly (host.json, api package.json, root pnpm-lock.yaml, dist/, function folders).
- Added production dependency install directly inside `api_deploy/` using hoisted linker:
  - `(cd api_deploy && pnpm install --prod --frozen-lockfile --config.node-linker=hoisted)`
- Tightened functional staging assertions for:
  - `api_deploy/node_modules/@azure/core-util`
  - `api_deploy/node_modules/@azure/storage-common`
  - `api_deploy/node_modules/@azure/storage-blob`
- Relaxed strict symlink prohibition to informational output, while keeping module existence + import checks as deploy gate.

### Root cause and fix summary

- Root cause: previous artifact could preserve pnpm store-oriented layout where `@azure/core-util` was nested under `.pnpm/...` but missing from top-level `node_modules/@azure/core-util`; Azure runtime then failed module resolution with `ERR_MODULE_NOT_FOUND`.
- Fix: perform production install in `api_deploy` with `node-linker=hoisted` before zipping so top-level `@azure/*` package paths exist and are importable at runtime.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,260p' .github/workflows/deploy.yml` ✅ reviewed existing deploy assembly/install/validation flow.
- `python - <<'PY' ...` ✅ updated `PROJECT_STATUS.md` with outage cause + packaging fix + guardrails.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified targeted minimal diffs.

### Expected deploy log signals

- `core-util-import-ok`
- `storage-common-import-ok`
- `storage-blob-import-ok`

### Follow-ups

- Re-run **Deploy API (prod)** and confirm import-ok signals appear in the validation step.
- Confirm post-deploy `POST /api/group/join` and `POST /api/group/meta` no longer return 500.
- Confirm App Insights exceptions no longer include `ERR_MODULE_NOT_FOUND` for `@azure/core-util`.

## 2026-02-21 01:16 UTC (deploy path bug fix for post-install node_modules checks)

### Objective

Fix false-failing deploy validation caused by path checks that still prefixed `api_deploy/` after already changing directory into `api_deploy`.

### Approach

- Updated `.github/workflows/deploy.yml` in the deploy staging step to run install from inside `api_deploy` using explicit `cd api_deploy`.
- Replaced post-install debug/assert block with cwd-aware diagnostics:
  - `pwd`, `ls -la .`
  - `ls -la node_modules || true`
  - `ls -la ../node_modules || true`
  - `ls -la node_modules/@azure || true`
  - `ls -la ../node_modules/@azure || true`
  - `test -d node_modules`
- Returned to repository root with `cd ..` after the install diagnostics.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,260p' .github/workflows/deploy.yml` ✅ reviewed existing deploy install/validation logic.
- `rg -n "api_deploy/node_modules|cd api_deploy" .github/workflows/deploy.yml` ✅ located path references to confirm where bug existed.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified targeted minimal diff and continuity doc updates.

### Follow-ups

- Re-run GitHub Actions workflow **Deploy API (prod)**.
- Capture from logs which node_modules path exists after install:
  - local: `api_deploy/node_modules` (from inside step shown as `node_modules`)
  - workspace root: `../node_modules`

## 2026-02-21 UTC (deploy: materialize hoisted node_modules into api_deploy)

### Objective

Ensure deploy staging always contains `api_deploy/node_modules` with real `@azure/*` directories when pnpm hoisting installs into workspace root.

### Approach

- Updated deploy workflow staging step to copy workspace root dependencies into `api_deploy/node_modules` using `cp -RL` (dereference symlinks).
- Replaced staging asserts with explicit checks for `node_modules` plus `@azure/core-util`, `@azure/storage-common`, and `@azure/storage-blob`.
- Added import smoke checks from inside `api_deploy` for all three Azure packages to validate runtime resolution before zipping/deploying.
- Updated continuity docs to capture pnpm workspace-root install behavior and the new materialization strategy.

### Files changed

- `.github/workflows/deploy.yml`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `sed -n '1,260p' .github/workflows/deploy.yml` ✅ reviewed current deploy staging/validation logic before edits.
- `python - <<'PY' ...` ✅ updated continuity docs in `PROJECT_STATUS.md` and appended this log entry.
- `git diff -- .github/workflows/deploy.yml PROJECT_STATUS.md CODEX_LOG.md` ✅ verified scoped changes for workflow + continuity docs.

### Follow-ups

- Re-run GitHub Actions workflow **Deploy API (prod)** and confirm logs print: `core-util-import-ok`, `storage-common-import-ok`, `storage-blob-import-ok`.
- Confirm artifact listing includes `node_modules/@azure/core-util` in `api.zip` contents.


## 2026-02-21 02:08 UTC (patch 1: draft personId default + draft diagnostics)

### Objective

Implement a minimal high-signal fix for rules draft mode by defaulting missing model `personId` from request context (draft only), and improve deterministic draft diagnostics end-to-end.

### Approach

- Added draft-only normalization step before `parseRuleItems(...)` in rule-mode model decoding.
- Added deterministic draft error metadata (`code`, `traceId`, `details`) and centralized structured draft-failure logging.
- Kept confirm mode strict (no draft normalization behavior).
- Added dev-only raw model capture log gate via `RULES_DRAFT_DEBUG_RAW=1`.
- Updated web Rules modal to render `draftError.code` and `draftError.traceId` when provided.
- Added targeted API tests for draft personId defaulting and deterministic `MODEL_QUESTION` error metadata.

### Files changed

- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "ruleMode|parseRuleItems|draftError|add_rule_v2_draft|question|confirm" api/src/functions/chat.ts api/src/lib -S` ✅ located rule-mode parsing/validation flow.
- `pnpm --filter @familyscheduler/api test` ✅ pass (includes new draft-mode tests).
- `pnpm --filter @familyscheduler/web build` ✅ pass.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured log timestamp.

### Follow-ups

- Human validation in running environment: verify prompt “I am not available March 3 2026.” now drafts without missing-`personId` failure.
- If draft still fails for specific prompts, use `draftError.code/details/traceId` + `rule_mode_draft_fail` logs to identify exact failure mode.

## 2026-02-21 02:24 UTC (rules modal UX improvements)

### Objective

Improve Rules modal UX: compose-area grouping, cleaner copy, richer preview styling, and Confirm gating until a valid draft exists.

### Approach

- Updated rules modal layout in `apps/web/src/AppShell.tsx` to visually group textarea + Draft in a composer block.
- Removed redundant helper sentence under rule prompt.
- Replaced plain preview bullets with styled proposal items driven by drafted intervals (`status-tag` + formatted UTC range + optional all-day marker), and added preview empty-state copy.
- Added `hasProposedRules` gating for Confirm button state (`disabled` + `aria-disabled`) and a defensive early return in confirm handler.
- Added scoped CSS in `apps/web/src/styles.css` for composer and preview chip/list styling.
- Updated continuity docs (`PROJECT_STATUS.md`, `CODEX_LOG.md`).

### Files changed

- `apps/web/src/AppShell.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "Rules\\b|Availability rule|rulePrompt|Draft\\b|Confirm\\b|Preview\\b|draftError" apps/web/src/AppShell.tsx` ✅ located modal state/handlers/render.
- `sed -n '200,820p' apps/web/src/AppShell.tsx` ✅ inspected modal implementation details.
- `rg -n "Button\\b|className=.*btn|disabled\\s*=" apps/web/src --glob='*.tsx'` ✅ checked local button/disabled patterns.
- `pnpm --filter @familyscheduler/web typecheck` ✅ passes after nullability-safe confirm promptId handling.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ launched local web app for screenshot capture (terminated with SIGINT after capture).

### Follow-ups

- Optional: perform an end-to-end manual check of Rules modal with running API to validate Draft→Confirm enablement transition in live flow.

## 2026-02-21 02:33 UTC (confirm persists drafted intervals)

### Objective

Make rules Confirm persist the exact drafted intervals from the UI instead of re-parsing via model, while preserving confirm fallback behavior.

### Approach

- Updated web rules Confirm request payload to include `draftedIntervals` derived from the stored draft response.
- Updated chat `ruleMode: "confirm"` flow to short-circuit OpenAI when `draftedIntervals` is present and non-empty, validate payload shape/person/date ordering, persist through existing rule confirm path, and return updated snapshot.
- Added structured confirm logging for drafted source and zero-interval model fallback.
- Added API tests for drafted-interval confirm success (without OpenAI) and personId mismatch validation.
- Updated `PROJECT_STATUS.md` continuity notes to document behavior changes.

### Files changed

- `apps/web/src/AppShell.tsx`
- `api/src/functions/chat.ts`
- `api/src/functions/chat.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "ruleMode:\\s*['\" ]confirm['\"]|rules-confirm|Confirm\\b" apps/web/src/AppShell.tsx` ✅ located existing confirm flow in rules modal.
- `rg -n "ruleMode:\\s*['\" ]draft['\"]|rules-draft|Draft\\b" apps/web/src/AppShell.tsx` ✅ located draft state and payload path.
- `sed -n '200,820p' apps/web/src/AppShell.tsx` ✅ reviewed modal and handlers for minimal-diff implementation.
- `rg -n "ruleMode.*confirm|add_rule_v2_confirm|incomingIntervalsCount|parseRuleItems" api/src/functions/chat.ts` ✅ located confirm/draft server branch.
- `sed -n '1,560p' api/src/functions/chat.ts` ✅ inspected request parsing and persistence path.
- `rg -n "saveRule|upsertRule|rules.*put|rules.*write|availability.*write|storage" api/src/lib api/src --glob='*.ts*'` ✅ confirmed existing storage save path usage via chat confirm flow.
- `pnpm --filter @familyscheduler/api test` ✅ pass (build + node test suite; includes new confirm draftedIntervals tests).

### Follow-ups

- Optional future hardening: factor drafted-interval parsing into shared validator utility if reused by additional endpoints.

## 2026-02-21 02:49 UTC (people table inline accept + rule alignment)

### Objective

Expose a clear inline accept path for new Person rows (button + Enter key) and align rule display content on the right with status tag at the end.

### Approach

- Updated `AppShell` people-row rendering to detect `isNewRowEditing` using existing `editingPersonId` + `pendingBlankPersonId` state.
- Swapped the Actions cell for the new-row editing state to `Accept`/`Cancel` buttons, while keeping existing icon actions for all other rows.
- Added key handling on new-row name/phone inputs so Enter submits and Escape cancels without affecting normal rows.
- Reworked rule display ordering in the person rules row and adjusted CSS for right alignment and truncation behavior.
- Updated continuity docs (`PROJECT_STATUS.md`, `CODEX_LOG.md`).

### Files changed

- `apps/web/src/AppShell.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "Add Person|adding|newPerson|isAdding|tempPerson|People|Actions\b|edit|delete|trash|pencil|rule|setPeople|personId|cellDisplay" apps/web/src/AppShell.tsx apps/web/src --glob='*.tsx'` ✅ located People table and rule/action rendering.
- `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
- `pnpm --filter @familyscheduler/web build` ✅ passed (Vite production build).
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for visual check; stopped with SIGINT after capture.
- `mcp__browser_tools__run_playwright_script` ⚠️ first run failed due JS syntax in Python runner; follow-up run succeeded and produced screenshots.

### Follow-ups

- Capture a fully in-flow People-pane screenshot in an environment with seeded group/app state so the inline Add Person row is visible without setup gates.

## 2026-02-21 03:01 UTC (rules dialog button label clarity)

### Objective

Rename Rules modal action button labels for clearer intent without changing behavior.

### Approach

- Updated Rules composer Draft button text from `Draft` to `Draft Rule` in `AppShell`.
- Updated Rules confirm button text from `Confirm` to `Add Rule` while preserving existing disabled/handler logic.
- Updated continuity docs in `PROJECT_STATUS.md` to reflect the UI wording change.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "\bDraft\b" apps/web/src --glob='*.tsx'` ✅ located Draft usages and scoped edits to Rules modal.
- `rg -n "\bConfirm\b" apps/web/src --glob='*.tsx'` ✅ located Confirm usages and scoped edits to Rules modal.
- `sed -n '200,900p' apps/web/src/AppShell.tsx` ✅ verified exact modal section and button handlers.
- `git diff -- apps/web/src/AppShell.tsx` ✅ confirmed only label text changes in Rules modal buttons.

### Follow-ups

- Human verify in UI that the Rules dialog shows “Draft Rule” and “Add Rule”.


## 2026-02-21 03:22 UTC (header/meta consistency + availability overlap + rule range formatting)

### Objective

Unify People/Appointments header metadata UI, remove duplicated access copy, fix assignment status for multi-day rules, and improve People rule date-range readability.

### Approach

- Updated `PageHeader` hierarchy to make group name primary, pane title secondary, and moved group metadata to a share-link + copy row with helper/access text.
- Removed the People-only duplicated access text block from `AppShell` so header metadata is the single source.
- Replaced person assignment status matching with UTC interval overlap against all person rules (prefers `startUtc`/`endUtc`, falls back to derived date/time + duration interval).
- Replaced People rule display formatter to human-readable ranges (all-day/date-range or timed span) without raw minute suffixes.
- Captured a UI screenshot of the updated header from local web app.

### Files changed

- `apps/web/src/components/layout/PageHeader.tsx`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web build` ✅ passed (`tsc` + `vite build`).
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started local Vite server for visual validation.
- Playwright screenshot script via `browser_tools.run_playwright_script` ✅ captured `artifacts/header-updates.png`.
- Sent `Ctrl+C` to dev server session ⚠️ expected SIGINT shutdown after screenshot capture.

### Follow-ups

- Optional future polish: replace unicode copy glyph in header with shared icon component if a global icon library is adopted.

## 2026-02-21 03:25 UTC (appointments composer helper text)

### Objective

Add muted helper guidance under the appointments prompt input to clarify supported actions and examples, with minimal layout impact.

### Approach

- Located the appointments prompt section in `apps/web/src/AppShell.tsx`.
- Expanded the one-line form JSX to multiline for a minimal, readable insertion point.
- Added two muted helper text lines directly below the input row using existing `var(--muted)` token and small font sizes (13/12).
- Updated continuity docs (`PROJECT_STATUS.md`, `CODEX_LOG.md`).

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "What would you like to do" apps/web/src/AppShell.tsx` ✅ located prompt input render site.
- `sed -n '720,820p' apps/web/src/AppShell.tsx` ✅ inspected local section before edit.
- `pnpm -C apps/web build` ✅ web app compiles successfully after UI copy update.

### Follow-ups

- Optional: if the team wants centralized styling instead of inline style props, migrate helper text to a small reusable class in a future cleanup PR.


## 2026-02-21 03:36 UTC (header + rule range + assignment overlap fixes)

### Objective

Implement three UI/logic fixes: header link placement under group name, improved People rule range display (all-day + date ranges), and assignment modal availability overlap correctness.

### Approach

- Reordered `PageHeader` content hierarchy so group link/copy row appears directly under group name and moved access text next to pane description.
- Replaced saved-rule row formatter in `AppShell` with `formatRuleDisplay(rule, personTz?)` that emits concise local/tz-friendly ranges with `(all day)` handling and no UTC/duration-minute suffixes.
- Reworked assignment availability overlap logic to interval-based helpers (`getUtcBoundsForRule`, `getUtcBoundsForAppt`) and overlap precedence (`unavailable` > `available` > `unknown`) without date-equality filtering.
- Captured a browser screenshot artifact for visual confirmation of header hierarchy updates.

### Files changed

- `apps/web/src/components/layout/PageHeader.tsx`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `pnpm --filter @familyscheduler/web build` ✅ success.
- `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ⚠️ starts, but API proxy requests fail in this environment (`ECONNREFUSED`) because local Functions API is not running.
- Playwright screenshot capture via browser tool ✅ produced `browser:/tmp/codex_browser_invocations/5bbaaae54bfc0abe/artifacts/artifacts/header-fixes.png`.

### Follow-ups

- Run the full web+api stack locally and verify APPT-2 assignment modal status labels against real group data.

## 2026-02-21 03:50 UTC (Schedule/People header consistency pass)

### Objective

Make Schedule and People panes visually consistent: rename Appointments UI label to Schedule, add modern segmented tabs, standardize + Add buttons, and tighten helper text grouping under the action prompt.

### Approach

- Updated shared `AppShell` header title mapping from Appointments -> Schedule (UI label only).
- Replaced two standalone pane-toggle buttons with one segmented tab container in the shared header region.
- Normalized both pane primary add actions to sentence-case labels with leading plus and matching dimensions.
- Grouped action-prompt helper lines under one compact container with reduced spacing and muted text.
- Captured a browser screenshot artifact to verify visual result.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "Appointments\b|People\b|Add Appointment\b|Add Person\b|What would you like to do\?" apps/web/src --glob='*.tsx'` ✅ located UI strings and controls.
- `sed -n '240,420p' apps/web/src/AppShell.tsx` ✅ inspected header/title logic region.
- `sed -n '420,760p' apps/web/src/AppShell.tsx` ✅ inspected pane controls and add buttons region.
- `sed -n '760,860p' apps/web/src/AppShell.tsx` ✅ inspected helper prompt text grouping region.
- `rg -n "Appointments\b|Add Appointment\b|Add Person\b|\+ Add appointment|\+ Add person|🗓|What would you like to do\?" apps/web/src/AppShell.tsx apps/web/src/App.tsx apps/web/src/components/layout/PageHeader.tsx --glob='*.tsx'` ✅ confirmed post-change strings/locations.
- `pnpm -C apps/web build` ✅ TypeScript + production build passed.
- `pnpm -C apps/web dev --host 0.0.0.0 --port 4173` ✅ launched for visual verification (then stopped with Ctrl+C).

### Follow-ups

- Optional: move segmented-tab inline styles into a shared class/tokenized style block if further header variants are added.

## 2026-02-21 03:55 UTC (header/rules density + all-day range clarity)

### Objective

Tighten header/rules spacing in the web UI and remove misleading time labels from all-day rule rows in the People pane.

### Approach

- Updated `PageHeader` group identity block to use a single compact vertical container with explicit internal spacing, zeroed child margins, and consistent spacing before tab/content sections.
- Reworked People rule rows into a compact right-aligned cluster so range text, description, status badge, and actions stay visually grouped.
- Added `isAllDayRule` + `formatRuleRangeForList` helpers to render all-day rule ranges as date-only `(all day)` text (including multi-day inclusive display).
- Reduced rule-list vertical spacing in CSS so the rule block reads as one compact unit.

### Files changed

- `apps/web/src/components/layout/PageHeader.tsx`
- `apps/web/src/AppShell.tsx`
- `apps/web/src/styles.css`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "fs-groupName|fs-meta|This link is required|clipboard|Group" apps/web/src/components/layout/PageHeader.tsx` ✅ located current header identity markup.
- `rg -n "personRules\.map\(|rule-item|rule-date-time|status-tag|formatRuleTime|formatDraftRuleRange" apps/web/src/AppShell.tsx` ✅ located People rules rendering and format helpers.
- `sed -n '1,180p' apps/web/src/components/layout/PageHeader.tsx` ✅ reviewed header component structure pre-edit.
- `sed -n '60,170p' apps/web/src/AppShell.tsx` ✅ reviewed rule range helpers pre-edit.
- `sed -n '760,840p' apps/web/src/AppShell.tsx` ✅ reviewed People row/rules JSX pre-edit.
- `rg -n "rule-item|rules-list|rule-date-time|rules-cell|rules-indent" apps/web/src -g '*.css' -g '*.tsx'` ✅ located rule spacing CSS source.
- `date -u '+%Y-%m-%d %H:%M UTC'` ✅ captured timestamp for continuity entry.

### Follow-ups

- Run local UI verification (`pnpm -C apps/web dev`) and visually confirm compact header/rules spacing and all-day range rendering across representative rules.

## 2026-02-21 03:59 UTC (helper text spacing tighten under action prompt)

### Objective

Tighten spacing/typography of the two helper lines beneath "What would you like to do?" so they read as one compact block attached to the input row.

### Approach

- Updated helper text wrapper styles to a single compact container with muted color, shared 12px size, `lineHeight: 1.25`, `marginTop: 8`, and `gap: 2`.
- Removed per-line typography-only styles and set each helper line to `<div style={{ margin: 0 }}>` to avoid paragraph-like default spacing.
- Updated continuity docs to record the spacing change in `PROJECT_STATUS.md`.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "What would you like to do\\?" apps/web/src/AppShell.tsx` ✅ located prompt section.
- `rg -n "Add, edit, delete, rename|Example:" apps/web/src/AppShell.tsx` ✅ located helper lines.
- `sed -n '520,760p' apps/web/src/AppShell.tsx` ✅ inspected nearby pane render context.
- `sed -n '800,900p' apps/web/src/AppShell.tsx` ✅ inspected exact input/helper markup region.
- `python - <<'PY' ...` ✅ inserted recent-change continuity note into `PROJECT_STATUS.md`.

### Follow-ups

- If requested, capture a UI screenshot in a running local web session to visually confirm helper spacing in-context.

## 2026-02-21 04:02 UTC (Schedule/People segmented control styling pass)

### Objective

Polish the Schedule/People tab switcher so it reads as one intentional segmented control with consistent button geometry and clearer active/inactive states.

### Approach

- Added shared `tabBase`, `tabActive`, and `tabInactive` style objects in `AppShell` so both tabs use one consistent baseline.
- Updated the segmented wrapper to include centered alignment and explicit top/bottom spacing (`marginTop: 8`, `marginBottom: 12`) directly above pane content.
- Removed ad-hoc per-button sizing styles in favor of shared 32px-height tabs with aligned icon/text treatment.
- Recorded this UI polish in `PROJECT_STATUS.md` continuity notes.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "Schedule\b|Appointments\b|People\b" apps/web/src/AppShell.tsx apps/web/src/components --glob='*.tsx'` ✅ located tab switcher references.
- `sed -n '560,700p' apps/web/src/AppShell.tsx` ✅ inspected segmented control render block before editing.
- `pnpm -C apps/web build` ✅ web build succeeded after style updates.
- `pnpm -C apps/web dev --host 0.0.0.0 --port 4173` ✅ launched local web app for screenshot capture (stopped after capture).
- Playwright screenshot capture via browser tool ✅ produced `browser:/tmp/codex_browser_invocations/24412a19f1571fb4/artifacts/artifacts/segmented-tabs.png`.

### Follow-ups

- If a shared design token system is introduced later, migrate inline segmented-control styles to a reusable component/class.

## 2026-02-21 04:07 UTC (revert segmented Schedule/People tabs to stable buttons)

### Objective

Undo the segmented Schedule/People tab UI experiment and restore two normal, always-clickable buttons with clear active/inactive styling.

### Approach

- Located segmented-control implementation in `apps/web/src/AppShell.tsx`.
- Removed segmented wrapper styles and local tab style objects (`tabBase`, `tabActive`, `tabInactive`).
- Replaced tab buttons with standard button classes (`fs-btnPrimary` / `fs-btnSecondary`) and preserved existing `view` state keys (`appointments`, `people`).
- Removed emoji labels from pane selector and retained plain text labels: `Schedule`, `People`.
- Searched for leftover segmented/opacity/pointer-events/disabled styling affecting pane selector and confirmed none remain.
- Updated `PROJECT_STATUS.md` to record the stability revert.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Commands run + outcomes

- `rg -n "🗓|👥|tabBase|tabActive|segmented|Schedule\\b|People\\b" apps/web/src --glob='*.tsx'` ✅ located segmented tab implementation.
- `sed -n '240,420p' apps/web/src/AppShell.tsx` ✅ inspected surrounding view/state logic.
- `sed -n '80,170p' apps/web/src/AppShell.tsx` ✅ inspected local segmented style objects.
- `sed -n '600,700p' apps/web/src/AppShell.tsx` ✅ inspected segmented JSX block.
- `rg -n "fs-btnSecondary|btn-secondary|fs-btnPrimary" apps/web/src --glob='*.tsx' --glob='*.css'` ✅ confirmed reusable button styles exist.
- `rg -n "🗓|👥|tabBase|tabActive|tabInactive|segmented" apps/web/src/AppShell.tsx apps/web/src --glob='*.tsx' --glob='*.css'` ✅ no leftovers found.
- `rg -n "opacity:|pointer-events:|disabled" apps/web/src/AppShell.tsx apps/web/src --glob='*.css'` ✅ only unrelated/global usages remain; none tied to pane selector.

### Follow-ups

- Run the web app and manually verify selector behavior/visuals in browser across typical desktop width.
