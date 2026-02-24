# ACS email environment variables for Join flow

## Purpose

The Join Group API (`/api/group/join`) can send a follow-up email with a join link after a successful phone-based join authorization.

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
