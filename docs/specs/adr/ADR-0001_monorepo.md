# ADR-0001: Monorepo Structure

- Status: Accepted
- Date: 2026-02-18

## Context

Yapper needs coordinated evolution of web UI, API, and shared contracts.

## Decision

Use a pnpm-based monorepo with:

- `apps/web`
- `api`
- `packages/shared`

## Consequences

- Easier shared schema alignment.
- Single CI entrypoint.
- Clear separation with shared dependency management.
