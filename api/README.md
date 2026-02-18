# API (local stub)

This package hosts the local Azure Functions API endpoint.

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
  -d '{"message":"hello"}'
```

Expected response:

```json
{"kind":"reply","assistantText":"You asked: hello"}
```
