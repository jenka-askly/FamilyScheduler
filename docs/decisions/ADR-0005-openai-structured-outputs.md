# ADR-0005: OpenAI Structured Outputs for Free-Form Parsing

- Status: Accepted
- Date: 2026-02-18

## Context

Free-form user prompts require flexible interpretation but must remain safe and deterministic at execution time.

## Decision

Use OpenAI only to produce strict structured action JSON for non-deterministic inputs.

- Deterministic commands bypass OpenAI.
- Model output must validate against schema.
- Invalid output triggers clarify/error path.

## Consequences

- Controlled integration of LLM reasoning.
- Requires robust schema validation and fallback handling.
