# apps/web

Scaffold folder for the FamilyScheduler web client.

## Intent

- Provide a prompt-only web UI:
  - transcript area
  - single prompt input
- No calendar widgets, no CRUD forms, no list/timeline visual UI components.

## Status

No implementation code yet. This folder currently exists for structure + planning.

## Planned responsibilities

- Session token handling after passkey login
- Prompt submission to `/api/chat`
- Rendering reply/proposal/clarify/error messages as text transcript entries
- Confirm/cancel interactions through prompt text only (`confirm`, `cancel`)
