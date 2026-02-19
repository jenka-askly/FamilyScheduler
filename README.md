# FamilyScheduler

FamilyScheduler is a lightweight family coordination scheduler with a hash-routed web app and Azure Functions API.

## v1 group access model

- Anyone can create a group from `/#/` with `groupName`, `groupKey` (ceremony only), and creator phone.
- Server creates a random UUID `groupId` and returns share link `/#/g/<groupId>`.
- Joining requires phone entry at `/#/g/<groupId>`.
- Access is allowed only if the normalized phone exists in active People for that group.
- No accounts, no tokens, no role model, no “my groups” index in v1.

## Storage model

- State is scoped per group in one blob/file:
  - `familyscheduler/groups/<groupId>/state.json`
- Local mode mirrors this under:
  - `.localstate/familyscheduler/groups/<groupId>/state.json`
- `STATE_BLOB_PREFIX` controls the root prefix (default: `familyscheduler/groups`).

## Local development

- `pnpm install`
- `pnpm dev` to run API + web together.
- Web routes:
  - `/#/` create group
  - `/#/g/:groupId` join with phone
  - `/#/g/:groupId/app` main scheduler app

## Notes

- People pane “Add person” is the invite mechanism: add sibling phone, then sibling can join by link + phone.
- All admitted members can edit all data.
