# API (local stub)

This PR adds a local Azure Functions stub endpoint.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Azure Functions Core Tools v4 (`func`)

## Run locally

From the repository root:

```bash
pnpm install
pnpm dev:api
```

Or from this folder:

```bash
pnpm install
pnpm run build
func start
```

## Test the stub endpoint

```bash
curl -s -X POST http://localhost:7071/api/chat \
  -H "content-type: application/json" \
  -d '{"message":"hello"}'
```

Expected response:

```json
{"kind":"reply","assistantText":"echo: hello","stateVersion":0}
```
