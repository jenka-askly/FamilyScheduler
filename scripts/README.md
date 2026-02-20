# scripts

Local developer/deploy automation scripts.

## Active scripts

- `scripts/package-api-deploy.mjs`: creates `.artifacts/deploy/api-package`, copies `api/host.json` + `api/package.json` + `api/dist`, installs production dependencies via `pnpm deploy --prod`, builds `.artifacts/deploy/familyscheduler-api.zip` using in-repo Node zip utilities (`scripts/zip-utils.mjs`), and self-validates required zip entries.
- `scripts/verify-api-deploy-zip.mjs`: validates `.artifacts/deploy/familyscheduler-api.zip` includes `host.json`, `package.json`, `dist/index.js`, and `dist/functions/groupCreate.js`.
- `scripts/ship-api.sh`: install, build, package, verify, and deploy via `az functionapp deployment source config-zip`.

## Packaging invariant

The deploy zip must include at the zip root:

- `host.json`
- `package.json` (with `"main": "dist/index.js"`)
- `dist/index.js`
- `dist/functions/*.js`
- `node_modules/**` (production dependencies)
