# FamilyScheduler

FamilyScheduler is a lightweight family coordination scheduler with a hash-routed web app and Azure Functions API.

## Design docs

- Storage + analytics + usage design: [`docs/DESIGN_STORAGE_TABLES_AND_USAGE.md`](docs/DESIGN_STORAGE_TABLES_AND_USAGE.md)

## v1 group access model

- Anyone can create a group from `/#/` with `groupName` and `groupKey` (ceremony only).
- Server creates a random UUID `groupId` and returns share link `/#/g/<groupId>`.
- Joining starts from the share link at `/#/g/<groupId>` and continues through email magic-link sign-in.
- Access is allowed only when the signed-in email has active membership in that group.
- Session auth is email-based (magic link + `x-session-id` header); no role model in v1.
- Dashboard/list-my-groups is backed by table indexes (`UserGroups`, `Groups`, `GroupMembers`).

## Storage model

- Group snapshot state blob:
  - `familyscheduler/groups/<groupId>/state.json`
- Appointment canonical docs + event chunks:
  - `familyscheduler/groups/<groupId>/appointments/<appointmentId>/appointment.json`
  - `familyscheduler/groups/<groupId>/appointments/<appointmentId>/events/<chunkId>.json`
- Appointment list/index projection is stored in Azure Tables (`AppointmentsIndex`).
- Local mode mirrors blob paths under `.localstate/...`.
- `STATE_BLOB_PREFIX` controls the root prefix (default: `familyscheduler/groups`).

## Local development

- `pnpm install`
- `pnpm dev` to run API + web together.
- Web routes:
  - `/#/` create group
  - `/#/g/:groupId` join flow (email magic link/session)
  - `/#/g/:groupId/app` main scheduler app


## Web/API endpoint configuration

- The web app uses `VITE_API_BASE_URL` to decide where API calls go.
- In local dev, if `VITE_API_BASE_URL` is unset, requests use relative `/api/*` and are proxied by Vite to `http://localhost:7071`.
- In production, set `VITE_API_BASE_URL` to the deployed Function App host (for example `https://familyscheduler-api-prod.azurewebsites.net`).
- If `VITE_API_BASE_URL` is unset, production web calls stay relative (`/api/*`) and hit the Static Web App integrated Functions backend.
- If `VITE_API_BASE_URL` is missing in production builds, the app throws a startup error with a clear configuration message.



## Specifications
- **Auth model (current + planned):** [`docs/AUTH_MODEL.md`](docs/AUTH_MODEL.md)

- [Time & Date Specification](docs/TIME_DATE_SPEC.md)

### Specification Governance

- The specification document is authoritative for time parsing, conflict evaluation, and entry-versioning behavior.
- Any behavioral change affecting time parsing, conflicts, or versioning must update the spec in the same PR.
- Increment the spec version whenever behavior changes.

## Force a production redeploy

If you need to redeploy `main` without source changes, push an empty commit:

```bash
git commit --allow-empty -m "chore: redeploy" && git push
```

This generates a new commit SHA. Since the web build injects `VITE_BUILD_SHA`, the UI build stamp changes on the next deploy, making the rollout visible immediately.

## Notes

- People pane “Add person” stores contact fields (email/cell) for coordination; API auth remains email session based (`x-session-id`).
- All admitted members can edit all data.


## Auth debugging

- Web auth trace logs: set `VITE_DEBUG_AUTH_LOGS=true` (default `false`).
- API auth/join/gate trace logs: set `DEBUG_AUTH_LOGS=true` (default `false`).
- Join and guarded-app flows propagate `traceId` so web and API logs can be correlated.

## GitHub deployment secrets

- `AZURE_STATIC_WEB_APPS_API_TOKEN`: required by `.github/workflows/swa-web.yml` for web deploys to Azure Static Web Apps.




## Required API environment variables

- `AZURE_TABLES_CONNECTION_STRING`
- `STORAGE_ACCOUNT_URL`
- `STATE_CONTAINER`
- `STATE_BLOB_PREFIX` (optional, defaults to `familyscheduler/groups`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AZURE_OPENAI_DEPLOYMENT` (optional deployment identifier for usage attribution)
- `AZURE_COMMUNICATION_CONNECTION_STRING` / `EMAIL_SENDER_ADDRESS` (for invite email)

## OpenAI production diagnostics

- Chat logs are structured JSON and include a `traceId` plus OpenAI request lifecycle markers (`chat_openai_before_fetch`, `chat_openai_after_fetch`, `chat_openai_exception`).
- Safe connectivity check: `GET /api/diagnose/openai` (returns `ok`, `model`, `hasApiKey`, optional `lastError` and `latencyMs`; no secrets or raw model output).
- For SWA-integrated Functions, set `OPENAI_API_KEY`, `OPENAI_MODEL`, and `LOCATION_AI_MODEL` in the **Static Web App configuration** for the deployed SWA resource.
