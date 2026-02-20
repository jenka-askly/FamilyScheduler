# apps/web

Minimal prompt-only React UI.

## Run locally

From repository root:

```bash
pnpm install
pnpm dev:web
```

The app runs at `http://localhost:5173`.

API base URL behavior:
- Local dev default: if `VITE_API_BASE_URL` is unset, the app uses relative `/api/*` and Vite proxies to `http://localhost:7071`.
- Explicit override: set `VITE_API_BASE_URL` to target a specific API host (for example `http://localhost:7071` or your deployed Function App URL).
- Production build: `VITE_API_BASE_URL` is required and should point at the Function App host (for example `https://familyscheduler-api-prod.azurewebsites.net`).
