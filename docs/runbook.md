# Runbook

Written for someone who is not the original author. If a step here does not work
on a clean machine, that is a bug in this document.

## Local setup

Two environments, both needed, different jobs:

- **Native Postgres 15** — fast schema/RLS/pgTAP iteration, no Docker. Good
  enough for pure DDL/policy work but has no Auth/Storage/Realtime, so it
  can't exercise real login flows.
- **`supabase start`** (Docker, via colima on Mac — no Docker Desktop
  required) — the real target: Postgres 17 + GoTrue (Auth) + PostgREST +
  Kong + Storage + Realtime + Studio, matching what self-hosted prod runs
  (Task 15). Anything touching auth, sessions, or the app talking to the
  database at all needs this running.

Both apply the same migrations in `supabase/migrations/`; run the pgTAP suite
against whichever one you're actively changing schema/RLS against, and
against `supabase start` before considering RLS work done — grants and
bootstrap behavior differ between a from-scratch Postgres and a real Supabase
cluster (see docs/schema.md's note on this; it bit us once).

### Native Postgres (fast schema iteration)

```
brew install postgresql@15
brew services start postgresql@15
```

pgTAP is not in Homebrew — build it from source once, against that Postgres:

```
git clone https://github.com/theory/pgtap.git
cd pgtap
export PATH="/usr/local/opt/postgresql@15/bin:$PATH"
make
make install   # writes into the Homebrew Postgres install — run this yourself,
                # an agent session cannot write outside the repo
```

```
createdb scout_quest_dev
DATABASE_URL=postgresql://localhost:5432/scout_quest_dev npm run db:reset
```

### `supabase start` (real Postgres/Auth/Storage/Realtime, Docker)

No Docker Desktop needed — colima gives you the same Docker CLI/daemon
headlessly:

```
brew install docker docker-compose colima
colima start
npx supabase start       # first run pulls several GB of images
```

Prints `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `JWT_SECRET`, `DB_URL`, and
a `STUDIO_URL` (open it in a browser — the whole DB/Auth/Storage admin UI).
These are Supabase's well-known **local-dev defaults**, identical on every
machine running `supabase start` — not secrets, safe to keep in `.env.local`
(gitignored regardless). Paste them into `.env.local` per `.env.example`.

`npx supabase db reset` drops, re-migrates, and restarts the stack — the
equivalent of `npm run db:reset` but for this environment. `npm run db:test`
still works against it directly (point `DATABASE_URL` at `DB_URL`'s port,
`54322` by default) since it's just psql/pg_prove underneath.

`npx supabase stop` tears the stack down; `colima stop` stops the VM
entirely if you want your machine back.

### Then, either way

```
git clone <repo-url>
cd scout-quest-app
npm install
cp .env.example .env.local          # fill in from whichever environment above you're using
npm run dev                         # http://localhost:3000
```

Useful commands:

```
npm run typecheck
npm run lint
npm run format          # npm run format:check in CI
npm run test            # vitest
npm run test:e2e        # playwright, needs `npm run build`/dev server AND the
                         # real `supabase start` stack — auth specs need GoTrue,
                         # not just Postgres. Run `npm run seed:e2e` first
                         # (needs SUPABASE_SERVICE_ROLE_KEY + DATABASE_URL set)
npm run seed:e2e        # seeds one scout + one leader for the login E2E specs
npm run db:migrate      # apply new migrations only
npm run db:test         # pgTAP suite only (point DATABASE_URL at either environment)
npm run db:reset        # drop, recreate, migrate, test — native Postgres only;
                         # use `npx supabase db reset` for the Supabase stack
```

`supabase/config.toml` pins `major_version = 17` — CI runs the full
`supabase start` stack (not just a bare Postgres container — Task 03's auth
flows need real GoTrue), and this project's eventual self-hosted Docker
Compose deploy (Task 15) both track that. Native local Postgres stays on 15
(a Homebrew constraint, not a deliberate choice) — fine for schema/RLS
iteration, just don't treat it as the version-accurate target, and remember
E2E/auth work needs the real `supabase start` stack locally too, not native
Postgres alone.

## Environment variables

See `.env.example` for the full list with inline comments. Summary:

| Var                             | Scope       | Notes                                                                                |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | public      | Safe to ship to the browser                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public      | RLS is the real boundary, not secrecy of this key                                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | server-only | Bypasses RLS. Read only from `/lib/server`. CI greps the client bundle for this name |
| `SUPABASE_JWT_SECRET`           | server-only | Signs/verifies session JWTs (GoTrue's and our own custom-minted scout ones)          |
| `DATABASE_URL`                  | server-only | Direct Postgres connection for `scripts/db-*.sh` (migrations, pgTAP)                 |
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
