# Yapper Environment Topology

Last Updated: 2026-02-22

---

## Production Environment

### Resource Group
familyscheduler-prod-rg

### Static Web App
Name: familyscheduler-web-prod
URL: https://red-cliff-0f62ac31e.4.azurestaticapps.net
Deployment Branch: main
Deployment Slot: production

### Function App (API)
Name: familyscheduler-api-prod
URL: https://familyscheduler-api-prod.azurewebsites.net
Plan: Flex Consumption (Node)
Managed Identity: Enabled

### Storage (API State)
Isolated from staging.
Uses its own storage account, container, and RBAC.
Managed Identity has "Storage Blob Data Contributor" role on prod storage.

---

## Staging Environment

### Resource Group
familyscheduler-staging-rg

### Static Web App
Name: familyscheduler-web-staging
URL: https://happy-wave-09af5f21e.6.azurestaticapps.net
Deployment Branch: develop
Deployment Slot: production

### Function App (API)
Name: familyscheduler-api-staging
URL: https://familyscheduler-api-staging.azurewebsites.net
Plan: Flex Consumption (Node 20)
Managed Identity: Enabled

### Storage (API State)
Storage Account: familyschedstg13217
Blob Endpoint: https://familyschedstg13217.blob.core.windows.net
Container: familyscheduler
Blob Prefix: familyscheduler/groups
Storage Mode: azure

Managed Identity Role:
Storage Blob Data Contributor
Scope: familyschedstg13217 storage account

---

## Branch → Environment Mapping

main     → Production Web + Production API  
develop  → Staging Web + Staging API

---

## Deployment Notes

- Staging and Production are fully isolated.
- Do NOT reuse storage accounts between environments.
- Do NOT reuse deployment tokens between environments.
- CORS is explicitly configured per environment.
- Any new environment must define:
  - Separate resource group
  - Separate storage account
  - Separate Function App
  - Separate Static Web App
  - Dedicated GitHub secrets

---

## Invariants

1. No cross-environment storage access.
2. No staging hostnames in production configuration.
3. No production secrets in staging configuration.
4. Managed identity must be used for blob access.
5. RBAC must be explicitly assigned per environment.

---
