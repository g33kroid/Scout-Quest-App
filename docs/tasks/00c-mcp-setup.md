# Claude Code — MCP and Plugin Setup

Install once, before Task 01. Everything here is scoped for a project holding
records of ~180 minors, so credential scoping is part of the setup, not an
afterthought.

**Not used on this project:** ECC (too large a surface for a solo maintainer at
8h/week, and its always-on ruleset injection fights ponytail for context),
headroom (unverified).

---

## 1. ponytail — the YAGNI ladder

The highest-value install for this project. It stops the agent over-building
before it writes, which is the failure mode most likely to sink a volunteer
project.

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Two separate prompts — the install does not work as one.

Requires Node on PATH. Set the default level:

```
export PONYTAIL_DEFAULT_MODE=full
```

Useful commands: `/ponytail-review` (review the current diff for
over-engineering, returns a delete-list), `/ponytail-audit` (whole repo),
`/ponytail-debt` (harvest deferred shortcuts into a ledger).

**Use `/ponytail-review` on every PR before merging.** It is the cheapest guard
you have against Wave 2 bloat.

One caveat: ponytail's ladder is about _solutions_, not _requirements_. It must
never be used to argue away a NON-NEGOTIABLE DESIGN RULE. If it suggests dropping
RLS tests, the audit log, offline idempotency, or bilingual publishing because
they are "not needed yet", that is out of scope for the ladder — those are the
requirements, not the implementation.

---

## 2. Playwright MCP — E2E, responsive, RTL

Drives a real browser in-session. Directly serves the breakpoint matrix, RTL
visual checks, and the E2E suites in every UI task.

```
claude mcp add playwright npx @playwright/mcp@latest
```

Use it for: the 360/414/768/1024 breakpoint sweep, Arabic RTL snapshots per
route, the offline/reconnect flows in Task 08, and the scout login E2E in Task 03.

---

## 3. Supabase MCP — schema, migrations, RLS

The biggest practical win for Tasks 02, 04, and 14.

```
claude mcp add supabase npx -y @supabase/mcp-server-supabase@latest \
  --read-only --project-ref=<STAGING_PROJECT_REF>
```

**Non-negotiable scoping:**

- **Point it at the staging project only. Never production.** Production holds
  children's records and parent contacts; an agent with write access there is not
  a risk worth taking for convenience.
- **`--read-only` always.** Migrations are applied through CI on merge, not by an
  agent in a session.
- Use a personal access token scoped to that one project, stored in the OS
  keychain or an env var, never committed.
- If the MCP ever reports it can see a table the RLS design says it should not,
  treat that as a finding and write a pgTAP test for it.

---

## 4. GitHub MCP — PRs, CI, reviews

```
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
```

Authenticate with a fine-grained PAT scoped to the single private repo:
contents, pull requests, issues, actions (read). **No org-wide scope, no
`delete_repo`, no admin.**

Use it for: opening PRs per task, reading failing CI logs, and pulling review
comments back into the session.

---

## 5. Chrome DevTools MCP — performance budgets

```
claude mcp add chrome-devtools npx chrome-devtools-mcp@latest
```

Use it to verify the Lighthouse budgets in `00b-cross-cutting-ui.md`: LCP < 2.5s
throttled 4G, CLS < 0.1, INP < 200ms, scout bundle < 200KB gzipped. Run traces
against staging, not localhost, for anything you plan to quote in a PR.

---

## 6. Context7 — current library docs

```
claude mcp add --transport http context7 https://mcp.context7.com/mcp
```

next-intl, Serwist, react-nice-avatar, and the Supabase client all move faster
than any model's training data. Use it whenever the agent is about to write
config for one of them.

---

## Project-scoped config

Put the non-secret entries in a committed `.mcp.json` at the repo root so the
setup is reproducible for the second maintainer:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    },
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

Keep **Supabase and GitHub in user scope**, not in the committed file. They carry
credentials, and a project-scoped entry invites someone to paste a token into a
tracked file.

Add `.mcp.json` handling to the runbook so a new maintainer knows which two
servers they must configure themselves.

---

## Security notes — read before installing anything

You are running agents against a codebase that will hold minors' records.

- **Every MCP server is a prompt-injection surface.** Tool output is untrusted
  input. A malicious string in a fetched page or a CI log can carry instructions.
  Do not run agent sessions with credentials you would not hand to a stranger.
- **Never give an agent production database credentials.** Staging, read-only,
  single project. This is the one rule not to bend when a task would be faster
  with write access.
- **Pin versions once the stack settles.** `@latest` is fine while setting up and
  a supply-chain risk once you are shipping to real scouts.
- **Review what each server can do before enabling it**, and re-review after any
  major version bump. New tools appear in updates.
- Keep the CI secret-scanning gate from Task 01 on. It catches the case where an
  agent helpfully pastes a key into a config file.

---

## Verify

```
claude mcp list
/plugin list
```

Expected: ponytail installed; playwright, supabase, github, chrome-devtools, and
context7 connected. Supabase must show read-only and a staging project ref.
