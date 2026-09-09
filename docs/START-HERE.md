# Start Here

## Order of operations

1. **Set up Claude Code** — `tasks/00c-mcp-setup.md`. ponytail plus five MCP
   servers. Supabase MCP read-only, staging only.
2. **Read** `../CLAUDE.md`, then `spec.md`, then `open-decisions.md`.
3. **Answer D1–D4** in `open-decisions.md`. They shape the schema and cannot be
   guessed.
4. **Run tasks in order** from `tasks/00-README.md`, one per Claude Code session,
   one branch and PR each.

## Document map

| File                            | What it is                                            |
| ------------------------------- | ----------------------------------------------------- |
| `../CLAUDE.md`                  | Always-loaded rules. Short by design.                 |
| `spec.md`                       | Full three-wave specification. The source of truth.   |
| `hld.md`                        | Build-vs-assemble comparison and the chosen approach. |
| `open-decisions.md`             | Questions Claude must not answer on its own.          |
| `runbook.md`                    | Operations, written for the second maintainer.        |
| `tasks/00-README.md`            | Task index and house rules.                           |
| `tasks/00b-cross-cutting-ui.md` | Responsiveness, caching, performance. Every UI task.  |
| `tasks/00c-mcp-setup.md`        | Claude Code tooling.                                  |
| `tasks/01–15`                   | One prompt per task.                                  |

## Before the first real scout record exists

- [ ] Breach notification procedure written (`runbook.md`)
- [ ] Parent consent form drafted and approved
- [ ] Export-a-scout and delete-a-scout both working
- [ ] Backup restore performed end to end, not just scheduled
- [ ] Safeguarding lead identified and documented
- [ ] Second maintainer has repo access and has run local setup unaided
