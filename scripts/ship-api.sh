#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-familyscheduler-api-prod}"
RESOURCE_GROUP="${RESOURCE_GROUP:-familyscheduler-prod-rg}"

pnpm install --frozen-lockfile
pnpm --filter @familyscheduler/api build
node scripts/package-api-deploy.mjs
pnpm deploy:api:verifyzip

az functionapp deployment source config-zip \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --src .artifacts/deploy/familyscheduler-api.zip

echo "Deployed .artifacts/deploy/familyscheduler-api.zip to $APP_NAME ($RESOURCE_GROUP)."
