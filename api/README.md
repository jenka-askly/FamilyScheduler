# API (Azure Functions Node v4)

This package hosts the Azure Functions API endpoint.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Azure Functions Core Tools v4 (`func`)

## Run locally

From the repository root:

```bash
pnpm install
cp api/local.settings.example.json api/local.settings.json
pnpm dev:api
```

Or from this folder:

```bash
pnpm install
cp local.settings.example.json local.settings.json
pnpm run build
func start
```

## Test the endpoint

```bash
curl -s -X POST http://localhost:7071/api/chat \
  -H "content-type: application/json" \
  -d '{"message":"hello","groupId":"demo"}'
```

## Production deploy artifact shape (Flex)

Azure Flex must receive a zip whose **root** contains:

- `host.json`
- `package.json` (`main` -> `dist/index.js`)
- `dist/**`
- `node_modules/**` (production dependencies)

Build/package locally:

```bash
pnpm deploy:api:package
```

Ship to prod (requires Azure CLI auth):

```bash
pnpm deploy:api:ship
```
