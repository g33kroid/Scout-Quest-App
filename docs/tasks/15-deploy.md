# Task 15 — Deploy, backups, runbook

## Scope

Get it running for real, safely, and document it so a second person can operate
it.

## Architecture

- Vercel: separate **staging** and **production** projects, each with its own
  Supabase instance. Never point staging at production data.
- Migrations applied via CI on merge to `main`, never by hand.
- Custom domain, HTTPS, HSTS.
- PWA manifest, icons, install prompt verified on both platforms.

## Security headers

Strict CSP with no `unsafe-inline` and no `unsafe-eval`, `frame-ancestors 'none'`,
HSTS, `X-Content-Type-Options: nosniff`, Referrer-Policy. Verify with an external
scanner and record the result in the PR.

## Backups

- Automated daily encrypted backups, retained per the documented policy.
- **A restore must be performed end to end before go-live**, into a scratch
  project, with the result verified. A backup job that reports success is not a
  backup.
- Off-site copy (the existing Proxmox homelab is a reasonable target).

## Runbook — `docs/runbook.md`

Written for someone who is not you:

- local setup from clone to running app
- add a leader, reset a PIN, issue a join code
- create a season, create units and patrols, promote scouts
- export a scout, delete a scout
- deploy a change, roll back a bad deploy
- restore from backup
- what to do if the app is down during a camp
- **breach notification procedure**: who is told, by whom, within what window

## Test cases

- [ ] staging and production are fully isolated (verify with a staging-only write)
- [ ] a migration applies cleanly to a production-shaped database
- [ ] a bad deploy can be rolled back in under 5 minutes (demonstrated)
- [ ] backup restore into a scratch project reproduces seeded data exactly
- [ ] CSP blocks an injected inline script (deliberate test)
- [ ] external header scan shows no failures
- [ ] PWA installs and launches standalone on real Android and real iOS
- [ ] push permission prompt appears only after install, only on a user gesture
- [ ] a second maintainer completes local setup from the runbook alone, unaided

## Done when

Every test passes, the restore has actually been performed, and the second
maintainer condition is met. That last one is the real gate.
