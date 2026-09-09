# Task 13 — Leader document sharing

## Scope

A leader attaches documents or links to a quest or session; scouts in that unit
open them from the journal.

## Architecture

- Private Supabase Storage bucket. **No public bucket, no permanent URL.**
- Signed, short-lived URLs generated per request after an RLS-backed check.
- `materials (id, quest_id nullable, session_id nullable, unit_id, kind
enum(file|link), storage_path, url, filename, mime, size, uploaded_by)`.

## Rules

- **Documents and links only in Wave 1. No images.** Image handling is Wave 3 with
  consent gating.
- Server-side validation: MIME allowlist (pdf, docx, pptx, xlsx, txt), **magic-byte
  check** not just extension, size cap, filename sanitisation.
- Virus scan before the file becomes retrievable.
- Only leaders and admin upload. Scouts read only.
- A scout can only retrieve materials for their own unit.
- Audit row on every upload and every retrieval.

## Test cases

- [ ] leader uploads a PDF; a scout in that unit can open it
- [ ] a scout in another unit gets 403
- [ ] an unauthenticated request to the storage path fails
- [ ] a signed URL expires and stops working
- [ ] a `.exe` renamed to `.pdf` is rejected by the magic-byte check
- [ ] an oversized file is rejected server-side, not just client-side
- [ ] a scout cannot upload via the API directly
- [ ] uploads and retrievals appear in `audit_log`
- [ ] image MIME types are rejected in Wave 1 (explicit assertion)
- [ ] filename with path traversal characters is sanitised

## Done when

All tests pass, including the renamed-executable rejection.
