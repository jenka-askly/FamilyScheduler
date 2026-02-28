# ADR-0003: ETag Optimistic Concurrency

- Status: Accepted
- Date: 2026-02-18

## Context

Concurrent session updates can overwrite each other without coordination.

## Decision

Require ETag-based optimistic concurrency for all state-changing writes.

- Reads return ETag.
- Writes require matching ETag.
- Conflicts return 409 and require re-proposal.

## Consequences

- Prevents lost updates.
- Adds conflict-handling complexity in proposal flow.
