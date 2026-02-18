# api

Scaffold folder for the FamilyScheduler backend API.

## Intent

Provide endpoints described in `docs/api.md`, including:

- authentication
- state retrieval
- prompt processing
- confirmation/cancel flow
- undo/backup/restore proposal pipeline

## Status

No implementation code yet. Contracts are defined in docs first.

## Key behavior constraints

- Never execute mutations without explicit confirm.
- Deterministic commands bypass OpenAI.
- ETag optimistic concurrency required for all writes.
