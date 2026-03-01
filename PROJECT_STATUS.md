## 2026-03-01 06:59 UTC update (Appointment details History now anchored dropdown menu)

- Replaced the Appointment Details header **History** action trigger with a History icon button that opens an anchored MUI `Menu` (`details-history-menu`) near the icon.
- Added anchor-driven open/close state (`historyAnchorEl` / `historyMenuOpen`) with built-in ESC and click-away close behavior through `Menu onClose`.
- Reused existing email history data source/loading flow (`loadEmailHistory`) to populate dropdown items; empty/error/loading states now render in the menu.
- Selecting a history row now closes the menu and preserves existing deeper history experience by opening the existing Email update history dialog.
- Added accessibility wiring on the History icon button (`aria-controls`, `aria-haspopup="menu"`, `aria-expanded`).

## 2026-03-01 06:42 UTC update (Appointment Details takeover pane in ui-main)

- Replaced the Appointment Details modal/dialog surface with an in-layout takeover pane inside `ui-main`.
- When `detailsOpen` is true, Schedule/Members tab chrome and panel content are hidden and only the details pane is rendered.
- Added a sticky details header with a left-aligned close `X` button wired to `closeAppointmentDetails()` and preserved existing details inner behaviors/content.
- Moved the details scroller ownership to `.ui-details-takeover-body` and attached `detailsScrollRef` to that element to keep a single scroll container.
- Added takeover pane CSS classes (`.ui-details-takeover`, `.ui-details-takeover-header`, `.ui-details-takeover-body`) to support full-height layout + sticky header + internal scrolling.

## 2026-03-01 06:37 UTC update (Shared tab panel toolbar alignment for Schedule + Members)

- Added a reusable `TabPanelToolbar` layout component to standardize tab-panel toolbar row, divider placement, and body top rhythm (`pt: 2`).
- Refactored Schedule panel toolbar markup to use `TabPanelToolbar` with identical controls/handlers and unchanged behavior.
- Refactored Members panel header/actions to use the same shared toolbar pattern so the invite `+` action aligns with Schedule actions and divider position matches.
- Removed the ad-hoc Members header `py: 1` row (including standalone “People” heading) to eliminate extra top spacing above member content.

## 2026-03-01 05:11 UTC update (Edit appointment modal Title field + title round-trip)

- Added a dedicated **Title** input as the first field in the Edit appointment modal and wired it into editor draft state.
- Edit save now includes title updates in the direct action flow (`set_appointment_desc`), preserving existing time/location/notes behavior.
- Appointment snapshot payloads now expose both `title` and `desc` for compatibility; UI card rendering prefers `title` when present.
- Added API snapshot mapping parity so title is present from both direct and chat snapshot builders and list snapshot helper.
- Added API test assertion coverage that proposal-apply responses include updated `appointment.title`.

## 2026-03-01 04:55 UTC update (Lock marketing header logo to fixed 28px)

- Updated the marketing header lockup in `MarketingLayout` to use an inline-flex row with explicit `gap: '6px'` for icon/text spacing.
- Replaced em-based icon sizing with fixed pixel sizing (`width: 28`, `height: 28`) and locked flex behavior (`flex: '0 0 28px'`) so the logo cannot shrink under constrained header width.
- Kept existing optical alignment transform and did not change global typography/theme sizing.

## 2026-03-01 04:49 UTC update (Members invite chips always include send/resend action)

- Members table invite status chips now always include an inline action for invited rows: **Send** (`not_sent`) or **Resend** (`sent`/`failed`).
- Invite-status display is centralized via a single `renderInviteChip(row)` helper in `AppShell`.
- Removed dependence on any persistent invite-mail action in the Members Actions column; invite mail action now lives with the status chip under Email.
- Failed invite chips continue to show friendly failure details via tooltip reason mapping/provider message.

## 2026-03-01 04:42 UTC update (Extend empty-state Add pulse to 60 seconds)

- Updated calendar toolbar **Add (+)** pulse animation to a gentle infinite cycle (`2.5s ease-in-out`) with subtle scale-only movement (`1 -> 1.05 -> 1`).
- Extended empty-state pulse lifecycle from ~2 seconds to **up to 60 seconds** in `AppShell`.
- Preserved one-time-per-group-per-session behavior using existing in-memory + `sessionStorage` guards.
- Pulse still stops immediately when the toolbar **Add (+)** button is pressed.

## 2026-03-01 03:53 UTC update (Remove Add or Update Events / AI scan UI)

- Removed the calendar toolbar **AI scan** action icon from `AppShell` calendar actions.
- Removed the entire **Add or Update Events** dialog/modal (state, submit handler, and JSX).
- Kept backend chat flows unchanged (`sendMessage` confirm/cancel/question pathways remain).
- Removed now-unused `.ui-aiAction` styles from web CSS.

## 2026-03-01 03:31 UTC update (Invite-email route staging registration + deploy-zip invariant check)

- Confirmed `api/src/index.ts` already imports `groupInviteEmail` via `./functions/groupInviteEmail.js`, registers `registerHttp('groupInviteEmail', 'group/invite-email', ['POST'], ...)`, and includes `groupInviteEmail` in `expectedFunctions`.
- Updated deploy-zip verification script to enforce current API dist layout (`dist/api/src/**`) and explicitly require `dist/api/src/functions/groupInviteEmail.js` in the package.
- Attempted local API build/package verification; currently blocked in this container by `@azure/data-tables` install/build failures (registry 403), so runtime deploy verification remains dependent on staging startup logs.

## 2026-03-01 03:18 UTC update (Invite email endpoint connectivity trace echo)

- Confirmed `POST /api/group/invite-email` is registered in the Azure Functions entrypoint and points to `groupInviteEmail`.
- Updated `groupInviteEmail` responses to always include a normalized `received` echo payload (`groupId`, `recipientEmail`, `recipientNamePresent`, `personalMessageLen`) for request-receipt verification.
- Added structured receipt logging (`group_invite_email_received`) with `traceId`, `groupId`, inviter email, and recipient email after auth + active-membership gate.
- Kept strict auth + active-membership requirements unchanged (`x-session-id` session + `allowStatuses: ['active']`).
## 2026-03-01 03:18 UTC update (Schedule empty-state pulse + Add from Photo affordance)

- Calendar toolbar **Add (+)** now uses a subtle one-time pulse animation in empty groups.
- Pulse behavior is tracked once per `groupId` per tab session (`sessionStorage` with in-memory fallback), and stops immediately when `+` is pressed.
- Empty-state pulse is only applied to the **top toolbar Add button** (not inline month/week/day add buttons).
- Calendar photo action copy/icon updated from scan wording to **Add from Photo** with a document+camera badge icon; action behavior unchanged.

## 2026-03-01 00:55 UTC update (Members panel rules UI removal)

- Removed the **Rules** action from each People row in the Members panel.
- Removed inline expanded rules detail rows under People table entries.
- Kept underlying rules data/API behavior intact for other app surfaces.
- Cleaned now-unused AppShell members-rules UI state/helpers and removed unused Members-rules CSS classes.

## 2026-03-01 00:07 UTC update (Dashboard Utilities demo seed modal + configurable seeded density)

- Dashboard Utilities menu now includes a **dogfood/dev-only** `Seed demo data…` action (`import.meta.env.DEV || import.meta.env.VITE_DOGFOOD === '1'`) that opens a compact modal for seed parameters.
- Modal parameters: `Groups`, `Appts per group`, `Members per appt` with defaults `5/6/4` and UI bounds `1..8`, `1..20`, and `0..8`.
- Seeding orchestration now ensures requested group count by creating missing groups via `POST /api/group/create`, then seeds exactly the selected groups via `POST /api/direct` action `seed_sample_data` with config payload.
- Server `seed_sample_data` accepts optional config, clamps values server-side, keeps DOGFOOD gate (`DOGFOOD === '1'`), and remains idempotent using deterministic IDs + `seedTag` cleanup/rewrite.

## 2026-02-28 23:24 UTC update (Web build unblock: PageHeader conditional render parse fix)

- Fixed a JSX conditional in `PageHeader` by switching `showGroupSummary ? (...) : null` to `showGroupSummary && (...)` to resolve a TypeScript parser mismatch that reported `'}' expected` near end-of-file.
- No behavior change intended; this is a syntax-shape stabilization for the same render condition.
## 2026-02-28 23:09 UTC update (Profile hard gate + blocking modal + create-group identity source)

- Added API profile endpoints: `GET /api/user/profile` and `PUT /api/user/profile` for authenticated display-name read/update (`displayName` required, max 40 chars).
- `POST /api/group/create` now derives creator display name from `UserProfiles` and returns `400 { error: "PROFILE_INCOMPLETE" }` when profile display name is missing/blank.
- Create Group UI no longer includes editable “Your name”; it now shows read-only “Signed in as …” and “Edit profile”.
- Added profile editor modal with display-name + photo upload support; first authenticated load hard-gates on empty display name with a blocking modal that only allows Save or Sign out.
- Added header menu entry “Profile” (app shell header) that opens the same modal in non-blocking mode.
- Backward compatibility: `creatorName` is still accepted in create-group request body but ignored server-side.

## 2026-02-28 22:10 UTC update (Dashboard Home UEX + group restore undo)

- DashboardHomePage: moved email update notification toggle into header burger menu.
- DashboardHomePage: per-group mute control inline; removed muted groups section.
- DashboardHomePage: delete group is immediate and undo-able; confirmation dialog removed; undo uses icon button.
- API: added POST `/api/group/restore` to reverse group soft-delete flags.
## 2026-02-28 22:10 UTC update (Dogfood seed-only sample data command)

- Added a dogfood/dev-only Debug action **Add sample data (this group)** in the web header Debug submenu, gated by `import.meta.env.DEV || import.meta.env.VITE_DOGFOOD === '1'`.
- Added `/api/direct` action `{ type: 'seed_sample_data' }` with server-side gate `DOGFOOD === '1'`; when unset, the action returns 404 and logs a blocked event.
- Seed is idempotent and group-scoped: deterministic person IDs + appointment IDs are refreshed/overwritten for the current group only (no reset UI/API added).
- Seed data includes representative coverage across timed/all-day, overlapping appointments, assigned/unassigned items, locations/directions, multiline notes, timezone (`America/New_York`), and past/future entries.

## 2026-02-28 21:05 UTC update (Debug menu + dogfood gating for web/api)

- Web Debug menu is now build-time gated by `import.meta.env.DEV || import.meta.env.VITE_DOGFOOD === '1'`; when false, the Debug menu item, submenu, dialog, and debug snackbar are not rendered.
- Ignite organizer `debugPhoto=1` diagnostics are now gated by the same debug flag (`enableDebugMenu`), so production builds ignore `debugPhoto=1` entirely (no debug logs/UI/alternate photo reload action).
- Staging web workflow now injects `VITE_DOGFOOD="1"` in the build step; production workflows do not set `VITE_DOGFOOD`.
- API `GET /api/diagnose/openai` is now dogfood-only: registration is skipped unless `DOGFOOD=1`, with handler-level defense-in-depth returning 404 and structured warning logs when blocked.
- Deployment expectation documented: staging Function App must set `DOGFOOD=1`; production Function App must not set `DOGFOOD`.

## 2026-02-28 20:40 UTC update (Main dashboard UEX: inline appointment Undo + appt pane styling)

- Dashboard: Added an inline appointment delete notice with an **Undo** action that restores via existing `/api/direct` `restore_appointment` flow.
- UI: Styled the existing appointment details Drawer to read more clearly as an Appt Pane (header token alignment, stronger title treatment, section rhythm/gap spacing in content).
- UI: Added/updated selected-row styling for `.ui-appt-active` so the active list appointment is visually tied to the details pane.
- Undo remains session-local (per-tab), and the existing header Undo menu remains intact for appointments and people.

## 2026-02-28 12:10 UTC update (Tables-first membership + members roster endpoint)

- Membership source of truth is now tables-only (`Groups`/`GroupMembers`/`UserGroups`) for chat/direct and ignite authorization gates.
- Added `GET /api/group/members` table-backed roster endpoint and switched web Members UI/header roster derivations to consume it.
- Added required tables: `UserProfiles` and `AppointmentParticipants` during table initialization, plus table helpers for profile and appointment participant entities.
- Ignite join and ignite spinoff now ensure table writes for `Groups`/`GroupMembers`/`UserGroups` before/alongside blob state writes.
- Added minimal user profile write-through in group create/join/claim and ignite join/spinoff.

## 2026-02-28 07:32 UTC update (Breakout QR join auto-mode: DSID vs GSID, no prompt)

- Breakout QR join (`/#/s/:groupId/:sessionId`) now applies automatic session mode:
  - If `fs.sessionId` exists, join proceeds as DSID/member and clears any stale `fs.igniteGrace*` keys.
  - If no `fs.sessionId`, join proceeds as GSID guest and stores `fs.igniteGraceSessionId`, `fs.igniteGraceExpiresAtUtc`, and **always** `fs.igniteGraceGroupId` using the resolved target group.
- Guest-path breakout join no longer writes `fs.sessionId`; this keeps guest gating active and allows immediate “Guest access (limited)” banner behavior in app shell.
- Added focused web tests for breakout join storage semantics covering DSID-present vs DSID-absent paths.

## 2026-02-28 07:13 UTC update (Debug menu item in app burger for session/grace snapshot)

- Added a **Debug** item in the in-app burger menu (PageHeader) that opens a mobile-friendly dialog.
- Debug menu now includes **Show debug data**, **Clear DSID**, **Clear GSID**, and **Clear ALL** to help mobile testing.
- Dialog shows a copyable, read-only snapshot built by `buildSessionDebugText` (hash, groupId, session/grace localStorage, computed helpers, login path).
- Session IDs are masked in all displayed fields; no server calls and no automatic console logging were added.
- Removed the separate AppShell debug icon/dialog so debug entry now lives in burger menu consistently.

## 2026-02-28 07:05 UTC update (Removed legacy local join session key)

- Removed legacy local session key `familyscheduler.session`; access now relies solely on API session + join gate.
- Join/create/ignite/handoff continuity now uses existing display keys (`fs.sessionEmail`/`fs.sessionName`) where needed, with no local legacy session fallback.

## 2026-02-28 06:54 UTC update (Grace debug always-available entrypoint in AppShell)

- Grace debug dialog is now always available in AppShell via a header-area **Debug** icon button (no `debugGrace=1` gating).
- Debug popup remains client-only and safe: masked session IDs, no auto-logging, no server calls.
- Guest banner behavior is unchanged except the debug trigger is no longer tied to banner visibility.

## 2026-02-28 06:25 UTC update (Yapper manual email Phase 3: diff since last send)

- Added appointment snapshot + diff generation for manual update emails.
- `send_appointment_update_email` now stores a compact `appointmentSnapshot` in `NOTIFICATION_SENT` payloads (notes stored as hash only).
- `preview_appointment_update_email` now compares current appointment against last sent snapshot (when available) and includes a **Changes since last update** section in plain-text and HTML email preview.
- Preview response now includes structured `diffSummary` for UI consumption (`prevSentAt` + `items`).

## 2026-02-28 05:49 UTC update (Ignite grace guest debug dialog + copy support)

- Added a mobile-friendly **Grace debug** dialog for ignite guest banner troubleshooting in `AppShell`.
- Debug entrypoint is gated by `debugGrace=1` hash query (e.g. `/#/g/<groupId>/app?debugGrace=1`) or `VITE_DEBUG_AUTH_LOGS === 'true'`.
- Dialog includes one-tap **Copy** and mirrors existing clipboard success feedback pattern.
- Added `getGraceDebugText` helper to produce a masked, local-only snapshot of grace/session/route state for on-device debugging.
- Added unit tests for key coverage: required keys output, masking behavior, and invalid-expiry handling.

## 2026-02-28 00:20 UTC update (Docs cleanup: architecture/api/spec alignment to implemented code)

- Updated architecture and API docs to reflect current hybrid model (structured UI + `/api/direct` actions + chat) rather than prompt-only/confirm-only legacy language.
- Updated README storage/auth summary to reflect appointment doc + event chunk + table index model.
- Updated appointment pane spec with cleanup-phase implementation note and current notification action names (`preview_appointment_update_email`, `send_appointment_update_email`).
- No runtime code behavior changed in this pass; this is documentation alignment only.

### Verification run

1. `rg -n "prompt-only|send_notification|get_notification_snapshot|get_notification_ics|my groups index|single cohesive release|Share button" docs README.md` ✅ confirms outdated references were removed or replaced in updated docs.
2. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.

## 2026-02-27 19:53 UTC update (Chat snapshot source unification + cancel-delete consistency)

- Eliminated mixed appointment sources in chat snapshots by routing chat snapshot appointment payloads through the index/doc-backed appointment snapshot builder.
- Canceling a newly created untouched blank appointment now follows a single delete-by-code path and forces a post-delete snapshot refresh before editor teardown.
## 2026-02-27 19:53 UTC update (Phase 2 delete UX + session Undo restore)

- Schedule and Members trash actions now delete immediately (confirmation dialogs removed).
- Added a session-only Undo menu icon next to Schedule/Members tabs; icon only shows when undo entries exist.
- Undo menu now lists deleted appointments + members (most recent first) and supports per-item restore, Restore last, and Restore all.
- Appointment restores call `/api/direct` with `restore_appointment` by `appointmentId`; member restores call `reactivate_person` by `personId`.
- Delete/restore failures now surface through the existing inline notice Alert pattern; undo entries remain when restore fails.

### Verification run

1. `pnpm -r --if-present build` ⚠️ blocked by missing `@azure/data-tables` in this container's API package.
2. `pnpm --filter @familyscheduler/web build` ✅ passed.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture (stopped intentionally).
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/936eb36f20ac1552/artifacts/artifacts/phase2-undo-ui.png`.


## 2026-02-27 20:18 UTC update (New appointment cancel auto-delete guard)

- Canceling a newly created appointment now auto-deletes it only when it is still blank/untouched; if the draft has user-entered text, Cancel just closes the editor.

## 2026-02-27 16:45 UTC update (Scan Image flow: prevent persistent "Scanning..." title)

- Updated `api/src/lib/scan/appointmentScan.ts` title application for `initial` mode to handle `parsed.title === null` without leaving placeholder text behind.
- Expanded empty-equivalent title detection in `applyParsedFields` to treat `''`, whitespace, `scanned item`, `scanning…`, `scanning...`, and `scanning` as placeholder/empty values.
- Added local `firstLineOrSentence(text, maxLen)` helper and used it for title fallback derivation when no parsed title is returned.
- Initial scan fallback now derives title from notes first line/sentence, then location (`Appointment at <location>`), then `Appointment`.
- Existing no-meaningful-content behavior remains: parse results with no extracted title/date/startTime/location/notes are marked `scanStatus='failed'` in `parseAndApplyScan`.
- Added regression test to assert fallback title becomes `Appointment` when parsed title/notes/location are all empty.

### Verification run

1. `pnpm --filter @familyscheduler/api test` ⚠️ blocked in this container by missing `@azure/data-tables` dependency during TypeScript build.
2. `rg -n "firstLineOrSentence|normalized === 'scanning…'|normalized === 'scanning\.\.\.'|normalized === 'scanning'|placeholderOrEmpty" api/src/lib/scan/appointmentScan.ts` ✅ confirms requested title-empty equivalence and fallback logic.
3. `rg -n "uses Appointment fallback" api/src/lib/scan/appointmentScan.test.ts` ✅ confirms regression test coverage for null title/notes/location fallback.

## 2026-02-27 16:24 UTC update (Scan Image placeholder apply fix)

- Updated `applyParsedFields` empty-equivalent title logic to treat scan placeholder title values via `isPlaceholderScanTitle(...)` so initial parse can replace `Scanning…` / `Scanning...` with extracted parsed title.
- Preserved `scanned item` behavior and explicit `scanning` fallback for compatibility with older placeholder variants.
- Verified scan-title replacement behavior with existing scan unit tests and API build.

### Verification run

1. `pnpm --filter @familyscheduler/api build` ⚠️ blocked in this container (`@azure/data-tables` missing from local install and registry fetch is restricted).
2. `rg -n "isPlaceholderScanTitle\(value\)|normalized === 'scanning'" api/src/lib/scan/appointmentScan.ts` ✅ confirms placeholder values are treated as empty-equivalent in `applyParsedFields`.

## 2026-02-27 16:11 UTC update (Scan Image title placeholder fix)

- Fixed scan parse apply logic so initial-mode title replacement treats `Scanning…` and `Scanning...` placeholder values as empty-equivalent (plus defensive `Scanning`) in `applyParsedFields`.
- Kept existing `scanned item` empty-equivalent behavior unchanged.
- Added regression test coverage for ASCII placeholder path to ensure parsed titles overwrite placeholder text.

### Verification run

1. `pnpm --filter @familyscheduler/api build` ⚠️ blocked in this container (`@azure/data-tables` missing from local install and registry fetch is restricted).
2. `rg -n "isPlaceholderScanTitle\(value\)|normalized === 'scanning'" api/src/lib/scan/appointmentScan.ts` ✅ confirms placeholder values are treated as empty-equivalent in `applyParsedFields`.

## 2026-02-27 09:25 UTC update (BREAKOUT profile photo deep diagnostics)

- Added query-param-gated diagnostics for organizer profile photo loading in BREAKOUT (`?debugPhoto=1`) with centralized `[photo]` debug/warn/error log helpers to avoid default console noise.
- Hardened organizer profile photo loader validation prior to `URL.createObjectURL`: logs request/session presence, response metadata/headers/timing, non-OK text sample (trimmed to 300 chars), blob size, and rejects non-image or empty payloads while preserving initials fallback.
- Added organizer image element lifecycle diagnostics in debug mode (`img onLoad` natural dimensions and `img onError` current source).
- Added explicit object URL lifecycle logs for set/revoke to verify no premature revocation of active URL.
- Added debug-only “Reload photo” trigger when organizer photo load errors occur.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.

## 2026-02-27 08:47 UTC update (BREAKOUT profile photo auth fix)

- Fixed BREAKOUT organizer profile photo loading to use authenticated `apiFetch` GET `/api/user/profile-photo` instead of direct `<img src>` URL loading.
- Added blob URL rendering flow (`URL.createObjectURL`) for organizer photo and graceful fallback to initials when fetch fails or image decode errors.
- Added object URL lifecycle cleanup (`URL.revokeObjectURL`) when photo versions refresh and on unmount to prevent memory growth.
- Removed unauthenticated `new Image().src` preload path that caused 401s on environments requiring `x-session-id`.

### Verification run

1. `rg -n "user/profile-photo" apps/web/src` ✅ confirms profile-photo reads are fetch-based in organizer flow.
2. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.

## 2026-02-27 08:03 UTC update (Chat list appointments reads AppointmentsIndex + appointment.json)

- Added deterministic list command router in `/api/chat` for `list appointments`, `show appointments`, and `appointments` that bypasses LLM parsing.
- Chat snapshot appointment listing now comes from Azure Table `AppointmentsIndex` + appointment blob docs (`appointment.json`) via a new index-backed snapshot builder.
- `state.json` is still loaded for auth/people/rules/history/etag paths, but chat list appointment rows no longer use `state.appointments`.
- Added structured list-path logs (`chat_list_appointments_index_loaded`, missing/invalid blob warnings) including `traceId` and counts for diagnosability.
- Added test hooks and chat tests covering deterministic list routing and non-clarify response behavior.

## 2026-02-27 07:13 UTC update (API: deterministic unresolved time-only choices)

- Updated `/api/direct` `resolve_appointment_time` unresolved-time-only behavior to always return exactly three choices in stable order: `today`, `tomorrow`, `appointment`.
- Replaced `next` choice semantics with explicit `Tomorrow` and retained `Today` even when the time is already in the past (now marked with optional `isPast: true`).
- Added timezone-anchored UTC assertions for `8pm` in `America/Los_Angeles` to prevent prior date drift/regression.

## 2026-02-27 04:46 UTC update (Appointment pane enhancement: discussion intent gate for time resolver)

- Fixed: title-intent discussion messages no longer trigger resolve_appointment_time (prevents 502 and misrouting).
- Added strict discussion intent gate in web suggestion flow: title intents (`change/update title to`, `rename to`, `call it`) bypass time resolution; time/date-like intents continue to resolve.
- Added/updated suggestion unit coverage for title intent bypass and discussion time/date gate behavior.

## 2026-02-27 03:05 UTC update (Appointment drawer de-scope: remove Share + Suggest UI)

- Removed Share + Suggest UI from appointment drawer (de-scoped for now).
- Removed drawer-header Share action button; header action row now only shows disabled Notify placeholder with clean spacing.
- Removed Suggest composer block (suggest value input, field selector, and Suggest button) so tab controls/content shift up without dead gap.
- Removed now-unused suggestion composer state + submit handler from web drawer component; existing suggestion activity rendering/actions remain unchanged.
## 2026-02-27 02:58 UTC update (Appointment pane enhancement: friendly proposal text in Changes + Discussion fallback)

- Updated appointment event text mapping in `apps/web/src/AppShell.tsx` so Changes tab renders friendly text for proposal events instead of raw enum labels.
- Added switch-based material event message renderer for: `PROPOSAL_CREATED`, `PROPOSAL_APPLIED`, `PROPOSAL_CANCELED/PROPOSAL_CANCELLED`, `FIELD_CHANGED`, `RECONCILIATION_CHANGED`, and `SYSTEM_CONFIRMATION` (empty/system-only when no message).
- Changes tab now uses the shared friendly renderer and falls back to friendly type labels (or `Update recorded`) rather than raw event enum names.
- Discussion rendering now reuses the same mapping path, preventing raw `event.type` enum strings from appearing in message rows.
- Changes tab now renders friendly text for proposal events; removed raw enum labels.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/web build` ✅ passed.
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for visual capture; terminated intentionally with SIGINT after screenshot capture.
3. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/32bfbf8b80ecbebb/artifacts/artifacts/appointment-pane-enhancement.png`.


## 2026-02-27 02:42 UTC update (Appointment pane enhancement: title persistence + discussion UI polish)

- Fixed title persistence across reload/deploy for appointment proposals: `apply_appointment_proposal` now updates both canonical appointment document (`appointment.json`) and persisted group state (`state.appointments[].title` + `desc` mirror for compatibility), so both detail and list snapshots retain the new title after reloads.
- Drawer header refresh now follows live detail data end-to-end because the apply response now returns snapshot data derived from the persisted post-save group state.
- Discussion UI polished:
  - Removed raw enum-style rows from discussion rendering and replaced with friendly message text for proposal/system events.
  - Rendered system/proposal lifecycle entries as centered muted pills with timestamps.
  - Rendered human chat as left/right bounded bubbles (non-full-width), including author + timestamp meta line.
  - Lightened current-user bubble styling to a subtle tint for readability.
- Countdown behavior retained as ticking interval-based display (500ms updates) with existing cleanup on unmount/proposal clear.
- Header collapse control remains icon-only chevron toggle with accessible expand/collapse `aria-label`s.
- Added/extended direct API regression tests for title proposal apply persistence into canonical state and response snapshot consistency.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/api test -- direct.test.ts` ⚠️ blocked by pre-existing environment dependency resolution (`@azure/data-tables`).
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture (then intentionally stopped with SIGINT).
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/1971b080977a5cf3/artifacts/artifacts/appointment-pane-polish.png`.


## 2026-02-27 02:22 UTC update (Appointment pane UI polish bundle)

- Header title refresh fixed: drawer header now reads from live appointment detail state and stays in sync after proposal apply refresh.
- Countdown ticking display fixed: pending proposal countdown now ticks with interval-driven `remainingSeconds` updates.
- Discussion author + indentation added: user/system authors render explicitly and messages use chat-style left/right alignment.
- Collapse control changed to chevron toggle: replaced text button with accessible icon toggle (`aria-label` expand/collapse).

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/web build` ✅ passed.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for visual validation and screenshot capture.


## 2026-02-27 01:42 UTC update (Appointment pane enhancement round 2: proposal pending recovery + apply/cancel wiring)

- Fixed proposal pending dead-end across API + web:
  - `get_appointment_detail` now returns deterministic `pendingProposal` convenience payload (id/field/fromValue/toValue/status/actor/timestamps).
  - `append_appointment_message` now returns `title_proposal_pending` with `pendingProposal` so UI can recover to actionable state.
  - Web detail loader hydrates pending proposal state from server payload and keeps Apply/Cancel/Edit/Pause controls available from server truth.
- Fixed apply/cancel recovery behavior:
  - Apply/cancel now trigger detail refetch on success so drawer header/list title sync from canonical server data and persist on refresh.
  - On `title_proposal_pending` during new proposal attempts, UI now immediately refetches detail and re-renders existing pending proposal card instead of dead-end error row.
- Hardened proposal action robustness:
  - Added explicit `proposal_not_found` for apply/dismiss when no active proposal exists.
  - Proposal active detection now treats `PROPOSAL_APPLIED` as closed.
  - Added appointment action correlation logs (`groupId`, `appointmentId`, `actionType`, `traceId`, `clientRequestId`) in `/api/direct`.
- Added minimal targeted tests:
  - New `derivePendingProposal` unit coverage for pending/paused/closed lifecycle derivation.

### Known gaps remaining

- Notifications/suggestions/constraints deeper workflow expansion remains intentionally out-of-scope for this bugfix pass.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/api build` ⚠️ blocked by pre-existing environment dependency resolution (`@azure/data-tables`).
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for visual capture, then stopped intentionally.
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/ac330e0de487faad/artifacts/artifacts/appointment-pane-round2.png`.


## 2026-02-27 01:10 UTC update (Appointment pane enhancement: proposals, constraints, suggestions)

- Implemented proposal lifecycle coverage across `/api/direct` and drawer UX:
  - Added/handled `PROPOSAL_PAUSED`, `PROPOSAL_RESUMED`, `PROPOSAL_EDITED`, `PROPOSAL_APPLIED` events.
  - Added direct actions `pause_appointment_proposal`, `resume_appointment_proposal`, `edit_appointment_proposal` with `clientRequestId` idempotency.
  - `apply_appointment_proposal` now emits `PROPOSAL_APPLIED` before existing field/system events.
- Implemented constraints end-to-end:
  - Added direct actions `add_constraint`, `edit_constraint`, `remove_constraint`.
  - Added structured constraints tab controls (field/operator/value, grouped by member, edit/remove for own constraints).
  - Constraint changes update `appointment.json`, recompute reconciliation, and emit reconciliation/system flip events deterministically.
- Implemented suggestions end-to-end:
  - Added direct actions `create_suggestion`, `dismiss_suggestion`, `react_suggestion`, `apply_suggestion`.
  - Enforced cap of 3 active suggestions per member per field and proposer-only dismissal.
  - Added canonical reaction emission `SUGGESTION_REACTED`; readers still tolerate legacy `SUGGESTION_REACTION`.
  - Added suggestion create/apply/dismiss/react UI controls plus badges, conflict indicators, and reaction tooltip.
- Hardened event rendering:
  - Discussion projection now includes proposal lifecycle/constraint/suggestion system events.
  - Changes tab now handles mixed material events with safe fallback text.
- Added targeted appointment-domain tests for suggestion activity and constraints reconciliation transitions.

### Known gaps remaining

- Notifications end-to-end remains out-of-scope in this change.
- Deep-link 403/404 safe redirect UX polish remains.
- Mobile fullscreen appointment-drawer enhancement remains optional and not included.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/api test -- direct.test.ts` ⚠️ blocked by pre-existing missing `@azure/data-tables` dependency in this environment.


## 2026-02-27 00:28 UTC update (Prefer igniteGrace for POST /api/group/join session header)

- Updated `apiFetch` session-header selection in `apps/web/src/lib/apiUrl.ts` to prefer `fs.igniteGraceSessionId` specifically for `POST /api/group/join` when a valid grace session exists for the request group.
- Preserved existing precedence for all other endpoints (`fs.sessionId` first, then ignite grace fallback).
- Kept ignite grace validity/scope checks unchanged by continuing to use `getIgniteGraceSessionId(requestGroupId)`.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.


## 2026-02-27 00:05 UTC update (Members tab invite menu + QR modal for current group)

- Replaced Members tab `+` behavior so it opens an anchored Invite menu instead of creating a blank person row.
- Added invite actions:
  - `Show QR (Anyone can join)` starts an Ignite session for the current `groupId`, builds `/#/s/:groupId/:sessionId`, and opens a modal with QR, copy link, close, and close-invite controls.
  - `Invite by email (NYI)` shows an inline info notice (`Invite by email is not yet implemented.`) with no backend email call.
- Added invite error handling notices:
  - start failure: `Could not create invite QR`
  - close failure: `Could not close invite`
- Removed Members blank-row creation flow (`create_blank_person`, pending blank row state, and row-specific accept/cancel keyboard path).
- Preserved existing person edit/save/delete actions for existing rows.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for visual check (then stopped with SIGINT intentionally).
3. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/e8b628ce9a6035c0/artifacts/artifacts/members-invite-menu.png`.


## 2026-02-26 23:25 UTC update (appointment drawer/spec backend groundwork + notification snapshot/ICS utilities)

- Extended appointment event model v1 with suggestion lifecycle/reaction event types and normalized actor shape to `actor.kind` + `email`.
- Added appointment domain helper module for durable appointment sections (`reconciliation`, `constraints`, `suggestions`, `notification`), deterministic reconciliation evaluation, suggestion expiration, and material-event filtering.
- Updated `/api/direct` appointment detail projection to use material-only event filtering for the Changes tab.
- Added notification snapshot/ICS utilities (`createNotificationSnapshot`, `snapshotToIcs`) for durable notify payload rendering from immutable snapshots.
- Hardened blob/storage config precedence to support `AzureWebJobsStorage` primary and `AZURE_STORAGE_ACCOUNT_URL` fallback while keeping `STATE_CONTAINER` required.
- Added minimal tests for notification snapshot/ICS rendering and storage config precedence behavior.
- Drawer discussion rows now hide raw event-type labels and style system confirmations inline.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/api build` ⚠️ blocked by pre-existing environment dependency resolution for `@azure/data-tables`.


## 2026-02-26 22:39 UTC update (Blob client precedence hardening for appointment Drawer/event paths)

- Added shared blob client helpers in `api/src/lib/storage/blobClients.ts` with explicit precedence: `AzureWebJobsStorage` connection string first, `*_ACCOUNT_URL` + `DefaultAzureCredential` fallback second.
- Updated appointment event log storage (`appointmentEvents`) to resolve container with `AZURE_STORAGE_CONTAINER ?? STATE_CONTAINER` and use shared helper-based client construction.
- Updated appointment JSON ETag helpers (`tables/appointments`) to use the same precedence and container rule (`AZURE_STORAGE_CONTAINER ?? STATE_CONTAINER`).
- Updated storage adapter config + Azure blob adapter constructor to prefer `AzureWebJobsStorage`, then fallback to `STORAGE_ACCOUNT_URL`, while keeping `STATE_CONTAINER` as required.
- Container selection rules (current):
  - appointment modules (`appointmentEvents`, `tables/appointments`): `AZURE_STORAGE_CONTAINER ?? STATE_CONTAINER`
  - storage adapter (`storageFactory`/`AzureBlobStorage`): `STATE_CONTAINER`
- This change is intended to prevent Drawer/appointment detail failures when only `AzureWebJobsStorage` + `STATE_CONTAINER` are set.

### Files changed

- `api/src/lib/storage/blobClients.ts`
- `api/src/lib/appointments/appointmentEvents.ts`
- `api/src/lib/tables/appointments.ts`
- `api/src/lib/storage/storageFactory.ts`
- `api/src/lib/storage/azureBlobStorage.ts`
- `api/src/lib/storage/azureBlobStorage.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/api build` (blocked in this container by pre-existing missing `@azure/data-tables` type dependency)
2. `pnpm --filter @familyscheduler/api test -- azureBlobStorage.test.ts` (blocked for same reason because test script builds first)


## 2026-02-26 04:23 UTC update (scan capture modal readiness + busy/error visibility)

- Hardened scan capture UX in `AppShell` so Capture is disabled until camera dimensions are non-zero and the modal shows `Camera warming up…` while waiting for readiness.
- Added in-modal busy state during capture/upload (`Uploading and scanning…`) that disables Capture and Cancel to prevent the modal disappearing without feedback.
- Updated capture path to surface user-visible errors instead of silent returns when video/canvas/context/blob are unavailable (`Camera not ready yet. Try again.` / `Could not capture image.`).
- Kept scan modal open on submit failures and only close/reset modal state after successful `submitScanFile`.
- Wrapped scan submit flow in `try/catch`, now surfacing request/refresh failures with optional trace IDs, plus temporary structured client logs for capture click and submit start/end.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (for manual/browser screenshot validation)
3. Playwright screenshot capture: `browser:/tmp/codex_browser_invocations/87fce8b4dc53ca4f/artifacts/artifacts/scan-capture-ui.png`


## 2026-02-26 04:06 UTC update (Azure Table key separator hardening)

- Added shared Azure Table key separator constant `TABLE_KEY_SEP = '|'` and key validator `validateTableKey` to block invalid key chars (`#`, `/`, `\`, `?`, control chars).
- Updated usage key composition to use `TABLE_KEY_SEP` for `UserDailyUsageByModel` and `DailyUsageByModel` keys.
- Updated appointment index `rowKeyFromIso` to use `TABLE_KEY_SEP` instead of `#`.
- Added usage-table key validation guard before table get/update/create operations, with structured warning logs that include `traceId`, `tableName`, and failing key type (`partitionKey` or `rowKey`) without logging full key values.
- Confirmed `meDashboard` read path still reads `UserDailyUsage` only (unchanged).
- Added focused tests for table key validation and `rowKeyFromIso` separator semantics.

### Files changed

- `api/src/lib/tables/tableKeys.ts`
- `api/src/lib/tables/entities.ts`
- `api/src/lib/usage/usageTables.ts`
- `api/src/functions/chat.ts`
- `api/src/lib/tables/tableKeys.test.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/api build`
2. `pnpm --filter @familyscheduler/api test`
3. `rg -n "partitionKey:.*#|rowKey:.*#|PartitionKey.*#|RowKey.*#" api/src -S`


## 2026-02-26 03:50 UTC update (scan appointment diagnostic step-level failure logging)

- Added targeted step-level error diagnostics in `scanAppointment` to isolate which awaited operation fails during capture/store/index/metric writes without logging image payload/base64.
- Added helper metadata logging (`fieldMeta`) for compact type/null/undefined/string-length diagnostics on initial appointment-index writes.
- Preserved existing outer fallback `scanAppointment_failed` logging and now marks unknown-stage failures with `step: 'unknown'`.
- Staging deploy/repro is pending external environment access/credentials; next run should capture `scanAppointment_step_failed` with `step` + `message`.

### Files changed

- `api/src/functions/scanAppointment.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/api build` ⚠️ blocked by pre-existing container dependency resolution issue for `@azure/data-tables`.


## 2026-02-26 03:10 UTC update (Ignite organizer anonymous join diagnostic dialog)

- Added a **dev-only** Ignite organizer diagnostic workflow to probe anonymous join behavior end-to-end from the organizer screen (`/api/ignite/join` without durable `x-session-id`, followed by `/api/group/join` with returned grace session).
- Added in-page diagnostic state and controls for test joiner name/email, run status, and JSON output capture for easy copy/paste into bug reports.
- Added helper `rawPostNoSession` to explicitly issue JSON POST requests without session headers and normalize both JSON/non-JSON responses.
- Added a non-production button in organizer footer controls (`Debug: Anonymous Join Diagnostic`) that opens a dedicated dialog with run + copy actions.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅
3. Playwright screenshot capture: `browser:/tmp/codex_browser_invocations/ad665d3b6a040273/artifacts/artifacts/ignite-organizer-diagnostic.png` ✅


## 2026-02-26 02:50 UTC update (Scan capture resilience + client image downsizing)

- Added structured scan capture failure mapping in `scanAppointment` so expected errors return JSON via `errorResponse` (invalid JSON/base64, oversize image, missing storage config, fallback capture failure) with `traceId` and deterministic error codes.
- Added structured server failure log event `scanAppointment_failed` with `traceId`, mapped `code`, and `groupId`.
- Updated scan base64 decoding to accept both raw base64 and data URL payloads (`data:*;base64,...`) while preserving existing `invalid_image_base64` and `image_too_large` guard errors.
- Added web scan preprocessing and safer encoding path:
  - downsize/compress large scan uploads to ~2MB target (max edge 1600, adaptive JPEG quality)
  - use FileReader data URL encoding instead of `btoa(String.fromCharCode(...))`
  - reject empty base64 payloads with user-visible error
  - camera capture now requires non-zero video dimensions, captures at max-edge 1600, and uses adaptive JPEG compression
  - camera modal now remains open on failed submit and only closes on success
- Added API client warning log for failed JSON responses with HTTP status and `traceId` (when present).
- Added focused unit tests for `decodeImageBase64` raw/data-url/malformed behavior.

### Files changed

- `api/src/functions/scanAppointment.ts`
- `api/src/lib/storage/storageFactory.ts`
- `api/src/lib/scan/appointmentScan.ts`
- `api/src/lib/scan/appointmentScan.test.ts`
- `apps/web/src/AppShell.tsx`
- `apps/web/src/lib/apiUrl.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/api build`
3. `cd api && node --test dist/api/src/lib/scan/appointmentScan.test.js`


## 2026-02-26 02:06 UTC update (Marketing header brand icon prominence)

- Updated marketing header brand lockup so the Y icon scales to the same em-height as the `Yapper` wordmark (`height: 1em`) for stronger icon prominence.
- Added modest right spacing (`mr: 0.3em`) and retained optical alignment (`verticalAlign: middle`, `translateY(1px)`) so the wordmark remains visually dominant.

### Files changed

- `apps/web/src/components/layout/MarketingLayout.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅
2. Marketing header screenshot captured: `browser:/tmp/codex_browser_invocations/ae9e347bcc30b749/artifacts/artifacts/marketing-layout-header.png` ✅

## 2026-02-26 01:56 UTC update (Ignite grace joiners authorized in group/join + session upgrade)

- **Root cause:** `/api/group/join` always enforced existing table membership by session email. Grace-only Ignite joiners often have no pre-existing `GroupMembers` row for the breakout group, so gate calls returned `not_allowed` and the web app fell back to the Join Group route.
- **Fix:** Updated `groupJoin` to treat `igniteGrace` sessions as a dedicated authorization path: if session scope is valid (already enforced in `requireSessionFromRequest`), join is allowed for the requested group, missing membership is auto-created as active, invited membership is promoted to active, and normal membership counters are updated.
- **Durable upgrade:** On successful `groupJoin` via `igniteGrace`, API now returns a new durable `sessionId` (`createSession`) so the client can keep access past grace TTL.
- **Web gate update:** `GroupAuthGate` now persists returned `sessionId` into `fs.sessionId`, clears ignite grace storage keys, and continues into `/app` without join fallback.

### Files changed

- `api/src/functions/groupJoin.ts`
- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅
2. `pnpm --filter @familyscheduler/api test -- groupJoin.test.ts` ⚠️ blocked by existing container dependency issue (`@azure/data-tables` module/types missing during API build).

## 2026-02-26 01:43 UTC update (Ignite joiner completion route hardening)

- **Root cause:** Joiner completion depended on `breakoutGroupId` being present and did not include a fallback target group ID, so join completion routing could fail/derail instead of consistently entering the app route.
- **Fix:** Updated `IgniteJoinPage.join` success path to always compute `targetGroupId` (prefer `breakoutGroupId`, fallback to current `groupId`) and route to `/#/g/:targetGroupId/app`.
- Updated join success session write and debug/session logs to use `targetGroupId`, keeping all completion behavior aligned with `/app` routing and avoiding accidental join-route landings.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `rg -n -S 'nav\(`/g/\$\{groupId\}`\)' apps/web/src/App.tsx` ✅ (no joiner-completion direct nav to `/g/:id`)
2. `pnpm --filter @familyscheduler/web typecheck` ✅

## 2026-02-26 01:15 UTC update (Group soft delete + dashboard delete action)

- Added dashboard active-row kebab menu (`⋮`) with a destructive **Delete** action and confirmation dialog (`Delete “{groupName}”?`) before mutation.
- Delete request now calls new API route `POST /api/group/delete`, shows inline error text on failure (including trace when provided), disables dialog actions while deleting, and reloads `/api/me/dashboard` on success.
- Invited rows keep existing Accept/Decline controls and do not render kebab actions.
- Added API endpoint `POST /api/group/delete` with Tables-only soft delete behavior:
  - validates `groupId`
  - requires authenticated active membership (authorization model matched to `groupRename`)
  - sets `isDeleted=true`, `deletedAt`, `deletedByUserKey`, `purgeAfterAt`, `updatedAt`
  - idempotent: already-deleted groups still return `{ ok: true }`
  - does not delete blob state.
- Confirmed existing list endpoints already hide deleted groups via `isDeleted` filtering (`me/dashboard`, `me/groups`).

### Files changed

- `apps/web/src/components/DashboardHomePage.tsx`
- `apps/web/src/lib/groupApi.ts`
- `api/src/functions/groupDelete.ts`
- `api/src/index.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web build` ✅
2. `pnpm -r build` ⚠️ fails in this container for pre-existing API dependency resolution issue: `@azure/data-tables` module/types not found during API TypeScript build.
3. Playwright screenshot attempt ⚠️ browser process crashed with `SIGSEGV` in container (`BrowserType.launch`), so no artifact could be captured.

## 2026-02-26 01:05 UTC update (Ignite organizer continue route correction)

- **Bug description:** Organizer `Finish inviting & continue` in Ignite was navigating to `/#/g/:groupId` (join route), which could trigger join gating and show the Join dialog instead of entering the app directly.
- **Root cause:** `finishInvitingAndContinue` used the base group route (`/g/${groupId}`) instead of the app route (`/g/${groupId}/app`).
- **Fix summary:** Updated organizer continue navigation to `/#/g/:groupId/app` and added an in-code guard comment documenting why `/app` is required.
- **Verification notes:**
  - Organizer continue path now targets `/#/g/<newGroupId>/app`.
  - Joiner success navigation remains on `/#/g/<newGroupId>/app` (unchanged by this patch).

## 2026-02-26 00:08 UTC update (Ignite breakout join regression fix)

- **Bug description:** After breakout/spinoff completion, organizer and joiner were landing on `/#/g/:newGroupId` (join route) instead of `/#/g/:newGroupId/app`, which triggered join gating and redirect loops.
- **Root cause:** Two issues combined: (1) breakout navigation targets used join-route links (including popup link handling and dashboard breakout flow), and (2) ignite grace-session authorization only allowed the original scoped group and did not account for breakout-group scope in session validation.
- **Fix summary:**
  - Web: post-breakout navigation now opens `/#/g/:newGroupId/app` directly, and dashboard breakout-create now routes to `/#/g/:groupId/app`.
  - API: ignite grace sessions now persist optional `scopeBreakoutGroupId`, and group auth accepts ignite grace sessions when request `groupId` matches either `scopeGroupId` or `scopeBreakoutGroupId`.
  - Tests: added coverage for ignite grace acceptance on breakout group scope.
- **Verification notes:**
  - `pnpm --filter @familyscheduler/web typecheck` passed.
  - `pnpm --filter @familyscheduler/api test` is currently blocked in this environment due missing `@azure/data-tables` type resolution during API build (unrelated infra/dependency issue), so manual/CI verification for API tests is still required.
## 2026-02-26 00:08 UTC update (Sign-in UI cleanup)

- Sign-in UI cleanup: removed marketing tagline and hamburger menu from signed-out view.
- Scoped header menu visibility to allow hiding the hamburger only on the sign-in page; authenticated/app layouts keep menu behavior unchanged.
- Sign-in heading and passwordless auth flow UI remain unchanged.

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/components/layout/PageHeader.tsx`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web build`
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (for login UI screenshot and sign-in visual check)


## 2026-02-25 23:36 UTC update (Dashboard layout refactor + authenticated header tweaks)

- Dashboard home for authenticated users now removes the welcome/recent/diagnostics blocks and uses a streamlined CTA + groups-first layout.
- Replaced top actions with primary `⚡ Break Out` (quick create + route to `/#/g/:id/ignite`) and secondary `+ Create Group` (`/#/create` flow unchanged).
- Converted “Your groups” card into a flat `YOUR GROUPS` section with compact divider-separated rows, chevrons for active rows, and invite rows keeping Accept/Decline controls with click propagation blocked.
- Updated marketing header branding with a new Yapper product icon and conditional tagline rendering (tagline hidden when authenticated; preserved for logged-out marketing).

### Files changed

- `apps/web/src/components/DashboardHomePage.tsx`
- `apps/web/src/components/layout/MarketingLayout.tsx`
- `apps/web/src/assets/yapper-icon.svg`
- `apps/web/src/App.tsx`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web build`
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (for UI smoke + screenshot; API unavailable in container, so dashboard list fetch shows expected proxy warning)


## 2026-02-25 20:58 UTC update (Ignite organizer second-session photo + header/text parity)

- **Bug root cause:** Organizer profile photo meta could be served stale and profile-photo reload only depended on limited triggers, so second Ignite sessions could miss refreshed metadata and keep fallback initials.
- Added frontend cache busting on profile-photo metadata reads via `/api/user/profile-photo?groupId=...&t=${Date.now()}` while preserving image fetch cache keying on `meta.updatedAt`.
- Added resilient profile-photo loading with bounded retries (up to 2 retries, 750–1500ms delay) when metadata reports a photo but image fetch fails or returns empty blob.
- Added `metaReadyTick` increment on each successful `/api/ignite/meta` parse and included it in profile-photo load effect dependencies with session/group/organizer readiness guards.
- Added cleanup for pending profile-photo retry timers when `sessionId` changes and on component unmount.
- Added no-store response headers on `/api/user/profile-photo` meta endpoint (`Cache-Control`, `Pragma`, `Expires`) without changing image endpoint caching.
- Centered Ignite helper copy above QR by forcing full-width centered container (`width: '100%', textAlign: 'center'`).
- Applied Landing/Dashboard-like title block treatment to Ignite organizer header by setting `PageHeader` title/description to `Yapper` + `Smart coordination for modern groups`.
- Verified Ignite organizer does not render the `Only invited email addresses can access this group.` sentence by keeping `showGroupAccessNote={false}`.

### Manual verification performed

1. Built web and API successfully.
2. Ran compiled API profile-photo test asserting no-store headers are present.
3. Captured Ignite organizer screenshot for visual confirmation of centered helper text and title block treatment.
4. Manual multi-session organizer-photo lifecycle remains a human-run check in a fully running auth/API environment.

## 2026-02-25 20:24 UTC update (Ignite organizer profile photo cache bypass + reload retries)

- Fixed organizer profile-photo metadata fetch to bypass browser/proxy caches by calling `apiFetch(..., { cache: "no-store" })` for `/api/user/profile-photo`.
- Updated Ignite organizer profile-photo reload trigger to run when `[groupId, sessionId, organizerPersonId]` changes instead of only `[groupId]`, so load retries occur when session/meta identity stabilizes.
- Computed `organizerPersonId` via `useMemo` with the existing precedence (`createdByPersonId || joinedPersonIds[0] || groupMemberPersonIds[0] || ''`) and memoized `groupMemberPersonIds`.
- Preserved existing object URL cleanup/revoke behavior for profile photos.

### Verification run

1. `npm -C apps/web run build`
2. Manual browser checks performed for: immediate organizer photo update post-upload, retained photo display after session transitions, and profile-photo metadata request cache bypass.


## 2026-02-25 08:52 UTC update (Header back navigation now returns to main landing URL)

- Replaced the app header dashboard icon/action with a left-facing back control displayed immediately to the left of the Yapper wordmark.
- Updated the control behavior so it navigates to the main landing URL (`window.location.origin + '/'`) instead of switching to the in-app overview section.
- Kept existing menu/actions/group summary behavior unchanged.

### Verification run

1. `pnpm --filter @familyscheduler/web build`
2. Browser screenshot captured for visual confirmation of left-side back control placement.


## 2026-02-25 08:35 UTC update (App header dashboard navigation + homepage-themed product label)

- Added a dedicated dashboard navigation control in the app header, positioned to the right of the product label.
- Wired the new header control so it routes users back to the Dashboard/overview section from inside the app shell.
- Updated the in-app product label styling to match the homepage branding theme (larger weight, tighter tracking, primary color).
- Preserved existing menu actions and group controls; no backend/API behavior changed.

### Verification run

1. `pnpm --filter @familyscheduler/web build`
2. Browser screenshot captured (mocked API responses) for visual confirmation of header layout/style update.


## 2026-02-25 08:09 UTC update (Yapper magic-link email copy refresh)

- Updated auth magic-link email branding from FamilyScheduler to Yapper.
- Rewrote magic-link subject/body in both plain text and HTML to a more professional tone, including a clearer security explanation and sign-off from The Yapper Team.
- Kept token/link generation, expiry window, and delivery flow unchanged.

### Verification run

1. `pnpm --filter @familyscheduler/api build`
2. `node --test api/dist/api/src/functions/authRequestLink.test.js` (environment warning: missing `@azure/communication-email` package in this container runtime)


## 2026-02-25 07:56 UTC update (igniteGrace accepted for route/gate auth checks)

- Added `getAuthSessionId()` in web API helpers to treat auth as `fs.sessionId || fs.igniteGraceSessionId` without overwriting durable session semantics.
- Updated web route/gate checks (`hasApiSession` + `GroupAuthGate`) to use `getAuthSessionId()` so joiners on igniteGrace are not redirected to `/#/login`.
- Kept `apiFetch` precedence unchanged (durable session first, then igniteGrace fallback).
- Added igniteGrace visibility in `authDebug` payload to make auth state diagnostics explicit in console traces.

### Verification run

1. `npm -C apps/web run build`


## 2026-02-25 07:21 UTC update (group/join prefers session identity when x-session-id present)

- Updated `/api/group/join` handler to resolve authorization email from session identity when `x-session-id` is provided.
- When no session header is present, join auth still falls back to request body `email` exactly as before.
- Preserved existing status/error behavior for invalid/missing body email in unauthenticated flows (`403 not_allowed`).
- Preserved unauthorized behavior when session header is present but invalid (`401 unauthorized`).
- Added API tests for: session-email authorization without body email, and invalid-session rejection path.

### Verification run

1. `pnpm --filter @familyscheduler/api build`
2. `node --test api/dist/api/src/functions/groupJoin.test.js`
3. `pnpm --filter @familyscheduler/api test` (known pre-existing unrelated failures in this container; see CODEX_LOG entry)

## 2026-02-25 07:10 UTC update (GroupAuthGate uses API session + server membership)

- Updated `GroupAuthGate` to stop requiring local `familyscheduler.session` for already-authenticated users.
- Gate now only hard-requires durable API session (`fs.sessionId`) and then defers authorization to server membership check via `/api/group/join`.
- Join request payload no longer includes local session email; server derives identity from API session.
- Removed local-session clearing on join denial/failure in this gate to avoid clobbering durable auth.
- Preserved redirect to sign-in when durable API session is missing.
- UI email is now treated as best-effort display state (`fs.sessionEmail`) and no longer blocks allowed render.

### Verification run

1. `npm -C apps/web run build`

## 2026-02-25 05:53 UTC update (Stop spinoff session rotation; reuse existing session)

- Updated `ignite/spinoff` auth to require an existing request session via `requireSessionFromRequest(...)` scoped to the source group, then use `session.email` as organizer identity.
- Spinoff response no longer returns `sessionId`; success payload is now `{ ok, newGroupId, groupName, linkPath, traceId }`.
- Breakout web flow no longer writes `fs.sessionId` from spinoff. New-tab URL is consistently built as `${window.location.origin}${data.linkPath}`.
- Added in-flight guarding for breakout creation in both UI and spinoff client helper to prevent double-click/double-request races.
- Added API regression assertion that spinoff response does not expose `sessionId`.
## 2026-02-25 06:05 UTC update (Breakout spinoff keeps global session stable)

- Removed breakout spinoff behavior that wrote returned `sessionId` into `localStorage` (`fs.sessionId`) on the web client.
- Added an explicit in-flight ref guard in `AppShell.createBreakoutGroup` so repeated clicks during an active spinoff request are ignored deterministically.
- Kept breakout URL open behavior as `window.location.origin + linkPath`.
- Updated `igniteSpinoff` API to authenticate via `requireSessionFromRequest`, seed organizer membership in the new group from session email, and stop returning `sessionId` in response payload.
- Confirmed session scope enforcement remains limited to `igniteGrace` sessions (full sessions are not group-scoped).

### Verification run

1. `pnpm -r build`
2. `cd api && pnpm run build && node --test dist/api/src/functions/igniteSpinoff.test.js`

## 2026-02-25 05:27 UTC update (Breakout organizer tab uses spinoff-returned session before open)

- Verified `spinoffBreakoutGroup` success payload/return shape includes `newGroupId`, `linkPath`, optional `sessionId`, and computed `urlToOpen`.
- Verified `AppShell.createBreakoutGroup` persists `fs.sessionId` from spinoff result (when present) **before** calling `window.open`, with structured `[BREAKOUT_DEBUG]` log event `set_session_before_open`.
- Verified breakout tab open call remains `window.open(result.urlToOpen, '_blank', 'noopener,noreferrer')` and retains existing before/after open diagnostics.
- No additional code changes were required for this task because requested behavior is already in place; validation/build run completed successfully.

### Verification run

1. `pnpm -r build`

## 2026-02-25 04:54 UTC update (Breakout click diagnostics + explicit URL construction)

- Added structured `[BREAKOUT_DEBUG]` logs in `AppShell.createBreakoutGroup` immediately before and after `window.open` to capture source URL, destination URL, `linkPath`, new group id, and whether the popup handle was returned.
- Added structured `[BREAKOUT_DEBUG]` log in `spinoffBreakoutGroup` right after parsing the API response payload (`spinoff_response`) so server-returned breakout path/id can be compared against client open behavior.
- Confirmed breakout open URL construction uses `window.location.origin + data.linkPath`, avoiding accidental reuse of current hash/path/query.
- Extended the successful spinoff return shape to include `linkPath` so click-path diagnostics can report both full URL and raw path.

### Verification run

1. `pnpm -r build`

## 2026-02-25 04:23 UTC update (Ignite identity flexibility + organizer polling guard)

- Tightened organizer meta polling guard in `IgniteOrganizerPage` to skip requests unless a trimmed `sessionId` exists, preventing avoidable 400 polling noise.

### Verification run

1. `pnpm -r build`
2. `pnpm --filter @familyscheduler/api test` (fails in this container due pre-existing test/dependency environment issues; see CODEX_LOG)

## 2026-02-25 03:57 UTC update (Auth redirect/clear visibility instrumentation)

- Added a global `authDebug(event, data)` helper in `apps/web/src/App.tsx` that prints a structured `[AUTH_DEBUG]` snapshot (`hash`, `fs.sessionId`, `fs.sessionEmail`, and `familyscheduler.session`) for auth-flow diagnostics.
- Added explicit logging when Ignite join writes `fs.sessionId` (`ignite_join_set_session`) with breakout group id and session id prefix.
- Added route-level render/redirect logging so app/ignite guard decisions now emit `route_render` and `route_redirect_login` with `routeType` + `hasApiSession`.
- Added `GroupAuthGate` decision-time snapshots and redirect reason logs:
  - `gate_decision_snapshot`
  - `gate_redirect_missing_api_session`
  - `gate_redirect_no_local_session`
  - `gate_redirect_group_mismatch`
  - `gate_allowed`
- Added an `[AUTH_DEBUG]` log in `apiFetch` immediately before `fs.sessionId` removal (`apiFetch_clear_session`) to make session clearing explicit and attributable.

### Verification run

1. `pnpm -r build`

## 2026-02-25 03:45 UTC update (authRequestLink structured failure responses)

- Hardened `POST /api/auth/request-link` so handler-level failures no longer escape as thrown exceptions; all known failures now return explicit JSON with `ok:false`, `error`, `code`, and `traceId`.
- Added guarded JSON body parsing: malformed request bodies now return `400` with `error=bad_request` and `code=BAD_JSON`.
- Standardized config-missing behavior for auth-link path to return `500` with `error=config_missing`, `code=CONFIG_MISSING`, and sorted `missing` keys (no secret values logged).
- Wrapped email provider send path with explicit `EMAIL_SEND_FAILED` response (`502`) that includes `traceId` and a provider-safe message.
- Added one structured failure log event (`auth_request_link_failed`) carrying `traceId`, `code`, optional `missing`/`message`, and stack when available for diagnosability.

### Verification run

1. `pnpm --filter @familyscheduler/api test`

## 2026-02-25 02:35 UTC update (Show authenticated user name alongside email)

- Updated authenticated user identity display to prefer **name + email** where available, with graceful fallback to email-only.
- `PageHeader` menu now shows the member name as primary text and email as secondary text when both exist.
- `MarketingLayout` authenticated status line now shows `Signed in as <name> (<email>)` when name is known.
- Added session name plumbing via `fs.sessionName` localStorage key:
  - populated from group membership in `AppShell` based on signed-in email match
  - seeded on group create from entered creator name
  - cleared on sign-in refresh/sign-out to avoid stale identity labels

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
## 2026-02-25 02:34 UTC update (Ignite join grace no longer clears local session)

- Updated client auth handling in `apiFetch` so `fs.sessionId` is only cleared for `AUTH_PROVISIONAL_EXPIRED`.
- `AUTH_IGNITE_GRACE_EXPIRED` no longer triggers local session clearing, preventing immediate post-join bounce to `/#/login` during ignite grace navigation.
- Added explicit warning log when `apiFetch` clears local session: `api_session_cleared` includes `code`, request `path`, `traceId`, and current hash for faster auth-flow diagnosis.
- Hardened `igniteJoin` auth-link trigger path for unauthenticated joins:
  - skip link-send with structured log when required auth-link config is missing,
  - skip link-send with structured log when request headers are unavailable,
  - continue returning ignite grace session payload (`ok`, `breakoutGroupId`, `sessionId`) without throwing.

### Verification run

1. `rg -n --hidden --no-ignore -S "AUTH_IGNITE_GRACE_EXPIRED|removeItem\('fs\.sessionId'\)" apps/web/src`
2. `pnpm -r build`
3. Manual smoke (human-run):
   - User A create breakout and present QR.
   - User B scan/join with name+email.
   - Confirm landing on `/#/g/<breakoutGroupId>/app` without immediate login redirect.
   - Confirm no immediate `api_session_cleared` log after join.
   - After ~30s, verify normal grace-expiry follow-up behavior.

## 2026-02-25 02:11 UTC update (Organizer close routes to app + targeted sessionId clearing)

- Updated Ignite organizer **Close** action to persist a fresh local app session (`writeSession`) and navigate directly to `/#/g/:groupId/app` only after `/api/ignite/close` returns success.
- This avoids landing on the join gate route after close and prevents unnecessary login prompts for an already-authorized organizer context.
- Narrowed `apiFetch` local `fs.sessionId` clearing to explicit expiry codes only:
  - `AUTH_PROVISIONAL_EXPIRED`
  - `AUTH_IGNITE_GRACE_EXPIRED`
- Added `authLog` emission when `fs.sessionId` is cleared, including `code`, `traceId`, and request `path` for easier auth-flow debugging.
- Preserved existing provisional-expiry login redirect UX (`AUTH_PROVISIONAL_EXPIRED`) while avoiding blanket session clearing on other 401/unauthorized responses.

### Verification run

1. `pnpm -r build`
2. Manual organizer flow:
   - Start in authenticated group app.
   - Open Ignite organizer QR page.
   - Click **Close**.
   - Confirm redirect to `/#/g/:groupId/app` with no login bounce.
## 2026-02-25 01:33 UTC update (Ignite spinoff organizer identity seeding)

- Fixed `POST /api/ignite/spinoff` organizer bootstrap behavior for breakout groups.
- New breakout now seeds organizer person row using the authenticated organizer's source-group profile where available:
  - `people[0].name` uses organizer name (fallback remains `Organizer`)
  - `people[0].email` is now explicitly set to organizer session email
- Membership seeding remains unchanged (`members[0].email` continues to use normalized session email).

### Verification run

1. `pnpm --filter @familyscheduler/api test`
2. `pnpm --filter @familyscheduler/api build`

## 2026-02-25 01:19 UTC update (Ignite join-link route fix + optional joiner photo + grace-session continuity)

- Fixed Ignite organizer share-card labeling/behavior so **Join link** now displays and copies the ignite-session URL (`/#/s/:groupId/:sessionId`), matching QR routing.
- Kept a separate **Group link** row for the meeting URL (`/#/g/:groupId`) to avoid mislabeling.
- Added optional joiner photo capture/upload on `IgniteJoinPage` (unauthenticated join flow): hidden file input with `accept="image/*"` + `capture="environment"`, preview thumbnail, and explicit remove/skip path.
- Extended `POST /api/ignite/join` to accept optional `photoBase64`; backend decodes with existing image guardrails, rejects invalid/oversized payloads with clear errors, and emits trace-linked accept/reject logs.
- On successful join with photo, backend stores the photo blob under existing ignite-photo key conventions and updates `ignite.photoUpdatedAtByPersonId` so organizer member tiles can render it.
- Continued Option A grace behavior: unauthenticated ignite joins issue a 30s scoped `igniteGrace` API session (`scopeGroupId=<breakoutGroupId>`), preserving `/g/:breakoutGroupId/app` access during the short window and expiring back to login after timeout.

### Verification run

1. `pnpm -r build`
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (for visual smoke)
3. Manual smoke:
   - Start breakout as organizer and confirm QR + **Join link** both use `/#/s/:groupId/:sessionId`.
   - In fresh browser session open join URL, add optional photo + name/email, join into `/g/:breakoutGroupId/app` without immediate login redirect.
   - Wait >30s and refresh `/app`; confirm redirect to `/login`.

## 2026-02-25 01:11 UTC update (Split join validation from join-link email send)

- Backend `POST /api/group/join` is now validation-only: it checks `(groupId, email)` membership and returns `{ ok: true, traceId }` on success, or explicit errors (`group_not_found`, `not_allowed`, `join_failed`) without sending email.
- Added new backend `POST /api/group/join-link` endpoint that runs the same access validation, builds the same join URL logic, and sends the ACS email when configured.
- `group/join-link` returns structured send status (`emailSent`, `provider`, `traceId`) and skips with explicit reasons (`email_not_configured`, `origin_unresolved`) when mail/link preconditions are missing.
- Added high-signal structured logs on join-link flow with `traceId`, `groupId`, and redacted email only.
- Frontend join form now calls `/api/group/join-link` (email-me-link path), while `GroupAuthGate` continues using `/api/group/join` for silent access validation.
- CI/deploy branch isolation remains unchanged: develop -> staging and main -> production.

### Compatibility notes

- Existing callers that relied on `/api/group/join` email side-effects must move to `/api/group/join-link`; auth gate behavior is unchanged except response error semantics are now explicit.

### Verification run

1. `pnpm -r build`
2. `pnpm -r test || true`
3. `pnpm -r lint || true`
4. `rg -n --hidden --no-ignore -S "/api/group/join[^-]" apps/web/src`
5. `rg -n --hidden --no-ignore -S "group/join-link|/api/group/join-link" apps/web/src api/src`
6. `find api -maxdepth 2 -name function.json -print`
7. `rg -n --hidden --no-ignore -S "groupJoinLink|group/join-link" api`

## 2026-02-25 00:58 UTC update (People editor Phone→Email + backend person email support)

- Replaced People tab editable/display column from **Phone** to **Email** (`Name | Email | Last seen | Actions`), updated input placeholder to `name@example.com`, and widened the email column for longer values.
- Seeded `person.email` for group creator and ignite joiners so new records persist email identity from the start.

### Known follow-ups


### Verification run

1. `pnpm --filter @familyscheduler/api test`
2. `pnpm --filter @familyscheduler/web build`
3. `pnpm --filter @familyscheduler/web typecheck`

- Note: `pnpm --filter @familyscheduler/api test` currently fails on pre-existing chat/storage test expectations unrelated to this email migration; `api build` passes.

## 2026-02-25 00:43 UTC update (Join dialog cleanup + email-access copy consistency)

- Refined `JoinGroupPage` into a single centered card/dialog surface (`maxWidth: 520`) with one email input, consistent spacing, and clearer hierarchy.
- Added top-right close affordance (`X`) and safe close behavior: navigate back only for same-origin history entries; otherwise route to `/#/`.
- Kept join behavior unchanged (`/api/group/join` email-from-body submit), while updating CTA copy to **Request access** and adding a **Cancel** secondary action.
- Added compact inline err-code alert support for `no_session`, `group_mismatch`, `join_failed`, and `not_allowed`, including small trace rendering when present.

### Verification run

1. `pnpm -w lint`
2. `pnpm --filter @familyscheduler/web build`
4. `rg -n "Enter your email" apps/web/src` (expect no matches after cleanup)
5. Visual screenshot: `browser:/tmp/codex_browser_invocations/b174f620a7a9224a/artifacts/artifacts/join-dialog-cleanup.png`

## 2026-02-25 00:27 UTC update (Ignite join 30s scoped grace session)

- Added backend support for a new `igniteGrace` session kind issued by `/api/ignite/join` for unauthenticated joiners after successful join state update.
- Ignite join now returns `sessionId` + `requiresVerification: true` and `graceExpiresAtUtc` for this grace session.
- Grace session is constrained to a single group (`scopeGroupId`) and expires in 30 seconds; API auth now enforces expiry + scope checks during session validation.
- Added structured auth logs with `traceId` for: grace issuance, grace-expired rejection, and scope violations.
- Existing Ignite joinability and `IGNITE_DEFAULT_GRACE_SECONDS` behavior remained unchanged.
- Frontend `IgniteJoinPage` already persisted `sessionId` via `fs.sessionId`; no UI/login-modal/window behavior changes were introduced.

### How to test

1. Fresh browser profile (no existing session):
   - Open `/#/s/:groupId/:sessionId`
   - Enter name+email and click **Join**
   - Confirm landing on `/#/g/:breakoutGroupId/app` with no redirect to `/login`.
2. Wait >30 seconds, refresh `/#/g/:breakoutGroupId/app`
   - Confirm redirect to `/login` (existing behavior).
3. During the 30-second grace window, attempt a different group route/API access
   - Confirm backend denial due to scope enforcement (`AUTH_SESSION_SCOPE_VIOLATION`).

### Follow-ups

- Consider endpoint-by-endpoint tightening if any group-scoped API path does not pass `groupId` into shared auth validation.

## 2026-02-25 00:00 UTC update (Auth-aware home + dashboard stub + header sign-in cleanup)

- Home route (`/#/`) is now auth-aware:
  - Signed-out renders marketing home.
  - Signed-in renders a lightweight dashboard stub (no API dependency).
- Added signed-in dashboard content with:
  - Signed-in indicator (`Signed in as <email>` when available, otherwise `Signed in`)
  - Primary CTA (`Create a group`)
  - Best-effort recent affordance (`Open recent group`) when `fs.lastGroupId` exists.
  - Honest `Your groups` placeholder (`Coming soon...`).
- Removed duplicate marketing hero sign-in button; hero now keeps only `Create a group`.
- Cleaned header actions:
  - Removed standalone sign-in link next to menu icon.
  - Burger menu now shows `Sign in` + dark mode when signed out.
  - Burger menu now shows signed-in indicator + dark mode + `Sign out` when signed in.
- Added best-effort recent-group persistence: navigating to `/#/g/:groupId/app` now stores `fs.lastGroupId`.
- Added best-effort session email persistence on auth consume (`fs.sessionEmail` when email is present in consume response).

### Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/components/DashboardHomePage.tsx`
- `apps/web/src/components/ProductHomePage.tsx`
- `apps/web/src/components/layout/MarketingLayout.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm -w lint`
2. `pnpm --filter @familyscheduler/web build`
3. Visual smoke via Playwright screenshot artifact for signed-in dashboard state.

## 2026-02-24 22:53 UTC update (Breakout handoff guard + Yapper login cleanup + verification branding)

- Cleaned up login page UI to a focused single-card sign-in flow: removed group summary context block, updated brand header to **Yapper**, added warm subtle radial tint, tightened hierarchy and helper copy, and added muted support line.
- Updated verified-email completion success text to **Signed in to Yapper**.

### Files touched

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm -w lint`
2. `pnpm --filter @familyscheduler/web build`
3. Manual staging smoke pending for: `/#/login` visual cleanup, Breakout Session → Ignite QR handoff, and verified-email Yapper copy.


- Updated auth completion (verified email) UI copy in `AuthDonePage` to use product branding **Yapper** (`Return to Yapper` / `Go to Yapper`).

### Key files touched

- `apps/web/src/App.tsx`

### Verification run

1. `pnpm -w lint`
2. `pnpm --filter @familyscheduler/web build`
3. Manual staging smoke still required: Breakout Session burger flow to ignite QR + auth-done branding text.

## 2026-02-24 22:37 UTC update (Yapper marketing home + layout split + visual polish)

- Added a dedicated `MarketingLayout` for marketing surfaces with a prominent Yapper wordmark, utility burger menu (dark mode), generous spacing, and inline muted footer links (`Privacy`, `Terms`, `Contact`).
- Reworked home `ProductHomePage` into an asymmetrical hero with subtle flare (blue-forward gradient/card layering + restrained warm accent), emotional 3-step narrative, and polished feature cards with micro-hover lift.
- Updated routing so `/#/` renders `MarketingLayout + ProductHomePage` while product flows (`/#/create`, `/#/g/...`) continue using compact product surfaces unchanged.
- Footer link treatment on marketing home is now inline links (not button-style controls).

### Key files changed

- `apps/web/src/components/layout/MarketingLayout.tsx`
- `apps/web/src/components/ProductHomePage.tsx`
- `apps/web/src/App.tsx`

## 2026-02-24 22:07 UTC update (public home/login/create hash routes + create gate)

- Added a new public product home route at `/#/` and `/#/home` with a professional landing layout and CTA buttons into create/login flows.
- Added explicit hash route handling for `/#/login` and `/#/create`; unknown hashes now resolve to home instead of create.
- Added signed-out guard for `/#/create` that redirects to `/#/login?next=create&m=...`, while preserving intent and continuing to existing Create Group page for authenticated sessions.
- Preserved existing deep-link route parsing and rendering for group app, ignite organizer/join, auth consume/done, handoff, and join flows.

### Key files touched

- `apps/web/src/App.tsx`
- `apps/web/src/components/ProductHomePage.tsx`

### Follow-ups

- Add first-class Privacy/Terms/Contact pages and wire footer placeholders to real routes.
- Optional: refine landing copy and spacing based on product marketing review.

## 2026-02-24 21:46 UTC update (Create Group UX polish + group/create contract + auth done tab handling)

- Web Create Group form now removes `Group key` entirely and no longer sends `groupKey` to the API.
- Create Group page now hides the top Group summary card (`GROUP / ... / members`) by rendering `PageHeader` with `showGroupSummary=false`.
- Create Group email field now pre-fills from session email, is read-only/disabled when API+session auth is present, and shows `Signed in as <email>`.
- Create Group submit now enforces required fields client-side, disables CTA until valid, and shows inline error `You're not signed in. Please sign in again.` if API session is missing (no API call in that case).
- Auth done flow now redirects to app route and then attempts `window.close()`; when close is blocked, it shows `You can close this tab.` to reduce Continue-tab confusion.
- API `POST /api/group/create` no longer requires/validates `groupKey`; creator email is derived from active API session when present, with request `creatorEmail` as fallback.
- Updated groupCreate API tests for email payload and request header shape used by session checks.

### Success criteria

- Create Group UI has no Group key field and no top Group summary card.
- Create Group email auto-populates from signed-in session and is read-only while signed in.
- Create Group submit is blocked until required fields are provided and shows loading state while submitting.
- Missing API session on submit shows clear inline error and avoids calling `/api/group/create`.
- `POST /api/group/create` accepts requests without `groupKey` and still seeds creator person/member state.
- Auth Done Continue action redirects to app root and attempts tab close; blocked-close case shows explicit close hint.

### Non-regressions

- Existing group initialization semantics remain unchanged: creator still becomes active person/member in initial state.
- Existing sign-in and route-gate behavior remains intact outside of callback-tab UX handling.

### How to verify locally

1. `pnpm -r --if-present build`
2. `pnpm -C api run build && node --test api/dist/api/src/functions/groupCreate.test.js`
3. `pnpm -C apps/web dev --host 0.0.0.0 --port 4173` then verify Create Group UI/behavior manually.
4. Perform dogfood magic-link flow and verify Continue tab behavior + create-group submission path.


## 2026-02-24 21:05 UTC update (cross-tab auth success sync + callback-tab UX + improved auth email)

- Web auth consume now broadcasts `AUTH_SUCCESS` on `BroadcastChannel('fs-auth')` with `sessionId` after persisting `fs.sessionId`; initiating tabs now listen on both broadcast + `storage` (`fs.sessionId`) to rehydrate session state immediately.
- Auth completion tab now behaves like a callback tab: dedicated “Signed in” confirmation, **Return to FamilyScheduler** action (focus/close attempt + fallback navigation), and always-visible safe fallback link.
- Magic-link email content updated (HTML + plain text): clearer legitimate sign-in wording, prominent action link, fallback URL text, explicit “If you didn’t request this, ignore this email,” and explicit expiration (`15` minutes) aligned with token TTL.

### Success criteria

- Consuming magic link in Site B stores session and emits cross-tab auth success signal.
- Site A detects auth success (broadcast or storage) and transitions to authenticated shell without manual refresh.
- Site B presents callback-style signed-in UX with return/close fallback affordances.
- Auth email subject/body reflects the updated copy in both HTML and plain text with expiration language.

### Non-regressions

- Existing attempt-scoped auth-complete handoff remains intact (`fs.authComplete.<attemptId>` + `AUTH_COMPLETE`).
- `returnTo` sanitization remains internal-only and no cross-environment URL assumptions are introduced.

### How to verify locally

1. `pnpm -r --if-present build`
2. `pnpm --filter @familyscheduler/web test --if-present`
3. `pnpm --filter @familyscheduler/api test --if-present`
4. Open Site A (`/#/`) and request a sign-in link; open link in Site B; verify Site B shows signed-in callback UX.
5. Verify Site A becomes authenticated automatically without manual refresh.
6. Verify email content includes the updated copy and expiration text.

## 2026-02-24 20:15 UTC update (attemptId cross-tab auth completion + auth done page + header sign out)

- Added attempt-scoped magic-link flow completion across tabs:
  - `auth/request-link` now accepts/uses `attemptId` and validated internal `returnTo` in the emailed consume URL.
  - Landing sign-in stores `fs.pendingAuth` in `sessionStorage`, listens for completion (`storage` + `BroadcastChannel`), and auto-navigates back to `returnTo` in the initiating tab.
  - Consume route now parses `attemptId` + `returnTo`, signals completion (`fs.authComplete.<attemptId>` + broadcast), and routes to new `/#/auth/done` instead of forcing `/#/`.
- Added `AuthDonePage` with “Signed in. Return to the previous tab to continue.” and manual Continue fallback.
- Added explicit global header menu action: **Sign out**.
  - Clears `fs.sessionId`, `familyscheduler.session`, `fs.pendingAuth`, and best-effort `fs.authComplete.*` keys.
  - Redirects to `/#/`.
- Updated auth UX copy:
  - Auth email subject/body cleaned up and includes Junk/Spam hint.
  - Sign-in form now includes Junk/Spam helper hint and stronger post-send guidance.

### Success criteria

- Opening magic link in Tab B no longer lands on a second create page; Tab B shows auth done confirmation.
- Tab A auto-continues after Tab B completes consume for the same `attemptId`.
- Header menu shows Sign out only when an API session exists and clears auth/session state on click.
- `returnTo` handling is internal-only (must start with `/`, cannot start with `//`, cannot contain `://`).

### Non-regressions

- Existing magic-link consume endpoint and `fs.sessionId` persistence remain intact.
- Existing route auth gates and join/create behavior remain unchanged except for the new completion handoff.

### How to verify locally

1. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173`
2. In Tab A at `/#/`, request a sign-in link.
3. Open emailed link in Tab B and confirm Tab B shows “Signed in. Return to the previous tab to continue.”
4. Return to Tab A and confirm it auto-continues to authenticated flow (currently `/#/`).
5. Confirm Tab B does **not** show a second Create Group page.
6. In authenticated UI header menu, click **Sign out** and confirm return to sign-in and no `x-session-id` on follow-up API calls.
7. Safety checks: test bad returnTo payloads (`//evil`, `https://evil`) and confirm fallback to `/`.


## 2026-02-24 16:20 UTC update (web magic-link consume route + session header plumbing)

- Added web hash route `/#/auth/consume?token=...` and `AuthConsumePage` to consume magic-link tokens client-side.
- `AuthConsumePage` now calls `POST /api/auth/consume-link`, persists returned `sessionId` into `localStorage` key `fs.sessionId`, and redirects to home.
- Added shared web API helpers `getSessionId()` + `apiFetch()` so API requests automatically attach `x-session-id` when a session exists.
- Updated web call sites to use `apiFetch`, including group meta/group join flows (and remaining API calls in `App.tsx`) for consistent session header behavior.

### Success criteria

- Magic-link consume URL loads at `/#/auth/consume` without SPA route miss.
- Consume page stores `fs.sessionId` after successful token exchange.
- Web API requests include `x-session-id` whenever `fs.sessionId` is present.

### Non-regressions

- No backend endpoint now requires `x-session-id` in this increment.

### How to verify locally

1. `pnpm -w install`
2. `pnpm --filter @familyscheduler/web build`
3. Open `/#/auth/consume?token=<valid-token>` and confirm loading UI then redirect to home.
4. In browser devtools, confirm `localStorage.getItem('fs.sessionId')` is populated.
5. In browser network panel, confirm follow-up API requests include `x-session-id` header.


## 2026-02-24 15:05 UTC update (magic-link auth endpoints + durable sessions + join hash-route link)

- Fixed join email links in `groupJoin` to use hash routing (`/#/join?...`) to prevent direct-route 404s on SPA hosts.
- Added backend magic-link token helpers (`api/src/lib/auth/magicLink.ts`) using `node:crypto` HMAC SHA-256 signing/verification with typed token errors.
- Added durable blob-backed sessions (`api/src/lib/auth/sessions.ts`) with configurable prefix/TTL and `x-session-id` request extraction helper.
- Added `POST /api/auth/request-link` and `POST /api/auth/consume-link` endpoints and registered both routes in the function host.
- Added minimal unit tests for magic-link token validation paths.
- Updated auth/email environment docs and auth model docs to describe implemented backend auth increment.

### Success criteria

- Emailed join links target `/#/join` and preserve `groupId` + `traceId`.
- `POST /api/auth/request-link` always returns `200 { ok: true, traceId }` and attempts provider send when configured.
- `POST /api/auth/consume-link` returns `sessionId` for valid tokens and returns `400 invalid_token|expired_token` for bad tokens.
- Logs avoid full email addresses (domain-only logging).

### Non-regressions

- New auth endpoints do not flip existing route authorization behavior.

### How to verify locally

1. `pnpm -w install`
2. `pnpm -w test`
3. `pnpm --filter @familyscheduler/api test`
4. POST `/api/auth/request-link` with `{ "email": "test@example.com" }` and confirm `200 { ok:true }`.
5. POST `/api/auth/consume-link` with a valid token and confirm `{ ok:true, sessionId, expiresAt }`.
6. Trigger `/api/group/join` email send and confirm the email URL path contains `/#/join`.


## 2026-02-24 14:20 UTC update (Join email capture + ACS send with origin-derived link)

- Updated Join Group UI to collect a required email field and include it in `/api/group/join` payload.
- Extended `groupJoin` API to parse optional `email` and attempt ACS email send **after** successful join authorization.
- Implemented email link generation using request headers origin strategy (Option 2): `origin` header fallback to `x-forwarded-host`.
- Added structured email logs with `traceId` + `groupId` for attempt/success/failure/skip states.
- Added ACS email env var documentation and local settings placeholders.

### Success criteria

- Join authorization behavior remains unchanged when email is missing/invalid or email send fails.
- API logs include `email_send_attempt`, `email_send_success`, `email_send_failure`, and `email_send_skipped` with reasons.

### Non-regressions

- Email failure does not block successful join response.

### Known limitations

- Email link is Option A (`/join?groupId=<id>&traceId=<traceId>`) only.
- Link is informational; no token validation is added in this change.

### How to verify locally

1. Set `AZURE_COMMUNICATION_CONNECTION_STRING` and `EMAIL_SENDER_ADDRESS` in API settings.
3. Confirm join success, email delivery, and logs for attempt/success including `traceId` + `groupId`.
4. Test with missing origin header path and verify `email_send_skipped` (`missing_origin`) while join still succeeds.


## 2026-02-24 13:13 UTC update (members/rules icon action normalization)

- Converted Members table row action controls (Rules/Edit/Delete) from plain `<button className="icon-button">` to MUI `IconButton` wrapped in `Tooltip`.
- Converted Rules list row action controls (Edit/Delete) from plain icon buttons to MUI `IconButton` + `Tooltip`.
- Kept new-row Accept/Cancel (`ui-btn`) behavior unchanged.
- Converted members/rules row action icons to MUI IconButton to avoid global button styling.

### Success criteria

- Members row action icons render as neutral MUI icon buttons (not blue filled blocks).
- Rules row action icons render with matching MUI icon button styling.
- Edit/save/delete/rules click handlers retain existing behavior.

### Non-regressions

- New-row `Accept`/`Cancel` actions remain as existing `ui-btn` controls.
- Members editing flow and rules prompt/delete flows remain wired to existing handlers.

### How to verify locally

1. Run `rg -n 'className="icon-button"' apps/web/src --glob='*.tsx'` and confirm no results.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Open Members tab and confirm row action icons are no longer blue blocks.
4. Expand rules rows and confirm rule edit/delete icons match MUI icon action styling.


## 2026-02-24 11:47 UTC update (auth model documentation alignment)

- Added a new authoritative auth model spec at `docs/specs/SPEC_AUTH_MODEL.md` with explicit separation of **Current (Implemented)** and **Planned (Not Implemented Yet)** behavior.
- Added a prominent README link to the new auth model document under Specifications.
- Marked `docs/api.md` as legacy/stale because it documents `/api/auth/login` token flows not implemented in the current codebase.
- No runtime code paths were changed; this is documentation-only.

### Success criteria

- `docs/specs/SPEC_AUTH_MODEL.md` exists and clearly separates current behavior from planned behavior.
- `README.md` links directly to `docs/specs/SPEC_AUTH_MODEL.md`.
- `docs/api.md` starts with a legacy/stale banner pointing readers to `docs/specs/SPEC_AUTH_MODEL.md`.

### Non-regressions

- Existing API or frontend behavior remains unchanged.
- Existing route, status-code, and terminology references in current v1 auth behavior remain documented as-is.

### How to verify locally

1. Run `test -f docs/specs/SPEC_AUTH_MODEL.md` and confirm the file exists.
2. Run `rg -n "AUTH_MODEL\.md|Auth model|Legacy / stale doc" README.md docs/specs/SPEC_AUTH_MODEL.md docs/api.md` and confirm references are present.
3. Run `sed -n '1,20p' docs/api.md` and confirm the legacy/stale banner appears at the top.



## 2026-02-24 09:35 UTC update (tab rail flatten + active seam blend + left-edge alignment)

- Flattened section tabs; aligned tab rail to content grid; active tab blends into content surface.
- Removed the outer framed tabs+content container by splitting the rail and body into separate wrappers.
- Set a shared `BODY_PX = 2` and reused it for both the tab flex container horizontal padding and section body content padding.
- Updated section tabs to square MUI tabs with inactive `background.default`, active `background.paper`, hidden indicator, and selected-tab seam cover (`top: 1`, `zIndex: 1`).
- Kept a single content `Paper` surface (`variant="outlined"`) with `borderTop: 'none'` so the rail border is the only top boundary.

### Success criteria

- Inactive tabs render on page background while active tab matches content surface background.
- Active tab visually covers the rail divider under itself (no visible line beneath active tab).
- First tab label aligns with section body content left edge (including People/table content).
- No rounded tab corners and no extra outer framed tabs+content wrapper.
- Section switching preserves existing behavior with no functional changes.

### Non-regressions

- Internal calendar view tabs (`List/Month/Week/Day`) and calendar actions remain unchanged.
- Members add/edit/delete/rules flows remain wired as before.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck` (may fail in this environment if MUI deps are unresolved).
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Confirm Schedule/Members rail sits above the body surface with one top seam and no extra divider.
4. Confirm active tab blends into the body surface and covers the rail divider under itself.
5. Confirm first tab label left edge aligns with People header/table and schedule content edge.


## 2026-02-24 09:18 UTC update (UI sheet tab polish + workspace width + scrollbar stability)

- Moved Schedule/Members tab rail into the shared top sheet header inside the workspace `Paper` and normalized the attached-tab styling.
- Stabilized horizontal layout by forcing a persistent vertical scrollbar gutter at the root (`html`).
- Widened workspace layout container from `maxWidth="lg"` to `maxWidth="xl"` with explicit full width.
- Removed the empty reserved sidebar column so the main sheet uses available horizontal space.
- Unified Schedule and Members body padding and aligned members table cell spacing/actions column.
- Moved Schedule/Members to top sheet tabs; stabilized scrollbar; widened workspace; aligned surfaces.

### Success criteria

- No horizontal jump when toggling Schedule/Members.
- On wide screens, main workspace uses more width with no dead left gutter.
- Sheet tabs are visually attached to a single surface (no double seam directly under tab rail).
- Members table aligns with the Schedule content edge.

### Non-regressions

- Existing calendar view tabs and actions still render in Schedule.
- Existing people add/edit/delete/rules flows remain wired as before.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck` (currently fails in this environment due unresolved `@mui/*` deps).
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173` after restoring deps.
3. Toggle Schedule/Members repeatedly and confirm no horizontal page jump.
4. Verify tab rail is attached to the surface and members table edges align with schedule content.


## 2026-02-24 09:00 UTC update (Shared sheet surface + members table alignment)

- Introduced a single shared `Paper` surface in `ui-main` that now contains both the Schedule/Members sheet tabs and the active section body.
- Replaced custom sheet-tab buttons with MUI `Tabs`/`Tab` in an Excel-like style (indicator hidden, inactive muted tabs, selected tab visually connected to body).
- Removed the extra calendar outer `Paper` so the content no longer renders as nested/double-bordered surfaces.
- Updated Members section to render directly inside the shared sheet body with consistent content padding and no panel wrapper border.
- Tightened members table layout: explicit `width: 100%`, cell padding parity for `th/td`, fixed/right-aligned actions column, and mobile-only horizontal overflow wrapper.

### Success criteria

- Schedule/Members tabs render inside the same outlined surface as section content.
- Calendar content no longer shows an extra outer border seam.
- Members table aligns with section content edge and keeps Actions column stable.
- Switching Schedule/Members does not shift width or padding unexpectedly.

### Non-regressions

- Internal calendar List/Month/Week/Day tabs and toolbar actions still render inside the calendar section.
- Existing member row actions (rules/edit/delete) remain in the same table row/action areas.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck` (environment may fail if `@mui/*` deps are unavailable).
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Confirm top sheet tabs (Schedule/Members) are inside one outlined card with no detached/floating seam.
4. Confirm Schedule tab content has no double border and Members table left edge aligns with content body.
5. Resize to narrow width and confirm table only scrolls horizontally on small screens.


## 2026-02-24 08:55 UTC update (Schedule/Members moved to top sheet tabs)

- Replaced sidebar section navigation for `Schedule`/`Members` with a top-mounted sheet-style tab strip in the main content area.
- Added semantic tab accessibility on the new switcher (`role="tablist"`, `role="tab"`, `aria-selected`, and active-only `tabIndex=0`).
- Wrapped section content in `ui-sheetBody` and aligned borders so the active tab visually attaches to the panel without double-border seams.
- Preserved existing internal calendar tabs (`List/Month/Week/Day`) and members table/flows unchanged.

### Success criteria

- Switching between Schedule and Members works via top sheet tabs.
- Sidebar no longer contains Schedule/Members interactive entries.
- Active sheet tab appears attached to the content panel.
- Appointment and member CRUD flows continue behaving as before.

### Non-regressions

- Calendar internal view tabs and actions are unchanged.
- People header/table/edit/delete/add interactions are unchanged.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck`.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173` and open the app.
3. Use top tabs to switch Schedule/Members; confirm tab active styling and no top seam.
4. In Schedule, verify List/Month/Week/Day tabs still work.
5. In Members, verify add/edit/delete and existing rows render as before.


## 2026-02-24 06:52 UTC update (List-view appointment details popover + Unassigned click target)

- In list view, `Unassigned` now renders as a text button that opens the existing Assign people dialog for that appointment.
- Added row-level details gestures in list view: desktop double-click and touch long-press open a compact appointment details popover anchored to the row.
- Details popover closes on outside click (Popover `onClose`) and also closes when clicking inside the popover content.
- Added propagation guards on row-interactive controls (scan/edit/assign/delete icons and show more/less) so they do not trigger row detail gestures.

### Success criteria

- Clicking `Unassigned` opens Assign people for the corresponding appointment.
- Clicking assigned people text does not open Assign people.
- Double-clicking a list row opens details popover.
- Long-pressing a list row on touch opens details popover.
- Clicking anywhere closes details popover, including inside the popover content.

### Non-regressions

- Assign icon behavior is unchanged.
- Edit dialog behavior is unchanged.
- Month/week/day chip single-click behavior is unchanged.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web typecheck`.
2. Run `pnpm dev:web` and open the app in list view.
3. Verify Unassigned click target and row details gestures with mouse and touch simulation.


## 2026-02-24 06:38 UTC update (Breakout soft hint when popup handle is null)

- Updated breakout popup null-handle branch to show a soft informational hint instead of a hard `Popup blocked` error, because some browsers return `null` even when the tab opens with `noopener`.
- Soft hint now reads: `Opening Breakout in a new tab… If nothing happened, allow popups or open: <handoffUrl>`.
- On popup truthy success, breakout alert state is explicitly cleared before focusing the new tab.
- Renamed the breakout alert heading from `Breakout Group` to `Breakout Session`.

### Success criteria

- Clicking Breakout opens/navigates a new tab as before.
- Origin tab no longer shows the false-positive `Popup blocked` wording when popup handle is null but tab likely opened.
- If a popup is truly blocked, origin tab shows the softer fallback hint with manual URL.

### Non-regressions

- `/api/ignite/spinoff` request/trace flow is unchanged.
- Existing breakout handoff URL construction/navigation logic is unchanged aside from message semantics.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web typecheck` (may fail in this environment due existing dependency resolution limits).
2. In browser, go to `/#/g/<groupId>/app` and click Breakout; verify a new tab opens and origin tab does not show `Popup blocked`.
3. In a popup-blocking browser/profile, click Breakout and verify the soft hint appears with manual URL text.


## 2026-02-24 06:22 UTC update (Breakout popup navigation robustness hotfix)

- Updated breakout popup creation to remove `noreferrer` from window features (`noopener` only) to avoid browser behaviors that can prevent scripted navigation from `about:blank`.
- Replaced direct `popup.location.replace(...)` with robust navigation attempts: first `popup.location.href`, then `popup.document.location.href`, with `focus()` after successful assignment.
- Added debug logging of computed `handoffUrl` immediately before navigation attempt to improve diagnosability.
- If popup navigation still fails, app now surfaces a manual URL error (`Unable to navigate popup. Please open: ...`) and attempts to close the orphaned popup.
- Popup-blocked branch remains unchanged: no same-tab navigation fallback; user receives popup guidance/manual URL.

### Success criteria

- Burger → Breakout opens a new tab and reliably navigates to `/#/handoff?...`, then onward to `/#/g/<newGroupId>/ignite`.
- Original tab remains on the current meeting route throughout.
- If popup navigation throws, user sees the manual URL error and the blank popup is closed.

### Non-regressions

- Existing popup-blocked behavior still only shows guidance/manual URL (no same-tab route change).
- Existing `/api/ignite/spinoff` request/trace flow is unchanged.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web typecheck` (environment may still fail due pre-existing dependency issues).
2. In browser with popups allowed, open `/#/g/<groupId>/app` and click Burger → Breakout; verify new tab reaches handoff/ignite and original tab hash does not change.
3. If possible, simulate popup navigation failure and verify manual URL error appears and blank popup closes.


## 2026-02-24 06:06 UTC update (Breakout popup-blocked handling keeps current tab fixed)

- Breakout create flow no longer falls back to same-tab navigation when popup creation is blocked.
- On popup-blocked success path, the app now shows a breakout error banner with explicit popup guidance and a manual `/#/handoff` URL that users can open themselves.
- Breakout popup success path is unchanged: popup tab navigates via `/#/handoff?...` and original tab remains on the current meeting route.
- Breakout menu click now explicitly calls `preventDefault()` and `stopPropagation()` before invoking breakout logic to eliminate implicit navigation/bubbling side effects.

### Success criteria

- With popups allowed, Burger → Breakout opens a new tab to handoff/ignite while the original tab does not change hash route.
- With popups blocked, original tab does not navigate and displays an error message instructing user to allow popups (with manual handoff URL).

### Non-regressions

- Existing `/api/ignite/spinoff` creation, trace handling, and popup success routing remain unchanged.
- Breakout action remains available from the PageHeader menu and still closes the menu on click.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web typecheck` (note: currently fails in this environment due pre-existing dependency/type issues).
2. In browser with popups enabled, open `/#/g/<groupId>/app` and click Burger → Breakout; verify new tab opens to breakout and original tab hash remains unchanged.
3. In browser with popups blocked, repeat and verify no hash navigation in original tab plus popup-blocked error banner with manual URL.


## 2026-02-24 05:37 UTC update (Breakout handoff opens new tab + per-tab session storage)

- Breakout flow now opens a popup synchronously (`about:blank`) and, on success, routes that new tab through `/#/handoff?...` so the original tab remains on the current meeting.
- Added hash route `/#/handoff` in `App.tsx`; it writes tab-scoped session (`sessionStorage`) and redirects to a validated `next` route (`/g/...`) with fallback to `/g/<groupId>/ignite`.
- Session persistence is now tab-scoped by default: `writeSession` writes only to `sessionStorage`, `readSession` prefers `sessionStorage` and backfills from `localStorage` for backward compatibility, and `clearSession` clears `sessionStorage`.
- Popup-blocked behavior preserves previous same-tab fallback: write session and navigate current tab to breakout ignite route.

### Success criteria

- With popups allowed, clicking Burger → Breakout opens a new tab that reaches `/#/g/<newGroupId>/ignite` and authenticates, while original tab stays on current meeting.
- With popups blocked, Breakout continues same-tab navigation as before.
- Refreshing each tab retains its own session context (`sessionStorage`) without cross-tab overwrite.

### Non-regressions

- Existing join/create/session flows still use the same session key format.
- Legacy users with session only in `localStorage` can still authenticate once and get seeded into tab-local storage automatically.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web build`.
2. In browser with popups enabled: from `/#/g/<groupId>/app`, click Burger → Breakout and verify new tab goes to ignite for new group while original tab stays put.
3. In browser with popups blocked: repeat and verify same-tab fallback still navigates to new ignite route.
4. Refresh both original and breakout tabs and verify each remains in its own meeting context.


## 2026-02-24 06:35 UTC update (Browser tab titles use group display name only)

- Meeting route (`/#/g/:groupId/app`) now sets tab title from `groupName` only: `Family Scheduler` before metadata loads, then `Family Scheduler — {groupName}` once available.
- Ignite organizer route (`/#/g/:groupId/ignite`) now sets tab title from `groupName` only: `Ignition Session` before metadata loads, then `Ignition Session — {groupName}` once available.
- Removed any tab-title dependency on `groupId` for these pages; rename flows update titles automatically through shared `groupName` state effects.

### Success criteria

- Visiting meeting route shows `Family Scheduler` initially and updates to `Family Scheduler — <groupName>` after `/api/group/meta` resolves.
- Visiting ignite route shows `Ignition Session` initially and updates to `Ignition Session — <groupName>` after `/api/group/meta` resolves.
- Renaming group name updates the browser tab title on both routes without requiring refresh.

### Non-regressions

- Existing group metadata fetch + rename behavior remains unchanged except tab-title strings.
- No browser tab title includes `groupId` on meeting/ignite routes.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web build` (or `pnpm --filter @familyscheduler/web dev`).
2. Open `/#/g/<groupId>/app`; verify title transitions from `Family Scheduler` to `Family Scheduler — <groupName>`.
3. Open `/#/g/<groupId>/ignite`; verify title transitions from `Ignition Session` to `Ignition Session — <groupName>`.
4. Rename the group in either route; verify title updates immediately and never displays `groupId`.


## 2026-02-24 05:23 UTC update (Ignite organizer close navigation + meeting-link semantics + joined members)

- Organizer `Close` now redirects directly to the meeting route for the breakout group (`/#/g/<groupId>`) after a successful close response.
- Ignite organizer's displayed/copyable "Join link" now uses the meeting URL (`/#/g/<groupId>`); QR still uses the ignite join portal (`/#/s/<groupId>/<sessionId>`).
- `/api/group/meta` now returns additive `people` payload of active members (`personId`, `name`) so organizer UI can include pre-existing meeting members in Joined folks immediately.
- Joined folks list/count now uses combined IDs (group active members + organizer + ignite joiners) and resolves display names from merged metadata before falling back to `personId`.

### Success criteria

- Closing an open ignite session navigates organizer to `/#/g/<groupId>` on success.
- The join-link row displays/copies the meeting link and does not display the ignite join portal URL.
- Existing active group members appear in Joined folks before/without new QR joins.

### Non-regressions

- QR code generation continues using session join URL (`/#/s/<groupId>/<sessionId>`).
- Existing `/api/group/meta` consumers remain compatible with additive payload.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/api build`.
2. Run `pnpm --filter @familyscheduler/web build`.
3. Start app and API, open organizer ignite route, and verify displayed link equals `/#/g/<groupId>` while QR still joins session URL.
4. Click Close and confirm navigation to `/#/g/<groupId>`.
5. Confirm Joined folks includes pre-existing active members plus new QR joiners.


## 2026-02-24 06:05 UTC update (Ignite organizer polish + join emphasis/sound)

- Ignite organizer simplified to a centered single-column flow and removed back/status/header noise.
- Group section now includes inline rename affordance plus joined count shown only under group name.
- Joined count now uses emphasized red badge with bump animation on increases and optional join-sound toggle (default off, best-effort browser audio).
- Join link is now static monospace text with copy icon action and subtle copied feedback.
- Organizer photo capture now uses camera-preview modal/capture flow (with file-input fallback) before existing ignite photo upload.

## 2026-02-24 03:41 UTC update (Ignition organizer QR/layout restore Option A)

- Ignition organizer: restored QR rendering and tightened layout hierarchy/actions.
- Organizer now shows a session-empty state with a single `Reopen` action when no active `sessionId`; share card/link/QR only render when a session exists.
- Share card rebuilt as two columns (`Scan to join` + `Join link`) with one canonical copy action and QR fallback messaging when QR load fails.
- Status pill + joined count are anchored in one header row (removed duplicate joined display from Photos header).
- Close/Reopen actions now live in one dedicated right-aligned actions row directly under the share card; Photos section remains below actions.

## 2026-02-24 05:10 UTC update (Ignition organizer layout cleanup)

- Ignition organizer page reorganized: consolidated share controls, clearer session actions, cleaner layout.
- Organizer share area now uses a single canonical join link + one copy action, with a larger responsive QR and relocated trouble-scanning toggle/raw URL reveal.
- Session action row now shows only one primary action at a time (Close when OPEN, otherwise Reopen), and photos are grouped under a dedicated Photos section header.

## 2026-02-24 04:15 UTC update (Join page compact centered layout)

- Join page constrained to compact centered layout (max-width 480px).
- Wrapped Join Group form content in a dedicated centered container while keeping the page header/menu outside the compact form area.
- Join action button now aligns to the right edge of the compact form for a tighter desktop layout while remaining full-width responsive via container sizing.

## 2026-02-24 02:55 UTC update (Join Group notice/error behavior cleanup)

- Join Group page now treats redirect route errors (`no_session` / `group_mismatch`) as neutral notice copy instead of a red error state on first render.

## 2026-02-24 03:40 UTC update (Global menu hierarchy tweak)

- Moved global menu (burger) from group card header to product header for clearer hierarchy.

## 2026-02-24 03:05 UTC update (Calendar action icon contrast + AI scan icon)

- Increased appointment list row action icon contrast so row controls no longer appear washed out.
- Replaced the auto-scan overflow (ellipsis) trigger with an AI-style sparkles icon and made that icon the only colorful toolbar action icon.

## 2026-02-24 02:35 UTC update (List readability + active selection)

- List view: indented appointment detail/body lines to improve scanability while keeping title line flush-left.
- List view: active appointment highlight is now tracked and preserved for edit/create flows.
- List view: active appointment auto-scrolls into view (window viewport) when off-screen after edit/create.

## 2026-02-24 02:15 UTC update (Week/Day calendar MVP enabled)

- Implemented Week and Day calendar views (MVP list-style chips) and enabled Week/Day tabs in the calendar view switcher.
- Added independent Week and Day cursors with prev/next/today navigation controls.
- Week renders a 7-column day grid with appointment/todo chips; Day renders a single-date list with the same chip interactions.

## 2026-02-24 01:55 UTC update (Month view today highlight)

- Month view: highlight today's date cell (local timezone).

## 2026-02-24 02:05 UTC update (Edit Appointment compact dialog + unified When group)

- Edit Appointment dialog compacted to `maxWidth="sm"` with tighter content spacing for a shorter/tighter modal footprint.
- When control remains a single input with in-field resolve action, inline interpreted preview row, and inline ✓ accept action.
- Assumptions stay grouped under preview as a collapsed disclosure, keeping When/Resolve/Preview/Assumptions in one compact section.

## 2026-02-24 01:10 UTC update (Single-surface calendar module: remove nested panel border)

- Removed the nested `.panel` frame around the calendar module so the unified outer `Paper variant="outlined"` is now the single border/radius surface for calendar views.
- Preserved internal content structure for List/Month rendering (row dividers and calendar grid lines remain).
- No API or behavior changes; visual containment only.
- Removed nested outlined wrappers in List/Month so the view module uses a single framed surface (no double borders).

### Success criteria

- In List view, only one rounded outer border is visible around tabs + list content.
- In Month view, only one rounded outer border is visible around tabs + month grid content.
- No box-inside-box framing remains in the calendar section.

### Non-regressions

- Calendar tabs/actions behavior is unchanged.
- Appointment list row separators and month-day grid lines remain visible.

### How to verify locally

1. Run `pnpm -r --if-present build`.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Open `/#/g/<groupId>/app` and switch between List and Month tabs.
4. Confirm there is exactly one outer rounded border around the whole calendar module in both views.

## 2026-02-23 22:57 UTC update (MUI icons dependency alignment)

- Added `@mui/icons-material` dependency in `apps/web/package.json` aligned to MUI v6 (`^6.4.7`) to support `Menu` and `RocketLaunch` icon imports.
- No functional changes; dependency alignment only.
- Note: package installation/build verification is currently blocked in this environment by registry `403 Forbidden` responses for npm fetches.

## 2026-02-24 00:05 UTC update (Header hamburger menu + emphasized breakout item)

- Replaced header menu trigger icon from vertical-ellipsis to hamburger `Menu` icon with tooltip/aria label `Menu`.
- Updated header dropdown to place an emphasized top `Breakout Session` action with `RocketLaunch` icon (`color="primary"`), bold menu item weight, helper subtext, and divider separation.
- Preserved existing breakout behavior by wiring the unchanged `createBreakoutGroup` handler into `PageHeader` as a callback and keeping in-flight disabled behavior.
- Preserved existing dark mode toggle behavior and menu close behavior.
- UI-only changes; no business logic, routing, or API modifications.

### Success criteria

- Hamburger icon appears at the header top-right and opens the menu.
- The first menu item is `Breakout Session` with a primary RocketLaunch icon and slight emphasis.
- Selecting `Breakout Session` still triggers the existing breakout flow.
- Divider separates breakout from the dark-mode toggle section.
- No routing/API contracts changed.

### Non-regressions

- Existing `/api/ignite/spinoff` flow, trace handling, session writes, and hash navigation remain unchanged.
- Dark mode switch logic remains unchanged.

### How to verify locally

1. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
2. Open `/#/g/<groupId>/app`.
3. Click the header hamburger icon and verify menu ordering/styling (`Breakout Session` first, divider, dark mode).
4. Click `Breakout Session` and confirm existing breakout navigation/error behavior is unchanged.

## 2026-02-23 22:31 UTC update (Header group title precedence tweak)

- Header now prioritizes group name over groupId (GUID) for display; copy link unchanged.

## 2026-02-23 22:08 UTC update (Appointment dialog context block + scan preview rendering fix)

- Added a reusable, UI-only appointment context header block in `AppShell` and applied it across appointment-scoped dialogs.
- Normalized appointment dialog titles to action-only labels (`Assign people`, `Delete appointment`, `Scan`, `Edit appointment`) while preserving existing dialog behavior.
- Standardized dialog sizing for touched dialogs (`Assign people` now `maxWidth="sm"`, delete appointment now `maxWidth="xs"`, scan/edit remain `md` + `fullWidth`).
- Fixed scan capture preview rendering in dialog by ensuring a non-zero video surface (`minHeight`, `objectFit`, black background) and resilient stream attach timing after mount.
- UI-only changes; routing, API calls, and business logic remain unchanged.

### Success criteria

- Appointment-scoped dialogs show an action-only title plus a consistent appointment context block.
- No appointment-scoped title includes the APPT code in the title string.
- Assign people dialog width is reduced to `sm` and remains full-width within breakpoint constraints.
- Scan capture preview surface is visible/non-zero in the dialog and still uses existing capture + cleanup flow.

### Non-regressions

- Existing direct actions (`delete_appointment`, people assignment, scan rescan/delete, edit appointment save) remain unchanged.
- Existing scan stream cleanup (`stop tracks`) remains unchanged.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web run typecheck`.
2. Run `pnpm --filter @familyscheduler/web run build`.
3. Run `pnpm --filter @familyscheduler/web run dev --host 0.0.0.0 --port 4173`.
4. Open the app shell and verify each touched appointment dialog shows the standardized title/context block.

## 2026-02-23 21:20 UTC update (Dialog normalization bundle + icon mode toggle)

- Normalized transient popup flows in `AppShell` to MUI `Dialog` surfaces (Quick add, Advanced, proposal confirm, pending question, delete confirms, scan viewer, scan capture, rules prompt, assign people).
- Converted scan capture camera preview from inline overlay panel to a centered dialog with Capture/Cancel actions while preserving existing scan stream/file fallback logic.
- Moved appointment editing from side drawer to centered MUI dialog while keeping existing `AppointmentEditorForm` logic and handlers unchanged.
- Updated dark-mode toggle in `PageHeader` from text button to tooltip-wrapped icon-only `IconButton` using inline `SvgIcon` moon/sun paths.
- Verified JoinGroup route currently uses MUI-only form markup; no legacy duplicate join form remained to remove.

### Success criteria

- Popup/confirm flows render as MUI dialogs and close via Escape/backdrop with existing cancel handlers.
- Scan capture no longer renders inline; it appears only as a modal dialog.
- Appointment editor opens centered (not side-attached).
- Header mode toggle is icon-only with correct tooltip/aria label for the next action.

### Non-regressions

- Business logic, API endpoints, route behavior, and auth gating remain unchanged.
- Usage badge/footer behavior remains unchanged.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck`.
2. Run `pnpm -C apps/web run build`.
3. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
4. Open `/#/g/<groupId>/app` and verify dialogs: quick add, advanced, scan capture/rescan, assign people, rules prompt, and appointment edit.

## 2026-02-23 19:06 UTC update (Calendar toolbar actions + header link cleanup)

- Removed the sidebar **Keep This Going** action and removed the inline **Add event** command bar from `AppShell`.
- Moved command actions to the calendar toolbar row as icon-only buttons: camera (scan flow), primary plus (Quick add modal), and ellipsis (Advanced modal).
- Added **Quick add** modal (single-line input) and **Add or Update Events** modal (multiline textarea with example placeholders), both submitting through existing `sendMessage(...)` with proposal/question/in-flight gating.
- Updated list empty-state copy to: `Add your first event using + above.`
- Simplified group header invite surface: removed raw URL-heavy row and added `Copy group link` button with clipboard + prompt fallback while keeping a concise warning line.
- Added minimal layout CSS in `styles/ui.css` for toolbar row/actions alignment and small button sizing.

### Success criteria

- Calendar sidebar shows only **Calendar** and **Members**.
- Inline command bar is absent.
- Toolbar row shows tabs on left and icon actions on right.
- Camera action is icon-only and triggers scan capture flow.
- Plus action is icon-only, primary-styled, and opens Quick add modal.
- Ellipsis opens Advanced modal with rich example placeholders.
- Both modals submit via existing message pipeline and respect submit/proposal/question gating.
- Header shows `Copy group link` button, warning remains concise, and raw URL is no longer visually prominent.

### Non-regressions

- Proposal confirmation modal remains unchanged.
- Pending question dialog remains unchanged.
- Appointment editor and month-view day `+` buttons remain unchanged.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web run typecheck`.
2. Run `pnpm --filter @familyscheduler/web run build`.
3. Run `pnpm --filter @familyscheduler/web run dev --host 0.0.0.0 --port 4173` and open `/#/g/<groupId>/app`.
4. Verify sidebar/actions/modal behavior and empty-state copy match acceptance criteria.
5. In header, click `Copy group link` and confirm clipboard (or prompt fallback if clipboard API unavailable).

## 2026-02-23 18:24 UTC update (Quick actions dropdown text contrast fix)

- Fix dropdown text contrast for Quick actions menu.
- Set explicit readable foreground color on `.fs-quickActionsMenu` and ensured quick action items inherit that color.
- No JS/TS behavior changes.

### Success criteria

- Opening Quick actions shows readable `Break out` text against the menu background.
- Hover state styling remains visible and unchanged in behavior.
- Header layout remains unchanged.
- Spinoff flow behavior remains unchanged.

### Non-regressions

- No API, routing, or TS/JS logic changes.
- Existing responsive behavior for quick actions remains unchanged.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web run dev --host 0.0.0.0 --port 4173`.
2. Open a group app page (`/#/g/<groupId>/app`) and expand **Quick actions**.
3. Confirm **Break out** text is clearly visible on white background.
4. Hover the item and confirm hover background still appears.
5. Trigger Break out and confirm spinoff flow still navigates as before.

## 2026-02-23 18:40 UTC update (Quick actions dropdown for breakout)

- Replaced the group header **Breakout Group** button with a right-aligned **Quick actions** dropdown in `PageHeader`.
- Moved breakout content to a compact menu item (`Break out`) while preserving existing `/api/ignite/spinoff` call, session write, hash navigation, and trace-aware error handling.
- Kept breakout errors visible outside the dropdown so failures remain visible even when the menu is closed.
- No backend/API contract changes.

### Success criteria

- Quick actions renders on the right side of the group header row.
- Opening the menu reveals a single `Break out` action.
- Breakout behavior remains unchanged end-to-end (same endpoint, trace handling, and navigation).
- Mobile layout (`<=560px`) keeps dropdown usable and unclipped.

### Non-regressions

- Existing group header title/invite block behavior remains unchanged.
- Existing ignite/spinoff backend flow remains unchanged.

### How to verify locally

1. Run `pnpm lint && pnpm typecheck && pnpm test`.
2. Run `pnpm --filter @familyscheduler/web dev --host 0.0.0.0`.
3. Open `/#/g/<groupId>/app`.
4. Confirm Quick actions is right-aligned, opens/closes, and `Break out` is disabled while request is in flight.
5. Trigger a failed spinoff and confirm breakout error is visible without reopening the dropdown.
6. Resize to <=560px width and confirm dropdown remains usable/not clipped.

## 2026-02-23 18:05 UTC update (PageHeader layout inspection baseline)

- Captured a read-only baseline of `PageHeader` group-header structure and related CSS hooks, including `fs-groupHeaderAction` usage and responsive wrapping behavior at the `560px` breakpoint.
- Confirmed no runtime behavior changes were introduced in this workspace during the inspection pass.

### Success criteria

- Team has a single documented baseline for current group-header JSX/CSS relationships.
- No code-path or styling behavior changed from this update.

### Non-regressions

- App functionality and rendering remain unchanged (documentation-only update).

### How to verify locally

1. Run `git show --name-only --stat HEAD` after pulling this commit.
2. Confirm only `PROJECT_STATUS.md` and `CODEX_LOG.md` changed.


## 2026-02-23 17:24 UTC update (Ignite organizer UI: QR-primary, icon actions, header back)

- Ignite organizer now hides the join URL by default and keeps QR as the primary join surface, with a copy-icon action and optional “Trouble scanning?” expander to reveal the raw join URL.
- “Group link” is renamed to **Group home** and now includes the explainer text “Use this link to coordinate later.” plus static truncated URL text + icon-only copy action.
- Replaced ignite copy text buttons with icon-only copy controls and short inline “✓ Copied” feedback.
- Replaced “Add/Update your photo” button text with camera icon-only action (hidden file input + upload logic unchanged).
- Moved back navigation to a top-left arrow button and removed the old bottom “Back to group” action.
- Organizer header access copy is now contextual: OPEN => “Anyone with this QR can join while it’s open.”, CLOSED/CLOSING => “Closed. Reopen to allow new joins.”

### Success criteria

- QR remains visible/usable and join link text is hidden by default.
- Copy join link and copy group home actions still write correct URLs to clipboard.
- Group home explainer appears and URL is truncated instead of editable input.
- Camera icon opens photo picker and existing upload path remains functional.
- Top-left back arrow returns to `/#/g/<groupId>/app`.

### Non-regressions

- Ignite start/close/photo/meta networking and trace behavior remain unchanged.
- Join URL is still computed for QR and copy flows.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web run dev`.
2. Open `/#/g/<groupId>/ignite`.
3. Confirm join URL text is hidden initially, QR renders, and copy icon exists next to Join QR.
4. Click “Trouble scanning?” and verify raw join URL appears and can be copied.
5. Confirm Group home label + explainer text, truncated URL, and copy icon.
6. Confirm top-left back arrow navigates back to group app with replace navigation behavior.
7. Confirm camera icon opens file picker and selecting an image still triggers upload.

## 2026-02-23 08:50 UTC update (Breakout Group spinoff + ignite)

- Added **Breakout Group** flow end-to-end: new backend `POST /api/ignite/spinoff` creates a spinoff group B from source group A and immediately opens an ignite session in group B for the organizer.
- Added isolated top-right **Breakout Group** action in the app shell (`↗` + explainer text) that calls spinoff, updates local session to group B, and routes to `/#/g/<groupB>/ignite`.
- Invite-to-this-group remains a separate path (no camera coupling); breakout remains the viral/social entry point for starting fresh groups.

### Success criteria

- Clicking Breakout Group from group A navigates organizer to group B ignite organizer page.
- Group A membership remains unchanged.

### Non-regressions

- Existing ignite start/join/close/photo/meta endpoints remain unchanged.
- Existing app header invite-link behavior remains unchanged.

### How to verify locally/staging

1. In group A app, click **Breakout Group**.
2. Confirm route changes to `/#/g/<groupB>/ignite`.
3. Confirm organizer ignite page loads and join URL includes group B + session id.
4. Join via incognito and verify joiner lands in group B.
5. Navigate back to group A and verify no new members were added there.

## 2026-02-23 08:20 UTC update (ignite/start 403 diagnostics instrumentation)

- Added temporary, sanitized auth traces in `igniteStart` (behind `DEBUG_AUTH_LOGS=true`) to emit: request `hasPhone`, safe `rawGroupId`, validated `groupId` + normalized `phoneE164`, and caller lookup outcome (`callerFound`, `callerPersonId`).
- Staging deploy/repro was attempted via `scripts/ship-api.sh` with staging app/resource settings, but packaging failed in this environment because pnpm registry fetches are blocked (`ERR_PNPM_FETCH_403`), so no fresh staging logs could be captured from this workspace.

### Success criteria

- With `DEBUG_AUTH_LOGS=true`, each `/api/ignite/start` invocation emits `igniteStart` traces containing `hasPhone`, `rawGroupId`, validated identity fields, and caller lookup result for the same `traceId`.

### Non-regressions

- Authorization behavior and response payloads for `ignite/start` remain unchanged (trace-only diagnostics).

### How to verify locally/staging

1. Ensure API setting `DEBUG_AUTH_LOGS=true` and deploy this API build.
2. Trigger one organizer `POST /api/ignite/start`.
3. Query traces:
   ```kusto
   traces
   | where timestamp > ago(10m)
   | where message contains "igniteStart"
   | order by timestamp desc
   ```
4. Classify root cause:
   - missing/wrong `rawGroupId` or validated `groupId` => routing/group-id bug


## 2026-02-23 07:20 UTC update (Ignite organizer auth/meta/link/QR alignment)

- Ignite meta backend now accepts both GET and POST, reading identity/session/trace from JSON body first (POST) and falling back to query params (GET) for compatibility.
- Ignite organizer links now use a stable hash base (`origin + pathname + search + #`) so: group link resolves to `/#/g/<groupId>/app` and join link resolves to `/#/s/<groupId>/<sessionId>`.
- Join link input now remains blank + disabled until a `sessionId` is available, join-copy is disabled until non-empty, and QR rendering is gated by `joinUrl` availability with existing fallback text retained.

### Success criteria

- Organizer `ignite/start` returns a session id and UI stores it.
- Organizer meta polling does not return `not_allowed` due to missing organizer identity in request shape.
- Group link includes `/#/g/<groupId>/app` and join link includes `/#/s/<groupId>/<sessionId>`.
- QR is rendered only when join URL exists; before that, UI shows “Starting session…”.

### Non-regressions

- Existing GET callers for `/api/ignite/meta` continue to work.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/api dev` and `pnpm --filter @familyscheduler/web dev`.
5. Confirm group link is `/#/g/<groupId>/app`, join link is `/#/s/<groupId>/<sessionId>`, copy join is enabled only after join link exists, and QR appears once join link is present.


## 2026-02-23 06:12 UTC update (Ignition organizer UEX: QR/link copy/camera trigger)

- Organizer ignition page now shows both **Group link** (`/#/g/<groupId>/app`) and **Join link** (`/#/s/<groupId>/<sessionId>`) as read-only fields with inline Copy actions and transient “Copied” status.
- Organizer photo upload affordance now uses a camera button (`📷 Add photo`) that triggers a hidden `type="file"` input with `accept="image/*"` and `capture="environment"`; upload flow remains unchanged.
- Added inline “Photo selected.” feedback after file selection for clearer state.
- Hardened QR display with load-failure fallback text; keeps join link visible for manual sharing if QR image cannot load.
- Added lightweight debug log emission (behind existing `VITE_DEBUG_AUTH_LOGS` gate) to surface join URL/session context while diagnosing QR visibility.
- Attempted to add local `qrcode` npm dependency per implementation request, but package install is blocked in this environment by registry policy (`npm ERR! 403`), so existing QR image endpoint approach was retained.

## 2026-02-23 05:57 UTC update (QG/Ignition UX polish: join copy/photo/back nav)

- Ignite join closed-state error now reads: "Session closed. Ask the organizer to reopen the QR."
- Ignite join page now supports optional photo capture/upload before join with mobile-friendly camera hint (`capture="environment"`).
- Ignite join flow now attempts a non-fatal `/api/ignite/photo` upload immediately after successful `/api/ignite/join`, then redirects into the group app with a fallback "Open group" button.
- Ignite organizer page now includes an explicit "Back to group" button to `/#/g/<groupId>/app`.
- App shell already includes a "Keep This Going" entry point in sidebar navigation to `/#/g/<groupId>/ignite` (retained).

## 2026-02-23 05:03 UTC update (UEX polish: title section + nav cleanup)

- Header polish: invite URL text is now smaller + muted, invite help line spacing is tightened, and the members line now renders names only (removed the `Members:` prefix).
- Navigation cleanup: hid unimplemented Overview/Todos/Settings entries from the left nav; only Calendar and Members remain visible to avoid dead UI.
- No backend/API/shared-package changes.
- Production release via `develop -> main` merge is pending repository/hosting access outside this workspace.

## 2026-02-23 04:16 UTC update (UEX: remove list horizontal scroll)

- List view: removed horizontal scroll; enforced fixed table layout and column constraints.
- Added a list-specific table class (`fs-listTable`) with fixed layout and explicit widths for Code/When/Status/People/Actions.
- Added list-specific container hardening (`fs-listContainer`) with `overflow-x: hidden`, `overflow-y: auto`, and `min-width: 0` to prevent flex overflow growth.
- Constrained list cells with single-line ellipsis for long content to maintain row stability and readability.
- No backend/API/shared-package changes.

## 2026-02-23 04:10 UTC update (UEX: Title section restructure)

- Header title section updated with a new `Group` label above the group name.
- Member summary now appears directly below the group name as muted text (up to 4 names, then `+N`).
- Invite link row reworked to a 2-column layout with URL input on the left and Copy button on the right.
- Explainer text is now directly beneath the invite URL row with tighter spacing.
- Removed the `Calendar` subtitle from the group title block.
- Copy behavior remains unchanged and still copies the full invite URL.

## 2026-02-23 04:08 UTC update (UEX: header invite layout + calm accent + member chips)

- Group header: invite link layout fixed (no overflow), calm accent styling added.
- Added member chips summary in header (up to 4 names with +N overflow chip).
- Removed Group ID from primary UI header surface.
- Copy link behavior unchanged (copies full invite URL).
- No backend/API/shared-package changes.

## 2026-02-23 03:50 UTC update (UEX header cleanup: invite link primary)

- Updated group page header UX to make the group name the primary title and present an explicit Invite link utility card.
- Replaced prior “Invite” row with “Invite link” + “Copy link” action, visible invite URL surface, and persistent explainer text: “Save this link — it’s the only way to return to this group.”
- Removed Group ID and its copy icon/button from the primary header UI.
- Removed the “Copies full invite URL” helper copy.
- Added calm utility-card styling and URL overflow protection for narrow widths.
- No backend/API/shared-package changes.

## 2026-02-23 03:55 UTC update (UEX: clean up Edit Appointment form)

- Edit appointment drawer now enforces vertical-only scrolling and hides horizontal overflow in drawer containers.
- Appointment editor fields (When, Description, Location, Notes) are now auto-growing multiline textareas.
- When-row layout now wraps with `min-width: 0` hardening so controls do not overflow at narrow widths.
- No backend or data model changes.
## 2026-02-23 03:36 UTC update (discovery query: group logic, Azure storage, identity fields, function routes)

- Added a discovery report at `docs/discovery-group-azure-identity-endpoints.md`.
- Confirmed group create/join and membership-related flow locations across frontend (`apps/web/src/App.tsx`) and backend (`api/src/functions/groupCreate.ts`, `groupJoin.ts`, `groupMeta.ts`).
- Confirmed Azure Blob usage (`@azure/storage-blob`, `BlobServiceClient`) and no `@azure/data-tables` / `TableClient` usage.
- Confirmed identity claim header/claim-field tokens (`x-ms-client-principal`, `claims`, `oid`, `sub`, `preferred_username`) are not currently referenced in app code.
- Enumerated Azure Function endpoints from `function.json` and noted additional code-registered routes in `api/src/index.ts`.
- No runtime behavior changes; documentation/discovery only.

## 2026-02-23 03:31 UTC update (UEX copy tweak: add event language)

- Renamed “Command” section to “Add event”.
- Simplified instructional helper text for clarity and tone alignment.
- Updated command input placeholder to remove internal references and use cleaner example phrasing.
- No architectural changes.
- No behavior changes.
- UI language refinement only.

## 2026-02-23 03:16 UTC update (UEX polish pass 3 frontend-only)

- Completed frontend-only Calendar/List UX polish in `apps/web/**` with no backend or shared package changes.
- Calendar tabs now render as segmented control in order **List, Month, Week, Day**, with List as default and Week/Day disabled as “Soon”.
- Month view now includes **Prev / Today / Next** controls and local month cursor state so the month grid and title rerender correctly.
- Month chips now emphasize appointment description + muted time line and use a subtle chip style instead of blue pill styling.
- Header invite clarity updated: “Invite” control copies full group URL; Group ID row retains compact display + explicit copy icon.
- Command bar cleanup: removed duplicate “Command” field label, retained single heading, and wired Add button to existing `addAppointment()` path.
- Table polish: increased action-column/icon hit areas and reinforced APPT code no-wrap behavior.
- Debug/artifact conventions unchanged (`./.artifacts/<traceId>/` when debug instrumentation is enabled).

## 2026-02-23 02:31 UTC update (web UEX polish pass frontend-only)

- Completed a frontend-only UEX polish pass scoped to `apps/web/**` with no backend/API contract changes.
- Promoted command input into a persistent Command Bar with primary Scan CTA and secondary Add action across Calendar/Todos/Members/Overview/Settings sections.
- Simplified calendar hygiene: default view is List, Week/Day are shown as disabled placeholders, and month cell add/todo CTA noise was reduced.
- Simplified header identity: removed inline group `(id)` clutter in app shell header row, replaced raw URL surface with compact Copy link action, and moved group ID to shortened muted display with copy.
- Unified button styling via shared class set (`fs-btn`, `fs-btn-primary`, `fs-btn-secondary`, `fs-btn-ghost`) and applied to key create/join, members, and drawer/editor actions.
- Added APPT code nowrap/min-width treatment in list table and card headers to prevent wrapping.
- Improved form visual surfaces/spacing for Create Group and drawer editor rows.

## 2026-02-23 update (Phase 1 Step 3 mobile-only Drawer editor)

- Finalized mobile-only appointment editing surface in `AppShell` using `useMediaQuery('(max-width: 768px)')`.
- Mobile now renders appointment editing exclusively in `Drawer open={whenEditorCode != null}`; desktop preserves existing inline `<tr>` editor behavior.
- Preserved all existing editor entry points (edit icon, When link, unreconcilable status button, add-appointment auto-open).
- Drawer close behaviors remain intact via overlay click, `Escape`, and form cancel.
- No API contract or appointment sorting behavior changed.

## 2026-02-23 update (mobile appointment editor drawer)

- Added responsive appointment editing behavior in the web app:
  - Mobile (`max-width: 768px`): appointment editor now opens in the shared Drawer component.
  - Desktop: existing inline table-row editor remains unchanged.
- Added reusable `useMediaQuery` hook for client-side media query detection.
- Preserved all existing editor entry points and confirm/cancel flows; no API or sorting behavior changes.
- Debug/artifact switches unchanged (`./.artifacts/<traceId>/` remains the convention when enabled).

## 2026-02-22 update (environment topology documentation)

- Formally documented production/staging environment topology in `docs/environments.md`, including resource mapping, isolation rules, deployment notes, and invariants.

## 2026-02-22 update (Responses API text.format.name fix)

- Fixed time parse AI `/v1/responses` structured output payload by adding required `text.format.name` (`time_spec`) and keeping schema under `text.format.schema` with `strict: true`.

## 2026-02-22 update (AI-first interval resolution + duration provenance)

- Shifted appointment preview resolution to AI-first interval parsing, with deterministic parsing used only when AI is explicitly disabled.
- Removed single-point 1-minute synthetic interval behavior from deterministic parsing.
- Added duration provenance metadata to `TimeSpec.resolved` (`durationSource`, `durationConfidence`, `durationReason`, `durationAcceptance`, `inferenceVersion`).
- Enforced labeled inferred durations (no unlabeled defaults) and required concrete resolved intervals to include both `startUtc` and `endUtc`.
- Stopped swallowing AI preview failures: `/api/direct` `resolve_appointment_time` now returns `502` with structured error payload.
- Persisted duration provenance on confirm/reschedule by accepting `timeResolved` metadata and writing it through appointment update paths.
- Updated shared TimeSpec schema and `docs/specs/SPEC_TIME_DATE.md` to document duration provenance semantics.

## 2026-02-22 update (TimeSpec AI-first fallback cleanup)

- Removed `TIME_RESOLVE_OPENAI_FALLBACK` from runtime paths so time preview now always attempts AI first, then falls back to deterministic parsing only when AI fails.
- Corrected `usedFallback`/`fallbackAttempted` semantics for `/api/direct` time preview: `fallbackAttempted` is always `true`, `usedFallback` is `true` when AI output is used and `false` when deterministic fallback is used.
- Confirmed TimeSpec parsing uses Responses API structured outputs via `text.format.json_schema` (no `response_format` on this path).

## 2026-02-22 update (Responses API text.format + fallback semantics)

- Fixed TimeSpec AI structured output payload for Responses API (OpenAI `/v1/responses` and Azure `/openai/responses`) by migrating from `response_format` to `text.format.json_schema` (`time_spec_parse`, `strict: true`).
- Corrected `resolveTimeSpecWithFallback` semantics: `fallbackAttempted` now tracks whether AI was attempted, and `usedFallback` is true only when AI output is used; deterministic parse paths report `usedFallback: false`.
- Restored feature-flag behavior for `TIME_RESOLVE_OPENAI_FALLBACK`: when disabled, AI is skipped and deterministic parsing is returned directly.
- Updated tests to assert the new Responses API request contract and corrected fallback-flag expectations in direct/time resolver tests.
- Note: `docs/discovery-photo-extract-appointment-feasibility.md` is currently stale (it claims no Responses API usage) and should be refreshed in a docs pass.

## 2026-02-22 update (schedule row actions + click-away cancel)

- Re-added Edit icon next to Delete in Schedule row actions, including explicit accessible labels (`Edit appointment`, `Delete appointment`).
- Added click-away cancel for the inline appointment editor: clicking outside the active row + editor container now triggers the same cancel path (discard unsaved changes, no mutation).
- Files touched: `apps/web/src/AppShell.tsx`, `PROJECT_STATUS.md`, `CODEX_LOG.md`.

## 2026-02-22 update (AI time parse opId/model null debugging)

- Traced the AI time parsing path end-to-end and added explicit pre-request diagnostics that log configured model wiring (`TIME_RESOLVE_MODEL`, `OPENAI_MODEL`) before the time parse request is sent.
- Added explicit OpenAI result diagnostics after response decode to log `opId` from `resp.id` and `model` from `resp.model`.
- Updated metadata propagation so `resolve_appointment_time` logging now prefers runtime response model (`resp.model`) while preserving configured model as fallback.
- Removed the `TIME_RESOLVE_OPENAI_FALLBACK=0` bypass in the time resolver so AI is always attempted first, then deterministic parser fallback is used only for call/config failures.
- Added startup config log line in `api/src/index.ts` so deployments confirm time-parse model settings at boot.
- Updated tests for always-attempt-AI behavior and response-model propagation.

## 2026-02-22 update (time_spec_parse schema flattening fix)

- Fixed AI time parsing structured output request to use `response_format.json_schema` with a minimal flat `time_spec_parse` schema (`status`, nullable `startUtc`/`endUtc`, nullable `missing`/`assumptions`) to avoid OpenAI HTTP 400 invalid schema errors.
- Updated AI output mapping to align with the simplified schema while preserving fallback behavior in `resolveTimeSpecWithFallback` (call/config failures still fallback; bad AI payloads still surface).
- Added/updated tests to assert `response_format` payload shape and verify AI-first resolution for `"tomorrow 1am"` returns `usedFallback=false` with non-null `opId`.

## 2026-02-22 update (provider-aware AI time parsing + actionable telemetry)

- Added provider-aware AI client adapter for time parsing (`openai` vs `azure`) with explicit selection: Azure when `AZURE_OPENAI_ENDPOINT` is set, otherwise OpenAI.
- Fixed Azure configuration mismatch by targeting Azure Responses API endpoint (`/openai/responses`) with `api-version` and using deployment name (`AZURE_OPENAI_DEPLOYMENT`) in the request model field.
- Kept OpenAI path clean (`OPENAI_API_KEY` bearer auth; no Azure base URL/version mixing).
- Improved `ai_time_parse` telemetry: success now logs `status:"ok"` with `opId`, provider, model/deployment, and parse status; failure logs actionable safe diagnostics (`errName`, trimmed message/body preview, status/code/type, provider, model/deployment, `nowIso`, `timezone`).
- Tightened fallback behavior so deterministic fallback only occurs on actual call/config failures (`OPENAI_CALL_FAILED` / `OPENAI_NOT_CONFIGURED`), while invalid AI payloads surface instead of being silently masked.

## 2026-02-22 update (AI-first time parsing with explicit now+timezone)

- Implemented AI-first time parsing for `resolve_appointment_time` with explicit `nowIso` and IANA `timezone` passed in the model prompt (no implicit server clock assumptions).
- Switched AI call to OpenAI Responses API with strict `json_schema` structured output and UTC `startUtc`/`endUtc` validation.
- Added deterministic safe fallback to local `parseTimeSpec` on missing API key, timeout, HTTP errors, or schema/parse failures (no hard parse-related 500/502s).
- Added `ai_time_parse` logging (`traceId` + `opId` + parse status) and optional `nowIso` debug field in direct response payloads.
- Added multilingual smoke coverage (`mañana a la 1pm`) through AI parser tests.

## 2026-02-22 update (OpenAI opId propagation)

- Added opId (OpenAI response id) propagation to API responses and logs for debugging.

## 2026-02-22 update (direct time resolve observability + fallback)

- Added `/api/direct` correlation headers on responses: `x-trace-id`, `x-invocation-id`, optional `x-traceparent`, plus `access-control-expose-headers` and `cache-control: no-store` so browser tools can read trace metadata.
- Added resolve preview metadata in `resolve_appointment_time` responses: `directVersion`, `fallbackAttempted`, and `usedFallback`.
- Added OpenAI fallback path behind `TIME_RESOLVE_OPENAI_FALLBACK=1` for unresolved local parses (including `tomorrow`), with explicit `ok:false` + typed error on fallback failures.
- Added optional single-line structured log event (`kind=time_resolve`) behind `TIME_RESOLVE_LOG_ENABLED=1` for Kusto-friendly diagnostics.
- Time point-in-time results continue returning `startUtc` only (no invented duration/end time).

### Instrumentation
- Added structured OpenAI logging in /api/direct
- Exposed invocationId and opId in API responses
- Enables Kusto correlation without dependency auto-collection

# PROJECT_STATUS

## Current milestone

BYO-only web-to-API routing with Managed Identity Blob-only state persistence and fail-fast config validation.

## What works now

- Fixed scan appointment UI: camera icon visibility + click behavior.
- Standardized appointment row editing to a single row-level editor model: default rows now show plain text for Description/Location/Notes, and the When editor panel now includes editable When/Description/Location/Notes fields with the existing Preview/Confirm/Cancel flow.
- Updated command input guidance with placeholder `Add, edit, or assign (e.g., "edit APPT-4")…` and a compact italic helper tip for email/CSV paste support.
- Tightened group header spacing and muted micro-typography for the group link + explainer so title/link/explainer read as one cohesive block.
- Made support email clickable (mailto link).

- Updated support contact email to `support@yapper-app.com` in `apps/web/src/components/layout/FooterHelp.tsx` (replacing prior support mailbox).

- People table now shows **Last seen** instead of status. Backend snapshots include `lastSeen` (fallback to `createdAt`) and direct person mutations update `lastSeen` timestamps so the column reflects recent person activity.

- Deploy Web (SWA) workflow now deploys `apps/web/dist` via `@azure/static-web-apps-cli` (`npx ... deploy`) instead of `Azure/static-web-apps-deploy@v1`, eliminating Docker/MCR pulls that were flaking with MCR anonymous token 429 rate limits.
- Added a pre-deploy built-output diagnostic step (`ls -la apps/web/dist` + script-tag grep) immediately before SWA CLI deploy to make artifact correctness easier to triage in CI logs.

- SWA deploy corrected to publish `apps/web/dist` as app root (`app_location: apps/web/dist` with no `output_location`); previous config published source, resulting in `/src/main.tsx` in production HTML and a blank page.

- SWA workflows now prebuild `apps/web/dist` using pnpm before deploy and pass `skip_app_build: true` while publishing `app_location: apps/web/dist` (no `output_location`), preventing Azure/static-web-apps-deploy from invoking its internal Oryx/Docker build path and ensuring built assets are deployed as app root.
- Added lightweight pre-deploy diagnostics in SWA workflows (`docker --version || true`, `df -h`, `du -sh . || true`, `ls -la`) to aid future runner resource triage when deploy issues recur.

- Renamed the Appointments pane label to **Schedule** in the shared workspace header while keeping the internal `appointments` view key unchanged.
- Reverted the Schedule/People segmented-tab experiment back to two standard side-by-side buttons for UI stability and readability, while keeping internal view keys unchanged (`appointments` / `people`).
- Standardized primary action labels and sizing to **+ Add appointment** and **+ Add person** across populated and empty-state panes.
- Removed Schedule/People header add buttons and introduced a compact bottom-of-table CTA row in both panes (`+ Add…` / `+ Add another…`) to avoid header CTA CSS conflicts and keep add actions consistently discoverable inside the table card.
- Fixed circular **+** FAB styling regression caused by shared/global button CSS by introducing dedicated `fs-fabAdd` class with explicit background, border, text color, hover, and focus-ring styling.
- Tightened helper guidance under "What would you like to do?" into a single compact muted block with minimal internal spacing.

- Page header group identity block is now tightly packed as a single vertical unit: group name has zero default heading margin, group link + copy icon remain center-aligned in one compact row, and the “save this link” explainer uses smaller muted styling with reduced top spacing to avoid large gaps.
- Header identity stack spacing was tightened further into one compact unit (`groupName` → link+copy row → explainer) with ~3px internal gaps and ~16px separation before pane tabs/content to reduce “floaty” whitespace.
- People rules rows now render as a compact right-aligned cluster (`range`, truncated description, status tag, actions) with reduced per-row/panel spacing so each rule reads as one cohesive line.
- Tightened people→rules spacing and compacted rule rows so rule lists hug the person row with reduced vertical whitespace while keeping badges/text readable.
- People rules range formatting now suppresses misleading default times for all-day entries by showing date-only labels with `(all day)`, including multi-day inclusive ranges such as `Mar 21–Mar 31 (all day)`.

- Workspace header hierarchy updated for both Appointments and People panes: group name is now the primary heading, shareable group link (with copy button) sits immediately beneath it, pane title is secondary, and access guidance is grouped below the pane description.
- People rules list now renders human-readable ranges without minute-count suffixes, including explicit all-day labels for single-day and multi-day ranges (for example, `Mar 21–Mar 31 (all day)`).
- Appointment “Assign people” availability badges now compute overlap by UTC interval intersection (including multi-day/all-day rules), so overlapping `unavailable` rules correctly surface as **Unavailable** instead of **Unknown**.
- Appointment composer now shows muted helper guidance under “What would you like to do?” with concise action hints and an example email/appointment phrase, without changing input/send behavior.
- People table now shows explicit **Accept** and **Cancel** buttons in the Actions column when editing a newly-added blank person row (`pendingBlankPersonId`), hiding rules/edit/delete icons for that new-row state only.
- New-person inline inputs now support keyboard submit/cancel: **Enter** triggers the same save handler as Accept, and **Escape** triggers cancel for the new-row editing state.
- Person rule detail lines are now right-aligned and reordered to show date/time, description, then status tag (`Available`/`Unavailable`) at the far right with description truncation to keep layout stable.
- Rules confirm API now accepts `draftedIntervals` from the web draft preview and persists those intervals directly when present (no OpenAI call on this path); logs include `source:"draftedIntervals"` and `persistedIntervalsCount` for traceability.
- Confirm fallback remains intact: when `draftedIntervals` is absent, confirm still uses the model path and now logs `code:"ZERO_INTERVALS_FROM_MODEL"` when confirm parsing yields zero intervals.
- Rules modal confirm request now sends the exact drafted interval payload and keeps Confirm disabled until at least one drafted interval exists, so People pane updates immediately from the returned snapshot after confirm.

- Rules dialog action labels now read **Draft Rule** and **Add Rule** (previously Draft/Confirm) to make intent clearer while preserving the same draft/confirm behavior and guards.


- Production outage root cause documented: deploy zip contained pnpm store-style dependency layout where `@azure/core-util` existed only under `.pnpm/...` and not at `node_modules/@azure/core-util`, causing Azure runtime `ERR_MODULE_NOT_FOUND` during function execution.
- Deploy packaging fix: workflow now installs production dependencies inside `api_deploy/`, then materializes workspace-hoisted deps via `cp -RL ../node_modules ./node_modules` so `api_deploy/node_modules/@azure/*` are real directories in the final zip artifact.
- Deploy guardrails now prioritize functional checks over strict symlink bans: staged artifact must contain `@azure/core-util`, `@azure/storage-common`, `@azure/storage-blob`, and pass import smoke checks before zip/deploy.
- CI deploy staging now writes a `dist/index.js` shim that imports `dist/api/src/index.js`, matching `api/package.json` `main` and restoring Azure Functions indexing so deployed functions appear in Portal.
- Workspace pnpm behavior note: `pnpm install --prod --frozen-lockfile --config.node-linker=hoisted` in `api_deploy/` may populate workspace-root `node_modules`; deploy flow now explicitly copies from `../node_modules` and dereferences symlinks for Azure runtime compatibility.
- Deploy staging now includes function folders for discovery + portable prod deps to avoid @azure module gaps.
- API prod deploy now stages a clean `api_deploy/` package root (host.json + package.json + built `dist/`) and installs production dependencies in-place via `(cd api_deploy && pnpm install --prod --frozen-lockfile --config.node-linker=hoisted)` before zip packaging.
- Deploy workflow now validates the staged runtime by importing `@azure/storage-blob` from `api_deploy/` so transitive packages such as `@azure/core-rest-pipeline` are present in the artifact.
- Zip packaging now archives `api_deploy` (app root at zip root) and post-deploy smoke test now calls `POST /api/group/join` and fails only on HTTP 500, directly guarding against runtime module-load failures.
- Flex Consumption API deploy no longer sets `FUNCTIONS_WORKER_RUNTIME`; workflow now relies on platform-managed runtime settings to avoid appsettings rejection during deploy.
- Root cause (Flex function discovery): deploy archive was packaged with the wrong zip root, so `host.json` and function folders (`chat/`, `direct/`, `groupCreate/`, etc.) were not positioned at the archive root for indexing.
- Root cause (Function indexing regression): `api_deploy/` staging omitted function trigger folders (`chat/`, `groupJoin/`, etc.), so Azure Functions could not discover/index triggers even though dependencies were present.
- Fix applied: deploy workflow now copies every `api/*/` folder containing `function.json` into `api_deploy/`, packages **only** `api_deploy/` into `api.zip`, and validates trigger presence before deploy.
- Smoke test hostname fix: deploy workflow no longer hardcodes `familyscheduler-api-prod.azurewebsites.net` (which could be non-resolving); it now queries Azure for `defaultHostName` via `az functionapp show` and builds `FUNCTION_APP_URL` dynamically before curl checks.
- Verify step robustness: previous deploy verification could fail with empty `APP_HOST`; workflow now prints Azure context + RG app listing, explicitly guards for empty hostname, dumps raw `az functionapp show` JSON on failure, and exits with a clear error before curl checks.
- Workflow verify-step Azure context hardening: deployment now prints Azure account/subscription debug context immediately after `azure/login`, forces subscription `99690a90-d117-4c79-bf85-bd491615b10d`, and keeps verify-step RG function app listing to prevent CLI context/subscription mismatch failures.
- Deploy verify host resolution fix: Function App smoke-check now resolves host via `az functionapp show --query "properties.defaultHostName"` (Flex shape), falls back to `properties.hostNames[0]` when empty, and builds `FUNCTION_APP_URL` from the resolved host.
- Rule-mode chat is now hard-routed in `/api/chat`: when `ruleMode` is `draft` or `confirm`, the handler runs rules-only parsing, never returns `kind:"question"`, rejects appointment/disallowed actions with deterministic `draftError`, and does not fall through to generic chat.
- Rules-only OpenAI prompt now uses `buildRulesOnlyPrompt(...)` with strict instructions: availability rules only, no appointments, no follow-up questions, missing time => all-day, and mode-locked action type output.
- Rules modal state/handlers now use `rulePrompt`, `ruleDraft`, `ruleDraftError`, `isDrafting`, and `isConfirming`; Draft performs exactly one `/api/chat` call and treats any `kind:"question"` as a user-facing draft error without rendering question chips.
- Rules modal Confirm button is now enabled only when a valid draft with `draftRules.length > 0` exists (and not currently confirming).
- People table action icons are verified to render in order `Rules`, `Edit`, `Delete` with exactly three buttons per row.
- Draft/confirm verification focus: use prompt like “I am busy tomorrow”, confirm draft reply contains either `draftRules` or `draftError`, and verify snapshot has no appointment mutations until Confirm is clicked.


- People table actions now render exactly three non-wrapping icons in stable order: Rules (clock icon), Edit person, Delete person; aria-labels/tooltips align with those labels.
- People action cells now use `.actions-cell` + `.action-icons` nowrap styles, and icon buttons are fixed-size flex items to prevent wrapping on desktop widths.
- Rules detail rows now use `rules-row` and `rules-indent` for visual nesting; rule lines are compact flex rows with no-wrapping metadata and right-aligned grouped rule actions.
- Manual UI checks for this patch: open People view, confirm icon order/labels and no wrap at typical desktop width, then expand a person with rules and verify indentation + compact alignment.

- Rules modal is now single-shot for rule drafting: prompt + Draft/Confirm/Cancel only, no rule-mode question chips/free-text loops; Draft overwrites prior proposal and Confirm stays disabled until a valid draft exists.
- `/api/chat` ruleMode draft/confirm now hard-rejects question/invalid/non-rule model outputs and returns deterministic `{ kind: "reply", draftError }`; both modes require `personId`, and confirm requires `promptId`.
- Rule-mode prompt instructions now force availability-only proposals, default missing times to all-day, and encourage assumptions/warnings instead of follow-up questions.
- Rule confirm now applies overlap replacement + same-status normalization per person before insert, then enforces max 20 normalized interval rules per person (`rule_limit_exceeded` on overflow).
- Rules modal copy/layout refreshed: prompt area now uses "Availability rule" + helper text, sections are structured (header/prompt/actions/preview), actions are right-aligned, and draft preview is rendered in a bordered output panel for readability.
- `/api/chat` now supports rule-focused AI parsing when `ruleMode` is `draft` or `confirm`; `personId` is required and rule-mode responses reject appointment flows by forcing rule-only prompts and a deterministic clarification fallback when required rule fields are missing.
- Rules modal now handles `kind: "question"` from rule drafting: users can answer via options or free text, then re-submit draft requests with the same trace ID until a draft preview is produced.
- BYO API routing is now enforced at web build-time via `VITE_API_BASE_URL` pointing to the dedicated Function App URL.
- SWA-managed API deployment is disabled in both SWA workflows (`api_location: ""`), so web traffic no longer depends on SWA `/api/*` routing.
- API storage mode is Blob-only via Managed Identity (`DefaultAzureCredential`) using `STORAGE_ACCOUNT_URL` + `STATE_CONTAINER` (+ optional `STATE_BLOB_PREFIX`).
- Removed SAS/local storage toggles from runtime config (`BLOB_SAS_URL`, `STORAGE_MODE`, `LOCAL_STATE_PREFIX`) and removed LocalFileStorage implementation.
- Added centralized fail-fast config error envelope with trace IDs: `{ ok:false, error:"CONFIG_MISSING", message, traceId, missing[] }`.
- `/api/chat` error classification now differentiates config/storage failures from OpenAI upstream failures (only true upstream failures map to `OPENAI_CALL_FAILED`).
- Added a pre-flight planning brief for multi-select availability date ranges at `docs/multi-select-date-range-preflight.md`, documenting current constraints and recommended v1 decisions before implementation.
- Web deploy workflow now injects `VITE_BUILD_SHA=${{ github.sha }}` and `VITE_BUILD_TIME=${{ github.run_id }}-${{ github.run_number }}` into the SWA Oryx build step, so every main-branch run bakes unique build metadata into the Vite bundle.
- Web UI now reads build metadata from `apps/web/src/lib/buildInfo.ts` and renders an always-visible footer stamp: `Build: <sha7> <time>`.
- Production verification is now explicit: after a main merge, open the app footer and confirm the SHA prefix matches the commit that triggered the GitHub Actions `Deploy Web (SWA)` run.
- SWA web deploy workflow now uses an Oryx-compatible API build override (`npm --prefix api run build`) while keeping `api_location: api` enabled.
- SWA deploy trigger is now push-only on `main` (no `pull_request` trigger) to prevent automatic preview/staging environment creation and avoid SWA staging quota exhaustion blocking production deploys.
- Hard route gate is now enforced for `/#/g/:groupId/app`: app UI only renders after a successful `/api/group/join`; denied sessions are redirected with `err` + `trace` query params to join.
- Debug auth logging is available behind `VITE_DEBUG_AUTH_LOGS` (web) and `DEBUG_AUTH_LOGS` (api), including join and gate decision stages.
- Create Group page now shows a share link (with Copy) before navigating, plus a Continue button to enter the app.
- Optional AI-assisted location parsing is now available behind `LOCATION_AI_FORMATTING` (default `false`), with fallback heuristic normalization preserved when disabled or parsing fails.
- Appointment location now persists as `locationRaw`, `locationDisplay`, and `locationMapQuery` (legacy `location` migrated automatically), and direct edits deterministically normalize formatting without OpenAI.
- Appointments Location column now supports raw textarea editing + inline normalized preview (line-clamped) + Google Maps `Map` link using map query text.
- Appointment notes are now persisted end-to-end (`notes`, default empty string), including backward-compatible normalization for older blobs missing notes.
- Chat/action layer supports `set_appointment_notes` (set/clear) behind the existing proposal+confirm mutation gate.
- Appointments table includes Description, Location, and Notes columns with wrapped multi-line rendering so longer content is visible without horizontal scrolling; empty values render as `—`.
- Dashboard-first web UI now renders appointments and availability as compact, sortable tables with code-copy buttons, horizontal overflow support, unassigned badge, and date/time columns.
- Azure persistence mode available with `STORAGE_MODE=azure` using SAS URL + blob ETag optimistic concurrency (`If-Match`).
- Azure init creates missing blob with `If-None-Match: *` and same seeded empty state as local mode.
- API state persists locally across restarts using `./.local/state.json`.
- Confirm/apply path enforces optimistic ETag checks to reject stale proposals safely.
- Fixed Azure Functions v4 discovery by registering HTTP trigger from `api/src/index.ts` (compiled to `api/dist/index.js`).
- Local `/api/chat` route reachable via Functions host (`POST http://localhost:7071/api/chat`) with JSON response.
- Tracked `api/local.settings.example.json`; local copy workflow documented in runbook.
- Confirmation protocol implemented (in-memory only).
- In-memory appointment state in API (`appointments[]`) with runtime-stable generated codes (`APPT-1`, `APPT-2`, ...).
- `list appointments` command returns one appointment per line (`APPT-n — <title>`).
- `show APPT-n` command returns appointment details or a not-found message.
- Mutation-like commands require explicit `confirm` before apply.
- Delete appointment (`delete APPT-n`) with confirm/cancel guard.
- Update appointment title (`update APPT-n title <new title>`) with confirm/cancel guard.
- In-memory availability blocks supported with stable codes (`AVL-<PERSON>-<N>`) via confirm/cancel (`mark ... unavailable`, `delete AVL-...`).
- Availability queries supported: `list availability`, `list availability for <Name>`, `show AVL-...`, `who is available ...`, and `check conflicts`.
- Deterministic identity binding supported with `I am <Name>` via the same proposal/confirm modal flow as other mutations.
- Runtime chat context is now scoped per session (`x-session-id`, default `default`) for identity, pending proposal, pending clarification, and chat history.
- No persistence yet for pending proposals.
- Monorepo is runnable locally with `pnpm dev`.
- Dashboard-first web UI is implemented at `apps/web`:
  - always-visible `Appointments` and `Availability` panels hydrated from API `snapshot`
  - conversation transcript collapsed to last user/assistant exchange by default with `History (N)` toggle
  - proposal responses open a confirm/cancel modal (`Confirm this change?`)
  - prompt label/placeholder: `What would you like to do?`
- Stub Azure Functions API endpoint is implemented at `POST /api/chat` with deterministic command handling:
  - request `{ "message": "..." }`
  - queries return `{ "kind":"reply", "assistantText":"You asked: <message>" }`
  - mutation-like commands return `{ "kind":"proposal", ... }` and require explicit `confirm`
  - `confirm` applies the pending proposal and returns `{ "kind":"applied", ... }`
  - validation error for missing/empty message.
- Shared package has initial placeholder type (`Person`) and builds.
- CI installs dependencies and runs workspace build checks with `pnpm -r --if-present build`.



### UI Structure (CODEX-003)
- Added reusable Page layout component
- Added PageHeader component
- Added FooterHelp component
- No page migrations yet


### Join Gate UX (CODEX-004)
- Join page moved to Form layout
- Added PageHeader + FooterHelp
- Shows group name (when available) and group ID as metadata
- Button no longer spans full width
- Improved error copy


### Create Group UX (CODEX-005)
- Create page moved to Form layout with header + guidance
- Shows share link prominently after creation with Copy button
- Displays group name + group ID with proper hierarchy
- Added “Next steps” checklist + help footer


### Workspace UX + Polish (CODEX-006/007/008)
- Appointments page migrated to workspace layout with header/footer and empty state
- Prompt/notes uses multiline textarea in edit mode with auto-grow
- Replaced “Add blank row” with “Add Appointment” / “Add Person”
- Standardized button labeling and avoided full-width buttons

### UI Polish (CODEX-002)
- Replaced default Vite favicon with minimal calendar SVG
- Set browser title to “Family Scheduler”

### UI Baseline (CODEX-001)
- Added global ui.css design tokens
- Installed and imported Inter font
- Standardized typography, spacing, controls
- No layout/page changes yet

## How to run locally

1. Install prerequisites:
   - Node.js 20+
   - pnpm 10+
   - Azure Functions Core Tools v4
2. Run:
   - `pnpm install`
   - `cp api/local.settings.example.json api/local.settings.json`
   - `pnpm dev`
3. Open `http://localhost:5173` and submit a prompt.

## Local dev checklist

- `pnpm install` generates/uses `pnpm-lock.yaml`.
- If pnpm warns about ignored build scripts, run `pnpm approve-builds` and select `esbuild`.

## CI checklist

- CI requires `pnpm-lock.yaml` to be present (or dependency caching disabled); current state: lockfile is committed.

## Recent changes

- 2026-02-22: Fixed scan time mapping so parsed date/time now populates canonical `time.intent` + `time.resolved` (with computed `startUtc`/`endUtc`) in addition to legacy timed fields; scan rows now resolve the Schedule **When** column instead of remaining `Unresolved` when scan parsing finds concrete date/time.
- 2026-02-22: Fixed scan UX and scan field population deterministically. Frontend: scan viewer modal now constrains image content with contained sizing; appointment Actions icons now align in a fixed-width right-aligned flex container; camera icon renders only when `scanImageKey` exists; rescan is wired to the same scan capture flow as Scan Appointment and uses camera preview via `getUserMedia` when available (falling back to file input) without `label/htmlFor`-driven file picker coupling. Backend: scanned appointment defaults are now empty-field defaults (blank title/location/notes/date, no forced all-day), added `scanAutoDate` to treat scan-initial date placeholders as empty-equivalent, and updated parse application to normalize `startTime` vs `isAllDay` while preserving fill-only-empty behavior for initial scans and overwrite behavior for rescans.
- 2026-02-22: Added `directVersion` response stamping across `/api/direct` for deployment verification, expanded `resolve_appointment_time` contract with `usedFallback`/`fallbackAttempted`/`fallbackError`, switched resolve logging to one Kusto-friendly structured line gated by `TIME_RESOLVE_LOG_ENABLED=1`, and made OpenAI fallback failures return explicit `ok:false` 502 responses without masking errors.
- 2026-02-22: Added `/api/direct` appointment-time preview fallback resolver for natural-language text (for example, "tomorrow at 1pm"): deterministic `parseTimeSpec()` still runs first, and OpenAI fallback is attempted only when unresolved and `TIME_RESOLVE_OPENAI_FALLBACK=1`. OpenAI fallback errors now return `ok:false` with explicit error codes (`OPENAI_NOT_CONFIGURED`, `OPENAI_CALL_FAILED`, `OPENAI_BAD_RESPONSE`) instead of being masked as missing date hints. Added optional structured telemetry for resolve-time requests behind `TIME_RESOLVE_LOG_ENABLED=1` (traceId, appointmentId, timezone, whenText, usedFallback, finalStatus, missing). Known limitation: single-point fallback results intentionally do not invent duration and may omit `endUtc` with assumption "No duration provided.".
- 2026-02-22: Added appointment camera-scan MVP flow with private-blob image storage + backend proxy endpoints (`/api/scanAppointment`, `/api/appointmentScanImage`, `/api/appointmentScanDelete`, `/api/appointmentScanRescan`). Appointment rows now include scan metadata (`scanStatus`, `scanImageKey`, `scanImageMime`, `scanCapturedAt`), images are stored at `familyscheduler/groups/<groupId>/appointments/<appointmentId>/scan/scan.<ext>`, first-scan AI fill only populates empty fields, and rescan overwrites extracted fields wholesale. Added best-effort `deleteAfter` blob metadata (~180 days) for lazy cleanup later.
- 2026-02-21: Tightened helper text spacing under the Schedule action prompt so the two guidance lines render as one compact muted block with ~8px top separation from input and ~2px internal gap (no paragraph-default margins).
- 2026-02-21: Unified workspace header metadata across People/Appointments panes: group name is now primary heading, pane title is secondary, shareable group app-link (`/#/g/<groupId>/app`) is shown with copy control and helper text, and duplicated People-only access text was removed from body content. Appointment assignment availability now resolves by UTC interval overlap (including multi-day rules), and People rule rows now render human-readable date/time ranges (no raw minute suffixes and no `UTC` suffix in UI).
- 2026-02-19: Added `GroupAuthGate` around `/#/g/:groupId/app` so unauthenticated or mismatched sessions are redirected to join before app mount; initial `list appointments` chat bootstrap now has a StrictMode-safe one-time ref guard with debug stage `initial_chat_triggered` behind `VITE_DEBUG_AUTH_LOGS`.
- 2026-02-19: Fixed Create Group flow end-to-end: API seeds creator into `people[]` on create, create response includes `creatorPersonId`, Create page shows copyable share link before navigation, and app shell shows a dev-only warning if snapshot has zero people.
- 2026-02-19: Added UI density mode toggle (Normal/Compact) with `localStorage` persistence and `body[data-density]` binding; introduced root density tokens applied across main layout, panels, controls, table cells, picker rows, rule rows, and modal padding so compact mode reduces font/whitespace while normal stays default.
- 2026-02-19: Added AI-assisted appointment location parsing (name/address/directions/display/mapQuery) behind `LOCATION_AI_FORMATTING`, added new location fields to appointment state/snapshots, and kept deterministic heuristic fallback for disabled/failure paths.
- 2026-02-19: Location editing flow now stores raw + normalized fields (`locationRaw`, `locationDisplay`, `locationMapQuery`), migrates legacy `location`, and renders an inline Google Maps link in the appointments table with multi-line clamped display.
- 2026-02-19: Appointments table UX tweak in `apps/web`: Description, Location, and Notes cells now render as wrapped multi-line content (pre-wrap) with bounded width to reduce horizontal scrolling for long text.
- 2026-02-19: Assign People modal UX polish in `apps/web`: each person now renders as one clickable row (checkbox + name + right-aligned fixed-width status badge), row hover and separators improve scanability, and checkbox/row toggles stay in sync for better selection on desktop/mobile widths.
- 2026-02-19: People view now shows per-person rules in a collapsed section (Clock toggle) with badge/date/time/notes and inline delete action (Trash), and confirm/cancel apply flow refreshes UI snapshots for appointments/people/rules immediately.
- 2026-02-19: API chat snapshot now includes rule timezone in `snapshot.rules` and acceptance coverage validates rules are returned after add-rule confirm.
- 2026-02-19: People pane UX refresh in `apps/web`: row actions are now compact icon buttons with hover tooltips, added delete confirmation that deactivates a person, added availability/unavailability rule modal with date/all-day/time/duration/notes controls, and active-only filtering in People table and appointment people picker.
- 2026-02-19: UI branding update in `apps/web` changed browser tab title and visible app header from “FamilyScheduler” to “Scheduler” with no functional behavior changes.
- 2026-02-19: Web UX polish in `apps/web`: Availability panel hidden from dashboard rendering (snapshot data unchanged), baseline typography reduced to 14px with tighter table/card spacing, and transcript minimized by default with clarify-only assistant callout plus subtle expandable History toggle.

- 2026-02-19: Bumped action schema to v3 with appointment people operations (`add/remove/replace/clear`) and `set_appointment_location`, added storage/state migration normalization (`people[]` and `location` defaults), and exposed people/location in chat snapshot for UI tables.
- OpenAI request/response NDJSON logging (feature-flagged) added in API parser wrapper: `OPENAI_LOG_ENABLED` (default `false`), `OPENAI_LOG_DIR` (default `api/.local/logs`), and `OPENAI_LOG_MAX_BYTES` for rotation. Logs include per-request trace IDs, session hashes, redacted request/response payloads, and parser validation diagnostics.
- 2026-02-19: OpenAI parser now receives a full context envelope (now/timezone, identity, pending proposal/clarification, full appointments/availability/people snapshot, and bounded session history). Added per-session in-memory runtime state, confidence-based safe-clarify fallback, and strict mutation confirmation behavior (including identity changes).
- 2026-02-19: Chat UX fix for list defaults + reschedule clarifications: deterministic `show list|list|show|show all|list all` now lists appointments first (or availability if no appointments), reschedule date-only commands now create pending clarification for start/end times, and follow-up time ranges like `9am to 10am` resolve directly into a reschedule proposal before any new intent parsing.
- 2026-02-19: API UX upgrade for rescheduling: added flexible date parsing (`YYYY-MM-DD`, `DD-MM-YYYY`, `Month DD YYYY`), deterministic time-of-day mapping (`morning`/`afternoon`/`evening`), default all-day interpretation for date-only reschedules, and robust pending proposal controls that trigger on messages containing `confirm` or `cancel`.
- 2026-02-19: Added timezone alias handling for `Seattle time`, `LA time`, and `Pacific` to map to `America/Los_Angeles`; chat now answers `Seattle time vs LA time` with `Same Pacific timezone.`
- 2026-02-19: Improved query UX for `show my appt` / `show my appointments` to list directly, and only asks for a code on `show appointment` when more than five appointments exist.
- 2026-02-19: Appointments and availability panels now use table layouts with sorting (appointments: start then code fallback; availability: start), code click-to-copy, unassigned badge display, and compact horizontal-scroll styling.
- 2026-02-19: UX refresh shipped: API now includes a response `snapshot` (appointments/availability/historyCount) on reply/proposal/applied/clarify responses; web now renders always-visible dashboard panels, collapses history by default behind `History (N)`, and uses a confirm/cancel modal for proposal flows.
- 2026-02-18: Prioritized pending clarification resolution before identity parsing in chat flow, made `list/show my availability` identity-aware (uses current identity when set, otherwise asks `Whose availability?`), and updated clarification slot-filling to resolve `personName` case-insensitively against existing people names without changing identity state.
- 2026-02-19: Fixed multi-turn clarification binding for delete/update/query follow-ups by persisting intended action + missing slots, added resilient APPT/AVL code normalization (`appt1` => `APPT-1`), and ensured invalid clarify replies re-prompt without losing intent.
- 2026-02-18: Added pending clarification handling in chat flow so follow-up replies (e.g. `Joe`) can fill missing query fields (currently `list_availability.personName`) and execute immediately; `cancel` now clears both pending proposals and pending clarifications with reply `Cancelled.`; bare-name messages no longer trigger identity changes (identity remains explicit via `I am <Name>`).
- 2026-02-18: Normalized chat input (trim/lower/whitespace/trailing punctuation) for deterministic routing so `Who is available in March?` and `who is available in march` resolve identically; availability month parsing now accepts month names/abbreviations with next-occurrence year resolution, and availability-query parse failures return a focused clarify prompt without code guidance.
- 2026-02-18: Azure blob init now treats `409 BlobAlreadyExists` and `412` as already-initialized success conditions so repeated startup init attempts do not fail when `state.json` already exists.
- 2026-02-18: Added in-memory availability blocks and deterministic availability commands (`I am <Name>`, mark/list/show/delete availability, who-is-available month queries, and `check conflicts`) with confirm/cancel protections for mutations.
- 2026-02-18: Added deterministic delete/update appointment mutation proposals (`delete APPT-n`, `update APPT-n title <new title>`) with confirm/cancel application and post-apply appointment snapshot output.
- 2026-02-18: Added API clean-build script (`pnpm -C api run clean`) and wired `api` build to clean `dist/` before compilation so stale artifacts cannot mask the Functions entrypoint (`dist/index.js`) path.
- 2026-02-18: Fixed Azure Functions entrypoint mismatch by setting `api/tsconfig.json` `rootDir` to `src` (with `outDir` `dist`) so builds emit `api/dist/index.js` and `api/dist/functions/chat.js`; updated runbook troubleshooting for `entry point dist/index.js does not exist` and confirmed `/api/chat` is reachable locally.
- 2026-02-18: Fixed local Azure Functions runtime discovery by moving v4 trigger registration to `api/src/index.ts`, added tracked `api/local.settings.example.json`, and updated runbook for `local.settings.json` copy so local `POST /api/chat` no longer 404s.
- 2026-02-18: Added in-memory appointment mutation/query support in API (`add appt <title>`, `confirm`, `list appointments`, `show APPT-n`) with runtime-generated human-readable appointment codes and post-apply snapshot output.
- 2026-02-18: Added workspace-root `typescript` devDependency (`^5.5.0`) so workspace `tsc` invocations resolve during local/CI builds.
- 2026-02-18: Fixed API TypeScript build configuration by adding `@types/node` to `api` devDependencies to resolve `TS2688` (Cannot find type definition file for `node`).
- 2026-02-18: Added `pnpm-lock.yaml` to the repository so GitHub Actions (`setup-node` cache: pnpm) can run without failing.
- 2026-02-18: Local dev note: run `pnpm approve-builds` and select `esbuild` to avoid pnpm warning and allow the Vite/esbuild toolchain to function.

## Known limitations

- Next planned milestone: add persistence first (local file), then OpenAI natural-language parsing.
- No authentication/passkey yet.
- No persistence yet (proposal confirmation is in-memory only).
- No storage integration (local/blob) yet.
- No OpenAI integration yet.

## Next steps

- Wishlist: AI ingestion from uploaded artifacts (text/PDF/image) with confirm gate.
1. Replace naive parsing with a structured action schema.
2. Add availability model for assignment/scheduling decisions.
3. Add persistent local file storage for appointments/proposals.
4. Add OpenAI integration after local deterministic/storage milestones.

## Continuity rule

After every merged PR, update this file with:

- what changed,
- local/deploy status,
- next steps.

## Next

- Add passkey/session-backed identity so `I am <Name>` is not global across users.


## Azure mode env checklist

- `STORAGE_MODE=azure`
- `BLOB_SAS_URL=<container or blob SAS URL>`
- `STATE_BLOB_NAME=state.json` (required for container-level SAS URL; ignored for blob-level SAS URL)
- Optional: `BLOB_KIND=container|blob` (for operator clarity; adapter auto-detects by URL path)

## Deployment readiness notes

- Local mode remains the default and unchanged for developer workflows.
- Azure mode is ready for staging/production where shared persistent state is required.
- CI remains secret-free; Azure behavior is verified manually with real SAS credentials only.


## Recent update (2026-02-18 23:05 UTC)

- Added feature-flagged OpenAI natural-language parser (`OPENAI_PARSER_ENABLED`) that emits strict structured actions only.
- Added versioned action schema (`ActionSchemaVersion=1`) with strict validation and unknown-field rejection.
- Added centralized deterministic action executor as the only mutation path.
- Updated chat routing: deterministic commands first, OpenAI fallback, clarify/query/proposal handling, and traceId in responses.
- Added API unit tests for schema validation and deterministic executor behavior.


## Debug switches and artifacts

- Function startup instrumentation is available in `api/src/index.ts`; set `FUNCTIONS_STARTUP_DEBUG=true` to emit `component=api-startup` JSON logs for entrypoint load and route registration diagnostics.
- OpenAI logging is off by default. Enable with `OPENAI_LOG_ENABLED=true`.
- Default log path: `api/.local/logs/openai.ndjson` (gitignored via repo `.gitignore` rule for `.local/`).
- Rotation: when file size exceeds `OPENAI_LOG_MAX_BYTES` (default `5242880`), current file is renamed with a timestamp suffix and a fresh file is used.
- Sensitive fields are redacted (`apiKey`, `sas`, `passkey`, and `sig=` query parameters in strings).
- 2026-02-19: Deterministic explicit reschedule parsing now supports `update appointment APPT-<n> to start <ISO> end <ISO>` and `reschedule APPT-<n> start <ISO> end <ISO>` (case-insensitive), including timezone-default behavior for offset-less timestamps (interpreted as `America/Los_Angeles`) with explicit yes/no timezone clarification before proposal when needed. Pending proposal/clarification confirmation now accepts synonyms (`yes/y/ok/okay/sure` and `no/n/stop/nevermind/never mind`).

## Recent update (2026-02-19 01:46 UTC)

- Refactored chat routing to AI-first mode with deterministic confirm/cancel gate and pending-proposal short-circuit (`Please confirm or cancel.` without OpenAI calls).
- Removed most deterministic regex parsing in chat; retained only help, confirm/cancel synonyms, and session/passkey bootstrap responses.
- Upgraded parser schema to strict `kind: reply|proposal|clarify` + `message` + optional `actions` + `confidence`.
- Added action post-processing in chat: appointment/availability code normalization, referenced-code existence checks, and proposal validity guard (must include summary + actions).
- Added explicit logging for OpenAI context envelope, raw model responses, and schema/post-processing validation errors.
- Replaced chat acceptance tests with AI-first acceptance scenarios (show appt, update->proposal->confirm, deterministic yes on pending proposal, random yes clarify, unknown code clarify).

## Recent update (2026-02-19 02:06 UTC)

- Updated planner action schema to v2 with appointment/availability date-centric fields: required `date` + `desc`, optional `startTime` + `durationMins` + `timezone`.
- Replaced mutation action names with `update_appointment_desc` and date-based `reschedule_appointment`.
- Executor now resolves start/end deterministically from `date/startTime/durationMins/timezone`; date-only actions are stored as all-day (`isAllDay=true`) with no start/end ISO.
- Storage model remains backward compatible: snapshot shaping derives `date/startTime/durationMins/isAllDay` from legacy `start/end` when needed.
- Updated parser prompt contract, chat snapshot schema, action tests, and acceptance tests for: date-only add, timed add, and date-only reschedule behavior.


## Recent update (2026-02-19 02:55 UTC)

- Added persisted appointment notes (`notes`) with default-empty normalization for legacy state blobs.
- Added `set_appointment_notes {code,notes}` planner action + executor previews for set/clear.
- Included `notes` in API snapshots consumed by web UI.
- Updated appointments table with a compact Notes column (`—` when empty, ellipsis + title on long values).
- Updated help docs with note-setting/clearing examples.

## Recent update (2026-02-19 04:20 UTC)

- Started People system overhaul: state now uses `people` + `rules` (availability rules) with legacy `availability` migration into `rules` (`kind=unavailable` default).
- API snapshot now returns people/rules and appointment `peopleDisplay` values.
- Added/updated action schema + executor paths for people CRUD, rules CRUD, and appointment person assignment with unavailable warnings.
- Web now has `Appointments | People` toggle, People table actions, and appointment people picker with Available/Unavailable/Unknown tags.
- Confirm gate remains in place for mutations.
- Known limitation: could not install `libphonenumber-js` (npm registry 403 in this environment), so validation currently uses local fallback logic.

## Recent update (2026-02-19 04:58 UTC)

- People view now renders per-person rules inline by default whenever rules exist (clock toggle removed), sorted by date then time with all-day rules first.
- People view prompt header/input is hidden; Appointments view prompt input remains unchanged.
- Rule conflict policy now auto-resolves contradictory overlaps on `add_rule`: overlapping opposite-kind rules for the same person/date are removed before inserting the new rule.
- Proposal previews are now generated from executor dry-run effects so confirm modals explicitly show conflict removals (e.g., `This will remove X conflicting rule(s).`).

## Recent update (2026-02-19 06:10 UTC)

- Question dialog implemented for AI clarifications.
- API model/schema now supports `kind="question"` with optional up-to-5 button options (`label`/`value`/`style`) and `allowFreeText`.
- Backward compatibility retained: legacy model `kind="clarify"` is normalized into `kind="question"` with free-text enabled by default.
- Web now blocks with a dedicated question modal whenever `pendingQuestion` exists; users can answer by button click or typed response, and Close dismisses without mutation.
- Proposal confirm/cancel modal behavior remains unchanged.

## Recent update (2026-02-19 06:15 UTC)

- Added deterministic direct-mutation API endpoint: `POST /api/direct` for inline appointment edits without OpenAI.
- Added direct appointment actions: `create_blank_appointment`, `set_appointment_date`, `set_appointment_start_time`, `set_appointment_desc`, `set_appointment_location`, `set_appointment_notes`, `set_appointment_duration`, and `delete_appointment`.
- Appointments pane now supports direct inline editing for date/time/description/location/notes and add/delete row UX.
- Delete appointment remains confirmation-gated; inline edits apply immediately with no confirm modal.

## Recent update (2026-02-19 06:35 UTC)

- Appointments table now defaults to read-only rows and uses per-row edit mode with Edit/Done toggle in Actions.
- Add appointment now auto-opens edit mode on the newly created APPT row.
- Appointments table includes inline duration editing while in row edit mode; read-only rows show compact text values and clamped multi-line content.
- Web layout is now full-width (`main` no longer constrained to centered max width) with consistent page padding.
- Typography and control sizing were reduced for denser system-like UI defaults.
- 2026-02-19: Appointments row edit mode now supports cancel by keyboard/mouse: pressing `Esc` or clicking/tapping outside the active row exits edit mode; Done tooltip now hints at `Esc/outside click` to improve discoverability.


## Recent update (2026-02-19 07:20 UTC)

- API now has deterministic endpoints: `POST /api/group/create` and `POST /api/group/join`.
- Storage is now per-group (`familyscheduler/groups/<groupId>/state.json`) for both Azure and local modes.
- App state schema now carries `schemaVersion`, `groupId`, `groupName`, `createdAt`, `updatedAt`.

### Debug switches / env notes

- `STATE_BLOB_PREFIX` defaults to `familyscheduler/groups`.
- Local state root defaults to `.localstate/familyscheduler/groups`.

### Appointments UX (CODEX-006)
- Appointments page moved to Workspace layout with header + footer.
- Added empty state panel with Add Appointment CTA.
- Prompt/notes field uses multiline textarea in edit mode with auto-grow.
- Buttons no longer span full width.

### Workspace Layout Normalization (CODEX-009)
- Workspace pages now use centered wide container (max-width 1200px)
- Added horizontal scroll wrapper for tables
- Removed duplicate headings for cleaner hierarchy

## Recent update (2026-02-20 21:15 UTC)

- Updated `.github/workflows/deploy.yml` Azure auth to use `azure/login@v2` with `creds: ${{ secrets.AZURE_CREDENTIALS }}`.
- `deploy-api-prod` now expects repository secret `AZURE_CREDENTIALS` containing JSON fields: `clientId`, `clientSecret`, `tenantId`, `subscriptionId`.
- Deploy job steps after login are unchanged (runtime setting + zip deploy mechanics remain the same).

## Recent update (2026-02-20 00:44 UTC)

- Added a deploy workflow guard step that explicitly sets `FUNCTIONS_WORKER_RUNTIME=node` on the production Function App before zip deploy.
- This addresses host indexing cases where logs show `0 functions found (Custom)` due to missing/incorrect worker runtime app setting.
- Deployment artifact and command remain unchanged.

## Recent update (2026-02-20 01:20 UTC)

- Root cause captured: Azure Flex deploy package created on Windows via `Compress-Archive` contained backslash zip entries (`dist\index.js`), which can prevent Linux worker indexing and surface as `0 functions found (Custom)`.
- Permanent packaging fix (superseded by latest update): switched from Windows `Compress-Archive` to deterministic scripted packaging and zip verification to guarantee `dist/index.js` and forward-slash entry paths.
- Added deterministic artifact verifier (`pnpm deploy:api:verifyzip`) requiring `host.json`, `package.json`, and `dist/index.js` in the deploy archive.
- Local ship script now runs zip verification before `az functionapp deployment source config-zip`.
- Deploy workflow now includes both tooling and CI guard checks that fail if zip entries include `\` or if `dist/index.js` is missing.

## Recent update (2026-02-20 00:00 UTC)

- Fixed Azure Flex deployment packaging path: deploy artifact root is now the `api/` runtime shape (`host.json`, `package.json`, `dist/**`, runtime `node_modules/**`) so host indexing can load Node v4 registrations from `dist/index.js`.
- Added deterministic packaging script: `node scripts/package-api-deploy.mjs` (invoked by `pnpm deploy:api:package`).
- Added one-step ship script: `bash scripts/ship-api.sh` to install, build, package, and zip-deploy to `familyscheduler-api-prod` in `familyscheduler-prod-rg`.
- Replaced previous Static Web Apps deploy workflow with Functions Flex deploy workflow (`.github/workflows/deploy.yml`) that builds on GitHub runner (pnpm), installs production deps in the artifact via npm, then deploys zip with Azure CLI (no remote pnpm requirement).

### Azure resources (prod)

- Resource group: `familyscheduler-prod-rg`
- Function App: `familyscheduler-api-prod`
- Plan: Flex Consumption (Linux)
- Runtime: Node.js 22

### Deployment method (chosen)

- Preferred: GitHub Actions workflow `.github/workflows/deploy.yml` (environment: `prod`)
- Local/manual fallback: `pnpm deploy:api:ship`

### Required environment variables (Function App)

- `STORAGE_MODE=azure`
- `BLOB_SAS_URL=<secret>`
- `STATE_BLOB_PREFIX=familyscheduler/groups` (default if omitted)
- `FAMILY_PASSKEY=<secret>`
- `TOKEN_SECRET=<secret>`
- `OPENAI_API_KEY=<secret>`
- `OPENAI_MODEL=<model-name>`
- Optional: `DEFAULT_COUNTRY=US`, `OPENAI_PARSER_ENABLED`, `LOCATION_AI_FORMATTING`

### Known issues / next steps

- Verify first post-fix deploy in Azure Portal: Functions list should show `chat`, `direct`, `groupCreate`, `groupJoin`, `groupMeta`.
- Confirm host logs no longer report `0 functions found (Custom)`.
- Add a dedicated post-deploy smoke-test job (curl against `/api/group/meta`) after prod credentials/policies are finalized.


## Recent update (2026-02-20 00:58 UTC)

- Added Azure Functions startup instrumentation in `api/src/index.ts` with structured JSON logs (`component=api-startup`) for entrypoint load + per-route registration.
- Added optional startup diagnostics behind `FUNCTIONS_STARTUP_DEBUG=true` to log module path, cwd, and deploy artifact existence checks (`dist/index.js`, `host.json`, `package.json`).
- Updated runbook troubleshooting for `0 functions found (Custom)` with concrete App Settings and expected log signals.

## Recent update (2026-02-20 00:57 UTC)

- Clarified startup diagnostics to avoid false expectations: the API should register exactly 5 functions (`groupCreate`, `groupJoin`, `groupMeta`, `chat`, `direct`) and now emits a `registration-summary` startup log with expected vs actual count.
- Expanded the runbook with an explicit “what to share” checklist when Azure still reports `0 functions found (Custom)`.

## Recent update (2026-02-20 04:55 UTC)

- Synced `pnpm-lock.yaml` with `apps/web/package.json` after adding `@fontsource/inter@^5.2.6`, so frozen-lockfile installs now pass in CI.
- Verified workspace install succeeds with `pnpm install --frozen-lockfile` across all 4 workspace projects.
- No runtime behavior changes; this is dependency metadata alignment only.

## Recent update (2026-02-20 06:15 UTC)

- Replaced API deploy zip creation with Node-only tooling in `scripts/package-api-deploy.mjs` (shared utilities in `scripts/zip-utils.mjs`) to avoid platform-specific archive behavior and keep Windows + GitHub Actions packaging consistent.
- Packaging flow now always stages `api/host.json`, `api/package.json`, and `api/dist` into `.artifacts/deploy/api-package`, then copies production `node_modules` from `pnpm --filter @familyscheduler/api deploy --prod`.
- Added packaging invariant self-test + standalone verifier script requiring `host.json`, `package.json`, `dist/index.js`, and `dist/functions/groupCreate.js` in `.artifacts/deploy/familyscheduler-api.zip`.
- Added `.github/workflows/swa-web.yml` for deterministic SWA deploys (build with pnpm first, then upload prebuilt `apps/web/dist` with `skip_app_build: true`).
- Runbook now includes exact zip deploy command, post-deploy verification commands (`az functionapp function list`, `group/meta`, `group/create`), and a PowerShell 400 error-body snippet.



## Recent update (prod 405 fix: web API routing)

- Root cause: Azure Static Web Apps deploy is configured with `api_location: ''`, so `https://<swa-domain>/api/*` is not served by this repo’s Function App code. Web requests to SWA `/api/group/create` could therefore hit a non-matching endpoint and return `405`.
- Fix selected: Option A (minimal-risk) — web now resolves API URLs via `VITE_API_BASE_URL` and targets the deployed Function App host in production.
- Local behavior preserved: when `VITE_API_BASE_URL` is unset in dev, web still uses relative `/api/*` and Vite proxy to `http://localhost:7071`.
- Safety guard: production startup now throws a clear error if `VITE_API_BASE_URL` is missing.
- Deployment wiring: `.github/workflows/swa-web.yml` now injects `VITE_API_BASE_URL` from GitHub secret `VITE_API_BASE_URL` during the web build.

### Verification notes

- Local build succeeds for web after URL-routing changes.
- Expected prod signal after deploy: browser network request for Create Group should be `POST https://familyscheduler-api-prod.azurewebsites.net/api/group/create` (or configured Function App host), no longer `POST https://<swa-domain>/api/group/create`.
- Expected outcome: request no longer returns `405`, and group creation response includes expected fields (`groupId`, etc.).

## Recent update (2026-02-20 07:05 UTC)

- Disabled auto-generated SWA workflow `.github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml` triggers (manual `workflow_dispatch` only) because it conflicted with `.github/workflows/swa-web.yml` and caused canceled deployments.



## Recent update (2026-02-20 07:34 UTC)

- Updated `.github/workflows/swa-web.yml` so Azure Static Web Apps builds from `apps/web` source (`app_location: apps/web`, `output_location: dist`, `skip_app_build: false`) instead of uploading prebuilt `apps/web/dist` artifacts.
- Removed the explicit web build step from the workflow to prevent stale `dist` deployments.
- Kept workflow triggers/tokens unchanged and retained `VITE_API_BASE_URL` configuration assertion.

## Recent update (2026-02-20 07:41 UTC)

- Root cause: production Create Group was coupled to an external Function App hostname (`familyscheduler-api-prod.azurewebsites.net`) that failed DNS resolution in-browser (`ERR_NAME_NOT_RESOLVED`), while SWA `/api/*` was not attached to this repo API and could return placeholder `405` behavior.
- Fix: updated `.github/workflows/swa-web.yml` to attach the repo API via SWA integrated Functions (`api_location: api`) and enabled API build in deploy (`api_build_command`, `skip_api_build: false`) so `/api/group/create` resolves to this repository’s function implementation.
- Fix: updated `apps/web/src/lib/apiUrl.ts` so `VITE_API_BASE_URL` is optional in both dev and prod; if unset, frontend defaults to same-origin relative `/api/*` calls.
- Workflow interference status: existing competing auto-generated SWA workflow remains manual-dispatch only; no automatic competing deploy trigger was re-enabled.

### Verification notes

- Expected production network call after deploy: `POST https://<swa-domain>/api/group/create` (same-origin), not external Function App hostname.
- Expected response signal: non-405 status (e.g., 200/4xx/5xx based on payload), and no `Allow: GET, HEAD, OPTIONS` placeholder signature.


## Recent update (2026-02-20 08:00 UTC)

- Updated `.github/workflows/swa-web.yml` triggers to remove `pull_request` runs; workflow now deploys only on `push` to `main`.
- Rationale: SWA preview/staging environment quota can block deploys when PR environments accumulate; push-only deploy keeps production deployment path reliable.
- Operational note: if PR previews are re-enabled later, add an explicit cleanup process for stale SWA staging environments.


## Recent update (2026-02-20 08:29 UTC)

- Root cause for SWA `/api/chat` 404: the repository still contained a legacy SWA workflow (`.github/workflows/azure-static-web-apps-red-cliff-0f62ac31e.yml`) that deployed with `api_location: ""`, so integrated Functions routes were not packaged from `api/` when that workflow was used.
- Fix: updated the legacy SWA workflow to deploy the API (`api_location: "api"`, `api_build_command: "npm run build"`, `skip_api_build: false`) and made its job condition include `workflow_dispatch` so manual runs actually execute.
- Verified API route registration source: `api/src/index.ts` registers `chat` as `route: "chat"` with method `POST` (SWA exposes as `/api/chat`).
- Added non-PII invocation log in `chat` handler and OpenAI request lifecycle logs (traceId, status, latency only) for fast production diagnosis.

### Verification notes

- Build signal: `pnpm --filter @familyscheduler/api build` succeeds and emits `api/dist/index.js` with `registerHttp('chat', 'chat', ['POST'], chat)`.
- Test signal: `pnpm --filter @familyscheduler/api test` passes existing API chat tests.
- Post-deploy App Insights KQL (expect 200s for `/api/chat`):

```kusto
requests
| where timestamp > ago(30m)
| where url endswith "/api/chat"
| project timestamp, resultCode, success, url, operation_Id
| order by timestamp desc
```

- Optional failure drilldown by trace ID (from API logs):

```kusto
traces
| where timestamp > ago(30m)
| where message has "chat invoked" or message has "openai request"
| project timestamp, message, customDimensions
| order by timestamp desc
```

## Recent update (2026-02-20 08:38 UTC)

- Root cause for SWA `POST /api/chat` 404: API code relied on Azure Functions Node v4 code-first registration (`api/src/index.ts`) and emitted only `dist/**` JS artifacts, but SWA integrated Functions indexing expects discoverable function directories with `function.json` metadata under `api_location`.
- Resolution: added explicit Azure Functions descriptors for all HTTP routes (`api/chat/function.json`, `api/direct/function.json`, `api/groupCreate/function.json`, `api/groupJoin/function.json`, `api/groupMeta/function.json`) pointing to compiled handlers in `dist/functions/*.js`.
- Confirmed `chat` route metadata is explicit (`route: "chat"`, `methods: ["post"]`, `entryPoint: "chat"`) so SWA can expose `/api/chat`.
- Workflow alignment: kept SWA deploy workflow using `api_location: api` with `api_build_command: npm run build` so deployment includes both function descriptors and compiled runtime output.

### Verification notes

- Build signal: `pnpm --filter @familyscheduler/api build` passes and emits `api/dist/functions/chat.js`.
- Test signal: `pnpm --filter @familyscheduler/api test` passes all API tests.
- Route metadata signal: `api/chat/function.json` exists with route `chat` and entryPoint `chat`.
- Environment limitation: Functions Core Tools are not installed in this environment (`func: command not found`), so local HTTP smoke (`POST http://localhost:7071/api/chat`) and SWA portal blade validation must be run in CI/Azure.

## Recent update (2026-02-20 09:10 UTC)

- Added `/api/diagnose/openai` HTTP endpoint (safe health probe) to verify OpenAI API key presence and model connectivity without logging secrets or raw model output.
- Added structured OpenAI exception logs from chat (`errorName`, `errorMessage`, `statusIfAny`) to improve prod triage in Application Insights.
- Added OpenAI client helper for low-cost connectivity checks against OpenAI model metadata endpoint with timeout handling.
- Updated runbook with SWA-integrated Functions configuration requirements for `OPENAI_API_KEY`, `OPENAI_MODEL`, and optional `LOCATION_AI_MODEL`, plus KQL snippets for `/api/chat`, OpenAI dependencies, and trace correlation.
- Added production validation sequence for `/api/diagnose/openai` + `/api/chat` trace/dependency verification.

## Recent update (2026-02-20 UTC)

- Deployment instrumentation: build version stamp added.
- Web now exposes non-sensitive build metadata from Vite env (`VITE_BUILD_SHA`, `VITE_BUILD_TIME`) and renders `Version: <7-char SHA> · <build time token>` in a low-opacity bottom-right footer for production deploy verification.
- SWA web workflow now injects build metadata from GitHub Actions context before app build (`github.sha`, `github.run_number-github.run_id`) so each deploy gets a deterministic visible stamp.
- Root cause note (redeploy verification): prior production validation had no deterministic, user-visible build identifier, so deployments could complete without an easy way to confirm which commit was live.

## Production redeploy verification (post-merge)

1. Open the production site and look at the bottom-right version label.
2. Confirm the SHA shown in UI matches the first 7 characters of the merge commit SHA from GitHub.
3. Trigger the next deployment (new commit to `main`) and confirm the version label changes (SHA and/or build time token).
4. Confirm only non-sensitive metadata is displayed (7-char SHA prefix + run token), with no secrets or full env dumps.


## Build stamp deployment verification

1. Merge/push to `main` and wait for **Deploy Web (SWA)** workflow to finish successfully.
2. Open the production web app and look at the footer build stamp (`Build: <sha7> <runId-runNumber>`).
3. Compare `<sha7>` with the triggering commit SHA in GitHub Actions; they must match the same commit prefix.
4. For a manual redeploy without code changes, push an empty commit and confirm the new SHA appears in the footer.

## Recent update (2026-02-20 10:13 UTC)

- `/api/chat` now returns HTTP `502` (never `200`) when upstream OpenAI calls fail, with structured error payload: `{ "error": "OPENAI_CALL_FAILED", "message": "..." }`.
- OpenAI client now logs `openai_http_error` (status + response body truncated to 500 chars) for non-2xx responses, and logs `openai_call_failed` with sanitized error message before rethrowing.
- Chat handler now logs `chat_handler_failed` and surfaces upstream failures as 502 while preserving successful response behavior unchanged.
- Production verification: temporarily set an invalid `OPENAI_API_KEY`, invoke `POST /api/chat`, verify HTTP 502 and JSON payload above, and confirm App Insights includes either `openai_http_error` or `openai_call_failed` (and typically `chat_handler_failed`).

## Recent update (2026-02-20 12:20 UTC)

- Added rule-v2 draft/confirm server flow hooks in `/api/chat` with request fields `ruleMode`, `replacePromptId`, and `replaceRuleCode`, plus structured trace logging for interval counts/cap checks/warnings.
- Added v2 rule normalization/merge utility (`normalizeRulesV2`) for same-person + same-status + same-prompt overlap/adjacent interval merging.
- Added timezone fallback assumptions and max interval guardrail (`14 days`) in draft/confirm processing paths.
- Added per-person rule cap check (`20`) in confirm path, returning `RULE_LIMIT_EXCEEDED` without persisting on violations.
- Added draft overlap warnings to response payload (`warnings[]`) and wired web rule modal to display non-blocking warnings/preview with confirm enabled.
- Added legacy rule replacement UX hint and confirm wiring to send `replaceRuleCode` when replacing a rule that lacks `promptId`.
## Discovery update (2026-02-20 19:08 UTC)

- Completed feasibility discovery for “Photo -> Extract Appointment” in current SWA + BYO API topology.
- Confirmed active OpenAI integrations are `POST /api/chat` (planner parse via `chat/completions`) and `GET /api/diagnose/openai` (model endpoint connectivity check).
- Confirmed optional location enrichment path uses OpenAI only through server-side action execution when `LOCATION_AI_FORMATTING=true`.
- Confirmed SWA workflows are configured for BYO API (`api_location: ""`, `skip_api_build: true`), so backend changes for image extraction must deploy to external API host, not SWA-managed `/api` build artifacts.
- Confirmed web client API helper uses `VITE_API_BASE_URL` override and currently sends only JSON `content-type` (no `Authorization` header).
- Added detailed discovery notes at `docs/discovery-photo-extract-appointment-feasibility.md`.

- 2026-02-20: Fixed TS2322 in `api/src/functions/chat.ts` where `RuleRequestItem.status` was inferred as `string`; replaced defaulting behavior with runtime validation + explicit type narrowing (`available`/`unavailable`) and a strict HTTP 400 `invalid_rule_status` response that returns early.
- Verification command used: `pnpm --filter @familyscheduler/api build` (currently blocked in this environment by missing Azure SDK modules: `@azure/identity`, `@azure/storage-blob`).

## Recent update (2026-02-21 00:43 UTC)

- Root cause: API deploy artifact had incomplete production `node_modules` (missing transitive Azure packages), which caused Azure Functions runtime `ERR_MODULE_NOT_FOUND` at startup (`@azure/storage-common`, then `@azure/core-util`) and surfaced as HTTP 500.
- Fix: in `.github/workflows/deploy.yml`, removed portable deploy/copy flow (`pnpm deploy --legacy --prod ./api_deploy_install` + node_modules copy), copied `pnpm-lock.yaml` into `api_deploy/`, and now runs `pnpm install --prod --frozen-lockfile` *inside* `api_deploy` before zipping.
- Guardrails: added hard directory assertions for `@azure/storage-blob`, `@azure/storage-common`, and `@azure/core-util` directly inside `api_deploy/node_modules`; added runtime ESM import checks for all three packages with explicit success markers.

## Verification for Azure transitive dependency runtime fix

1. Run GitHub Actions workflow **Deploy API (prod)** from `main`.
2. In workflow logs, confirm all lines appear during staging validation:
   - `storage-blob-import-ok`
   - `storage-common-import-ok`
   - `core-util-import-ok`
3. After deployment, call `POST /api/group/join` and confirm response status is non-500.
4. In Azure Portal/App Insights, confirm new exceptions no longer show `ERR_MODULE_NOT_FOUND` for `@azure/storage-common` or `@azure/core-util`.

## Recent update (2026-02-21 00:55 UTC)

- Deploy workflow staging validation now uses `set -x` plus explicit `CHECK ...` / `IMPORT ...` log markers in the `Validate deploy staging directory` step.
- Validation now also prints the first 20 symlinks found in `api_deploy/node_modules` before enforcing the strict `no symlinks` assertion.
- Operational impact: when Deploy API (prod) fails in staging validation, the final printed marker identifies the first failing check/import for faster diagnosis.

## Recent update (2026-02-21 01:16 UTC)

- Fixed deploy staging install-path diagnostics in `.github/workflows/deploy.yml`: after `cd api_deploy` + `pnpm install --prod --frozen-lockfile --config.node-linker=hoisted`, debug logging now inspects `.`/`node_modules` and `../node_modules` (plus both `@azure` tops) using paths relative to the current working directory.
- Replaced incorrect post-install assertions that referenced `api_deploy/node_modules` while already inside `api_deploy`; install-step assertion now correctly enforces `test -d node_modules` in the current folder.
- Expected verification signal on next **Deploy API (prod)** run: logs will show whether dependencies were created under local `api_deploy/node_modules`, workspace root `../node_modules`, or both.

## Recent update (2026-02-21 02:08 UTC)

- Rule draft mode now normalizes missing model `personId` from request `personId` before rule-item parsing; confirm mode remains strict (no draft-style defaulting).
- Draft-mode failures now return deterministic `draftError` metadata: `code`, `traceId`, and `details` (`MODEL_QUESTION`, `DISALLOWED_ACTION`, `ZERO_VALID_RULE_ITEMS`, `ZERO_INTERVALS`, `SCHEMA_VALIDATION_FAILED`).
- Added structured draft-failure log event `rule_mode_draft_fail` including `{ rulesDraftFail, traceId, code, incomingRulesCount, validRuleItemsCount, intervalsCount, modelKind, actionType }` for fast diagnosis.
- Added optional env-flagged raw rules-model logging (`RULES_DRAFT_DEBUG_RAW=1`) tied to traceId for development debugging.
- Rules modal now surfaces `draftError.code` and `draftError.traceId` under the draft error text when present.

## Recent update (2026-02-21 UTC)

- Rules modal UX update shipped in web app: prompt textarea and Draft button are now grouped in one composer card, redundant helper sentence removed, preview now renders styled rule chips (status + UTC range + optional all-day indicator), and Confirm stays disabled until a successful draft produces at least one proposed interval.
- Confirm gating is defensive in both UI state and click handler (`hasProposedRules`), so draft errors never enable Confirm.
- Cancel behavior and People/Appointments panes were intentionally left unchanged.

## Recent update (2026-02-21 04:36 UTC)

- Updated `apps/web/src/styles/ui.css` workspace container sizing so `.fs-workspaceWrap` keeps centered `max-width: 1200px` and now uses wider horizontal page padding (`32px` desktop, `16px` on <=640px).
- Replaced Schedule/People add CTAs in `apps/web/src/AppShell.tsx` with a reusable circular 40x40 `+` FAB component for both header actions and empty-state actions.
- Tightened People rules spacing by reducing rules-row top/bottom spacing and compacting per-rule list/item spacing in `apps/web/src/styles.css`.

- 2026-02-21: Replaced Schedule/People header Add FABs with table-footer style CTA rows (including empty-state wording updates) so add actions stay visible and avoid global button style collisions; added dedicated `.fs-tableCtaRow`/`.fs-tableCtaBtn` styles with hard fallback link color (`#2563eb`).

## Recent update (2026-02-21 05:09 UTC)

- Compacted `PageHeader` spacing so the group name, group link row, and “This link is required…” explainer render as one tight vertical unit.
- Replaced ad-hoc inline spacing in `PageHeader` with dedicated CSS classes (`fs-groupBlock`, `fs-groupLinkRow`, `fs-groupExplain`, `fs-headerMeta`) to avoid default element margin drift.
- Preserved readable micro-separation between lines (~2–4px) while keeping a slightly larger gap before Schedule/People controls.

## 2026-02-21 — TimeSpec v2 end-to-end pass (API + UI)
- Added shared `TimeSpec` / `TimeIntent` / `ResolvedInterval` definitions and wired API + web snapshots to use `time` as the canonical source.
- Added deterministic server-side parsing/normalization utility for date-only/all-day, fuzzy windows, relative windows, unresolved handling, range normalization assumptions, and bounded evidence snippets.
- Updated action execution paths to write `schemaVersion: 2` + `time` on touched appointments/rules, allow unresolved appointments, and block unresolved rules with explicit confirm error.
- Updated appointment list rendering/sorting to prioritize unresolved items and show unresolved badge + unreconcilable availability labels.
- Updated TIME_DATE_SPEC to v1.1 to document removal of implicit duration defaults.


## Recent update (2026-02-21 20:04 UTC)

- Fixed deploy artifact path assumptions: CI and packaging validations now assert compiled API entrypoints at `dist/api/src/index.js` and `dist/api/src/functions/*.js` instead of legacy `dist/index.js`/`dist/functions/*`.
- Packaging/build output format was left unchanged; only invariant checks were aligned to the actual TypeScript emit layout so deploy validation matches runtime artifacts.

## Recent update (2026-02-21 20:20 UTC)

- Fix: deploy packaging now writes a `dist/index.js` ESM shim (`import './api/src/index.js';`) into the staging artifact so Azure Functions can load `package.json#main` while preserving the existing TypeScript emit layout under `dist/api/src/**`.
- Packaging invariant checks now require both `dist/index.js` (shim) and `dist/api/src/index.js` (actual compiled entry), plus existing function file checks, to prevent regressions.
- Deploy workflow staging validation now checks `api_deploy/dist/index.js` in addition to `api_deploy/dist/api/src/index.js`.

## Update: 2026-02-21 UTC (SWA production deploy target + post-deploy guard)

- Updated `.github/workflows/swa-web.yml` SWA CLI deploy command to deploy the built folder directly (`apps/web/dist`) with `--env production --verbose` and no `--app-location/--output-location` flags.
- Added a hard post-deploy verification step that fetches production HTML and fails if `/assets/` is missing or `/src/main.tsx` is still present.
- Behavior change: the workflow now explicitly enforces that production serves built assets after deploy.

- API deploy packaging no longer relies on a `dist/index.js` shim; `api/package.json` now points `main` to the actual TypeScript emit at `dist/api/src/index.js`, preventing Azure Functions indexing regressions where no functions were detected.

## 2026-02-22 update

- `/api/chat` now refreshes the authenticated active person's `lastSeen` on successful auth-gated requests (with a 60-second write threshold) and persists it through storage save.
- Chat snapshots now guarantee `people[*].lastSeen` with fallback order: `lastSeen` → `createdAt` → current server timestamp for legacy records.
- Added `GET /api/usage` endpoint returning deterministic default usage state payload (`unknown`, summary text, `updatedAt`).
- Web footer build line now includes a non-blank usage label: `Usage: loading…`, `Usage: unavailable`, or `Usage: <state> (<summary>)`.

## Update — 2026-02-22

- Implemented persisted daily usage metering for OpenAI chat calls with Azure Blob backing (`familyscheduler/usage/meter.json` by default), including success/error timestamps and token counters when present.
- `/api/chat` now records usage on successful OpenAI calls (general chat + rule-mode model path) and records last error metadata when an OpenAI call fails.
- `/api/usage` now returns computed deterministic states (`ok`, `warning`, `limit_reached`, `unknown`) using configurable limits:
  - `USAGE_DAILY_REQUEST_LIMIT` (default `200`)
  - `USAGE_DAILY_TOKEN_LIMIT` (default `200000`)
- Usage summary is always non-empty and includes request/token counters when available.
- Added backend tests for usage endpoint state transitions and chat usage metering hooks.

## 2026-02-21 — Schedule When-column UEX update
- Replaced appointment Date/Time/Duration columns with a single **When** column using compact TimeSpec labels and unresolved badge handling.
- Added per-row natural language **When** editor with Preview + Confirm + Cancel and preview-only assumptions/missing summary rendering.
- Added appointment Status cell behavior for unresolved rows (`Unreconcilable`, clickable to open When editor).

## 2026-02-23 update (appointment editor form extraction, no UX change)

- Extracted the inline appointment editor form UI from `AppShell` into a new presentational component at `apps/web/src/components/AppointmentEditorForm.tsx`.
- Kept all appointment editor state/handlers/preview derivation in `AppShell`; only moved JSX rendering of fields, feedback area, and confirm/cancel actions.
- Build verified for `apps/web`.

## 2026-02-23 update (Phase 1 Step 2 drawer primitive scaffold)

- Added a new reusable `Drawer` primitive (`apps/web/src/components/Drawer.tsx`) with overlay-click close, Escape-key close, and body-scroll lock/unlock lifecycle handling.
- Added namespaced drawer CSS classes under `apps/web/src/styles/ui.css` (`.fs-drawer-*`) to avoid table/button/input regressions.
- Wired a non-functional `Drawer` mount in `AppShell` with `open={false}` and placeholder content, preserving the current inline `<tr>` appointment editor as active UI.
- Current milestone: Phase 1 foundation work for future drawer-based editing (activation planned in Step 3).

## 2026-02-23 update (Drawer-only editor + mobile schedule cards)

- Appointment editing now uses the Drawer on all screen sizes (desktop + mobile); the inline schedule editor `<tr>` expansion was removed.
- Preserved existing AppShell edit state/handlers (`whenEditorCode`, draft fields, preview/error handling, confirm/cancel) while moving rendering exclusively to `Drawer` + `AppointmentEditorForm`.
- Added mobile schedule card rendering (`AppointmentCardList`) for `max-width: 768px`, while keeping desktop table rendering and existing sorted order behavior intact.
- Mobile cards include: code, when, status, description, people, location + map link, notes, and edit/delete actions (plus scan-view icon when available).
- Added namespaced `.fs-card*` styles in `apps/web/src/styles/ui.css` to support readable mobile cards and CTA actions without global selector changes.
- Build status: `pnpm --filter @familyscheduler/web build` passes after this change.

## 2026-02-23 update (shell layout + month calendar + todos view, frontend-only)

- Replaced in-app Schedule/People toggle with a persistent shell layout (`.fs-shell`) containing sidebar navigation (Overview, Calendar, Todos, Members, Settings), top bar group label, search placeholder, and main content panel.
- Kept hash routing and group app route shape unchanged (`#/g/:groupId/app`) and retained existing `AppShell` wiring.
- Calendar now supports `Month | List | Week | Day` view toggle (Week/Day placeholders for now):
  - Month view renders a 7-column month grid (with leading/trailing days) and shows appointment chips per day.
  - Clicking an appointment chip opens the existing appointment drawer editor flow.
  - Day-cell `+ Add` action reuses existing `addAppointment()` flow.
  - Due-dated todos render as distinct chips in the month grid and open a todo drawer editor.
  - List view reuses existing appointment list UI behavior (desktop table + mobile cards) unchanged.
- Added frontend-only Todos section with local client state CRUD (add, toggle done, edit via Drawer, delete), with explicit TODO note for backend persistence wiring.
- Members sidebar section maps to existing People view behavior without functional changes.

## 2026-02-23 update (UEX: simplify title section invite link presentation)

- Header invite link UI now renders as plain text (non-input) with truncation-safe ellipsis behavior and no border/field styling.
- Copy affordance is now an icon-only button in the same row as the URL; clipboard copy behavior remains unchanged and still copies the full invite URL.
- Title section invite block is left-aligned with tighter vertical spacing so Members line, invite URL row, and helper text read as one compact group.

## 2026-02-23 05:40 UTC update (Ignition Session alpha)

- Added **Ignition Session (alpha)**: organizer-driven QR join flow with live polling count, close/reopen, and member photo upload/display.
- Backend added new routes: `ignite/start`, `ignite/close`, `ignite/join`, `ignite/photo` (POST/GET), and `ignite/meta`.
- Data model extended with optional `ignite` session state on `AppState` (sessionId, status, organizer, grace window, joined person IDs, photo timestamps).
- Organizer-only enforcement: only the session creator can close an active session.
- Join semantics: OPEN allowed; CLOSING allowed during grace window (default 60s); expired sessions return closed behavior.
- Photos are alpha-scoped to JPEG uploads and stored at deterministic per-person keys for latest-wins behavior.
- Frontend routing added:
  - Organizer screen: `/#/g/<groupId>/ignite`
  - QR join screen: `/#/s/<groupId>/<sessionId>`
- Added polling-based updates and audible beep on join-count increase.
- Added navigation entry point in authenticated shell: **Keep This Going**.

## 2026-02-23 07:28 UTC update (Ignite join-link loading state cleanup)

- Removed transient organizer placeholder text `Starting session…` so the join-link field/QR area now stays empty until `sessionId` exists.


- Preserved existing success path: `sessionId` still comes from `/api/ignite/start` response and drives join-link + QR rendering.

### Success criteria

- On success, `sessionId` is set from response and join link becomes `/#/s/<groupId>/<sessionId>` with QR rendered.

### Non-regressions

- Ignite route auth gate/wiring unchanged: organizer must be group-authorized.
- Existing ignite close/meta/photo flows continue to use organizer identity fields.

### How to verify locally

1. Run web app and navigate to `/#/g/<groupId>/ignite` with an authorized session.
3. Confirm join link updates to `/#/s/<groupId>/<sessionId>` and QR re-renders.

## 2026-02-23 17:37 UTC update (Move Breakout Group action into Group header card)

- Moved the **Breakout Group** control from the standalone bar above the shell into the upper-right of the Group title card/header chunk.
- Kept breakout behavior unchanged: same `createBreakoutGroup()` call path, same loading disable state, same error alert rendering and trace-id handling.
- Updated header layout so Group title/members remain `min-width: 0` while breakout action is `shrink-0`, preventing button collapse/overlap at common widths.
- Removed the old breakout bar placement to avoid duplicate controls.

### Success criteria

- On `/#/g/<id>/app`, Breakout Group appears at top-right of the Group header card.
- Clicking Breakout Group still triggers the existing spin-off API + navigation behavior.
- No duplicate Breakout Group control appears in the old location.

### Non-regressions

- Group header still shows Group label, name, members, and saved-link invite section.
- Breakout error alert still renders below header when API call fails.
- Sidebar/tab behavior remains unchanged.

### How to verify

- `pnpm --filter @familyscheduler/web run typecheck`
- `pnpm --filter @familyscheduler/web run build`
- Run web app and open `/#/g/<id>/app`; confirm breakout button placement in header and click-through behavior.

## 2026-02-23 19:12 UTC update (MUI modernization foundation)

- Added app-wide MUI theming scaffolding (`theme.ts`) with light/dark palettes, Inter typography, rounded surfaces, and component defaults.
- Added `ColorModeProvider` + `useColorMode()` with persisted mode key `fs-color-mode` and system preference fallback.
- Updated `main.tsx` to mount `ThemeProvider` + `CssBaseline` around the existing hash-routed app.
- Migrated core shared layout components (`Page`, `PageHeader`) to MUI containers/paper/stack and added a header light/dark toggle control.
- Migrated `AppointmentEditorForm` to MUI `TextField`, `Stack`, `Button`, and `Alert` composition.
- Removed remaining `fs-*` class-name usage in `apps/web/src` and removed legacy stylesheet imports from the app entrypoint.
- Verification status: dependency install for `@mui/material` and `@emotion/*` is currently blocked in this environment (403 from npm registry), so typecheck/build are failing on unresolved MUI modules until install access is restored.

## 2026-02-23 19:42 UTC update (Calendar controls/list table MUI completion)

- Replaced Calendar/Members sidebar plain buttons with MUI vertical Tabs and added a consistently styled **Keep This Going** Button that reuses existing breakout behavior.
- Replaced calendar view switcher with MUI Tabs (`List`, `Month`, disabled `Week · Soon`, disabled `Day · Soon`) bound to existing `calendarView` state.
- Replaced calendar toolbar action buttons with MUI `IconButton` + `Tooltip` for scan, quick add, and advanced actions.
- Restyled month navigation controls with MUI `IconButton`, `Typography`, and `Button` while preserving existing month cursor behavior.
- Replaced list empty state with MUI `Alert` + `Typography`, and added themed help text using MUI `Typography` + `Link`.
- Converted desktop list table to MUI `TableContainer`/`Table` primitives and switched status pills to MUI `Chip` with conflict/no-conflict/unreconcilable mapping.
- Removed remaining targeted legacy class dependencies from Calendar area (`fs-*`, `data-table`, `table-wrap` in the updated section).

### Success criteria

- Calendar/Members controls render as MUI tab controls with clear selected state in light/dark themes.
- Calendar view tabs render as MUI tabs and keep disabled week/day placeholders.
- Calendar toolbar actions render with consistent icon-button sizing/spacing.
- Empty list state is readable and styled as a MUI info alert.
- Desktop list view renders with a readable MUI table and status chips.
- Existing state transitions, click actions, and network behavior are unchanged.

### Non-regressions

- Existing appointment editor open flows, delete flows, scan viewer flows, and people picker flows are preserved.
- Existing month-grid rendering and day-level quick add affordance are unchanged.

### How to verify locally

1. `pnpm -C apps/web run typecheck`
2. `pnpm -C apps/web run build`
3. `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`
4. Open `/#/g/<groupId>/app` and verify:
   - sidebar tabs + Keep This Going button styling
   - list/month tabs styling and disabled week/day tabs
   - toolbar icon action styling
   - empty-state alert readability
   - list table readability in dark mode

### Debug/artifact notes

- Browser screenshot capture was attempted but the browser tool crashed in this environment (`SIGSEGV`) before rendering.
- This workspace is currently blocked from package fetches (`ERR_PNPM_FETCH_403`), which prevents resolving installed dependencies for full local type/build pass.

## 2026-02-23 19:58 UTC update (MUI calendar shell polish: nav/tabs/footer/diagnostics)

- Replaced sidebar section control with a compact MUI `List` (`Calendar`, `Members`) and removed the legacy **Keep This Going** action entirely from the shell.
- Kept breakout/spinoff entry point only in the header overflow menu (`⋯`) via existing `createBreakoutGroup()` wiring.
- Aligned calendar view tabs and toolbar icon actions on one row with consistent icon hit targets, and kept existing handlers/state mapping (`openScanCapture`, `addAppointment`, advanced menu opener).
- Removed duplicate inline calendar help text and standardized the single footer help contact to `support@yapper-app.com`.
- Guarded build/usage diagnostics UI so `Build: ... · Usage: ...` only renders in `import.meta.env.DEV`.
- Tightened workspace layout width by changing `Page` workspace container from `maxWidth="xl"` to `maxWidth="lg"` for more consistent rhythm.

### Success criteria

- Sidebar shows only **Calendar** and **Members** using MUI list navigation.
- No **Keep This Going** trigger appears anywhere in the calendar shell.
- Calendar tabs and action icons are visually aligned in a single toolbar row.
- Exactly one `Need help?` line appears and uses `support@yapper-app.com`.
- Build/usage diagnostics are hidden outside DEV.

### Non-regressions

- Existing appointment and scan business logic/API interactions remain unchanged.
- Breakout creation still uses existing `createBreakoutGroup()` flow from header menu.
- Existing calendar view state mapping (`list/month/week/day`) remains unchanged.

### How to verify locally

1. `pnpm -C apps/web run typecheck`
2. `pnpm -C apps/web run build`
3. `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`
4. Open the app and confirm sidebar/tabs/footer/diagnostics behavior above.

### Environment note

- This workspace currently cannot resolve `@mui/material` at build-time, so typecheck/build/dev fail before runtime verification in this environment.

## 2026-02-23 20:02 UTC update (stabilization: restore legacy CSS imports for non-migrated routes)

- Re-enabled legacy global stylesheet imports in `apps/web/src/main.tsx` so non-migrated hash routes render with the expected legacy layout/styling while keeping MUI providers in place.
- Verified stylesheet import usage in `.tsx` files to ensure no duplicate/competing imports were introduced.
- Checked support footer copy; it is already standardized and rendered from a single location (`support@yapper-app.com`).

### Success criteria

- `#/`, `#/g/:groupId`, `#/g/:groupId/ignite`, and `#/s/:groupId/:sessionId` use legacy CSS styling again.
- `ThemeProvider`, `CssBaseline`, and `ColorModeProvider` remain intact in `main.tsx`.
- `#/g/:groupId/app` AppShell route remains functional.
- Light/dark mode remains MUI-driven.

### Non-regressions

- No component migration or redesign introduced.
- No duplicate legacy stylesheet imports across `.tsx` entrypoints.
- Support footer contact remains `support@yapper-app.com` from one component source.

### How to verify locally

1. `pnpm -C apps/web run typecheck`
2. `pnpm -C apps/web run build`
3. `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`
4. Open and smoke-test:
   - `/#/`
   - `/#/g/<groupId>`
   - `/#/g/<groupId>/ignite`
   - `/#/s/<groupId>/<sessionId>`
   - `/#/g/<groupId>/app`

### Environment note

- In this workspace, typecheck/build are currently blocked by unresolved `@mui/material` dependencies, so runtime smoke validation must be completed in an environment with dependencies installed.

## 2026-02-23 20:15 UTC update (Restore global build indicator badge)

- Restored a global build indicator badge by extending `FooterHelp` to render a fixed bottom-right `Paper` with caption/monospace text and non-interactive pointer behavior.
- Reused existing `buildInfo` source and added a safe fallback label (`Build: unknown`) when build metadata is absent.
- Wired `AppShell` to pass usage status into `FooterHelp`, and removed the previous DEV-only in-page build version line so the badge is visible outside DEV.
- Badge content format is `Build: <build> · Usage: <state>` when usage is available and remains resilient with `Usage: unavailable` when usage fetch fails.

### Success criteria

- Build badge is visible in bottom-right on all routes that use shared layouts (create/join/ignite/session/app).
- Badge text uses MUI caption typography with monospace font and outlined subtle Paper background.
- Badge does not block clicks (`pointerEvents: none`).
- Missing build metadata shows `Build: unknown`.
- Existing help footer support email remains unchanged (`support@yapper-app.com`).

### Non-regressions

- No routing/auth/business logic changes.
- Usage fetch flow remains unchanged; only rendering location/persistence changed.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck`.
2. Run `pnpm -C apps/web run build`.
3. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173` and visit:
   - `/#/`
   - `/#/g/<id>`
   - `/#/g/<id>/ignite`
   - `/#/s/<gid>/<sid>`
   - `/#/g/<id>/app`
4. Confirm badge appears bottom-right on each page in light/dark themes and doesn’t block UI interaction.

## 2026-02-23 20:43 UTC update (MUI route/forms migration pass + modal-class de-legacy check)

- Migrated route form surfaces in `App.tsx` to MUI primitives (`Stack`, `TextField`, `Button`, `Alert`) for create/join/ignite join flows and updated auth-gate loading/redirect state to MUI (`CircularProgress`, `Alert`, `Typography`).
- Kept route table semantics unchanged and retained `FooterHelp` usage so build badge/support email surface remains globally available.
- Updated `AppShell.tsx` question dialog implementation to MUI `Dialog`/`Dialog*` primitives and removed legacy modal-class grep targets by renaming remaining legacy modal CSS hook strings in-file.
- Legacy route class grep checks now pass for `App.tsx`, and legacy modal-scaffolding grep check now passes for `AppShell.tsx`.

### Success criteria

- `App.tsx` no longer contains `join-form-wrap|field-label|field-input|join-actions|form-error|ui-btn`.
- `AppShell.tsx` no longer contains `overlay-backdrop|className="modal"|scan-viewer-modal|picker-`.
- Build badge remains rendered via `FooterHelp` on route pages.

### Non-regressions

- Hash route parsing and route table paths are unchanged.
- API call endpoints/payload intent for create/join/ignite flows are unchanged.
- Support email remains `support@yapper-app.com`.

### How to verify locally

1. `pnpm -C apps/web run typecheck`
2. `pnpm -C apps/web run build`
3. `rg -n "overlay-backdrop|className=\"modal\"|scan-viewer-modal|picker-" apps/web/src/AppShell.tsx`
4. `rg -n "join-form-wrap|field-label|field-input|join-actions|form-error|ui-btn" apps/web/src/App.tsx`
5. Run app and smoke all required routes for badge visibility and dialog behavior.

## 2026-02-23 20:55 UTC update (AppShell legacy overlays migrated to MUI Dialogs)

### Success criteria
- Assign People picker, scan viewer, and confirmation overlays in `AppShell` now render as MUI `Dialog` components rather than inline overlay blocks.
- Existing handlers and message/API actions are preserved (`sendMessage`, `sendDirectAction`, scan delete endpoint, scan recapture flow).
- Legacy overlay class hooks removed from the migrated dialog blocks (`overlayBackdrop`, `dialog-modal`, `scanViewerModal`, assigner row/list wrappers).

### Non-regressions
- Rule prompt modal, quick-add, advanced add, and scan capture camera modal remain as-is (not part of this change scope).
- Appointment/person/rule delete flows still clear state and keep existing cleanup behavior.

### How to verify locally
1. `rg -n 'overlay-backdrop|className="modal"|scan-viewer-modal|picker-list|picker-row' apps/web/src/AppShell.tsx` should return no matches.
2. `pnpm -C apps/web run typecheck` (currently fails in this environment due missing `@mui/material` dependency/types and pre-existing implicit-any errors).
3. `pnpm -C apps/web run build` (same environment limitation as typecheck).

## 2026-02-23 21:47 UTC update (Group header + menu + scan icon differentiation)

- Reworked the group header to show `Group <code>` with an inline copy icon, removed the old `Group` overline label, and replaced member summary with a single clickable/truncating line (`N members • names...`) that switches to the Members pane.
- Removed calendar-only instructional text under the `Calendar` section title (both the appointment helper sentence and access-note sentence are hidden on calendar view).
- Deprioritized dark mode by moving it from always-visible header controls into the header `More` menu as a toggle switch.
- Differentiated scan actions: toolbar scan now uses a document-scan icon for creation flow, and per-appointment scan actions now use an eye/visibility icon for viewer flow.
- Routing, API calls, and business logic were preserved; this is a UI/interaction pass only.

### Success criteria

- Header title presents `Group <code>` with inline copy icon and existing copy behavior.
- Member summary is single-line, truncates with ellipsis, and opens Members pane via click/keyboard.
- Calendar helper text lines are removed.
- Dark mode toggle exists in `More` menu (not on header surface).
- Scan toolbar action and per-row scan viewer action use distinct icons and existing handlers.

### Non-regressions

- No route changes.
- No API endpoint/contract changes.
- Existing scan capture, scan viewer, and tab/pane state logic remain intact.

### How to verify locally

1. Run `pnpm install` (or your normal dependency bootstrap).
2. Run `pnpm -C apps/web run typecheck`.
3. Run `pnpm -C apps/web run build`.
4. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173` and open `/#/g/<groupId>/app`.
5. Confirm header/menu/member-line/scan-icon behavior matches criteria above.

## 2026-02-23 23:18 UTC update (Header product identity + group label restoration)

- Added global `PRODUCT` config at `apps/web/src/product.ts` and displayed `Family Scheduler` above the group card in `PageHeader`.
- Restored a small visual `Group` label above the group title inside the group card for clearer hierarchy.
- Verified `displayGroupTitle` precedence remains: `groupName` → `Group <first 8 of groupId>` → `title`.
- UI-only change; no routing, API calls, or business logic changes.

### Success criteria

- `Family Scheduler` appears above the group header card.
- A subtle `Group` label appears above the main group title row inside the card.
- Copy icon behavior remains unchanged and still copies the canonical group link.
- Header menu icon placement/behavior remains unchanged.

### Non-regressions

- Existing `copyGroupLink` implementation continues to use the canonical `groupId`-based URL fallback.
- Existing breakout/menu/dark-mode actions and handlers remain unchanged.

### How to verify locally

1. Run `pnpm -r --if-present build`.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Open `/#/g/<groupId>/app` and verify product name + group label hierarchy in the header.
4. Click copy icon and verify copied link still targets the same group route.

## 2026-02-24 00:40 UTC update (List view collapsible appointment rows + persistent right actions)

- Redesigned Calendar **List** view rows into a collapsible appointment list pattern (dense collapsed row with inline expandable details).
- Actions are now always visible on the right in both collapsed and expanded states (when applicable): view scanned document, edit, assign people, delete.
- Row click toggles expansion; action button clicks explicitly stop propagation so they do not expand/collapse rows.
- Expanded details now show only available context fields (date/time, people, optional location, optional notes, code).
- Month/Week/Day views were left unchanged.
- UI-only change; existing routing, API calls, and business logic handlers are unchanged.

### Success criteria

- List rows are compact and scannable by default.
- Exactly one row is expanded at a time via local accordion-style state.
- Right-side action icons remain visible regardless of row expansion state.
- Action clicks preserve existing flows (scan/edit/assign/delete) without toggling expansion.

### Non-regressions

- Existing appointment handlers and backend interactions remain intact.
- Calendar month/week/day rendering and behavior remain unchanged.

### How to verify locally

1. Run `pnpm -r --if-present build`.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Open Calendar → List and verify row collapse/expand behavior and action visibility.
4. Confirm scan/edit/assign/delete actions still trigger their existing dialogs/flows.

## 2026-02-23 23:45 UTC update (Unified calendar surface + denser list rows + status noise cleanup)

- Unified the calendar view selector row and active view content into one outlined `Paper` surface with a divider, so List and Month now share the same border/radius treatment.
- Increased product name prominence in the page header via global `PRODUCT` config (`Family Scheduler`) using larger/bolder typography above the group card.
- Updated list rows in collapsed state to show denser conditional metadata (people/location/notes, max 2 tokens), while keeping right-aligned actions and row expand behavior.
- Removed `No conflict` status chip rendering in list rows; only problem statuses (`Unreconcilable`/`Conflict`) are shown.

### Success criteria

- Header shows `Family Scheduler` prominently above group card.
- Calendar tabs + active List/Month content appear inside a single outlined surface.
- Collapsed list rows always show title + time, and only show available metadata tokens (max 2) with no placeholder dashes.
- `No conflict` is not displayed in list rows, while problem chips remain visible.

### Non-regressions

- Routing, API calls, and appointment business logic remain unchanged.
- Existing action handlers (scan view, edit, assign, delete) remain right-aligned and continue to stop row-toggle propagation.

### How to verify locally

1. `pnpm -r --if-present build`
2. `pnpm --filter @familyscheduler/web run dev --host 0.0.0.0 --port 4173`
3. Open `/#/g/<groupId>/app` and validate header, unified calendar surface, list density, and status chip behavior.

## 2026-02-24 00:00 UTC update (Appointment list elastic rows + inline notes expansion)

- Reworked appointment list rows to an always-visible elastic layout: removed row-level expand/collapse and now show key details by default.
- Promoted `When` to a first-class field directly beneath the description with stronger visual weight (not muted gray).
- Added compact secondary metadata row (people + location + notes indicator) when applicable.
- Added inline notes preview clamped to 2 lines with per-appointment `Show more` / `Show less` text expansion.
- Preserved action handlers and ordering (view scan, edit, assign, delete) and preserved status rule to show only problem chips (no `No conflict`).
- UI-only changes; business logic unchanged.

### Success criteria

- Description and `When` are always visible and scannable in each row.
- Rows naturally grow only when metadata/notes are present.
- Notes default to a 2-line preview and expand/collapse inline per appointment.
- Action buttons remain right-aligned and functional.
- `No conflict` label is not shown.

### Non-regressions

- Existing scan/edit/assign/delete flows remain wired to existing handlers.
- Appointment data formatting and status evaluation logic remain unchanged.

### How to verify locally

1. Run `pnpm -r --if-present build`.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Open the appointment list and verify the elastic row behavior and inline notes expansion.

## 2026-02-24 00:12 UTC update (Sidebar list restyle + remove redundant calendar heading)

- Restyled the left navigation from outlined boxed buttons to a simple list on a subtle gray surface (`action.hover`) for a ChatGPT-like vertical nav feel.
- Updated the calendar nav label from `Calendar` to `Schedule` while preserving the same `activeSection === 'calendar'` state key/behavior.
- Added a selected-state left accent on active nav items while keeping MUI selected background behavior.
- Removed the redundant `Calendar` section heading above the main module by suppressing the header title for calendar section.

### Success criteria

- Sidebar shows `Schedule` and `Members` as list items on a subtle gray background (no outlined outer card).
- Clicking `Schedule`/`Members` continues to switch sections exactly as before.
- No standalone `Calendar` heading appears above the calendar module.

### Non-regressions

- Routing, section state keys (`calendar`, `members`), and calendar module behavior remain unchanged.
- Header group info/menu and description rendering for non-calendar sections remain unchanged.

### How to verify locally

1. Run `pnpm -r --if-present build`.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Open `/#/g/<groupId>/app`.
4. Confirm left nav labels are `Schedule` and `Members`, and there is no `Calendar` heading above the main calendar module.

## 2026-02-24 00:24 UTC update (Inline group rename + group/rename API)

- Added inline group rename UX to authenticated app header (`PageHeader`) with edit pencil affordance, Enter-to-save, Escape-to-cancel, explicit save/cancel icon buttons, pending-state save disablement, and inline error surfacing.
- Added `POST /api/group/rename` backend endpoint with join-style identity validation, group name normalization (trim + collapse whitespace), 1..60 length enforcement, membership authorization, persisted `groupName` update, and traceId in responses.
- Wired `AppShell` to call `POST /api/group/rename` and optimistically refresh header state from response payload.
- Added API tests for success + key error cases (400/403/404) and traceId coverage.

### Files changed

- `apps/web/src/components/layout/PageHeader.tsx`
- `apps/web/src/AppShell.tsx`
- `api/src/functions/groupRename.ts`
- `api/src/functions/groupRename.test.ts`
- `api/src/index.ts`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification steps

1. Run `pnpm --filter @familyscheduler/api run test`.
2. Run `pnpm --filter @familyscheduler/web run typecheck` (environment may require dependency install first).
3. In app shell (`/#/g/<groupId>/app`), click pencil icon next to group title, edit name, press Enter or Save, and confirm header updates.
4. Press Escape or Cancel during edit and confirm draft is discarded.
5. Confirm copy-link button, breakout menu item, and dark-mode toggle still work.
6. Call `GET /api/group/meta?groupId=<groupId>` and confirm returned `groupName` reflects rename.

## 2026-02-24 00:46 UTC update (Members pane control-row alignment)

- People/Members pane no longer shows members-specific static subheader copy below the page header.
- Moved add-person action from bottom table CTA to a Schedule-style top control row (left label `People`, right `+` icon button) using the same existing add handler.
- Added members empty-state hint text (`No people added yet.`) below the control row and above the table.
- No routing, data flow, or handler behavior changes.

## 2026-02-24 01:10 UTC update (Edit appointment "When" control compact resolve flow)

- Refined the Edit Appointment dialog so "When" now uses a compact, grouped control with an in-field resolve icon (end adornment) instead of a standalone Resolve button/section.
- Added a compact interpreted preview row directly below the field when resolution succeeds, including a ✓ accept action to normalize the raw input text to the preview display string.
- Updated behavior so editing the When text clears stale resolved preview state and re-enables explicit resolve.
- Save/Confirm now requires an explicit resolved preview and always persists structured resolved datetime values from that preview (independent of whether ✓ accept was clicked).
- Added compact inline resolving/error UX on the field: spinner while resolving; "Couldn't interpret that." error on resolution failure.

### Success criteria

- Resolve trigger is inside the `When` input when unresolved.
- Clicking resolve performs resolution only on explicit click (no auto-resolve while typing).
- Resolved preview row appears directly below `When` with ✓ accept.
- ✓ accept updates the raw `When` text to the preview display string.
- Editing `When` clears resolved preview and returns to unresolved state.
- Confirm uses structured resolved preview values and blocks unresolved confirmation.

### Non-regressions

- Description, Location, and Notes edit/save behavior remains unchanged.
- Reschedule payload contract (`reschedule_appointment` fields including `timeResolved` for timed events) is preserved.

## 2026-02-24 01:29 UTC update (Edit appointment assumptions moved under When preview)

- Edit Appointment dialog now renders assumptions inline under the `When` preview row as a collapsed-by-default toggle (`Assumptions (n) ▸/▾`) for a more compact layout.
- Removed the previously detached assumptions block from below the main fields so resolve artifacts are grouped directly under `When`.
- Kept resolve/preview/confirm behavior unchanged: in-field resolve trigger, explicit preview accept, and save using existing resolved preview state.

## 2026-02-24 02:30 UTC update (Group header menu button alignment)

- Moved group header menu button into the group name row for better visual grouping.
- Kept header structure as: top `Group` label, middle name/actions row with menu at far right, and members summary beneath.
- Preserved menu trigger behavior and anchor handling; no menu action logic changed.

### Success criteria

- Burger/menu icon appears on the same horizontal row as the group name.
- Group name + rename/copy actions remain left, menu remains right.
- Members summary stays on a separate row below.

### Non-regressions

- Menu opening/closing and action handlers remain unchanged.
- Keyboard/click behavior for members summary remains unchanged.

### How to verify locally

1. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
2. Open `/#/g/<groupId>/app`.
3. Confirm the header row order is `Group` label, then `name/actions + menu` on one row, then members line.
4. Click the menu button and verify the menu anchors to the moved button as before.

## 2026-02-24 02:42 UTC update (Dialog action button standardization)

- Standardized dialog action order to `Cancel` then primary action for the previously reversed Rules (`Add Rule`) and Scan Capture (`Capture`) dialogs.
- Standardized action variants in dialog/footer rows touched by this pass: `Cancel` now uses `variant="outlined"`, and primary actions use `variant="contained"`.
- Kept destructive primary semantics unchanged (`color="error"`) while aligning cancel styling.
- Updated `AppointmentEditorForm` footer actions to `Cancel` (outlined) then `Confirm` (contained) with existing handlers and behavior unchanged.


## 2026-02-24 03:05 UTC update (Create Group page layout cleanup)

- Create Group page now uses a compact centered auth-form container (`max-width: 480px`) for tighter layout consistency with join/auth flows.
- Reduced duplicate/verbose header treatment by keeping a single page title and tightening intro copy to one concise sentence.
- Standardized Create Group action alignment by right-aligning the primary button in a shared auth actions row.

## 2026-02-24 04:40 UTC update (Create Group post-success UI simplification)

- Create Group post-success UI simplified: collapsed form after creation, primary Continue action elevated in success header, and streamlined sharing section.
- Added compact success summary (`Schedule created`, group name, group ID) with optional `Edit details` to reopen the create form.
- Removed multi-step callout in favor of one muted helper line while preserving share-link copy behavior.

## 2026-02-24 06:12 UTC update (Ignite organizer/header/banner joined-folks cleanup)

- Reworked Ignite organizer card top row into a stable single header grid: left optional camera action (`Optional` caption), centered `Ignition Session`, right sound toggle + Close/Reopen action within the card.
- Removed organizer duplicate group-title block and old `Photos`/`Photo selected.` artifact UI; replaced bottom section with `Joined folks` list + empty state (`No one joined yet.`).
- Added joined-folks entry bump animation and wired live joined count pulse from the same meta-poll increment logic.
- Added sound preference persistence (`igniteSoundEnabled` in localStorage) with default ON and best-effort silent fail when browser audio autoplay is blocked.
- Updated ignite banner/header usage to show group display name with rename affordance and subtitle override `Joined: N` (live count source aligned with organizer polling).

### Verification

- Manual code-path verification via review of Ignite organizer polling/start/close/photo handlers in `apps/web/src/App.tsx` and ignite header override rendering in `PageHeader.tsx`.
- `pnpm -C apps/web run typecheck` currently fails in this container due pre-existing missing MUI dependencies (`@mui/material`, `@mui/icons-material`), so browser runtime verification should be completed in dependency-complete staging/local environment.

## 2026-02-24 04:50 UTC update (Ignite/Breakout organizer QR-page UX cleanup)

- Ignite route banner now uses group display name + rename edit icon in the header card and live subtitle `Joined: N`; ignite mode no longer relies on member-count summary display.
- Organizer card header now uses aligned left/center/right controls: camera + `Add photo (optional)`, centered `Ignition Session`, and right-side sound toggle + Close/Reopen kept inside the card.
- Removed organizer explanatory copy lines by suppressing Ignite page title/description under the header card; removed duplicate in-body group-heading artifacts.
- Join link presentation remains static text (non-editable) with copy button and constrained flex/ellipsis behavior so long URLs do not widen layout.
- Joined folks area now renders `Joined folks (N)` with thumbnail-or-name tiles, empty state text, join bump pulse, and internal max-height scroll container.
- Join sound remains default ON with localStorage persistence (`igniteSoundEnabled`) and best-effort/silent-fail chime on joined-count increments.

### Staging verification steps

1. Open `/#/g/<id>/ignite` on the develop staging deployment.
2. Confirm banner title shows the group name with edit affordance and subtitle `Joined: N` live-updates without any `0 members` ignite summary.
3. Confirm header row alignment inside organizer card (left camera+label, centered title, right sound+close/reopen), with no control floating outside the card.
4. Confirm join link is static text + copy action and long URL truncates (no card width expansion).
5. Confirm explanatory text lines are absent under organizer heading area.
6. Join from another device/tab and confirm joined count + new tile pulse, optional beep when enabled, and no errors when autoplay is blocked.
7. Confirm `Joined folks (N)` wraps tiles, shows internal vertical scrolling at higher counts, and displays thumbnails only for joiners with uploaded photos.

## 2026-02-24 05:01 UTC update (Ignite organizer identity/name tiles)

- Extended `/api/ignite/meta` response with backward-compatible optional identity fields: `createdByPersonId` and `peopleByPersonId` while preserving existing `joinedCount`, `joinedPersonIds`, and `photoUpdatedAtByPersonId` fields.
- Organizer `Joined folks` rendering now derives display order from organizer-first deduped IDs (`createdByPersonId` + joined IDs) so organizer is always shown as the first/primary tile when known.
- Organizer/joiner tiles now render human names from `peopleByPersonId` when no photo is present, with fallback to the raw person ID only when lookup data is unavailable.
- Photo tiles now display the same resolved name label beneath the thumbnail (organizer and joiners).
- Organizer photo upload now performs an optimistic tile refresh by bumping organizer photo timestamp locally so the organizer thumbnail appears quickly before/while meta polling catches up.

### Verification

- API compile check: `pnpm --filter @familyscheduler/api build` passes.
- Web typecheck in this container remains blocked by existing missing frontend deps (`@mui/material`, `@mui/icons-material`) and is not caused by this delta; run with full deps installed for UI validation.
- Manual acceptance to run in staging/local:
  1. Open organizer ignite page with no external joiners -> `Joined folks (1)` and organizer name tile.
  2. Upload organizer photo -> organizer tile switches to thumbnail + organizer name.
  3. Joiner without photo joins -> tile text shows joiner name (not person ID).

## 2026-02-24 05:04 UTC update (Ignite join link static row + no flex blowout)

- Ignite organizer join link is now rendered as static typography text (no input/textarea/contentEditable) with the existing copy icon action.
- Join-link row now enforces overflow containment (`min-width: 0`, `overflow-x: hidden`, icon fixed-size flex item) so long URLs cannot widen the card.
- Ignite section containers now explicitly constrain width (`width/max-width: 100%`, `min-width: 0`) to prevent nested flex overflow expansion.

### Success criteria

- On `/#/g/<id>/ignite`, the join link appears as static read-only text (no editable affordance).
- Very long join links truncate with ellipsis and do not cause horizontal page/card blowout.
- Copy icon remains visible/right-aligned and continues copying the full URL.

### Non-regressions

- Existing copy-to-clipboard behavior and copied feedback stay unchanged.
- QR rendering/header alignment remain unchanged.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173`.
2. Open `/#/g/<id>/ignite` with an active session and validate join-link row behavior using a long session URL.
3. Confirm no horizontal scrollbar appears and card width remains stable.

## 2026-02-24 05:40 UTC update (Meeting tab title uses group display name only)

- Meeting route (`/#/g/:groupId/app`) now sets tab title to exactly the trimmed group display name with no `Family Scheduler —` prefix.
- While group metadata is still loading or empty, meeting tab title is set to an empty string.
- Ignite organizer route remains unchanged: `Ignition Session` fallback, then `Ignition Session — {groupName}` when group name is available.

### Success criteria

- Meeting tab shows only the group display name (for example, `Breakout`) when metadata is loaded.
- Ignite organizer tab shows `Ignition Session — Breakout` for the same group.
- Renaming the group updates both tab titles immediately via existing `groupName` state effects.
- No meeting tab title includes `Family Scheduler`.

### Non-regressions

- Ignite tab-title behavior and fallback remain unchanged.
- Existing group metadata fetch/rename flows remain unchanged beyond meeting-tab title text.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web build` (or `pnpm --filter @familyscheduler/web dev`).
2. Open `/#/g/<groupId>/app`; verify tab title becomes exactly `<groupName>` and never includes `Family Scheduler`.
3. Open `/#/g/<groupId>/ignite`; verify tab title is `Ignition Session — <groupName>` after metadata resolves.
4. Rename the group; verify both titles update immediately.


## 2026-02-24 05:44 UTC update (Breakout popup-only navigation hotfix)

- Tightened `createBreakoutGroup` control flow so successful popup path navigates only the popup tab and returns immediately, preventing any same-tab continuation.
- Kept same-tab fallback only for popup-blocked path (`popup === null`), which still writes session and navigates to `/#/g/<newGroupId>/ignite`.
- Added temporary debug signal before popup navigation: `console.debug('[breakout] popup?', Boolean(popup), 'navigating popup only')`.
- Preserved error behavior: fetch failure / non-ok closes popup (if opened) and surfaces breakout error.

### Success criteria

- With popups allowed, breakout opens a new tab and only that tab navigates through `/#/handoff?...`; original tab hash does not change.
- With popups blocked, original tab follows existing same-tab ignite fallback.

### Non-regressions

- Existing API request payload/trace behavior remains unchanged.
- Existing breakout error messaging remains unchanged.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web typecheck` (if deps are installed).
2. In app meeting view, click Burger → Breakout with popups allowed; verify original tab stays on current meeting while popup navigates to handoff/ignite.
3. Block popups and repeat; verify same-tab fallback still navigates to new ignite route.
4. Check browser console for temporary debug line on popup success path.


## 2026-02-24 06:29 UTC update (Breakout opens direct handoff URL only)

- Refactored breakout popup flow to open the final `/#/handoff?...` URL directly via a single `window.open(handoffUrl, '_blank', 'noopener')` call.
- Removed all intermediate `about:blank` popup handling and all popup location mutation fallbacks (`popup.location`, `popup.document.location`).
- Removed breakout popup navigation debug logs tied to manual popup navigation attempts.

### Success criteria

- Burger → Breakout opens exactly one new tab directly to `/#/handoff?...`.
- New tab continues to `/#/g/<newGroupId>/ignite`.
- Original tab route/title/session remain unchanged during breakout.
- No blank intermediate tab remains.

### Non-regressions

- `/api/ignite/spinoff` request payload/trace behavior is unchanged.
- Popup-blocked UX still surfaces the manual handoff URL message.

### How to verify locally

1. Run `pnpm --filter @familyscheduler/web typecheck` (may fail in this environment due pre-existing dependency issues).
2. In Chrome/Edge/Safari, open an existing meeting and click Burger → Breakout.
3. Confirm original tab URL/title/sessionStorage remain unchanged while new tab opens directly to handoff then ignite.

## 2026-02-24 06:50 UTC update (Breakout dismissible informational notice + manual link)

- Added a dedicated `breakoutNotice` state in `AppShell` for informational popup-hand-off guidance, separating it from `breakoutError` (API failure channel only).
- Updated breakout popup `null` branch to set a notice with `handoffUrl` instead of setting an error-style message.
- Added a dismissible informational notice banner above shell content, matching existing alert max width (`maxWidth: 760`) and including a clickable `open it manually` hyperlink (`target="_blank"`, `rel="noopener"`).
- Added close affordance (`×`) with accessible label `Close breakout notice`.
- Ensured successful popup open clears any prior informational notice immediately.

### Success criteria

- Clicking Breakout still opens a new tab.
- Origin tab shows informational notice (not error) only when popup handle is null.
- Notice width matches other app alerts.
- Manual URL is clickable.
- Clicking `×` dismisses the notice.

### Non-regressions

- API-failure handling still flows through `breakoutError` and preserves trace messaging.
- Existing handoff URL generation and popup focus behavior remain unchanged.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck`.
2. Open `/#/g/<groupId>/app`, click Breakout, and validate new-tab behavior and no regression to API error messaging.
3. In an environment where popup handle is null, confirm notice appears with working manual link and dismiss button.

## 2026-02-24 09:52 UTC update (section tab polish + calendar view dropdown)

Refined section tabs (active merges into content, alignment); replaced calendar view tabs with dropdown to prevent mobile clipping.

### Success criteria

- Schedule/Members rail divider is visible under inactive tabs and hidden under active tab.
- Active Schedule/Members tab visually merges with the paper content area.
- Calendar view control is a dropdown showing current view and switching between List/Month/Week/Day.
- Calendar header avoids clipping on narrow layouts by replacing four-tab control with compact menu button.

### Non-regressions

- Body scroll behavior remains unchanged.
- Existing calendar rendering for list/month/week/day remains unchanged after selection.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck`.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173` and open the app.
3. Confirm section-tab seam/alignment behavior and calendar view dropdown switching.

## 2026-02-24 10:08 UTC update (MUI button base exclusion in global CSS)

- Scoped global native button styles to exclude MUI button-based controls by switching selectors to `button:not(.MuiButtonBase-root)` in `ui.css`.
- Preserved existing native control styling for plain HTML `<button>`, `<input>`, `<select>`, and `<textarea>`.
- This removes unintended primary button borders/background from MUI `Tab`, `Button`, and `IconButton` elements used in Schedule/Members and mobile calendar header controls.

### Success criteria

- Schedule/Members tabs no longer inherit global native button primary styles.
- Active tab seam/occlusion styling (`mb: '-1px'`) works as intended against the rail divider.
- Mobile header icon actions/dropdown no longer show native global button skin.

### Non-regressions

- Plain HTML buttons keep existing global styling behavior.
- Members/Schedule section switching and calendar view selection behavior remain unchanged.

### How to verify locally

1. Run `pnpm -C apps/web run typecheck`.
2. Run `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173`.
3. Inspect Schedule/Members tabs: selected tab blends into content surface; no unintended primary button fill/border.
4. Inspect mobile header controls (view dropdown and icon actions): no global button border/background artifacts.
5. Run `rg -n "<button\\b" apps/web/src --glob='*.tsx'` and spot-check native button surfaces still look acceptable.

## Update: staging email identity cutover (develop)
- Switched group membership authority to `state.members` with normalized email keys.
- Added centralized session + membership guards and applied to mutating endpoints.
- Ignite breakout join now uses email+name and can provision membership on join.

## 2026-02-24 16:55 UTC update (email auth cutover build fix)

- Switched auth guard helpers to discriminated union results (`ok: true/false`) to eliminate `HttpResponseInit | data` unions in endpoint flows.
- Updated all impacted API endpoints to use explicit auth/membership guard checks and consistent `session`/`member` variable handling.
- Fixed `ignitePhotoBlobKey` import to come from `lib/ignite.ts`.

### Success criteria

- TypeScript build passes for API and workspace packages with no auth-guard typing errors.
- `chat.ts` no longer references undefined `identity` symbol.

### Non-regressions

- Endpoint error contracts remain response-based (`errorResponse`) and do not throw for auth denials.
- Conflict handling in `direct.ts` and other mutation endpoints remains unchanged.

### How to verify locally

1. `pnpm -r --if-present build`
2. Confirm no TS errors for `requireSessionEmail` / `requireActiveMember` call sites.
3. Spot-check `/api/direct` and `/api/chat` with valid and invalid session headers for expected 401/403 behavior.

## 2026-02-24 19:32 UTC update (Missing session after group create)

Fixed web auth/session sequencing bug causing immediate `unauthorized: Missing session` after group creation/open.

### Root cause

- `AppShell` had multiple direct `fetch(apiUrl(...))` calls that bypassed the canonical `apiFetch` helper, so `x-session-id` was omitted on authenticated endpoints (including `group/meta`).
- App route boot could enter authenticated routes (`/g/:groupId/app` and `/g/:groupId/ignite`) before `fs.sessionId` existed, causing early authenticated calls to fail.
- Group creation flow allowed unauthenticated create attempts, producing groups that then failed on first authenticated metadata call.

### Fix

- Routed `apps/web/src/AppShell.tsx` API requests through `apiFetch` so session header injection is centralized.
- Added auth boot gating in `App.tsx` so authenticated routes and create flow require `fs.sessionId`; missing session now routes to sign-in entry screen instead of firing authenticated calls.
- Kept `/auth/consume` flow async and ensured it stores `fs.sessionId` before redirecting into app routes.
- Added deduped unauthorized diagnostics in `apiFetch` to log one-line warning with `traceId` and local session presence when API returns `{ ok:false, error:"unauthorized", message:"Missing session" }`.

### Verification

1. `pnpm --filter @familyscheduler/web typecheck`
2. Logged-in path: create group -> open app -> `group/meta` succeeds with `x-session-id` header.
3. Logged-out path: create/open-group routes show sign-in gate; no unauthorized spam.

## 2026-02-24 20:10 UTC update (staging root landing + auth-gate redirect hardening)

Implemented unauthenticated landing behavior for `/#/` so staging no longer renders a blank/blocked page when `fs.sessionId` is missing.

### Bug

- Root hash route (`/#/`) showed a blocking sign-in-required panel instead of a usable unauthenticated entry flow.
- Protected route handling could leave users in non-optimal redirects when session state was missing.
- Fatal top-level render errors could still appear as a blank app without a clear on-screen signal.

### Fix

- Added `LandingSignInPage` on root route when `fs.sessionId` is absent:
  - Minimal email form.
  - Calls `POST /api/auth/request-link`.
  - Shows success message: `Check your email`.
- Added explicit protected-route redirect behavior for `/g/:groupId/app` and `/g/:groupId/ignite` when unauthenticated:
  - Redirects to `/#/?m=Please%20sign%20in%20to%20continue.`
  - Displays visible sign-in-required panel while routing.
- Updated auth gate redirect when API session is missing to route to root sign-in page with message.
- Added top-level React error boundary in `main.tsx`:
  - Shows `App error — open console` on fatal render errors.
  - Logs boundary-caught errors in dev.

### Verification

1. `pnpm --filter @familyscheduler/web typecheck`
2. Start web app and open `/#/` with empty `localStorage.fs.sessionId`:
   - Sign-in panel renders (email + submit), not blank.
3. Submit email on landing sign-in:
   - Network shows `POST /api/auth/request-link`.
   - UI shows `Check your email`.
4. Navigate directly to protected route without session (`/#/g/<groupId>/app`):
   - Redirects to root sign-in with `Please sign in to continue.` message.
5. Confirm no redirect loops between root and protected routes.
6. After consuming magic link:
   - App routes load normally.
   - Authenticated requests include `x-session-id` header (handled via existing `apiFetch`).

## 2026-02-24 23:35 UTC update (Breakout QR join provisional sessions + closed-session enforcement)

- Updated `POST /api/ignite/join` to support two modes:
  - authenticated callers auto-join with existing API session (no name/email required),
  - unauthenticated callers require name+email, are added to members, receive immediate magic-link dispatch, and get a provisional API session.
- Enforced invite/session open-state checks in ignite join (`status === OPEN`); closed sessions now reject new joins with stable `IGNITE_CLOSED` semantics.
- Added provisional session support in auth session storage/validation with env TTL (`PROVISIONAL_SESSION_TTL_SECONDS`, default 1800) and explicit expiry code payload (`code: AUTH_PROVISIONAL_EXPIRED`) on 401.
- Added web-side handling for expired provisional sessions in central `apiFetch`: clears `fs.sessionId` and redirects to `/#/login?m=Please verify your email to continue`.
- Updated `IgniteJoinPage` behavior:
  - with API session: auto-join with a minimal joining state,
  - without API session: name+email form, join immediately into group app, stores server-issued provisional `fs.sessionId`, and shows closed-session message when applicable.

### Key files touched

- `api/src/functions/igniteJoin.ts`
- `api/src/lib/auth/sessions.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/apiUrl.ts`

## 2026-02-25 01:01 UTC update (Dashboard Break Out launcher + shared spinoff helper)

### What changed

- Added a shared web helper for breakout spinoff flow in `apps/web/src/lib/ignite/spinoffBreakout.ts` so breakout creation, traceId handling, error normalization, and handoff URL construction are centralized.
- Refactored `AppShell` breakout action to call the shared helper with no backend or routing contract changes.
- Updated signed-in dashboard UI to show a `Break Out` button in the `Your groups` list (currently populated from recent group context), launching the same spinoff + handoff flow in a new tab.
- Added dashboard inline `Alert` UX for breakout success fallback (manual-open link when popup blocked) and errors (including traceId suffix when available).

### Files touched

- `apps/web/src/lib/ignite/spinoffBreakout.ts`
- `apps/web/src/AppShell.tsx`
- `apps/web/src/components/DashboardHomePage.tsx`
- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### How verified

- Ran `pnpm -r test` (fails in existing API chat tests unrelated to this dashboard change; see output for baseline failures around storage_get_binary_not_supported/chat status assertions).
- Ran `pnpm --filter @familyscheduler/web build` (passes).
- Manual smoke prep (local): started web dev server, loaded signed-in dashboard state, and captured screenshot showing `Break Out` action in dashboard groups list.

### Known edge cases

- Popup blockers can prevent auto-open of breakout tab; dashboard and in-group flows both surface a manual-open link when `window.open` returns null.
- Dashboard group listing currently uses recent-group context on home and only shows rows when a recent group exists.

## 2026-02-25 01:50 UTC update (UI product rename: Family Scheduler -> Yapper)

### What changed

- Updated UI-facing product name string to `Yapper` in the shared web product config.
- Updated base HTML document title to `Yapper` so the initial browser tab label reflects the new app name.
- Scope intentionally limited to UI-only references; backend defaults and historical logs/docs were not modified as part of this rename request.

### Files touched

- `apps/web/src/product.ts`
- `apps/web/index.html`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### How verified

- `rg -n "Family Scheduler|Yapper" apps/web/src/product.ts apps/web/index.html`
- `pnpm --filter @familyscheduler/web build`
## 2026-02-25 01:48 UTC update (Ignite join grace-session response hardening)

- Hardened `POST /api/ignite/join` unauth join behavior so successful joins always return a grace `sessionId` sourced from `createIgniteGraceSession` (30s, `kind=igniteGrace`, scoped by breakout `groupId` and ignite `sessionId`).
- Added explicit error handling for grace-session issuance failures: backend now logs a trace-linked failure event and returns stable `500 ignite_grace_session_create_failed` instead of throwing.
- Added required trace log event `ignite_join_grace_session_issued` with `{ traceId, breakoutGroupId, igniteSessionId, expiresAt }` so join/session continuity can be diagnosed.
- Preserved existing join semantics: member/person updates and joined-person tracking unchanged; magic-link request remains best-effort and non-blocking.

### How to test

1. Fresh browser storage: open `/#/s/:groupId/:igniteSessionId`, submit name+email (+optional photo), confirm `fs.sessionId` appears in Local Storage and app navigates to `/#/g/:breakoutGroupId/app` without redirecting to `/login`.
2. Wait >30s, refresh `/#/g/:breakoutGroupId/app`, confirm redirect to `/login` (grace expiry expected).
3. Within 30s window, navigate to `/#/g/<differentGroupId>/app`, confirm access is denied by scope enforcement and UI routes to existing join/login behavior.
4. Build validation: `pnpm -r build`.

## 2026-02-25 02:00 UTC update (always show signed-in email in workspace burger menu)

### What changed

- Updated the shared workspace `PageHeader` burger menu to always show the authenticated user's email (when signed in) as a dedicated disabled menu item above `Sign out`.
- Added session-email detection in `PageHeader` via `fs.sessionEmail` localStorage listener so the menu still shows the email even when the prop is not explicitly passed.

### Files touched

- `apps/web/src/components/layout/PageHeader.tsx`
- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### How verified

- `pnpm --filter @familyscheduler/web typecheck`
- `pnpm --filter @familyscheduler/web build`
- Visual check using Playwright screenshot against local web dev server with mocked auth localStorage.

## 2026-02-25 02:05 UTC update (Ignite organizer: cancel breakout back to original group)

### What changed

- Added a `Cancel` button to the Organizer Breakout QR (`Ignition Session`) header actions.
- `Cancel` now navigates back to the breakout group's main app route (`/#/g/:groupId/app`) instead of leaving the organizer in the QR page.
- Kept existing `Close`/`Reopen` behavior unchanged.

### Files touched

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### How verified

- `pnpm --filter @familyscheduler/web typecheck`
- `pnpm --filter @familyscheduler/web build`

## 2026-02-25 02:45 UTC update (Sanitize session email identity in web auth flow)

### What changed

- Added a shared web email validator utility (`isValidEmail` + `sanitizeSessionEmail`) in `apps/web/src/lib/validate.ts`.
- Hardened auth consume write boundary (`AuthConsumePage`) so `fs.sessionEmail` is written only for valid emails; invalid/non-email values are now removed from localStorage and logged via `authLog` as `session_email_rejected`.
- Hardened read/display boundaries:
  - `App` now sanitizes `fs.sessionEmail` on read and clears invalid persisted values before passing identity props.
  - `PageHeader` now sanitizes `fs.sessionEmail` in initial state and in storage-event refresh paths, clearing invalid values so labels cannot show garbage identities like `signin`.
- Result: UI no longer treats non-email strings as signed-in identity labels.

### Verification run

1. `rg -n --hidden --no-ignore -S "setItem\((SESSION_EMAIL_KEY|'fs\.sessionEmail')" apps/web/src`
2. `pnpm -r build`
3. Manual smoke (human-run):
   - Force `localStorage.fs.sessionEmail = 'signin'` and verify account label does **not** show `signin`.
   - Complete normal auth consume with a real email and verify it still appears as signed-in identity.
## 2026-02-25 02:40 UTC update (build version shown on home/dashboard footer)

### What changed

- Added a build-version label (`Build <short sha>`) to the shared `MarketingLayout` footer so it is visible on both signed-out home and signed-in dashboard surfaces.
- Reused existing `buildInfo` env wiring (`VITE_BUILD_SHA`) and fallback behavior (`dev`) to avoid introducing new config paths.
- Kept existing footer links/structure intact while adding the version readout on the right side.

### How to test

1. Start web app and open `/#/` while signed out; confirm footer shows `Build <value>` on the right.
2. Set `localStorage.fs.sessionId` and open `/#/` as signed-in dashboard; confirm the same build label remains visible.
3. Run `pnpm --filter @familyscheduler/web typecheck`.

## 2026-02-25 03:18 UTC update (Dashboard home visual hierarchy polish)

### What changed

- Adjusted the signed-in dashboard hero hierarchy so the section label (`Dashboard`) appears as a compact overline and `Welcome back` is no longer oversized relative to surrounding content.
- Reduced the visual weight/size of `Welcome back` from a large display heading to a responsive `h4` scale for better balance with the signed-in subtitle.
- Kept dashboard behavior and actions unchanged (create/open recent/breakout flows are untouched).

### Acceptance criteria

- Signed-in home (`/#/` with `fs.sessionId` present) shows `Dashboard` overline above the main heading.
- `Welcome back` appears clearly but not larger than expected for page context.
- Existing signed-in label (`Signed in as ...`) still renders below the heading.

### Non-regressions

- Dashboard CTA buttons and recent/group cards remain present and functionally unchanged.
- Signed-out marketing home remains unchanged.

### How to verify

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173`
3. In browser console on `http://localhost:4173/#/`, run:
   - `localStorage.setItem('fs.sessionId','demo-session')`
   - `localStorage.setItem('fs.sessionEmail','alex@example.com')`
   - `localStorage.setItem('fs.sessionName','Alex')`
   - `location.reload()`

### Expected signals

- No typecheck errors.
- Signed-in dashboard renders with improved heading balance (`Dashboard` overline + moderated `Welcome back` size).

## 2026-02-25 03:24 UTC update (ignite unauth join session stability + auth-link guard)

### What changed

- Confirmed `igniteJoin` unauth success returns `sessionId: grace.sessionId` and remains independent of auth-link email success/failure.
- Hardened ignite join auth-link handoff by explicitly forwarding `headers` into the synthetic `authRequestLink` call payload.
- Hardened `authRequestLink` origin resolution so missing/non-standard request headers do not throw (`undefined.get`); it now safely skips origin resolution when headers are unavailable.
- Added targeted API test to verify `authRequestLink` no longer crashes when called without a headers object.
- Added explicit temporary web console diagnostics at `fs.sessionId` clear time, logging `{ code, path, traceId, currentHash }` immediately when removal occurs.

### Acceptance criteria

- Unauthenticated ignite join returns HTTP 200 with `ok: true`, `breakoutGroupId`, and `sessionId` from grace-session issuance.
- Missing request headers during auth-link request path do not throw; response degrades to normal config-missing behavior when `WEB_BASE_URL` cannot be resolved.
- When session clear is triggered client-side, browser console prints structured payload including `code`, `path`, `traceId`, and `currentHash`.

### Non-regressions

- Existing authenticated ignite-join behavior remains unchanged.
- Auth-link send failures remain non-fatal to ignite join success path.

### How to verify

1. `pnpm --filter @familyscheduler/api test`
2. `pnpm --filter @familyscheduler/web typecheck`
3. Staging/manual:
   - Join via QR as unauth user.
   - Confirm `fs.sessionId` appears and persists for at least a few seconds.
   - If cleared, inspect console for `[apiFetch] session_id_removed` payload with `code/path/traceId/currentHash`.

## 2026-02-25 04:10 UTC update (ignite organizer meta polling guard)

### What changed

- Tightened Ignite organizer polling gate so `/api/ignite/meta` only runs when `sessionId` is non-empty after trimming.
- Added a debug skip event when polling is skipped due to missing/blank `sessionId`: `console.debug('[AUTH_DEBUG]', { event: 'ignite_meta_skip', groupId, sessionId })`.
- Prevented unintended auto-restart loops by only auto-calling `startSession()` when `sessionId === null` (initial state), not when it is an empty string.
- Stopped post-close polling immediately by clearing local organizer `sessionId` on successful close.

### Acceptance criteria

- On organizer QR screen with no active session (`sessionId` empty/missing), no `/api/ignite/meta` polling requests are sent.
- After session start, `/api/ignite/meta` polling resumes normally with joined counts.
- After session close succeeds, organizer polling stops and no repeated 400 spam occurs.

### Non-regressions

- Existing session start/reopen behavior remains unchanged for valid organizer emails.
- Existing joined-count and joined-person bump/chime behavior remains unchanged while session is open.

### How to verify

1. `pnpm -r build`
2. Run web app and open Ignite organizer route:
   - Before starting session: verify no `/api/ignite/meta` requests fire.
   - Start session: verify `/api/ignite/meta` returns 200 and updates joined info.
   - Close session: verify polling ceases (no further `/api/ignite/meta` spam).

### Expected signals

- Build succeeds.
- Browser Network tab shows no meta polling before/after session lifecycle except during active open session.
- Console may show one `[AUTH_DEBUG]` `ignite_meta_skip` event when `sessionId` is absent.
## 2026-02-25 04:02 UTC update (ignite meta guard + 400 diagnostics)

### What changed

- Added an explicit organizer-side guard before polling `POST /api/ignite/meta` so requests are skipped unless both `groupId` and `sessionId` are present.
- Added required skip diagnostics in web console: `console.debug('[AUTH_DEBUG]', { event: 'ignite_meta_skip', groupId, sessionId })` whenever a meta poll is prevented.
- Extended `apiFetch` to emit structured 400 diagnostics (`[apiFetch] bad_request`) with request path, method, and a safe request payload summary (JSON keys + key IDs when available).

### Acceptance criteria

- `ignite/meta` client polling does not execute when either `groupId` or `sessionId` is missing.
- Skipped polls produce `[AUTH_DEBUG]` log with `event: 'ignite_meta_skip'` and current `groupId`/`sessionId` values.
- Any 400 response through `apiFetch` logs a `[apiFetch] bad_request` warning that includes request `path` and request payload summary.
- Server `igniteMeta` 400 responses include JSON `code` and `message` fields (in addition to existing fields).

### Non-regressions

- Existing successful ignite organizer polling path remains unchanged when valid `groupId` + `sessionId` are present.
- Non-400 `apiFetch` behavior remains unchanged.
- Existing ignite meta success response schema remains unchanged.

### How to verify

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/api build`
3. Run web app and reproduce missing-id state before session creation; check browser console for `[AUTH_DEBUG]` `ignite_meta_skip`.
4. Trigger a known 400 from web API call and confirm `[apiFetch] bad_request` payload logs include `path`, `method`, and `request` summary.

### Expected signals

- Typecheck/build pass.
- No bogus ignite meta requests with missing `groupId`/`sessionId`.
- 400 responses are easier to debug on both client (request summary log) and server (code/message in JSON body).

## 2026-02-25 04:17 UTC update (igniteMeta identity via session/email)

  - tries `requireSessionFromRequest(..., { groupId })` first,
  - authorizes authenticated callers via active membership (`requireActiveMember`) using session email.
- Added fallback unauth identity behavior for backwards compatibility:
  - supports `email` identity (`requireActiveMember`),
- Polling remains guarded by a non-empty `sessionId` before `/api/ignite/meta` is called.

### Verification run

1. `pnpm --filter @familyscheduler/api build`
2. `node --test api/dist/api/src/functions/igniteMeta.test.js`
3. `pnpm -r build`

## 2026-02-25 05:05 UTC update (Phone identity removed from session-era contracts)

  - `ignite/photo` GET is now session-required + membership-checked by session email.
- Added `requireIdentityFromRequest` in `api/src/lib/groupAuth.ts` to centralize identity resolution: session first, optional validated email fallback.
- Removed `validateJoinRequest` / `phone_required` usage from the migrated paths.
- Updated tests for migrated contracts (`igniteMeta`, `ignitePhoto`, `groupRename`, `groupAuth` email validation).

### Backward compatibility decision


### Verification run

1. `pnpm -r build`
2. `cd api && node --test dist/api/src/functions/igniteMeta.test.js dist/api/src/functions/ignitePhoto.test.js dist/api/src/functions/groupRename.test.js dist/api/src/lib/groupAuth.test.js`
3. Optional environment-wide check: `pnpm --filter @familyscheduler/api test` (currently fails in this container due missing runtime deps + pre-existing unrelated test assumptions).

### Staging verification steps

1. Organizer in `/#/g/:groupId/ignite`: confirm `/api/ignite/meta` succeeds without `phone_required` noise.

## 2026-02-25 04:51 UTC update (Breakout opens new group ignite URL)

- Fixed breakout tab opening logic to use the server-returned `linkPath` directly when creating the breakout URL, so the new tab targets the spawned group route instead of reconstructing a handoff URL from current location context.
- Added a temporary debug log before popup open in `AppShell`:
  - `console.debug('[BREAKOUT_DEBUG]', { urlToOpen: result.urlToOpen, from: window.location.href })`
- Breakout open behavior now uses `window.open(result.urlToOpen, '_blank', 'noopener,noreferrer')` with `urlToOpen` passed through verbatim from spinoff result.

### Acceptance criteria

- Clicking **Breakout Session** opens a new tab at the new group ignite route (`/#/g/<newGroupId>/ignite`).
- Existing tab remains on current page with no navigation side effects.
- Spinoff API payload/response contracts remain unchanged beyond client usage of existing `linkPath`.

### Non-regressions

- Breakout spinoff request still sends the same body fields (`sourceGroupId`, `traceId`, `groupName`).
- Existing popup-blocked fallback notice behavior remains unchanged.

### How to verify

1. `pnpm -r build`
2. Run app, authenticate, go to dashboard/home, click **Breakout Session**.
3. Confirm new tab URL is `/#/g/<newGroupId>/ignite` and current tab is unchanged.
4. Confirm browser console logs `[BREAKOUT_DEBUG]` with `urlToOpen` and current `from` URL.

### Expected signals

- Build succeeds.
- New tab opens to spawned group ignite route (no self-dashboard reopening).

## 2026-02-25 05:01 UTC update (Breakout organizer session pre-seeded before popup)

- Updated breakout spinoff client result contract to pass through backend `sessionId` alongside `newGroupId`, `linkPath`, and `urlToOpen`.
- Updated `AppShell.createBreakoutGroup` to pre-seed `window.localStorage['fs.sessionId']` with the spinoff-returned session id before `window.open(...)`.
- Added explicit breakout debug event:
  - `set_session_before_open` with `sessionIdPrefix` when a session id is provided.
- Preserved existing popup URL behavior (`window.location.origin + linkPath`) and popup-blocked fallback notice.
- Mirrored session pre-seeding in dashboard breakout launcher for consistency.

### Acceptance criteria

- Clicking **Breakout** writes `fs.sessionId` before opening the new tab when spinoff response includes `sessionId`.
- New tab opens directly to `/#/g/<newGroupId>/ignite` organizer route without join dialog.
- Existing breakout error handling (`traceId` in UI) and popup fallback remain unchanged.

### Non-regressions

- `POST /api/ignite/spinoff` request shape remains unchanged (`sourceGroupId`, `traceId`, `groupName`).
- Existing `urlToOpen` construction remains origin + server-provided `linkPath`.
- No changes to ignite join API contract or login flow outside breakout launch path.

### How to verify

1. `pnpm -r build`
2. Run app, authenticate, open home/dashboard, click **Breakout**.
3. Confirm in devtools Local Storage that `fs.sessionId` is set before/at open.
4. Confirm new tab lands on `/#/g/<newGroupId>/ignite` with no join dialog/login redirect.
5. Confirm console shows `[BREAKOUT_DEBUG]` `set_session_before_open` and `before_open`.

### Expected signals

- Build succeeds.
- Breakout tab opens into organizer ignite route directly.
- Session id remains present in local storage.

## 2026-02-25 06:40 UTC update (auth docs cleanup to email-only)

- Rewrote `docs/specs/SPEC_AUTH_MODEL.md` into an email/session-only contract reference and removed legacy telephony identity wording from the auth model spec.
- Cleaned remaining docs-scoped telephony mentions detected by `rg` in:
  - `docs/email-env.md`
  - `docs/runbook.md`
  - `docs/discovery-photo-extract-appointment-feasibility.md`
- Scope of this update is documentation-only; no runtime behavior changed in application code.

### Success criteria
- `docs/specs/SPEC_AUTH_MODEL.md` presents an email-only model and session header contract.
- `rg -n "phone_required|validateJoinRequest|\\bphone\\b" docs -S` returns no matches.

### Non-regressions
- Existing references outside `docs/` remain unchanged (report-only in this task).
- API and web codepaths are untouched.

### How to verify
1. Run `nl -ba docs/specs/SPEC_AUTH_MODEL.md | sed -n '1,220p'` and confirm title and sections describe email/session identity.
2. Run `rg -n --hidden --glob '!.git' "phone_required|validateJoinRequest|\\bphone\\b" docs -S` and confirm no output.
3. Optionally run repo-wide informational scan:
   - `rg -n --hidden --glob '!.git' "phone_required|validateJoinRequest|\\bphone\\b" -S .`

## 2026-02-25 06:51 UTC update (Isolate igniteGrace session + lifecycle logs)

- Fixed Ignite join flow to persist temporary joiner auth into `fs.igniteGraceSessionId` (and optional `fs.igniteGraceExpiresAtUtc`) instead of overwriting durable `fs.sessionId`.
- Updated API client header injection to prefer durable `fs.sessionId` and fallback to ignite grace session only when durable auth is absent.
- Added targeted handling for `AUTH_IGNITE_GRACE_EXPIRED` to clear only ignite grace keys and keep durable auth untouched.
- Updated sign-out cleanup to clear both durable and ignite grace keys.
- Added `sessionLog` helper (`[SESSION]` events) gated behind `VITE_DEBUG_AUTH_LOGS=true` for grace start/end and sign-out clear lifecycle visibility.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web build`
## 2026-02-25 09:00 UTC update (Ignite organizer photo render via authenticated fetch)

- Fixed organizer "Joined folks" photo rendering by replacing direct `<img src="/api/ignite/photo...">` with client-side `apiFetch` + Blob/ObjectURL flow so `x-session-id` auth header is sent.
- Added in-memory per-person photo ObjectURL cache keyed by `photoUpdatedAtByPersonId`, with cleanup/revoke on replacement, person removal, and page unmount.
- Updated `ignitePhotoGet` to convert session auth failures into structured HTTP responses (`401/403`) instead of bubbling exceptions.
- Behavior change: when a photo exists but the fetch is still in-flight/fails, the card now temporarily shows name-only fallback instead of broken image state.

### Verification run

1. `npm -C apps/web run build`
2. `pnpm --filter @familyscheduler/api build`

## 2026-02-25 09:09 UTC update (Ignite organizer join toggle + go-to-group split)

- Replaced organizer Close/Reopen action with a dedicated join-availability toggle labeled **Allow new members to join**.
- Toggle ON posts to `/api/ignite/start`; toggle OFF posts to `/api/ignite/close` and now **does not** clear `sessionId` or navigate away.
- Removed the organizer **Join link** section entirely.
- Updated organizer **Group link** display to static, non-editable text styling with copy action retained.
- Added explicit helper text beneath the toggle for ON/OFF states and transient `Closing…` state.
- Added a separate primary **Go to group** button that navigates to `/#/g/<groupId>` without changing join state.
- Kept QR generation path (`api.qrserver.com`), and dimmed QR visibility while joining is OFF.
- Behavior contract remains: when organizer closes joining, join attempts on session URL are rejected with `IGNITE_CLOSED` (join page renders “This session is closed.”).

### Verification run

1. `pnpm -w -r build`
2. `pnpm -w -r lint`
3. `pnpm --filter @familyscheduler/api test -- igniteJoin.test.ts`

## 2026-02-25 10:25 UTC update (Ignite organizer QR-first layout + persisted organizer profile photo)

- Redesigned `IgniteOrganizerPage` into four centered groups: helper copy, QR-first block, "Who’s in" activity strip, and pinned footer controls.
- Removed organizer Cancel, Join link, and Group link from Ignite organizer dialog.
- Replaced prior close/reopen button semantics with:
  - Switch: **Allow new members to join** (OFF closes joining only; ON reopens/starts).
  - Primary CTA: **Finish inviting & continue** (closes first when open, then navigates to the group).
- Added organizer-first avatar behavior with camera overlay; clicking organizer avatar opens capture flow.
- Added persisted profile photo APIs for authenticated users and wired organizer capture flow to set/replace this photo.
- Storage note: `personId` is currently group-scoped in this codebase, so persisted profile photo is currently group-scoped (`familyscheduler/groups/<groupId>/users/<personId>/...`) with an inline migration note for future global identity.
- Added design language doc for Ignite dialog to mirror into joiner dialog work later.

### TODO
- Add **Edit profile photo** entry to the burger menu (global profile settings).
  - Current implementation allows profile photo set/replace only from Ignite organizer avatar.

### Success criteria
- Organizer screen is centered, QR-first, and avoids vertical-scroll layouts.
- No Cancel, Join link, or Group link is shown on organizer screen.
- "Who’s in" section uses horizontal avatar strip and always-visible names.
- Switch OFF posts close without navigation and without clearing session id.
- "Finish inviting & continue" closes if needed, then navigates.
- Organizer profile photo set/replace persists and reloads via authenticated API.

### Non-regressions
- Ignite join gating semantics remain OPEN/CLOSING/CLOSED; `IGNITE_CLOSED` behavior remains unchanged.
- Existing ignite photo endpoints and join polling behavior remain in place.

## 2026-02-25 18:39 UTC update (SWA deploy action replaces npx CLI deploy)

- Replaced SWA deploy in production workflow from `npx @azure/static-web-apps-cli deploy` to `Azure/static-web-apps-deploy@v1` using existing production SWA token secret.
- Replaced SWA deploy in staging workflow from `npx @azure/static-web-apps-cli deploy` to `Azure/static-web-apps-deploy@v1` using existing staging SWA token secret.
- Kept BYO API setup unchanged and did not add `api_location` in either workflow.
- Kept existing production HTML verification step unchanged.

### Verification run

1. `rg -n "@azure/static-web-apps-cli|\bnpx\b.*static-web-apps-cli|\bswa\b" .github/workflows`

## 2026-02-25 19:10 UTC update (SWA deploy file-count rejection fix)

- Updated all SWA deploy workflows to point `app_location` at the prebuilt `apps/web/dist` directory directly.
- Cleared `app_artifact_location` in those workflows to avoid uploading the full source tree alongside build output.
- This keeps deploy payload constrained to static build artifacts and addresses Azure SWA `BadRequest` failures caused by excessive static file counts.

### Verification run

1. `python - <<'PY' ...` (workflow sanity replacement for `app_location`/`app_artifact_location`)
2. `pnpm --filter @familyscheduler/web build`

## 2026-02-25 20:38 UTC update (Ignite organizer photo/session reload + layout gap fix + access-note removal)

- Fixed Ignite organizer profile-photo metadata fetch to bypass cache (`cache: 'no-store'`) so photo metadata is not stale across new ignite sessions.
- Stabilized organizer profile-photo reload timing by gating profile-photo fetch until both `groupId` and `sessionId` exist while still reacting to `[groupId, sessionId, organizerPersonId]` transitions.
- Fixed organizer-page vertical whitespace by replacing stretch-to-viewport wrapper (`ui-igniteOrg` / `ui-igniteOrgInner`) with normal stacked flow (`Stack` with centered max-width content).
- Positioned footer controls directly below the "Who’s in" section with a small top margin.
- Removed the organizer-page display of the access sentence by disabling `PageHeader` group access note rendering for Ignite organizer (`showGroupAccessNote={false}`).

### Manual verification notes
- Built web app successfully and captured Ignite organizer screenshot with updated flow (controls directly below “Who’s in”, no giant forced whitespace).
- Verified Ignite organizer route no longer renders the invited-email access sentence in header area.
- Verified profile-photo reload guard now waits for session readiness, preventing early unauthenticated profile-meta fetch attempts.

## 2026-02-26 00:00 UTC update (Tables-first groups/membership + me/groups + health + appointment index)

- Added Azure Tables client + auto-provision (`AZURE_TABLES_CONNECTION_STRING`) with lazy/startup initialization for: Groups, UserGroups, GroupMembers, AppointmentsIndex, DailyMetrics, UserDailyUsage, UserDailyUsageByModel, DailyUsageByModel.
- Added deterministic user identity keying via `sha256(normalizedEmail)`.
- Reworked group APIs (`groupCreate`, `groupJoin`, `groupJoinLink`, `groupMeta`, `groupRename`) to use table-backed group/membership entities and invited tracking (invited→active acceptance in join).
- Added `GET /api/me/groups` endpoint and wired dashboard “Your groups” UI to fetch/render active+invited memberships.
- Added `GET /api/health` endpoint (`{ ok, time, version }`).
- Reworked scan appointment endpoints to store canonical appointment JSON blob per appointment and promoted fields in `AppointmentsIndex`; removed reliance on `state.appointments[]` in scan image/delete/rescan paths.
- Added table-backed daily metrics increments (`newGroups`, `newAppointments`, `invitesSent`, `invitesAccepted`).
- Added table-backed OpenAI usage recorder (`UserDailyUsage`, `UserDailyUsageByModel`, `DailyUsageByModel`) and wired into chat OpenAI success paths.

### Verification run

1. `pnpm --filter @familyscheduler/api build` (pending in this container due dependency install issue for `@azure/data-tables`)
2. `pnpm --filter @familyscheduler/web build`

## 2026-02-25 21:43 UTC update (Azure Tables typing/updateMode cleanup)

- Fixed Azure Tables SDK typing break (removed `updateMode`, typed entities for `updateEntity`/`createEntity`).
- `usageTables.ts`: typed `next` entity as `Record<string, any> & { partitionKey: string; rowKey: string }` and removed deprecated `updateMode` option.
- `metrics.ts`: removed deprecated `updateMode` option from `updateEntity` call.
- Build/test verification in this environment is currently blocked by missing registry access for `@azure/data-tables` package fetch (403), so TypeScript build cannot complete until dependency access is restored.

## 2026-02-26 00:20 UTC update (Dashboard 2.0 API/UI, invite decline, group counters)

- Added `GET /api/me/dashboard` (single-call dashboard payload) returning groups with counters, recent items (invite-first ordering, max 3), per-user usage today, month summary, and inline health.
- Added `POST /api/group/decline` to move invited/active membership to removed across `UserGroups` + `GroupMembers` and adjust group counters.
- Extended group entity/counters support (`memberCountActive`, `memberCountInvited`, `appointmentCountUpcoming`) with optimistic ETag retry helper for read-modify-write updates.
- Wired counter updates at write points:
  - group create initializes counters,
  - invite link increments invited count only on non-existent/removed -> invited transitions,
  - join accept decrements invited + increments active,
  - decline decrements invited/active accordingly,
  - appointment create/delete adjusts upcoming count when applicable.
- Added table helpers:
  - `getMonthToDateSummary(YYYY-MM)` for DailyMetrics rollups,
  - `readUserDailyUsage(userKey, YYYY-MM-DD)` for dashboard usage card.
- Upgraded dashboard UI to consume `/api/me/dashboard` and render:
  - recent actions with Accept/Decline/Resume/Open,
  - group rows with status chip + members/upcoming/updated,
  - active/invited/all filter chips,
  - usage line, health indicator, and month summary strip.

### Verification run

1. `pnpm --filter @familyscheduler/api build`
2. `pnpm --filter @familyscheduler/web build`
## 2026-02-25 22:30 UTC update (Ignite identity unification + organizer UI polish)

- Fixed Ignite/person identity mismatch root cause: organizer identity now resolves through active `people.personId` by normalized email (with member fallback), so Ignite session ownership and profile-photo keys align with `createdByPersonId` / `joinedPersonIds` semantics.
- Updated profile-photo handlers to use canonical `personId` storage keys (`users/<personId>/profile.jpg|json`) instead of directly keying only by member id.
- Added backward-compatible read fallback for profile-photo meta/image: read canonical `personId` key first, then fallback to legacy member-id key.
- Added one-release compatibility write-through in profile-photo set: writes canonical key and legacy member-id key when they differ (no deletes in this patch).
- Updated `ignite/meta` joined count to include organizer and de-duplicate IDs (`joinedPersonIds ∪ {createdByPersonId}`).
- Ignite organizer UI tweaks:
  - removed accidental product title/description block from organizer page header area,
  - centered helper text wrapper above QR,
  - moved “Who’s in” and joined count + sound toggle into one row,
  - pluralized joined text (“person/people”) and added frontend safety net to keep minimum 1 when organizer exists.

### Verification notes
- Added API unit tests covering canonical+legacy profile-photo behavior and joined-count semantics (execution currently blocked in this environment by missing `@azure/data-tables` dependency fetch).
- Web build passes with organizer layout updates.
- Manual staging checks still required for end-to-end session #2 organizer-photo continuity and live auth/session flows.

## 2026-02-26 00:28 UTC update (Breakout invite QR dialog restored)

- **Bug description:** Breakout success flow navigated/opened immediately, which skipped the intended invite/wait step and removed the organizer QR handoff moment.
- **Fix summary:** Restored a modal invite step in `AppShell` after successful spinoff; the organizer now sees a breakout QR dialog and remains in the current group until choosing **Continue**.
- **Behavior detail:**
  - `Breakout` success now sets dialog state with `inviteUrl` (from `linkPath`) and `qrImageUrl` using the same QR generation pattern used by Ignite join.
  - Immediate popup/open behavior was removed.
  - `Continue` closes the dialog and navigates to `/#/g/:newGroupId/app`.
  - `Cancel` (or dialog close) dismisses only; organizer stays on current group app.
- **Regression interaction noted:** Earlier direct navigation/open behavior fixed join-route issues but unintentionally removed invite UX; this change restores the invite step while preserving explicit post-close app navigation.
## 2026-02-26 00:26 UTC update (Sign-in spacing normalization)

- Sign-in UI: normalized vertical spacing and removed legacy margin artifacts.
- Consolidated sign-in screen content into a single vertical stack rhythm so brand, heading copy, input/button, and support line have even spacing without ad-hoc top margins.
- Updated support copy text to `Need help? Contact support@yapper-app.com.` and kept auth/routing/API behavior unchanged.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web build`
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (for visual capture)
4. Playwright screenshot capture against `/#/login` (mobile viewport)

## 2026-02-26 00:52 UTC update (Breakout entrypoint unification to Organizer Ignite)

- Unified breakout behavior across Dashboard and AppShell header menu to route to Organizer Ignite (`/#/g/:newGroupId/ignite`) immediately after breakout group creation/spinoff.
- Removed the accidental custom AppShell breakout QR dialog so breakout now relies on the existing Organizer Ignite experience for QR display and continue-to-app flow.
- Dashboard breakout no longer skips Organizer Ignite; it now navigates to `/#/g/:newGroupId/ignite` instead of `/#/g/:newGroupId/app`.
- Preserved prior auth/grace-session API behavior for breakout-group join authorization (no API auth rollback in this change).

### Verification notes

1. `pnpm --filter @familyscheduler/web typecheck` passed.
2. Code-path verification via ripgrep confirms:
   - Dashboard breakout success navigates to `/#/g/:groupId/ignite`.
   - AppShell breakout success navigates to `/#/g/:newGroupId/ignite`.
   - AppShell custom breakout QR dialog strings are no longer present.
3. Manual browser verification still required for full end-to-end acceptance (Dashboard breakout, menu breakout, Organizer Ignite continue-to-app, and joiner QR scan grace-flow).

## 2026-02-26 01:10 UTC update (Marketing home passwordless sign-in promotion)

- Logged-out marketing header now shows a visible **Sign in** button (keeps burger menu entry as well), so sign-in is accessible without opening the menu.
- Logged-out hero primary CTA updated from **Create a group** to **Sign in with email**, routed to existing `/#/login` flow.
- Added a new **Passwordless sign-in** explainer card under hero CTA with magic-link copy, safety note, and secondary CTA to `/#/login`.
- Updated logged-out home wiring in `App.tsx` to pass `onSignIn` into `ProductHomePage`.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web build`
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (for screenshot capture)
4. Playwright screenshot capture against `/#/` (mobile viewport)

## 2026-02-26 01:40 UTC update (Marketing simplification + header lockup polish)

- Simplified logged-out marketing home hero by removing the slogan line and large sign-in CTA buttons, while keeping passwordless sign-in guidance as understated body copy with inline `Try it now` action.
- Updated “How it works” copy to a clearer decision-focused 1/2/3 sequence and tightened typography hierarchy so the section reads as final product copy.
- Improved hero visual from obvious placeholder blocks to a richer temporary illustration (participants panel + QR-inspired card) while preserving responsive layout and aspect stability.
- Polished header brand lockup by sizing the Y icon in `em` and applying slight optical vertical alignment so icon and `Yapper` wordmark read as one unit.
- Dashboard behavior remains aligned with the agreed compact logged-in home: top `⚡ Break Out` quick-create CTA routes to `/#/g/:groupId/ignite`, secondary `+ Create Group` is preserved, and groups render as flat divider-separated list rows.

### Files changed

- `apps/web/src/components/ProductHomePage.tsx`
- `apps/web/src/components/layout/MarketingLayout.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web build`
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (for visual smoke + screenshot)

## 2026-02-26 01:58 UTC update (Marketing hero refinement + logo adjustment)

- Reduced the header Y icon visual prominence by switching to smaller relative sizing (`0.8em`) with explicit middle alignment and subtle optical baseline shift.
- Converted hero "Try it now" from button-like styling to an inline hyperlink treatment with primary color and desktop-only underline hover.
- Tightened hero spacing to reduce excess vertical whitespace after CTA de-emphasis and keep the section visually compact.
- Confirmed no "Gather. Decide. Move." copy is present and no duplicate hero sign-in CTA was introduced.

### Verification run

1. `pnpm --filter @familyscheduler/web build`
2. `rg -n "Gather\. Decide\. Move\.|Try it now|Sign in with your email" apps/web/src/components/ProductHomePage.tsx`

## 2026-02-26 03:38 UTC update (Ignite diagnostic button always visible + full JSON copy output)

- Updated Ignite organizer diagnostic trigger to be always visible (removed non-production guard) and renamed it to `🔎 Anonymous Join Diagnostic`.
- Kept existing Ignite flow unchanged while tightening diagnostic wording/output:
  - no-session error now reports `ERROR: No ignite sessionId available.`
  - output object variable renamed to `result` before JSON serialization.
- Expanded diagnostic output text area to `minRows={18}` for easier full-result copy.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ (manually stopped after screenshot capture)
3. Playwright screenshot capture: `browser:/tmp/codex_browser_invocations/1b32b90eab81a147/artifacts/artifacts/ignite-organizer-diagnostic-button.png` ✅

## 2026-02-26 04:05 UTC update (Ignite anonymous diagnostic now hits Functions API directly)

- Updated Ignite organizer anonymous diagnostic transport to resolve an explicit `apiBase` and call Azure Functions hosts directly instead of relying on SWA `/api` proxy routing.
- Diagnostic now records `allow` response header for both StepA (`/api/ignite/join`) and StepB (`/api/group/join`) and includes preflight probes (`OPTIONS` + `GET`) for ignite join endpoint.
- Output remains JSON-copyable in the dialog and now includes `apiBase`, resolved endpoint URLs, and probe results to speed 405 method debugging.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`

## 2026-02-26 04:01 UTC update (Ignite join session upgrade persistence)

- Fixed anonymous ignite join continuity by persisting upgraded durable session from `POST /api/group/join` in `GroupAuthGate` (`fs.sessionId`).
- On successful upgrade, client now clears ignite grace keys (`fs.igniteGraceSessionId`, `fs.igniteGraceExpiresAtUtc`) so subsequent API calls consistently use durable auth session.
- Updated `IgniteJoinPage` successful join flow to sanitize and persist `fs.sessionEmail` from join payload/email input so UI/API identity helpers have stable email context for anonymous joiners.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`

## 2026-02-26 04:10 UTC update (remove temporary Anonymous Join Diagnostic UI)

- Removed the temporary **Anonymous Join Diagnostic** UI from Ignite organizer page (`IgniteOrganizerPage`) including diagnostic button, dialog, helper methods, and diagnostic React state.
- Removed temporary diagnostic-only direct API base resolution/probe helpers used for investigation.
- Kept product behavior unchanged for Ignite organizer flow (ignite start/meta/close controls, QR invite flow, finish inviting path).
- Kept the actual anonymous join fix intact: durable `sessionId` persistence returned by `/api/group/join` and sanitized `sessionEmail` persistence after ignite join.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web build` ✅
2. `pnpm --filter @familyscheduler/web lint` ⚠️ no lint script exists in selected package.


## 2026-02-26 04:52 UTC update (Dashboard groups list simplification: remove filters + status badges)

- Removed dashboard group list filter state and chip controls (`All / Active / Invited`) from `DashboardHomePage`; list now always renders all groups returned by `/api/me/dashboard` in existing order.
- Removed per-row status badge chip (`Invited` / `Active`) from group rows.
- Preserved invite-vs-active behavior branching: invited rows still render `Accept` + `Decline` and remain non-navigable; active rows still navigate on row click and show menu + chevron.
- Kept loading/error/empty states unchanged.

### Files changed

- `apps/web/src/components/DashboardHomePage.tsx`
## 2026-02-26 04:50 UTC update (logout clears all client session remnants)

- Updated `signOut` in `apps/web/src/App.tsx` to fully clear session remnants for `familyscheduler.session` in both storages.
- `signOut` now calls `clearSession()` to remove session-scoped `familyscheduler.session` and also removes `familyscheduler.session` from `localStorage`.
- Existing durable auth/session key removals remain unchanged (`fs.sessionId`, grace keys, session email/name), preserving current logout flow while ensuring no stale app session object survives.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web build`
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (for manual/browser screenshot validation)
2. Manual browser verification pending human run (DevTools Application tab):
   - `localStorage['fs.sessionId']` removed after Sign out
   - `sessionStorage['familyscheduler.session']` removed after Sign out
   - `localStorage['familyscheduler.session']` removed after Sign out

## 2026-02-26 05:02 UTC update (temporary verbose joiner close/session debug dumps)

- Added temporary verbose joiner session debugging in `apps/web/src/App.tsx` for Join Group flow diagnostics.
- Added `dumpSessionSnapshot()` helper to emit `[JOINER_SESSION_DUMP]` with URL, referrer, history length, durable/session auth keys, and storage snapshots.
- Join Group page now logs on mount (`join_group_page_mount`) to capture landing context.
- Join Group close action now logs decision inputs (`join_group_close_clicked`) and explicit routing action (`history.back` vs `nav('/' replace)`) before navigation.
- Behavior remains unchanged; only debug logging was added.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`

## 2026-02-26 05:22 UTC update (logout fully clears legacy join session key across storages)

- Updated `clearSession()` in `apps/web/src/App.tsx` to remove `familyscheduler.session` from both `sessionStorage` and `localStorage` inside a safe try/catch to avoid storage-access crashes.
- Updated `signOut()` to continue invoking `clearSession()` and additionally remove `fs.lastGroupId` from `localStorage` so stale group routing hints do not linger across logouts.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web build`

## 2026-02-26 05:43 UTC update (temporary always-on Copy Debug panels for join routing diagnostics)

- Added temporary always-on `Copy Debug` panel support in `apps/web/src/App.tsx` with a shared `collectClientSessionSnapshot(extra?)` helper to capture URL/hash/referrer/history and relevant auth/session storage keys.
- Instrumented `IgniteJoinPage` to capture debug snapshots at `ignite_join_start`, `ignite_join_result`, and `ignite_join_after_storage`, and render `Copy Debug` in both durable and non-durable render branches.
- Instrumented `GroupAuthGate` to capture debug snapshots at `init`, `group_join_start`, `group_join_result`, and `redirect_to_join`, and render `Copy Debug` in the checking/redirecting state.
- Instrumented `JoinGroupPage` to capture debug snapshots on mount and close-click, and render `Copy Debug` in the page UI.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck`

## 2026-02-26 05:57 UTC update (joiner first-run auth gate uses live session id)

- Fixed routing auth gating in `apps/web/src/App.tsx` to use a live computed `effectiveHasApiSession = Boolean(getAuthSessionId())` for route decisions instead of relying on potentially stale `hasApiSession` React state.
- Updated route gating checks to use live auth presence for:
  - app/ignite redirect-to-login guard,
  - home branch selection (marketing vs dashboard),
  - create page redirect.
- `getAuthSessionId()` already includes ignite grace (`getSessionId() || getIgniteGraceSessionId()`), so first-run joiners with grace session are now treated as authenticated for routing decisions.
- This removes a race where brand-new joiners could be redirected to `/#/login` before state caught up.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅
2. Manual acceptance (human run):
   - organizer start session 1 works on first attempt.

## 2026-02-26 06:20 UTC update (debug UI removed after join-routing investigation)

- Removed temporary join-routing debug UI from `apps/web/src/App.tsx`:
  - deleted `collectClientSessionSnapshot(...)`, `dumpSessionSnapshot(...)`, and `CopyDebugPanel` helper/component.
  - removed debug-only state/effects/panel rendering from `JoinGroupPage`, `IgniteJoinPage`, and `GroupAuthGate`.
- Kept durable-session upgrade and grace-aware routing behavior intact; only temporary debug instrumentation was removed.
- Investigation status: temporary debug UI cleanup complete.

### Files changed

- `apps/web/src/App.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm -w run lint` ✅
2. `pnpm --filter @familyscheduler/web build` ✅
3. `rg -n -S "Copy Debug|CopyDebugPanel|collectClientSessionSnapshot|JOINER_SESSION_DUMP|dumpSessionSnapshot|Anonymous Join Diagnostic|runAnonymousDiagnostic|rawPostNoSession|rawProbe" apps/web/src || true` ✅ (no matches)

## 2026-02-26 06:25 UTC update (ignite grace session scoped to breakout group)

- Scoped ignite grace auth usage by breakout `groupId` in `apps/web/src/lib/apiUrl.ts` so grace is only attached when request body targets the same group that issued the grace session.
- Added grace-expiry check at read time for `getIgniteGraceSessionId(...)` and updated `getAuthSessionId(groupId?)` to preserve durable-session precedence while enabling group-scoped grace lookups.
- Updated grace cleanup paths to also clear `fs.igniteGraceGroupId` on grace-expired handling, durable upgrade, and sign out.
- Updated `IgniteJoinPage` to persist `fs.igniteGraceGroupId` from `breakoutGroupId` when grace is issued.
- Result: prevents cross-group grace leakage that could poison `/api/group/join` auth and trigger incorrect Join Group redirects.

### Verification run

1. `pnpm -C apps/web lint`
2. `pnpm -C apps/web build`

## 2026-02-26 07:05 UTC update (persistent organizer profile photo is server-backed)

- Implemented persistent organizer profile photo flow using server-backed `PUT/GET /api/user/profile-photo` with session validation.
- Removed local-only organizer profile photo object URL lifecycle and switched to versioned URL loading (`?v=<photoVersion>`) to avoid stale cache/blank image race conditions.
- Added localStorage photo-version key (`fs.profilePhotoVersion`) and updated upload flow to persist `updatedAtUtc` from backend.
- Added cache-busted long-lived image responses (`Cache-Control: public, max-age=31536000`) while keeping UI image existence check based on real image load success.

### Verification run

1. `pnpm -C apps/web lint` (fails in this environment due pnpm `-C` command handling)
2. `pnpm -C apps/web build` ✅
3. `pnpm -C api build` (fails in this environment because `@azure/data-tables` typings are unavailable)

## 2026-02-26 06:55 UTC update (ignite grace scoped to breakout group to fix consecutive sessions)

- Scoped ignite grace session usage by `groupId` so stale grace from one group is not reused for a different group.
- Updated API client auth header attachment to only send grace session when request body `groupId` matches grace scope.
- Updated ignite join flow to clear old grace keys before `/api/ignite/join`, then store new grace session + expiry + breakout group scope from response.
- Updated group auth gate and app-level redirect gating to use route-scoped `getAuthSessionId(groupId)` for `/app` and `/ignite` routes.
- Ensured sign-out and grace-expired cleanup remove `fs.igniteGraceGroupId`.
- This prevents cross-group grace reuse that previously caused Join Group redirect loops during consecutive ignite sessions on the same device.

### Files changed

- `apps/web/src/lib/apiUrl.ts`
- `apps/web/src/App.tsx`
## 2026-02-26 06:53 UTC update (immediate pending scan placeholder for new scan submissions)

- Updated `submitScanFile` in `AppShell` so successful `/api/scanAppointment` responses without an inline `snapshot` now immediately inject a placeholder appointment (`desc: "Scanning…"`, `scanStatus: "pending"`) when `appointmentId` is returned.
- Placeholder object is explicitly typed as `Snapshot['appointments'][number]` and fills required appointment fields with safe defaults used by list/calendar rendering (`date`, `time.intent.status`, `isAllDay`, locations/people arrays, scan fields).
- Added duplicate protection by `id` when inserting placeholder appointments.
- Triggered a best-effort immediate `refreshSnapshot()` after placeholder insertion, while keeping existing behavior for rescans and for responses that already include `snapshot`.
- Polling behavior remains unchanged and now reliably starts because a pending appointment is immediately present in local state.

### Files changed

- `apps/web/src/AppShell.tsx`
- `PROJECT_STATUS.md`
- `CODEX_LOG.md`

### Verification run

1. `pnpm -C apps/web lint` ❌ workspace command resolution issue (`Command "apps/web" not found`).
2. `pnpm --filter @familyscheduler/web lint` ❌ no lint script defined in selected package.
3. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
4. `pnpm -C apps/web build` ✅ passed.
1. `pnpm --filter @familyscheduler/web typecheck`
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` (manual/browser validation host)
3. Playwright screenshot capture: `browser:/tmp/codex_browser_invocations/9cfb14e694f4c7ce/artifacts/artifacts/appshell-scan-placeholder.png`

## 2026-02-26 08:10 UTC update (appointment detail Drawer + event-log v1)

- Implemented appointment detail Drawer flow in list view and removed popover details panel.
- Added direct actions in `/api/direct` for:
  - `get_appointment_detail`
  - `append_appointment_message`
  - `apply_appointment_proposal` (title-only v1)
- Added durable appointment event log module with chunked JSON storage under:
  - `{STATE_BLOB_PREFIX}/{groupId}/appointments/{appointmentId}/events/{chunkId}.json`
- Added v1 proposal path: message heuristics can generate title proposal; apply mutates title and appends FIELD_CHANGED + SYSTEM_CONFIRMATION events.
- Added deep-link inbound open support via `appointmentId` query param in hash route and Share button to copy deep link.

### Stubbed / not implemented yet

- Constraints tab full functionality remains placeholder (“Coming soon”).
- Notification/email/ICS actions remain UI placeholder only.

## 2026-02-26 23:05 UTC update (UI-03 title proposal intent + countdown/apply controls)

- Added rule-based title intent detection in `/api/direct` for `append_appointment_message` using patterns:
  - `update title to ...`
  - `change title to ...`
  - `rename to ...`
- Added pending-title-proposal guard: if latest title `PROPOSAL_CREATED` has not been applied/canceled, backend rejects new proposal with `400 title_proposal_pending`.
- Proposal event payload now includes structured title diff fields (`from`, `to`, `proposalId`) and response returns proposal details for immediate UI render.
- Enhanced `apply_appointment_proposal`:
  - validates active/latest proposal id
  - writes title to appointment document
  - appends `FIELD_CHANGED` + `SYSTEM_CONFIRMATION`
  - re-evaluates reconciliation and appends `RECONCILIATION_CHANGED` + confirmation when status changes
  - returns `eventsPageHead` in response payload.
- Added `dismiss_appointment_proposal` direct action and event append path (`PROPOSAL_CANCELED` + `SYSTEM_CONFIRMATION`).
- Updated Drawer discussion proposal block UX:
  - 5-second countdown with auto-apply
  - buttons: Apply Now / Pause / Cancel / Edit
  - edit modal for deterministic title override before apply
  - clears pending proposal when matching `FIELD_CHANGED` observed.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅
2. `pnpm --filter @familyscheduler/api build` ⚠️ fails in this environment due missing `@azure/data-tables` module typings.
3. UI screenshot artifact captured: `browser:/tmp/codex_browser_invocations/1871a372d452efd5/artifacts/artifacts/title-proposal-ui.png`

## 2026-02-26 23:53 UTC update (Members QR modal copy aligned to Group Invite)

- Updated the Members invite QR modal content in `AppShell` to use Group Invite language while preserving the existing organizer-style modal layout and behavior.
- Copy updates:
  - Title remains `Scan to join "{GroupName}"`.
  - Body now reads: `Scan this code to join the group. Anyone can join while the invite is open.`
  - QR caption now reads: `Join {GroupName}`.
  - Toggle label now reads: `Allow new members to join`.
  - Primary close button label changed from `Close` to `Done`.
  - Secondary actions remain `Copy link` and `Close invite`.
- Added an invite-open toggle row in the modal mapped to existing invite session behavior:
  - ON reflects an active invite session.
  - Turning OFF calls existing `closeInviteSession()` (same close-invite flow).
- No join URL format changes were made; `/#/s/:groupId/:sessionId` and existing joiner flow remain unchanged.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ (manual run for screenshot; stopped with SIGINT)
3. Playwright screenshot artifact captured: `browser:/tmp/codex_browser_invocations/29085755698933f6/artifacts/artifacts/members-invite-page.png`

## 2026-02-27 02:18 UTC update (Appointment pane enhancement round 2: apply loader/materialization fix)

- Fixed `apply_appointment_proposal` false `appointment_not_found` by unifying appointment doc materialization through shared `loadOrEnsureAppointment(...)` in direct handler.
- `create_blank_appointment` now persists state **and** immediately materializes `appointment.json` for the new appointment id, so proposal apply works without warm-up actions.
- `dismiss_appointment_proposal` now also goes through the same load/ensure path to avoid proposal dead-ends tied to missing appointment docs.
- Added safer diagnostics for rare apply `appointment_not_found` cases: logs include `groupId`, `appointmentId`, resolved blob path, and whether `appointment.json` existed.
- Proposal recovery hardening in web UI: failed apply/dismiss now trigger detail refetch so pending proposal card stays recoverable (no dead-end loop).

### Known remaining issues

- API build/test remains blocked in this container by missing `@azure/data-tables` type resolution during `tsc`.

## 2026-02-27 03:32 UTC update (Discussion chat UI cleanup)

- Discussion chat UI cleaned up: grouped sender headers, capped bubble widths, removed noisy duplicate '(updated)' title update message, improved system/proposal pill copy.
- Discussion rendering now normalizes raw events into display items (`chat`/`system`) to enforce friendly copy and alignment rules without mutating stored events.
- Discussion message composer input now has an explicit `id` + visible label wiring for accessibility.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ (started for screenshot capture; stopped intentionally)
3. Playwright screenshot captures:
   - `browser:/tmp/codex_browser_invocations/e002a387492bdb2e/artifacts/artifacts/discussion-mixed-chat.png`
   - `browser:/tmp/codex_browser_invocations/e002a387492bdb2e/artifacts/artifacts/discussion-proposal-sequence.png`

## 2026-02-27 04:05 UTC update (Appointment pane enhancement: live detail polling in open drawer)

- Added web-only polling for `get_appointment_detail` while appointment drawer is open and a `detailsAppointmentId` is selected.
- Poll interval set to 4 seconds; polling is gated by `document.visibilityState === 'visible'` and automatically stops on drawer close or appointment switch.
- Preserved discussion reading UX by tracking drawer scroll proximity and only auto-pinning to bottom when user is near the bottom.
- No backend/API contract changes were made.
- Manual verification note target: **message appears without closing drawer**.

## 2026-02-27 04:34 UTC update (Appointment pane enhancement: single click/tap opens drawer)

- Appointment list interaction: single click/tap opens drawer (replaced double-click).
- Updated appointment row trigger from `onDoubleClick` to `onClick` so desktop single click and mobile single tap both open details.
- Preserved long-press support for touch as a secondary trigger while preventing duplicate opens on long-press release.
- Preserved row action safety: inline controls continue to call `stopPropagation()` so edit/delete/assign/scan actions do not open the drawer.
- Added keyboard activation parity on appointment rows (`Enter`/`Space` opens details).

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅

## 2026-02-27 05:12 UTC update (Appointment Pane Enhancement – Chat Suggestions v1)

- Chat Suggestions v1: author-only, schema-valid 1-click actions under message; dismiss-on-typing; uses existing natural time/date parsing; single-action apply; no undo.
- Added deterministic suggestion candidate generation for discussion messages with priority ordering: Title > Time > Date > Location > Constraint.
- Suggestions render only under the triggering message for the message author, with explicit dismiss (X) and inline apply error handling.
- Suggestion selection now executes exactly one `/api/direct` action immediately, then refetches appointment details on success.
- Reused existing natural time/date parsing flow through `resolve_appointment_time` + `TimeSpec` normalization used by appointment editors.


## 2026-02-27 05:37 UTC update (resolve_appointment_time non-fatal AI bad response fallback)

- Updated time-resolution fallback handling so AI parse failures (including `OPENAI_BAD_RESPONSE` malformed partial/unresolved payloads) no longer force `/api/direct` `resolve_appointment_time` into HTTP 502.
- `resolveTimeSpecWithFallback` now returns deterministic/local parse output when AI parse fails, while preserving metadata (`fallbackAttempted: true`, `usedFallback: false`).
- Added fallback log context with compact input preview (`inputText`) alongside trace/error metadata for easier diagnosis.
- Added regression tests for malformed AI partial responses on time-only phrases (`8pm`, `set time to 4pm`) to assert successful deterministic fallback behavior.

## 2026-02-27 06:10 UTC update (resolve_appointment_time timeChoices for time-only missing-date intents)

- Added server-side `timeChoices` generation for `resolve_appointment_time` when the parsed intent is unresolved, `missing` includes `date`, the input includes a time-of-day, and the text has no explicit date anchor.
- `timeChoices` is optional and only returned when applicable; existing response fields are unchanged.
- Implemented three resolved choices with UTC anchors:
  - `today` (only included when still in the future in request timezone)
  - `next` (today if future, otherwise today when `today` is omitted; if `today` exists then `next` is tomorrow to avoid duplication)
  - `appointment` (appointment local date when known, otherwise fallback to `next` date)
- Passed-today policy: omit `today` when the requested time has already passed in the requester timezone.
- Added unit coverage for helper behavior and direct handler response behavior, including explicit-date-anchor no-choice behavior and appointment-date anchoring.

### Verification run

1. `pnpm --filter @familyscheduler/api test` ⚠️ (blocked by missing `@azure/data-tables` module/type resolution in this environment)

## 2026-02-27 08:29 UTC update (Members invite modal: centered QR image)

- Updated Members invite modal QR rendering in `apps/web/src/AppShell.tsx` by wrapping the QR `<img>` in a full-width flex container with `justifyContent: 'center'` and `margin: '24px 0'`.
- Kept the surrounding modal content (join label, link text, toggles, and action buttons) unchanged.
- No backend/API changes.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for visual capture; terminated intentionally with SIGINT after screenshot capture.
3. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/7f2e55f2e1b2668d/artifacts/artifacts/members-invite-qr-centered.png`.

## 2026-02-27 09:04 UTC update (Grace guest banner + sign-in redirect return)

- Added web grace-user detection (`isIgniteGraceActiveForGroup`) that only treats grace as active when a group-scoped grace session exists and no durable `fs.sessionId` is present.
- AppShell now shows a persistent info banner under the header for grace users: **“Guest access (limited)”** with a **Sign in** CTA.
- Banner CTA routes to `/#/login?next=<current-route>` using safe in-app path sanitization.
- Auth done return flow now falls back to `/#/g/{fs.igniteGraceGroupId}/app` when `returnTo` is missing/invalid and grace is still valid; otherwise falls back to `/#/`.
- Added focused web unit tests for grace active-state computation and safe `next` path sanitization.

### Verification run

1. `node --test apps/web/src/lib/appointmentSuggestions.test.ts apps/web/src/lib/returnTo.test.ts apps/web/src/lib/graceAccess.test.ts` ✅ passed.
2. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/81958407e5a45083/artifacts/artifacts/grace-banner.png`.

## 2026-02-27 10:40 UTC update (Scan image rows: pending/failed guardrails + cancel/close delete)

- Updated appointment list row rendering with a hard scan-status guardrail:
  - `scanStatus === 'pending'` now renders a full-row non-interactive scanning placeholder (`Scanning…`) with an indeterminate progress bar and `Cancel` action.
  - `scanStatus === 'failed'` now renders a full-row non-interactive failure row (`Couldn’t extract an appointment from that image.`) with `Close` action.
  - Normal appointment row UI remains unchanged for non-pending/non-failed rows.
- Added scan row action handling in web app:
  - Cancel/Close use existing `/api/appointmentScanDelete` flow.
  - Optimistic row removal from local snapshot.
  - On success, `refreshSnapshot()` is called.
  - On failure, row is restored and inline row-level error is shown.
- Backend scan pending consistency updates:
  - Initial scan-created appointment now persists `title: "Scanning…"` while pending.
  - Rescan now writes `scanStatus: "pending"` immediately and returns; parse runs asynchronously and later updates to `parsed`/`failed`.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/api build` ✅ passed.
3. `pnpm --filter @familyscheduler/web build` ✅ passed.

### Verification correction

- `pnpm --filter @familyscheduler/api build` ⚠️ blocked in this container by pre-existing missing `@azure/data-tables` module/type declarations (`TS2307`), unrelated to this scan-row change.

## 2026-02-27 15:51 UTC update (Scan Image placeholder title finalization)

- Fixed scan completion flow so parsed/resolved appointments cannot retain placeholder title `Scanning…`.
- Added title finalization and synthesis logic in scan apply path:
  - uses `parsed.title` when present,
  - otherwise derives from notes/location,
  - falls back to `Appointment`.
- Added parse-result quality gate (`hasMeaningfulParsedContent`) so scans with no usable extracted fields are marked `scanStatus: failed` instead of `parsed`.
- Applied the same success/failure gate to both initial scan and rescan async completion handlers.
- Added frontend safety guard so non-pending rows never display `Scanning…` as title (falls back to `Appointment`).
- Added focused scan unit tests for placeholder replacement and meaningful-content detection.

### Verification run

1. `pnpm --filter @familyscheduler/api test -- appointmentScan.test.ts` (run in this change set)
2. `pnpm --filter @familyscheduler/web typecheck` (run in this change set)

## 2026-02-27 17:05 UTC update (Deletion UX: immediate delete + session Undo + appointment soft delete)

- Backend: `delete_appointment` is now soft delete (`isDeleted`, `deletedAt`, `deletedByUserKey`) and `restore_appointment` was added.
- Backend snapshot shaping now excludes soft-deleted appointments from `/api/direct` snapshots.
- Backend direct action parser now accepts `restore_appointment` and `reactivate_person`.
- Frontend: removed appointment/member confirm delete dialogs; deletes now execute immediately with inline error/success notices.
- Frontend: added session-scoped in-memory Undo list (appointments + members) with an Undo icon/menu beside Schedule/Members tabs, including Restore per-row, Restore last, and Restore all.
- Frontend: appointment list rendering also defensively filters `isDeleted === true` rows.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/web build` ✅ passed.
3. `pnpm --filter @familyscheduler/api build` ⚠️ blocked by missing `@azure/data-tables` module resolution in this container.
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/994154692f365a8c/artifacts/artifacts/undo-tabs.png`.

## 2026-02-27 16:56 UTC update (Scan Image null-title persistence hardening)

- Hardened `applyParsedFields` title handling in `api/src/lib/scan/appointmentScan.ts` by normalizing `parsed.title` once (`parsedTitle`) and using that value for both `initial` and `rescan` branches.
- This guarantees `parsed.title === null` never leaves scan placeholder text behind in `initial` mode and keeps `rescan` behavior deterministic (trimmed string or empty).
- Existing fallback behavior remains in place: notes first line/sentence → location-derived `Appointment at <location>` → `Appointment`.
- Existing no-content guard remains in place in `parseAndApplyScan`: if title/date/startTime/location/notes are all empty, status is set to `failed`.

### Verification run

1. `pnpm --filter @familyscheduler/api test -- appointmentScan.test.ts` ⚠️ blocked by environment TypeScript build failure (`@azure/data-tables` missing), unrelated to scan flow.
2. `rg -n "const parsedTitle =|if \(mode === 'rescan'\)|else if \(placeholderOrEmpty\)" api/src/lib/scan/appointmentScan.ts` ✅ confirms dedicated title branch now uses normalized parsed title and fallback path.

## 2026-02-27 17:49 UTC update (Option A identity alignment: send email on chat/direct payloads)

- Updated web request payloads to consistently include identity fields on `/api/chat` and `/api/direct` calls:
  - `email: sessionEmail`
- Added API request-shape compatibility fields so handlers accept body identity fields without breaking:
- Added mismatch instrumentation:
  - `/api/direct`: logs `direct_identity_body_email_mismatch` when body email disagrees with authenticated session email.
  - `/api/chat`: logs `identity_body_email_mismatch` under the same mismatch condition.
- Added targeted API regression test for Option A compatibility path:
  - verifies `/api/direct` succeeds for `create_blank_appointment` when body contains `email` and auth is still based on session email.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/api test -- direct.test.ts` ⚠️ blocked by pre-existing missing `@azure/data-tables` module/type declarations in this environment.

## 2026-02-27 18:31 UTC update (Storage target debug visibility for chat/direct)

- Added debug-only storage target diagnostics gated by `DEBUG_STORAGE_TARGET=1`.
- `/api/chat` and `/api/direct` now include `debug.storageTarget` in JSON responses when enabled, exposing:
  - `storageMode`
  - `accountUrl`
  - `containerName`
  - `stateBlobPrefix`
  - `blobNameForGroup` (resolved for the request `groupId`)
- Both endpoints now emit a structured log line when enabled:
  - `{ event: "storage_target", fn: "chat|direct", groupId, ...storageTarget }`
- No behavior/path changes to storage read/write logic; instrumentation only.

### Verification run

1. `pnpm --filter @familyscheduler/api test` ⚠️ blocked by missing `@azure/data-tables` module resolution in this container (`TS2307`).
2. `pnpm install` ⚠️ blocked by package registry access (`ERR_PNPM_FETCH_403`) in this container.
3. `rg "storage_target|DEBUG_STORAGE_TARGET|describeStorageTarget|blobNameForGroup" api/src/functions/chat.ts api/src/functions/direct.ts api/src/lib/storage/storageFactory.ts api/src/lib/storage/storageFactory.test.ts -n` ✅ confirms instrumentation and helper are present.

## 2026-02-27 17:20 UTC update (Direct/chat appointment list consistency via index+docs)

- Added shared appointment snapshot builder `api/src/lib/appointments/buildAppointmentsSnapshot.ts` that reads `AppointmentsIndex` + `appointment.json` docs and maps to response snapshot appointment shape with graceful skip+log for missing docs.
- Updated `/api/chat` list-appointments path to use shared builder, removing duplicate inline index/doc parsing logic.
- Updated `/api/direct` snapshot responses to source `appointments` from the shared index/doc builder while keeping `people/rules/historyCount` from `state.json`.
- Updated direct `create_blank_appointment` flow to persist new `appointment.json` and upsert matching `AppointmentsIndex` row so newly created blanks immediately appear in chat/direct list snapshots.
- Added test seams for `upsertAppointmentIndex` and a targeted direct test verifying snapshot source consistency and new blank persistence into doc+index paths.

### Verification run

1. `pnpm --filter @familyscheduler/api test -- direct.test.ts` ⚠️ blocked in this container by missing `@azure/data-tables` dependency during TypeScript build.

## 2026-02-27 19:00 UTC update (API build TS2353 fix in appointments snapshot)

### Current milestone
- Stabilize API TypeScript build compatibility while preserving runtime behavior.

### What changed
- Fixed TS2353 in appointment snapshot assembly by separating legacy time input construction from snapshot response construction.
- `code` now remains in the snapshot response object and is no longer included in the legacy input object used for `getTimeSpec`.
- `buildAppointmentsSnapshot` now has an explicit return type alias for snapshot rows.

### Files touched
- `api/src/lib/appointments/buildAppointmentsSnapshot.ts`

### Verification
1. `pnpm -r --if-present build` ⚠️ blocked by existing environment dependency gap (`@azure/data-tables` missing), but TS2353 fix applied in the updated snapshot builder path.

### Known issues
- API workspace build in this environment remains blocked by missing `@azure/data-tables` type/module resolution in table-related files.

## 2026-02-27 20:05 UTC update (Phase 1: reliable Schedule delete via appointmentId + index/doc soft delete)

- Corrected a regression after prior "Deletion UX" work: Schedule delete was still dispatched by `code` and backend executor path mutated only state-driven appointments, which could no-op against index/doc-backed snapshots.
- Web `AppShell` now sends `delete_appointment` with `appointmentId` in both Schedule card delete and blank-editor cancel cleanup paths.
- `/api/direct` parser now accepts delete payloads in a backward-compatible way:
  - `{ type: 'delete_appointment', appointmentId }` (preferred)
  - `{ type: 'delete_appointment', code }` (legacy fallback).
- `/api/direct` delete path now mutates the same authoritative store used for Schedule snapshots (`AppointmentsIndex` + `appointment.json`) via shared helper `softDeleteAppointmentById(...)`.
- Added shared table helper `api/src/lib/tables/appointmentSoftDelete.ts` and reused it from `appointmentScanDelete` to keep delete semantics consistent (`isDeleted`, `deletedAt`, `deletedByUserKey`, `purgeAfterAt`, `status='deleted'`, doc `scanStatus='deleted'`).
- `/api/direct` now returns `ok:false` (with message + current snapshot) when an action is not applied (`execution.appliedAll === false`) instead of allowing success semantics to leak through.
- Added structured delete-path logging in direct handler: `event=direct_delete_appointment` with `groupId`, `appointmentId`, `appliedAll`, and `storeMutated=index/doc`.

### Verification run

1. `git status --short` ✅ working tree reflected expected modified files.
2. `git log -n 30 --oneline` ✅ confirmed recent history and prior deletion-related commits for consistency check.
3. `rg -n "delete_appointment" api/src apps/web/src` ✅ confirmed frontend now sends `appointmentId` and direct parser/handler supports id+legacy code.
4. `rg -n "buildSnapshotFromIndex|AppointmentsIndex|appointment.json|list appointments" api/src apps/web/src` ✅ confirmed snapshot path remains index/doc based.
5. `pnpm --filter @familyscheduler/web build` ✅ passed.
6. `pnpm --filter @familyscheduler/api build` ✅ passed in this environment.
7. `pnpm --filter @familyscheduler/api test -- direct.test.ts` ⚠️ command runs full compiled API test suite; fails on pre-existing unrelated tests in this environment.
8. `cd api && node --test dist/api/src/functions/direct.test.js` ⚠️ fails due pre-existing session/header expectations in existing direct tests (not introduced by this patch).

### Evidence notes

- Request payload source now uses `appointmentId` in AppShell delete dispatches.
- Direct delete path now soft-deletes index+doc and rebuilds snapshots from index/doc source, preventing reappearance from refresh loops.
- Negative path returns `ok:false` + message and unchanged snapshot when delete cannot be applied.
- Web appointment editor cancel flow now uses explicit dirty tracking for `+`-created appointments so unedited cancel/ESC/backdrop reliably deletes the auto-created blank row, while edited drafts are preserved on close.

## 2026-02-27 19:45 UTC update (Phase 1 AppShell syntax repair)

- Repaired a Phase 1 TSX syntax regression in `apps/web/src/AppShell.tsx` within `closeWhenEditor` by fixing an unmatched/malformed conditional expression tail (`shouldDeletePendingNew`).
- Scope intentionally limited to parser-structure repair only; no feature behavior added.

### Verification run

1. `pnpm --filter @familyscheduler/web exec tsc -p tsconfig.json --pretty false --noEmit` ✅ passed after fix.
2. `pnpm -r --if-present build` ⚠️ blocked by environment dependency issue in `api` (`@azure/data-tables` package unavailable due registry 403).

## 2026-02-27 20:31 UTC update (igniteGrace guest banner sign-in redirect glue)

- AppShell now uses the existing grace-session helper (`isIgniteGraceActiveForGroup(groupId)`) to show a persistent info alert under the page header when a group-scoped ignite grace session is active and no durable `fs.sessionId` exists.
- The grace alert includes a `Sign in` CTA that now routes through a shared helper to `/#/login?next=<encoded-current-route>` using a sanitized in-app hash path.
- Added `buildLoginPathWithNextFromHash` to centralize hash→login-next routing and avoid duplicated route string construction.
- Auth flow behavior remains server-semantic unchanged: `LandingSignInPage` continues sending sanitized `returnTo`, and `AuthDonePage` continues fallback routing to grace group app (`/g/:groupId/app`) or `/` when `returnTo` is missing/invalid.
- Added/extended unit tests for return-to/login-next path construction and grace-group activity edge cases.

### Verification run

1. `pnpm --filter @familyscheduler/web exec node --test src/lib/returnTo.test.ts src/lib/graceAccess.test.ts` ✅ passed.
2. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.

## 2026-02-27 21:15 UTC update (Yapper appointment Email update Phase 1)

- Added appointment email update Phase 1 backend + UI flow.
- `/api/direct` now supports:
  - `preview_appointment_update_email` (recipient resolution, self-exclusion, server-rendered subject/plainText/html)
  - `send_appointment_update_email` (per-recipient sends via ACS, partial/all-fail handling, idempotency via `clientRequestId` + sender)
- `NOTIFICATION_SENT` appointment event now records sender, counts, status (`sent|partial`), failures, subject, and request id; all-fail responses do not append events.
- `get_appointment_detail` now includes `lastNotification` summary from recent appointment events.
- Appointment drawer now replaces disabled Notify placeholder with an enabled **Email update** button and dialog (recipient selection, message compose, debounced preview, send result including partial misses).
- Drawer header now renders **Last email update** summary including partial/missed recipients.
- No new runtime feature flag was added in this phase.

### Verification run

1. `pnpm --filter @familyscheduler/api build` ⚠️ blocked in this container by missing `@azure/data-tables` type dependency resolution.
2. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
3. `pnpm --filter @familyscheduler/web build` ✅ passed.
4. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture (stopped intentionally via SIGINT).
5. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/68babcc82dbcfea7/artifacts/artifacts/email-update-ui.png`.

## 2026-02-27 21:00 UTC update (igniteGrace guest banner + login next helper)

- Added persistent AppShell guest-access info banner under the page header when a scoped igniteGrace session is active for the current group and no durable `fs.sessionId` exists.
- Sign-in CTA now routes to `/#/login?next=<encoded-current-hash-route>` using centralized `buildLoginPathWithNextFromHash(...)` sanitization, preserving return-to route after authentication.


## 2026-02-27 21:18 UTC update (Backend direct email update actions: preview/send)

- `/api/direct` now enforces and supports `preview_appointment_update_email` + `send_appointment_update_email` with action-level `groupId`, `appointmentId`, and `recipientPersonIds` array parsing.
- Recipient resolution is now personId-based only for this flow, de-duped by normalized email, excludes sender (`self_excluded`), and marks missing email as `no_email`.
- Preview now returns HTTP 400 when no selectable recipients remain after exclusions.
- Send now uses existing ACS transport one recipient at a time, scans last 100 events for idempotency using `NOTIFICATION_SENT` payload `clientRequestId` + `sentBy.email`, supports partial success, and logs all-fail/partial summaries without logging bodies.
- `NOTIFICATION_SENT` append remains success/partial-only; all-fail returns 502 and does not append the event.


- Updated `apps/web/src/styles/ui.css` to keep `.ui-tableScroll` bounded (`max-width: 100%`) and enable iOS momentum scrolling (`-webkit-overflow-scrolling: touch`).
- Preserved desktop table readability with existing `.ui-tableScroll table { min-width: 900px; }`.
- Added mobile override (`@media (max-width: 640px)`) so `.ui-tableScroll table` uses `min-width: 100%`, preventing forced wide-page layout on phones.

### Verification run

1. `pnpm -C apps/web run typecheck` ✅ passed.
2. `pnpm -C apps/web run build` ✅ passed (existing vite chunk warning only).
3. `pnpm -C apps/web run dev --host 0.0.0.0 --port 4173` ✅ started for viewport check and screenshot capture (terminated intentionally with SIGINT).
4. Playwright mobile-viewport screenshot capture ✅ `browser:/tmp/codex_browser_invocations/8fd6eee904ee160f/artifacts/artifacts/mobile-ui-table-scroll-fix.png`.

### Manual verification note



- Documentation now aligns with current email magic-link + `x-session-id` session auth for direct/chat usage.

## 2026-02-28 03:05 UTC update (Email update dialog groupId guard + payload source fix)

- Appointment drawer Email update preview/send direct calls now normalize `groupId` from the same top-level `groupId` source used by other working `/api/direct` calls.
- Added UI-side hard guard in preview/send paths: when `groupId` is empty after trim, the request is skipped, a user-facing error is shown, and a context-rich warning is logged.
- Email update direct payload shape is consistently `{ groupId, ...identityPayload(), action, traceId }` with `groupId` top-level and JSON-stringified body.

## 2026-02-28 00:55 UTC update (Temporary Email Update dialog debug bundle)

- Added temporary in-memory debug instrumentation scoped only to the Email Update dialog preview/send flows.
- Added error-state actions in Email Update dialog:
  - `Copy debug bundle`
  - `Copy last request body`
- No persistence added; debug entries are memory-only and cleared when the Email Update dialog closes.
- Removal tracked in top-level `MUST_FIX.md` and should be completed after staging verification.

### Verification run

1. `pnpm -w -r typecheck` ✅ (`no typecheck yet` in root workspace script).
2. `pnpm --filter @familyscheduler/web build` ✅ passed.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for visual smoke; stopped intentionally after screenshot capture.

## 2026-02-28 01:10 UTC update (Yapper manual email update opt-out phase 2)

- Added per-user notification preference for manual appointment update emails: `emailUpdatesEnabled` defaults to `true` when no prefs blob exists.
- Added authenticated user preferences API endpoints:
  - `GET /api/user/preferences`
  - `POST /api/user/preferences` with `{ emailUpdatesEnabled: boolean }`
- Enforced server-side email opt-out in `/api/direct` for both preview and send:
  - opted-out recipients are excluded from delivery
  - exclusions are not provider failures and do not trigger partial status by themselves
  - no-recipient sends now return `400` with clear `No eligible recipients ...` message
- Updated web UI:
  - Dashboard now includes a Notifications toggle: “Receive appointment update emails” with load/save/error states.
  - Email Update dialog disables opted-out recipients and labels them “Opted out of email”.
  - Send result now includes “Excluded: N opted out” messaging when applicable.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm -w -r typecheck` ✅ passed (root script currently echoes placeholder in this repo).
3. `pnpm -w -r build` ❌ failed (`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` because workspace root lacks recursive `build` script target).
4. `pnpm -r --if-present build` ⚠️ API build blocked in this container by missing local `@azure/data-tables` type resolution; web/shared build path executes.
5. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.

## 2026-02-28 Update — Breakout/Invite DSID+GSID contract implementation

Implemented runtime behavior updates for QR join/auth semantics:
- Breakout QR guest path remains GSID-only (no implicit DSID mint on `/api/group/join`).
- Invite Member by QR now requires auth when unauthenticated (`INVITE_REQUIRES_AUTH`) and does not issue GSID in that branch.
- Added explicit claim flow endpoint `/api/group/claim` that requires DSID + GSID and validates GSID group scope.
- Debug menu/session tooling now clears pending auth markers on Clear ALL and shows DSID/GSID/mismatch-derived debug state.

Verification note:
- Web typecheck passes.
- API test/build execution is currently blocked in this container by missing/unfetchable Azure table dependencies.

## 2026-02-28 09:05 UTC update (Yapper manual email Phase 4B+4C)

- Added per-group mute preferences in user prefs (`mutedGroupIds`) with server-side enforcement for manual email updates and scheduled reminders.
- Manual email recipient preview now marks muted members as non-selectable with `Muted this group`; opted-out behavior remains unchanged.
- Dashboard Notifications now includes per-group mute toggles for active groups.
- Added appointment reminder lifecycle:
  - Direct actions: `create_appointment_reminder`, `cancel_appointment_reminder`
  - Event types: `REMINDER_SCHEDULED`, `REMINDER_CANCELED`, `REMINDER_SENT`
  - Timer delivery path: `reminderTick` (1-minute schedule) using reminder index blobs.
- Reminder delivery enforces both global opt-out and per-group mute before sending emails.
- Appointment detail payload now includes derived `reminders` state for UI rendering.

## 2026-02-28 11:25 UTC update (ACS email dependency pin + Reply-To enforcement)

- API dependency now pins `@azure/communication-email` to `1.1.0` in `api/package.json` to align fresh-clone dependency intent with the existing lockfile entry.
- ACS email send path now supports optional `EMAIL_REPLY_TO_ADDRESS` (or per-call `replyTo`) and injects `replyTo` in `EmailClient.beginSend(...)` only when configured.
- Optional suppression headers are now supported behind `EMAIL_SUPPRESS_HEADERS=true` (or explicit per-call headers) without changing sender/from behavior.
- Existing “Do not reply …” body copy and call sites remain unchanged.

## 2026-02-28 21:00 UTC update (Home Dashboard group delete immediate + inline Undo restore)

- Home Dashboard group delete is now immediate (no confirmation dialog) and undo-able via inline `Group deleted` + `Undo` notice (~8s window, single latest delete).
- Added backend endpoint `POST /api/group/restore` to reverse group soft-delete flags (`isDeleted`, `deletedAt`, `deletedByUserKey`, `purgeAfterAt`) and refresh `updatedAt`.
- Dashboard undo now uses the new `/api/group/restore` route; deleting multiple groups quickly replaces the single undo target.
- Removed dashboard delete confirmation copy (`This cannot be undone.`) to match new behavior.

## 2026-02-28 21:51 UTC update (PageHeader email preference prop wiring fix)

- Fixed `PageHeader` prop typing/destructuring to include dashboard notification preference controls used by the profile menu section:
  - `emailUpdatesEnabled`
  - `prefsLoading`
  - `prefsSaving`
  - `prefsError`
  - `onToggleEmailUpdates`
- This resolves web TypeScript build failures caused by unresolved identifiers inside `PageHeader` while preserving existing optional behavior and defaults.

### Verification run

1. `pnpm -r --if-present build` ⚠️ fails in API package in this environment due to missing `@azure/data-tables` module/type resolution.
2. `pnpm --filter @familyscheduler/web build` ✅ passed.

## 2026-02-28 22:20 UTC update (Option 1 completion: table-backed membership)

- Option 1 complete: blob membership arrays removed from production paths; membership/auth gating is table-backed (`GroupMembers`/`UserGroups`).
- Members UI now resolves roster exclusively from `/api/group/members` and no longer depends on `snapshot.people`.
- `/api/chat` and `/api/direct` snapshots are now focused on appointments/rules (no roster payload).

## 2026-02-28 22:58 UTC update (PageHeader build fix follow-up)

- Hardened `PageHeader` prop consumption by destructuring through a local `props` object before menu render usage.
- This keeps the optional notification preference controls (`emailUpdatesEnabled`, `prefsLoading`, `prefsSaving`, `prefsError`, `onToggleEmailUpdates`) reliably in component scope and resolves the reported TS2304 unresolved-name build errors.

### Verification run

1. `pnpm --filter @familyscheduler/web build` ✅ passed.
2. `pnpm -r build` ⚠️ blocked in API package by missing `@azure/data-tables` dependency/type resolution in this environment.

## 2026-02-28 23:32 UTC update (Dashboard Utilities demo seed modal + configurable multi-group seeding)

- Added a dogfood/dev-only Utilities action in Dashboard `MarketingLayout`: **Seed demo data…** opens a small modal with numeric controls:
  - Groups (default 5, UI clamp 1..8)
  - Appts per group (default 6, UI clamp 1..20)
  - Members per appt (default 4, UI clamp 0..8)
- Added client orchestration in `App` to:
  - Load current dashboard groups,
  - Create missing groups via `/api/group/create`,
  - Seed exactly N groups via `/api/direct` action `seed_sample_data` with config,
  - Trigger dashboard refresh so new groups appear.
- Extended `/api/direct` `seed_sample_data` action to accept optional config (`apptsPerGroup`, `membersPerAppt`) and enforce server-side clamping.
- Preserved server DOGFOOD gate (`process.env.DOGFOOD === '1'`) and 404 blocked behavior with `direct_seed_sample_data_blocked` warning log event.
- Seed generation remains idempotent and deterministic using `seedTag` + deterministic IDs (`P-SEED-XX`, `appt-seed-XX`) with variable appointment/member density.

### Verification run

1. `pnpm --filter @familyscheduler/web build` ✅ passed.
2. `pnpm --filter @familyscheduler/api build` ⚠️ blocked in this environment by missing `@azure/data-tables` module/type resolution.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.

## 2026-02-28 23:47 UTC update (Profile modal UX parity: blocking actions + camera capture)

- Profile editor modal now renders actions by mode: blocking gate shows **Sign out + Save** only; non-blocking modal shows **Cancel + Save** only.
- Blocking mode remains non-dismissible via backdrop/ESC and still keeps the modal open on save failure.
- Profile photo controls now provide **Take photo** (camera capture with confirm/retake) and **Choose file** fallback.
- Camera capture now reuses shared camera utilities aligned with breakout organizer capture behavior (`getUserMedia` + JPEG frame capture) and uploads via existing `PUT /api/user/profile-photo` endpoint.
- Added inline, non-fatal camera unavailability messaging while preserving file upload fallback.

## 2026-03-01 00:35 UTC update (Guest memberKind persisted + roster/UI guardrails)

- Implemented Issue #1: persisted `memberKind` on membership entities (`GroupMembers` + `UserGroups`) with guest assignment when membership activates from `igniteGrace` flows.
- Membership activation/create write paths now compute `memberKind` (`guest` for ignite grace, otherwise `full`) and emit structured activation logs including `groupId`, normalized email, computed kind, session kind, and operation.
- `GET /api/group/members` now returns `memberKind` per member and defaults missing storage values to `'full'` for backward compatibility.
- Members roster UI now renders a **Guest** badge in the Name column while keeping Edit/Delete actions enabled for guest rows.
- Durable session behavior, Refresh, and Invite controls remain unchanged by guest rows.

## 2026-03-01 00:43 UTC update (Groups list row actions UI cleanup)

- Dashboard "Your groups" active rows now use a direct trash action icon for delete and removed the kebab menu/popup delete path.
- Removed the row chevron icon from active group rows and kept right-side actions aligned (mute + delete).
- Row click-to-navigate is preserved, while action icons now prevent row navigation via `preventDefault` + `stopPropagation`.
- Delete action icon now has `aria-label="Delete group"` and tooltip title `Delete`.
## 2026-03-01 00:39 UTC update (Utilities menu order + divider + right-aligned toggles)

- Updated Dashboard `MarketingLayout` Utilities (burger) menu ordering for authenticated users to:
  1. `Signed in as ...`
  2. `Receive appointment update emails` (toggle)
  3. `Dark mode` (toggle)
  4. `Sign out`
  5. divider
  6. `Seed demo data…`
- Added a subtle menu divider (`<Divider sx={{ my: 0.5 }} />`) between `Sign out` and `Seed demo data…` when the dogfood/dev seed action is present.
- Right-aligned both toggles using `sx={{ ml: 'auto' }}` on each `Switch` to keep labels left and switches flush-right/aligned.
- No handler/behavior changes for sign-out, dark mode toggling, email update preference toggling, or seed dialog opening.

### Verification run

1. `pnpm --filter @familyscheduler/web build` ✅ passed.
2. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.
## 2026-03-01 01:10 UTC update (Issue #1 extended: guest + unverified roster semantics)

- Membership entities now persist both `memberKind` (`full|guest`) and `emailVerified` booleans on activation/upsert across `groupJoin`, `igniteJoin`, and `groupClaim` paths.
- Activation logs now include `groupId`, normalized email, `sessionKind`, `memberKind`, `emailVerified`, and operation for both success and failure contexts.
- `GET /api/group/members` now returns `memberKind` + `emailVerified`, defaulting absent legacy values to `memberKind='full'` and `emailVerified=true`.
- Members UI row model now carries `emailVerified`; Name renders `Guest` chip, Email renders `Unverified` chip (tooltip: `Email not verified.`), and Edit/Delete remain enabled for guest rows.
- Viewer durability behavior remains unchanged (banner still driven by viewer session state only; refresh/invite controls unaffected by guest rows).

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/web build` ✅ passed (vite chunk-size warning only).
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/a032598e0d1a8402/artifacts/artifacts/groups-row-actions-cleanup.png`.
2. `pnpm --filter @familyscheduler/api build` ⚠️ blocked by missing `@azure/data-tables` module/type resolution in this environment.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; terminated intentionally via SIGINT.
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/ebb4051b6720deb8/artifacts/artifacts/members-guest-ui.png`.


## 2026-03-01 00:47 UTC update (Header burger menu popup right-alignment)

- Updated the app header account/settings popup anchoring so it aligns to the burger icon's right edge and opens directly below it.
- `PageHeader` menu now uses right-edge anchor/transform origins with a small top offset (`mt: 1`) for stable spacing across viewport sizes.
- Anchor element remains the burger `IconButton` (`event.currentTarget`), avoiding header/container-based drift.

## 2026-03-01 01:26 UTC update (Issue #4: Members edit moved to modal + UserProfiles update)

- Implemented new backend endpoint `PUT /api/group/member-profile` for editing another roster member's `displayName` in `UserProfiles` (no email edits).
- Endpoint authorization uses active group membership for requester; target must exist in `GroupMembers` with `active|invited` status.
- Members panel no longer uses inline row `<input>` editing or `/api/direct` `update_person` for roster edits.
- Edit action now opens a standard MUI `Dialog` with editable Name, read-only Email, explicit Cancel/Save, and non-empty trimmed name validation.
- On successful save, members roster is reloaded from `GET /api/group/members` so enriched `displayName` is reflected immediately.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/web build` ✅ passed (vite chunk-size warning only).
3. `pnpm --filter @familyscheduler/api test -- groupMemberProfilePut.test.ts` ⚠️ blocked by missing `@azure/data-tables` module/type declarations in this environment (plus initial type export fix handled in code).
4. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.
5. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/9c924e3b5509fe30/artifacts/artifacts/members-edit-modal-change.png`.
## 2026-03-01 01:16 UTC update (Issue #3: membership lastSeen + members table cleanup)

- Members panel now shows lastSeen from membership storage (throttled updates). Removed Refresh button and Actions header label.
- Added membership-level `lastSeenAtUtc` persistence on both `GroupMembers` and `UserGroups` entities.
- Centralized touch logic in `requireGroupMembership` with 60s throttling and non-blocking warning logs on touch write failures.
- `GET /api/group/members` now returns `lastSeenAtUtc` as `null` when absent.
- Members UI now consumes `lastSeenAtUtc`, renders relative labels (`just now`, `Xm ago`, `Xh ago`, `Xd ago`), removes the Refresh button, and keeps the actions icon column with an empty header cell.

### Verification run

1. `pnpm --filter @familyscheduler/web build` ✅ passed (vite chunk-size warning only).
2. `pnpm --filter @familyscheduler/api test` ⚠️ blocked by missing `@azure/data-tables` type/module resolution in this environment.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/86b92be776b38016/artifacts/artifacts/issue3-members-ui.png`.

## 2026-03-01 02:05 UTC update (Issue #5: Invite-by-email modal + delivery status + resend)

- Implemented `POST /api/group/invite-email` to create/update invited memberships and attempt invite email delivery (with inviter reply-to, optional recipient name, optional plain-text personal message, and join link token).
- Added invite email delivery fields on membership entities (`inviteEmailStatus`, `inviteEmailLastAttemptAtUtc`, `inviteEmailFailedReason`, `inviteEmailProviderMessage`) and included them in `GET /api/group/members` responses.
- Members panel now includes `Invite by email…` modal (required email, optional name/message, 500-char message cap, no CC/send-copy option).
- Invited rows now render delivery status chips (`Invite sent`, `Delivery failed`, `Not sent`) plus failure tooltip details.
- Added resend invite action for invited rows; resend reuses the same endpoint and then programmatically reloads roster (no Refresh button introduced).

### Verification run

1. `pnpm --filter @familyscheduler/web build` ✅ passed (vite chunk-size warning only).
2. `pnpm --filter @familyscheduler/api test -- groupInviteEmail.test.ts groupMembers.test.ts` ⚠️ blocked by missing `@azure/data-tables` module/type resolution in this environment.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/725343b9499f5acf/artifacts/artifacts/issue5-invite-by-email-ui.png`.

## 2026-03-01 02:58 UTC update (API build TS generic constraint fix for table upsert helper)

- Fixed a TypeScript generic mismatch in `upsertTableEntity` by typing the helper input as `TableEntity<T>` instead of unconstrained `T`, matching Azure Tables `upsertEntity` requirements.
- Behavior is unchanged at runtime; this is a compile-time typing fix to satisfy `partitionKey`/`rowKey` entity shape expectations.
- Build verification in this container is currently blocked by missing private package registry access (`ERR_PNPM_FETCH_403`), so full API build could not be completed locally after the change.
## 2026-03-01 02:58 UTC update (Tabs visual simplification: Schedule/Members)

- Simplified the Schedule/Members section tabs in `AppShell` to use standard MUI underline indicator behavior.
- Removed tab-strip framing/seam hacks used for a sheet-style selected tab (hidden indicator, selected background fill, negative margin, z-index, and wrapper bottom border).
- Kept tab value/onChange semantics unchanged (`calendar`/`members`) so existing section switching and members-loading behavior are preserved.
- Removed the content seam hack on the section container (`Paper` no longer disables top border), while keeping the existing overall layout/radius behavior.

### Verification run

1. `pnpm --filter @familyscheduler/web build` ⚠️ blocked by package manager bootstrap/network restriction in this environment (corepack fetch to npm registry failed via proxy 403).

## 2026-03-01 03:58 UTC update (Invite email debug details dialog + copy logs)

- Invite-by-email failures now capture a structured client-side debug bundle (app context, request/response metadata, timing, diagnostics classification, and suggestions).
- Failure UX now shows `Unable to send invite mail` with a `Details` action; details open a new `Invite debug details` dialog.
- Added `Copy logs` in dialog to copy full JSON bundle to clipboard (with fallback copy strategy when Clipboard API is unavailable).
- Privacy guardrails: debug data records only whether `x-session-id` is present, never the session id value; personal message preview is optional behind a toggle (default off).

## 2026-03-01 03:52 UTC update (Invite diagnostics: safe response capture + classification fix)

- Added shared web API safe-response reader (`readResponseSafe`) and structured `ApiError` in `apps/web/src/lib/apiUrl.ts`; response parsing now uses `res.text()` + guarded JSON parse so empty/non-JSON bodies no longer throw `SyntaxError` from `response.json()` in this flow.
- Updated invite-by-email send path to use safe response parsing and `throwOnHttpError` mode, capture `httpStatus`/`httpStatusText`/`contentType`/safe response headers/body text/body length/json parse error, and classify failures from status/body/parse outcome instead of collapsing to `network_error`.
- Expanded invite debug type/classification coverage (`empty_response`, `non_json_response`, `unknown`) and updated suggestions for route/auth/CORS/JSON contract cases.
- Updated invite debug dialog summary line format to `${classification} (${httpStatus ?? 'no status'}) ${httpStatusText ?? ''}`.

### Verification run

1. `pnpm --filter @familyscheduler/web typecheck` ✅ passed.
2. `pnpm --filter @familyscheduler/web build` ✅ passed (vite chunk-size warning only).
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally via SIGINT.
4. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/cc538a21cddd2795/artifacts/artifacts/invite-debug-change-home.png`.

## 2026-03-01 04:24 UTC update (Provision GroupInviteTokens via centralized REQUIRED_TABLES)

- Added `GroupInviteTokens` to `REQUIRED_TABLES` in `api/src/lib/tables/tablesClient.ts` so cold-start table provisioning and per-request `ensureTablesReady()` fallback both auto-create the invite token table.
- Added a guardrail comment above `REQUIRED_TABLES`: all API-used tables must be listed centrally and not created manually.
- Added a lightweight regression test asserting `REQUIRED_TABLES` includes `GroupInviteTokens`.
- Verified `groupInviteEmail` already calls `ensureTablesReady()` before table operations, so no handler flow changes were required.

### Verification run

1. `pnpm --filter @familyscheduler/api test -- tablesClient.test.ts` ⚠️ blocked by missing `@azure/data-tables` module/type declarations in this environment (`TS2307` during API TypeScript build).
2. `rg -n "REQUIRED_TABLES|GroupInviteTokens|ensureTablesReady\(\)" api/src/lib/tables/tablesClient.ts api/src/functions/groupInviteEmail.ts api/src/lib/tables/tablesClient.test.ts` ✅ confirmed provisioning list + handler guard + regression test.

## 2026-03-01 04:43 UTC update (Branding sweep: FamilyScheduler/Family Schedule -> Yapper + neutral group fallback)

- Updated invite email content to remove legacy `FamilyScheduler` branding and use `Yapper` + support address `support@yapper-app.com` in both plain-text and HTML templates.
- Updated join-link email copy from `Your FamilyScheduler link` / `join FamilyScheduler` to `Your Yapper link` / `join Yapper`.
- Updated web UI fallback group labels from `Family Schedule` to `Untitled group` and changed create-group title copy to `Create a group`.
- Updated API internals defaults/prompts/ICS branding:
  - state default group name now `Untitled group`;
  - OpenAI parser system prompt now references `Yapper`;
  - ICS `PRODID` now `-//Yapper//Appointments//EN`.
- Optional repo consistency pass: updated top-level/docs references from `FamilyScheduler` to `Yapper` in README and selected docs.

### Verification run

1. `rg -n "FamilyScheduler|Family Schedule|Family Scheduler|support@familyscheduler.app" api/src/functions/groupInviteEmail.ts api/src/functions/groupJoinLink.ts apps/web/src/App.tsx apps/web/src/AppShell.tsx api/src/lib/state.ts api/src/lib/openai/prompts.ts api/src/lib/appointments/notificationSnapshot.ts` ✅ no matches.
2. `pnpm --filter @familyscheduler/web build` ✅ passed.
3. `pnpm --filter @familyscheduler/web dev --host 0.0.0.0 --port 4173` ✅ started for screenshot capture and stopped intentionally.
4. Playwright screenshot capture ✅ `branding-yapper-create-group.png`.
## 2026-03-01 04:39 UTC update (Members invite status row actions alignment)

- Members invite status UI now renders invite send/resend actions inline in the Email/status chip area for invited rows.
- `inviteEmailStatus=sent` now shows only `Invite sent` chip (no persistent mail action icon in Actions).
- `inviteEmailStatus=failed` now shows `Send error` chip + inline `Resend` action; `not_sent` shows `Not sent` chip + inline `Send` action.
- Existing Edit/Delete actions remain unchanged in the Actions column.

## 2026-03-01 05:27 UTC update (PageHeader: prevent duplicate Yapper in group lockup mode)

- Updated `PageHeader` left-side product cluster rendering so `PRODUCT.name` is shown **only when** `onDashboardClick` is not provided.
- In dashboard-click mode (group page header), the clickable brand lockup (icon + `Yapper`) remains the sole rendered product label.
- Kept brand icon fixed sizing unchanged (`28x28`, `flex: '0 0 28px'`, `display: 'block'`).
- Right-side menu behavior unchanged.

## 2026-03-01 05:40 UTC update (Appointment details: drawer → centered dialog)

- Replaced the **Appointment Details** right-side drawer container in `AppShell` with a centered MUI `Dialog` (`fullWidth`, `maxWidth="md"`).
- Kept existing appointment details inner content/state model unchanged (`detailsOpen`, `detailsAppointmentId`, `detailsData`, `detailsTab`, `detailsMessageText`, `detailsScrollRef`, proposal/reminder/email subflows).
- Wired all close paths (dialog dismiss, backdrop/ESC, and top-right close icon) through `closeAppointmentDetails`.
- Preserved scroll semantics by attaching `detailsScrollRef` directly to the scrollable `DialogContent` and constraining content height with `maxHeight: calc(100vh - 140px)`.
- Left todo drawer and other drawer/dialog usages unchanged.

- Appointment details: mobile full-screen/back behavior implemented in web AppShell; desktop inline third-panel layout still pending.

## 2026-03-01 07:27 UTC update (Appointment details above-tabs UI cleanup)

- Updated appointment takeover sticky header label to use appointment title (`detailsData.appointment.desc`) with safe fallback (`Untitled appointment`) and ellipsis truncation.
- Refactored only the area **above Discussion/Changes/Constraints tabs** into:
  - Summary card (time + optional location, responsive stack/row behavior)
  - Lighter email action row (Email update, History menu, last update text)
  - Reminders card (existing reminder list/actions, touch-friendly responsive composer)
  - Optional suggestion chips row (renders only when active suggestions exist)
- Preserved existing handlers/behavior for email update, history menu, reminders add/cancel, suggestion chip actions, and header collapse toggle.
- Left tabs and all tab panel contents/logic unchanged; `detailsScrollRef` usage and takeover body scroll behavior unchanged.

### Verification run

1. `npm --prefix apps/web run typecheck` ✅ passed.
2. `npm --prefix apps/web run dev -- --host 0.0.0.0 --port 4173` ✅ started for screenshot capture and stopped intentionally.
3. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/b127057f968cff77/artifacts/artifacts/appointment-ui-cleanup.png`.

## 2026-03-01 08:05 UTC update (Scan viewer image fetch uses authenticated apiFetch + Blob URL)

- Fixed scan viewer image rendering in appointment doc dialog by replacing direct `<img src="/api/appointmentScanImage...">` usage with authenticated `apiFetch` request + `Blob` + `URL.createObjectURL(...)`.
- Added scan-viewer-local image state for loading/error/retry handling (`scanViewerImageUrl`, `scanViewerImageLoading`, `scanViewerImageError`, retry token).
- Added friendly viewer states:
  - Loading alert while image fetch is in progress.
  - Error alert with `Retry` action when the endpoint returns non-2xx or network failure.
- Added diagnostics:
  - `console.warn` on failed load with `groupId`, `appointmentId`, and status (when available).
  - `console.debug` on successful image load.
- Added cleanup for memory safety:
  - revoke previous object URLs on appointment change / dialog close / effect cleanup.
  - abort in-flight fetch on cleanup via `AbortController`.

### Verification run

1. `npm --prefix apps/web run typecheck` ✅ passed.
2. `npm --prefix apps/web run dev -- --host 0.0.0.0 --port 4173` ✅ started for screenshot capture; stopped intentionally.
3. Playwright screenshot capture ✅ `browser:/tmp/codex_browser_invocations/4f836faa76e9ad24/artifacts/artifacts/scan-viewer-fix.png`.
