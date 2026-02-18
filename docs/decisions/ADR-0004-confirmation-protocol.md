# ADR-0004: Confirmation Protocol for Mutations

- Status: Accepted
- Date: 2026-02-18

## Context

Natural-language scheduling actions can be ambiguous or risky.

## Decision

Enforce proposal-before-apply protocol for every mutation.

- API proposes actions with explicit confirmation text.
- Execution only on `confirm` / `confirm <proposalId>`.
- `cancel` aborts.
- Proposal TTL = 10 minutes.

## Consequences

- Significantly improves safety.
- Adds one extra interaction step for mutations.
