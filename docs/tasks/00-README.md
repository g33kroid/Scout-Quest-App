# Wave 1 Task Prompts

One file per task. Each is a self-contained Claude Code prompt: paste it as the
opening message of a fresh session, with the repo checked out.

Run them in order. Each assumes the previous ones are merged to `main`.

| #   | Task                                        | Est |
| --- | ------------------------------------------- | --- |
| 01  | Repo baseline, CI/CD, security gates        | 5h  |
| 02  | Schema, RLS, pgTAP suite                    | 8h  |
| 03  | Auth: scout PIN, leader TOTP, rate limiting | 6h  |
| 04  | Ledger and SECURITY DEFINER write path      | 4h  |
| 05  | Leader scoring flow (the 15-second screen)  | 10h |
| 06  | Attendance and excused absences             | 5h  |
| 07  | QR check-in with rotating offline token     | 8h  |
| 08  | Offline queue and sync                      | 7h  |
| 09  | Quest model, prerequisites, scout board     | 7h  |
| 10  | Journal                                     | 4h  |
| 11  | Bilingual authoring, translation, RTL       | 8h  |
| 12  | Avatar builder                              | 3h  |
| 13  | Leader document sharing                     | 4h  |
| 14  | Seed template library and admin views       | 5h  |
| 15  | Deploy, backups, runbook                    | 5h  |

Total ~89h including the tasks previously scoped loosely. Trim by deferring
13 and 14 if needed.

## Before Task 01

Set up Claude Code per `00c-mcp-setup.md` — ponytail plus five MCP servers.
Supabase MCP must be read-only and pointed at staging.

## House rules for every task

- Run `/ponytail-review` on every PR before merging. It returns a delete-list for
  over-engineering. It reviews the _solution_, never the requirements — it must
  not be used to argue away a non-negotiable design rule.
- Read `00b-cross-cutting-ui.md` before any task that renders UI. Its
  responsiveness, caching, and performance criteria are acceptance criteria for
  every screen, not optional polish.
- Read `scout-quest-claude-code-prompt.md` in the repo root first. Its
  NON-NEGOTIABLE DESIGN RULES override anything in a task file.
- Work on a branch, open a PR, never push to `main`.
- Every task ships with its tests. A task without passing tests is not done.
- If a requirement is ambiguous, list it as an open question in the PR
  description rather than inventing a decision.
- If you believe a requirement is wrong, say so in the PR — then implement it as
  written unless told otherwise.
