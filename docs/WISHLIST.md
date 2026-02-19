# Wishlist

## AI Ingestion

- Upload/paste appointment artifacts (text/email/PDF/image) → AI extracts fields → proposal → confirm → apply.
  - Supported formats: text, PDF (text-based), image via vision (later).
  - Multi-appointment extraction (one upload can yield multiple `add_appointment` actions).
  - Clarify when extracted details are ambiguous before proposing actions.
  - Logging/privacy: default **NO** raw artifact logging; store redacted/hashed metadata only, with an optional dev flag for raw capture.
