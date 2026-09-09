# Task 01 — Repo baseline, CI/CD, security gates

## Scope

Set up the repository so every later task lands on solid ground.

- Next.js (App Router, TypeScript, strict mode) + Tailwind
- Supabase local dev via `supabase` CLI, migrations in `supabase/migrations`
- pnpm or npm with committed lockfile
- Vitest for unit, Playwright for E2E
- ESLint + Prettier, pre-commit via husky + lint-staged
- GitHub Actions CI

## Out of scope

Any product feature. No schema beyond what the CLI scaffolds.

## Architecture

```
/app                 Next.js routes
/components          UI
/lib                 shared logic (server + client split explicit)
/lib/server          server-only; must never be imported client-side
/supabase/migrations SQL migrations
/supabase/tests      pgTAP
/e2e                 Playwright
/docs                runbook, ADRs
```

## CI pipeline — must fail the build on any of these

1. `npm ci` (lockfile respected)
2. Typecheck, lint, format check
3. Unit tests
4. `supabase db reset` then pgTAP suite
5. Playwright E2E against a local build
6. **Secret gate**: build the app, then grep the client bundle for
   `SUPABASE_SERVICE_ROLE_KEY`, any `service_role` JWT shape, and the LLM API key
   env name. Any hit fails the build.
7. gitleaks scan on the diff
8. `npm audit --audit-level=high`

Also enable: Dependabot weekly, branch protection on `main` requiring CI green
and one review, GitHub push protection for secrets.

## Environment

Document every env var in `.env.example` with a comment saying whether it is
public (`NEXT_PUBLIC_`) or server-only. Server-only vars must be read exclusively
from `/lib/server`.

## Test cases

- [ ] CI passes on a clean checkout
- [ ] CI fails when a fake service-role key is added to a client component
- [ ] CI fails when a secret-shaped string is committed
- [ ] CI fails on a type error
- [ ] `supabase db reset` runs migrations and pgTAP with zero tests (empty suite passes)
- [ ] A direct push to `main` is rejected

## Done when

CI is green, all six failure cases above have been demonstrated once by
deliberately breaking them, and `docs/runbook.md` exists with local setup steps a
second maintainer can follow cold.

---

## Public repository — additional requirements

This repo is **public**. The architecture does not rely on code secrecy, so that
is fine — but five things become mandatory rather than advisable.

1. **Secret exposure is now instant and irreversible.** Bots scrape public
   commits within seconds. GitHub push protection ON, gitleaks in CI ON, and a
   written rotation procedure in the runbook: any key that touches a public
   commit is considered burned and must be rotated, not deleted from history.

2. **Zero real data in the repo, ever.** Seed files, test fixtures, Playwright
   snapshots, and example `.env` files use invented names and numbers only. No
   real scout name, no real parent phone, no real join code. Add a CI check that
   fails on anything matching a UAE phone pattern in tracked files.

3. **Staging holds synthetic data only.** Visual regression snapshots and
   Playwright traces are artefacts that can end up attached to a public PR. If
   staging carries real records, they leak that way.

4. **Issues and PRs are public.** Never name a scout, a parent, or a specific
   leader in an issue, a commit message, or a PR description. "Scout with two
   no-shows" is a safeguarding leak once it has a name attached. Add this to the
   PR template.

5. **The attacker now knows the mechanism.** Join code format, PIN length,
   lockout thresholds, and the QR token scheme are all readable. That is
   acceptable only if the implementation genuinely holds — so the pgTAP RLS suite
   and the PIN rate-limit tests move from "important" to "the only thing standing
   between a curious teenager and another unit's data".

**Reconsider deferring device binding.** With a public repo, a 6-digit PIN, a
published join-code format, and enumerable nicknames, the PIN is the whole
control. Either bring device binding forward from Wave 3 into Wave 1, or
document explicitly why the rate limit is considered sufficient until camp.
