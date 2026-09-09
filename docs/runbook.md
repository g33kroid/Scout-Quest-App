# Runbook

Written for someone who is not the original author. If a step here does not work
on a clean machine, that is a bug in this document.

## Local setup

Requires: Node 24+, npm, Docker (Docker Desktop or equivalent — Supabase's
local stack runs as Docker containers under the hood).

```
git clone <repo-url>
cd scout-quest-app
npm install
cp .env.example .env.local          # fill in values printed by `supabase start`
npx supabase start                  # spins up local Postgres/Auth/Storage/Realtime
npx supabase db reset               # applies migrations + runs pgTAP
npm run dev                         # http://localhost:3000
```

`supabase start` prints the local API URL, anon key, and service-role key —
paste those into `.env.local`. Never commit `.env.local`.

Useful commands:

```
npm run typecheck
npm run lint
npm run format          # npm run format:check in CI
npm run test            # vitest
npm run test:e2e        # playwright, needs `npm run build` or a dev server
npx supabase stop       # tear down the local stack
```

## Environment variables

See `.env.example` for the full list with inline comments. Summary:

| Var                             | Scope       | Notes                                                                                |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | public      | Safe to ship to the browser                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public      | RLS is the real boundary, not secrecy of this key                                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | server-only | Bypasses RLS. Read only from `/lib/server`. CI greps the client bundle for this name |
| `LLM_API_KEY`                   | server-only | Quest translation calls only, never shipped to the client                            |

Server-only vars are read exclusively from `/lib/server` — that boundary is
what the CI secret gate (`scripts/check-client-bundle-secrets.sh`) checks
after every build.

## Repo protection (one-time, once a GitHub remote exists)

Not automatable from a local checkout — configure once the repo has a GitHub
remote:

1. Branch protection on `main`: require CI green, require 1 review, block
   direct pushes and force-pushes.
2. Enable GitHub secret scanning + push protection (Settings → Code security).
3. Add repo secrets used by CI if any are introduced later (none as of Task 01
   — Supabase/staging creds live in the deploy environment, not GitHub Actions
   secrets, until Task 15).

## MCP and Claude Code setup

See `docs/tasks/00c-mcp-setup.md`. Two servers carry credentials and are NOT in
the committed `.mcp.json` — configure them yourself:

- **Supabase MCP** — read-only, staging project ref only. Never production.
- **GitHub MCP** — fine-grained PAT, this repo only.

## Routine operations

_Filled in as the relevant task lands._

- Add a leader · Task 14
- Reset a scout PIN · Task 03
- Issue and expire a join code · Task 03
- Create a season, units, patrols · Task 14
- Promote scouts between units · Task 14
- Export a scout's record · Task 14
- Delete a scout's record · Task 14
- Deploy a change · Task 15
- Roll back a bad deploy · Task 15
- Restore from backup · Task 15

## Incidents

### The app is down during a camp

_TODO — Task 15. Must include the paper fallback path._

### A secret was committed to this public repo

1. Treat the key as burned. Rotate it immediately — do not attempt to remove it
   from history first.
2. Rotate: Supabase service role, Supabase anon key, LLM API key, any PAT.
3. Check Supabase audit logs for use of the exposed credential.
4. Record what happened and when in `docs/incidents/`.

### Suspected data breach

_TODO — before the first real scout record is entered._

Must name: who is notified, by whom, within what window, and who talks to
parents. This is a PDPL obligation, not a nice-to-have.

## Safeguarding

Concerns about a child's wellbeing never go in this system. They go to the
safeguarding lead through the church's normal process. Meeting minutes record
only that a referral was made.
