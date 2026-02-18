# ADR-0006: Local-First Storage Mode

- Status: Accepted
- Date: 2026-02-18

## Context

Developers need a zero-cloud setup for fast local iteration.

## Decision

Default `STORAGE_MODE=local` with local state file and simulated ETag hashing.

Production can switch to `STORAGE_MODE=azure` with Blob SAS and native ETag.

## Consequences

- Faster onboarding and development.
- Requires consistent abstraction behavior between local and Azure adapters.
