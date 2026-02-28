# Temporary debug instrumentation to remove

- **Why:** Temporary client-side debug bundle for Email Update dialog to diagnose groupId request issues from phone.
- **Removal trigger:** Remove after groupId issue resolved and verified in staging.

## Checklist
- [ ] Remove Email Update dialog in-memory debug ring buffer (`apps/web/src/AppShell.tsx`)
- [ ] Remove “Copy debug bundle” button + error UI (`apps/web/src/AppShell.tsx`)
- [ ] Remove debug helper types/functions created solely for this (`apps/web/src/AppShell.tsx`)

Added: 2026-02-28
