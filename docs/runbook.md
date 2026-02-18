# Runbook

## 1. Local development setup (current)

### Prerequisites

- Node.js 20+
- pnpm 10+
- Azure Functions Core Tools v4 (`func` command)

### Run commands

```bash
pnpm install
cp api/local.settings.example.json api/local.settings.json
pnpm dev
```

If you see `Ignored build scripts: esbuild`, run `pnpm approve-builds`, allow `esbuild`, then re-run `pnpm install`.

What this starts:

- Web app (Vite) at `http://localhost:5173`
- Azure Functions API at `http://localhost:7071`

The web app proxies `/api/*` requests to the Functions host.

### Quick verification

1. Open `http://localhost:5173`.
2. Confirm transcript starts with `Type 'help' for examples.`.
3. Enter `hello` and press Enter.
4. Confirm assistant reply renders and no `unable to fetch reply` error appears.

## 2. API smoke test (without UI)

From `api/`:

```bash
pnpm run build
func start
```

Then from another shell:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:7071/api/chat" -ContentType "application/json" -Body '{"message":"hello"}'
```

Expected behavior:

- Functions startup output lists the `chat` HTTP function route.
- API returns JSON payload (not 404), for example:

```json
{
  "kind": "reply",
  "assistantText": "You asked: hello"
}
```

Validation failure behavior:

```json
{"kind":"error","message":"message is required"}
```


## 3. Troubleshooting

### Azure Functions shows `Found zero files matching ...`

This indicates a mismatch between the Azure Functions worker entrypoint pattern and the TypeScript build output layout under `api/dist`.

For this repo, `api/tsconfig.json` is intentionally set so `tsc` emits function files under `api/dist/src/functions/*.js`. If output lands in a different folder (for example `api/dist/functions/*.js`), Functions may start with no discovered handlers.

Quick checks:

```bash
pnpm -C api run build
find api/dist -maxdepth 4 -type f
```

Expected files include:

- `api/dist/src/index.js`
- `api/dist/src/functions/chat.js`
