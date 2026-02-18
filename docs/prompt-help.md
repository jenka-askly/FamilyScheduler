# Canonical Prompt Help Text (`/help`)

Use the following as the canonical help content returned by `help` or `?`.

---

FamilyScheduler Help

Changes require confirmation. Questions respond immediately.

Deterministic commands:

- `help` / `?`
- `list appointments [from YYYY-MM-DD to YYYY-MM-DD]`
- `list unassigned`
- `show <CODE>`
- `export json`
- `export csv`
- `undo`
- `backup now`
- `list backups` (if supported)
- `restore from backup <NAME>`
- `confirm [proposalId]`
- `cancel`

Mutation safety:

- Mutations are never applied immediately.
- You will receive a proposal and a confirmation message.
- Reply `confirm` (or `confirm <proposalId>`) to execute.
- Reply `cancel` to discard.

Stable codes:

- Every appointment/availability item has a stable code (example: `APR-12-PT-1`).
- Use codes to modify/delete/show items.

Sample prompts:

1. `Add a PT appointment for Mom on 2025-04-12 at 3:00pm for 1 hour at Rehab Center.`
2. `Move APR-12-PT-1 to 2025-04-12 at 4:00pm.`
3. `Delete appointment APR-12-PT-1.`
4. `Mark Joe unavailable on 2025-03-10 from 9:00am to 1:00pm for work.`
5. `Assign Joe and Ana to APR-18-SURG-1.`
6. `Who is available in March?`
7. `List appointments from 2025-03-01 to 2025-03-31.`
8. `Export json.`
9. `Undo.`
10. `I am Joe.`

Timezone default: `America/Los_Angeles`.

---
