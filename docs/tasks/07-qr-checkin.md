# Task 07 — QR check-in with rotating offline token

## Scope

Per-scout check-in code, scanned by a leader at the door of a class or camp
session.

## Architecture

- Each scout holds a signing secret issued at enrollment, stored server-side and
  delivered once to their device.
- The app renders a **TOTP-style rotating token** (30s window) as a QR code.
  Payload: `person_id_opaque | counter | HMAC`. Never the raw UUID, never a name.
- Leader devices cache a **verification key and the unit roster** so scanning
  works fully offline. Accept ±1 window for clock skew.
- Continuous scan mode: camera stays open, audible confirm per scan, running
  count on screen. Not one-scan-per-tap.
- Duplicate scan in the same session is ignored with a distinct sound.
- **Manual override always visible** — tap the name on the roster instead. Dead
  phone, cracked screen, no phone at all.

## Rules

- Camera permission is requested **only in the leader build**. Never in the scout
  build.
- The QR encodes no personal data. Assume every code is photographed and shared.
- A static code is not acceptable — proxy attendance would corrupt the one metric
  this project is judged on.
- Check-ins write through the same queue as awards (Task 08).

## Test cases

- [ ] token changes every 30s
- [ ] a token captured 2 minutes ago is rejected
- [ ] a token from ±1 window is accepted (clock skew)
- [ ] verification succeeds with the device fully offline (airplane mode)
- [ ] a token for a scout outside the leader's unit is rejected
- [ ] scanning the same scout twice in one session records once
- [ ] continuous mode scans 30 codes in under 2 minutes (timed, recorded in PR)
- [ ] manual override records identically to a scan
- [ ] the scout build requests no camera permission (automated manifest check)
- [ ] QR payload contains no UUID, name, or unit (decode and assert)
- [ ] a tampered HMAC is rejected

## Done when

All tests pass and the 30-scan timing has been measured on real hardware.
