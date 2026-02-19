# Canonical Prompt Help Text (`/help`)

Use the following as the canonical help content returned by `help` or `?`.

---

FamilyScheduler Help

Changes require confirmation. Questions respond immediately.

Deterministic commands:

- `help` / `?`
- `I am Joe`
- `add appt <desc> <YYYY-MM-DD> [HH:MM] [duration mins]`
- `list appointments`
- `show <CODE>`
- `update APPT-1 desc <new desc>`
- `move APPT-1 to <YYYY-MM-DD> [HH:MM] [duration mins]`
- `delete APPT-1`
- `mark Joe unavailable <YYYY-MM-DD> [HH:MM] [duration mins] <desc>`
- `list availability`
- `list availability for Joe`
- `delete AVL-JOE-1`
- `who is available in 2026-03`
- `who is available 2026-03-01 to 2026-03-31`
- `confirm`
- `cancel`

Mutation safety:

- Mutations are never applied immediately.
- You will receive a proposal and a confirmation message.
- Reply `confirm` to execute.
- Reply `cancel` to discard.

Action semantics:

- Appointment/availability create and reschedule use `date` + optional `startTime` + optional `durationMins`.
- `date` format: `YYYY-MM-DD`.
- `startTime` format (optional): `HH:MM` (24-hour).
- `durationMins` format (optional): integer in `[1, 1440]`.
- If `startTime` is omitted, item is all-day.
- If user says “all day”, omit `startTime`.
- Default timezone: `America/Los_Angeles`.

Examples:

- `add dentist 2026-03-03` → all-day appointment (`date=2026-03-03`, no `startTime`).
- `add dentist 2026-03-03 10:00 60` → timed appointment (`startTime=10:00`, `durationMins=60`).
- `move APPT-1 to 2026-03-05` → reschedules to all-day by default.

---

## Natural language (OpenAI parser)

When `OPENAI_PARSER_ENABLED=true`, the API can parse natural phrasing into structured actions.

Examples:
- `Add dentist March 3 2026`
- `Add dentist March 3 2026 10am-11am`
- `Move APPT-1 to 2026-03-05`
- `Delete the dentist appointment` (expected clarify response with explicit code candidates)

Safety reminder: changes still require explicit `confirm` before mutation is applied.
