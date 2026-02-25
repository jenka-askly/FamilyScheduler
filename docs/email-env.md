# ACS email environment variables for Join flow

## Purpose

The Join Group API (`/api/group/join`) can send a follow-up email with a join link after a successful email/session-based join authorization.

## Required environment variables

Set these in the Function App configuration for each environment:

- `AZURE_COMMUNICATION_CONNECTION_STRING`
  - Azure Communication Services connection string used by the API to send email.
  - Example (redacted): `endpoint=https://<resource>.communication.azure.com/;accesskey=<redacted>`
- `EMAIL_SENDER_ADDRESS`
  - Sender/from address used for outbound join email.
  - Example (redacted): `no-reply@notifications.example.com`

## Where to set

- **Staging**: Azure Function App → Configuration → Application settings (staging app instance)
- **Production**: Azure Function App → Configuration → Application settings (production app instance)

Apply values per environment (do not reuse prod secrets in staging).

## Notes

- The sender address must belong to a verified domain configured for ACS Email.
- If either variable is missing, join still succeeds and email sending is skipped with a log entry.


## Magic-link auth environment variables

The new auth endpoints (`/api/auth/request-link` and `/api/auth/consume-link`) require/accept additional settings:

- `MAGIC_LINK_SECRET` **(required)**
  - HMAC signing secret used to sign and verify magic-link tokens.
  - Must be long, random, and unique per environment.
- `WEB_BASE_URL` **(recommended)**
  - Absolute base URL used when building emailed auth links (for example `https://app.example.com`).
  - Recommended to avoid relying on request `Origin` headers (which may be absent or spoofed).
- `SESSION_BLOB_PREFIX` *(optional, default: `familyscheduler/sessions`)*
  - Blob key prefix for durable session JSON documents.
- `SESSION_TTL_SECONDS` *(optional, default: `604800`)*
  - Session lifetime in seconds (default is 7 days).

Required for staging email/session auth:
- `MAGIC_LINK_SECRET`
- `WEB_BASE_URL`
- `SESSION_BLOB_PREFIX` (optional, defaults provided)
- `SESSION_TTL_SECONDS` (optional)
