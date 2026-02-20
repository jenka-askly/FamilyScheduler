# scripts

Local developer/deploy automation scripts.

## Active scripts

- `scripts/package-api-deploy.mjs`: builds deploy staging for `api/` and creates `.artifacts/deploy/familyscheduler-api.zip` with POSIX zip entry paths (`/` separators).
- `scripts/verify-api-deploy-zip.py`: validates a deploy zip contains `host.json`, `package.json`, `dist/index.js`, and no backslash entry names.
- `scripts/ship-api.sh`: install, build, package, verify, and deploy via `az functionapp deployment source config-zip`.

## Deprecated guidance

- Do **not** use PowerShell `Compress-Archive` for Linux Azure Functions deploy artifacts; use `tar -a` packaging (or `pnpm deploy:api:package`) to avoid backslash zip paths.
