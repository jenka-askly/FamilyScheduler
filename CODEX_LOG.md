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
