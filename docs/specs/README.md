# Specs Index

This directory is the canonical home for product specs, design docs, architecture decision records (ADRs), and legacy discovery notes.

## Specs and design
- [Authentication model](./SPEC_AUTH_MODEL.md)
- [Time and date](./SPEC_TIME_DATE.md)
- [Architecture](./SPEC_ARCHITECTURE.md)
- [Data model](./SPEC_DATA_MODEL.md)
- [Storage tables and usage design](./DESIGN_STORAGE_TABLES_AND_USAGE.md)
- [Appointment pane enhancement](./SPEC_APPOINTMENT_PANE_ENHANCEMENT.md)
- [Breakout QR join DSID/GSID](./SPEC_BREAKOUT_QR_JOIN_DSID_GSID.md)
- [Ignite dialog design](./design/DESIGN_IGNITE_DIALOG.md)

## ADRs
- [ADR-0001 monorepo](./adr/ADR-0001_monorepo.md)
- [ADR-0002 prompt-only UI](./adr/ADR-0002_prompt-only-ui.md)
- [ADR-0003 storage etag](./adr/ADR-0003_storage-etag.md)
- [ADR-0004 confirmation protocol](./adr/ADR-0004_confirmation-protocol.md)
- [ADR-0005 OpenAI structured outputs](./adr/ADR-0005_openai-structured-outputs.md)
- [ADR-0006 local-first storage mode](./adr/ADR-0006_local-first-storage-mode.md)

## Legacy discovery
- [Discovery: group Azure identity endpoints](./legacy/LEGACY_DISCOVERY_GROUP_AZURE_IDENTITY_ENDPOINTS.md)
- [Discovery: photo extract appointment feasibility](./legacy/LEGACY_DISCOVERY_PHOTO_EXTRACT_APPOINTMENT_FEASIBILITY.md)
- [Multi-select date range preflight](./legacy/LEGACY_MULTI_SELECT_DATE_RANGE_PREFLIGHT.md)

## Source of truth policy
- Specs (`SPEC_*`) are authoritative for product behavior and constraints.
- Design docs (`DESIGN_*`) describe implementation choices aligned to specs.
- Legacy discovery docs (`LEGACY_*`) are historical context and must not override specs or design.
