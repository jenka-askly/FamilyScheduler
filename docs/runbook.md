# Runbook

## 1. Local development setup (current)

### Prerequisites

- Node.js 20+
- pnpm 10+
- Azure Functions Core Tools v4 (`func` command)

### Run commands

```bash
pnpm install
pnpm dev
```

What this starts:

- Web app (Vite) at `http://localhost:5173`
- Azure Functions API at `http://localhost:7071`

The web app proxies `/api/*` requests to the Functions host.

### Quick verification

1. Open `http://localhost:5173`.
2. Confirm transcript starts with `Type 'help' for examples.`.
3. Enter `hello` and press Enter.
4. Confirm assistant reply renders as `echo: hello`.

## 2. API smoke test (without UI)

```bash
curl -s -X POST http://localhost:7071/api/chat \
  -H "content-type: application/json" \
  -d '{"message":"hello"}'
```

Expected response:

```json
{"kind":"reply","assistantText":"echo: hello","stateVersion":0}
```

Validation failure behavior:

```json
{"kind":"error","message":"message is required"}
```
