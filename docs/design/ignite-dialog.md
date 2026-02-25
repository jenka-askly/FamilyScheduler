# Ignite dialog design language

## Purpose
- This dialog is dual-purpose: organizer control surface and joiner first impression.
- Keep a centered "poster" experience that is fast to scan and emotionally clear.

## Non-negotiables
- Centered poster layout.
- QR always visible; no vertical scrolling.
- Joined strip is horizontal-only and single-row; names always visible.

## Approved copy
- Helper text:
  - "{OrganizerName} started this group to move things forward."
  - "Join to coordinate with everyone."
- QR label: "Join {OrganizerName}’s {GroupName}"
- Section label: "Who’s in"
- Footer primary: "Finish inviting & continue"

## Behavior rules
- Sound icon lives with the joined-count cluster and toggles join-success sound playback only.
- Organizer avatar appears first in the joined strip and includes a subtle camera overlay.
- Clicking organizer avatar opens capture flow for profile photo set/replace.
- Switch label is "Allow new members to join":
  - OFF posts close, does not navigate, does not clear `sessionId`.
  - ON posts start/reopen behavior.
- Primary button closes joining first when needed, then navigates to the group.
