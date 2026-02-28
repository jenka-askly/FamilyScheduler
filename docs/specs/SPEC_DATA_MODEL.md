# Data Model Specification (Versioned)

This document defines the legacy structural state contract for FamilyScheduler.

> **Note:** This is a legacy/structural app-state model. Persistence source-of-truth is defined in `docs/specs/DESIGN_STORAGE_TABLES_AND_USAGE.md` (table-first membership/authorization and roster semantics).

## 1. AppState (structural compatibility model)

```ts
interface AppState {
  version: number;
  people: Person[];
  appointments: Appointment[];
  availability: AvailabilityBlock[];
  history: AppliedBatch[]; // keep last 20
  backupsIndex?: BackupEntry[];
}
```

Required semantics (for structural blob compatibility, not persistence authorization truth):

- `version` increments whenever a mutation batch is applied.
- `history` stores latest 20 applied batches (drop oldest beyond 20).
- `backupsIndex` is optional but recommended for listing/restore UX.

## 2. Entity schemas

### Person

```ts
interface Person {
  id: string; // UUID
  name: string;
}
```

### Appointment

```ts
interface Appointment {
  id: string; // UUID internal
  code: string; // REQUIRED stable human code
  title: string;
  start: string; // ISO-8601 with timezone offset
  end: string;   // ISO-8601 with timezone offset
  location?: string;
  type: 'preop' | 'surgery' | 'postop' | 'pt' | 'followup' | 'other';
  requiredCompanions: 1 | 2;
  assigned: string[]; // personId[]
  notes?: string;
  updatedAt: string; // ISO-8601
}
```

### AvailabilityBlock

```ts
interface AvailabilityBlock {
  id: string;
  code: string; // REQUIRED stable human code
  personId: string;
  start: string; // ISO-8601 with timezone offset
  end: string;   // ISO-8601 with timezone offset
  reason?: string;
  updatedAt: string; // ISO-8601
}
```

### AppliedBatch

```ts
interface AppliedBatch {
  id: string;
  appliedAt: string; // ISO-8601
  actions: unknown[]; // applied actions payload
  inverseActions: unknown[]; // undo payload
  summary: string; // human summary
}
```

### BackupEntry (documented optional structure)

```ts
interface BackupEntry {
  name: string; // e.g., state-20250418-153045.json
  createdAt: string; // ISO-8601
  pathOrBlobName: string;
}
```

## 3. Human-friendly stable code rules

All appointment and availability items must have stable user-facing codes.

### Appointment code format

`MMM-DD-TYPE-N`

Examples:

- `APR-12-PT-1`
- `APR-18-SURG-1`

Where:

- `MMM`: uppercase month abbreviation
- `DD`: zero-padded day
- `TYPE`: normalized short token (`PT`, `SURG`, etc.)
- `N`: sequence number for same day/type collisions

### Availability code format

`AVL-<PERSON>-MMM-DD-N`

Examples:

- `AVL-JOE-MAR-10-1`

Where:

- `<PERSON>`: short uppercase identity token (e.g., first name)
- `MMM-DD`: date fragment
- `N`: collision sequence

### Stability requirement

- Codes are immutable after creation.
- Editing time/title/notes/assignment **must not** auto-rename codes.
- Future explicit code renaming can only happen through dedicated feature/command.

## 4. Backup naming

Recommended backup naming pattern:

- `backups/state-YYYYMMDD-HHMMSS.json`

This applies in local filesystem and may map to equivalent blob naming in Azure.
