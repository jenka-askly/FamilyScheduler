# Canonical Prompt Help Text (`/help`)

Use the following as the canonical help content returned by `help` or `?`.

---

FamilyScheduler Help

Changes require confirmation. Questions respond immediately.

Deterministic commands:

- `help` / `?`
- `I am Joe`
- `add appt <title>`
- `list appointments`
- `show <CODE>`
- `update APPT-1 title <new title>`
- `delete APPT-1`
- `mark me unavailable 2026-03-10 9am-1pm out of town`
- `list availability`
- `list availability for Joe`
- `delete AVL-JOE-1`
- `who is available in March`
- `who is available in 2026-03`
- `who is available 2026-03-01 to 2026-03-31`
- `check conflicts`
- `confirm`
- `cancel`

Mutation safety:

- Mutations are never applied immediately.
- You will receive a proposal and a confirmation message.
- Reply `confirm` to execute.
- Reply `cancel` to discard.

Stable codes:

- Every appointment and availability item has a stable code (example: `APPT-1`, `AVL-JOE-1`).
- Use codes to show/modify/delete items.

Timezone default: `America/Los_Angeles`.

---
