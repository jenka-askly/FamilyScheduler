# Canonical Prompt Help Text (`/help`)

FamilyScheduler Help

Changes require confirmation. Questions respond immediately.

Examples:
- `add person Joe 650-555-1234`
- `update person P-1 cell +1 650 555 9999`
- `deactivate person P-1`
- `mark P-1 unavailable 2026-03-10 09:00 180 out of town`
- `mark P-1 available 2026-03-10 all day`
- `replace people on APPT-1 with P-1,P-2`
- `list people`
- `list rules`
- `confirm`
- `cancel`

Notes:
- `cell` is required when adding a person.
- If no rule overlaps an appointment, person status is `unknown`.
- `unavailable` wins over `available` if both overlap.
- AI may ask follow-up questions in a modal dialog with up to 5 suggested answer buttons, and you can still type a custom response unless explicitly disabled.
