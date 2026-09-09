# Open Decisions

**Claude Code: do not invent an answer to anything on this list. Ask.**

Full question set in `../scout-quest-checkpoint.md` (48 items). These are the ones
that block or shape code.

---

## Blocking — needed before the schema is final

**D1. Device binding — Wave 1 or Wave 3?**
Originally deferred to Wave 3. The repo is now public, so join-code format, PIN
length, and lockout thresholds are all readable, leaving a 6-digit PIN as the
entire control against enumerable nicknames.
**Default until decided: build it in Wave 1.** If deferred, the reason must be
written down here.

**D2. Season model.** Do points reset each season or accumulate? Does the journal
carry over? Badges? Streaks? Who triggers rollover and when?
Affects: ledger queries, journal, leaderboard normalisation.

**D3. Medical and allergy data.** Operationally required at camp, higher
sensitivity than a phone number. Own table? Visible to which leaders? Cached
offline how? Separate retention schedule?
Affects: schema, RLS, offline cache. **No medical column exists until this is
answered.**

**D4. Patrol membership changes mid-season.** When a scout leaves or moves, does
"average points per active member" recalculate historically or only forward?
Affects: leaderboard correctness.

---

## Needed before the pilot

**D5. Attendance baseline.** Last season's figure, reconstructed from the existing
spreadsheets. Without it the success metric cannot be evaluated.

**D6. Quest granularity.** Is a weekly class one quest or several? Is attendance
itself a quest, or a separate mechanic that also awards points?
Affects: quest model, seed templates.

**D7. Content ownership.** Who authors 12 weeks × 4 units of quests each season?
Who owns the shared template library and approves additions?

**D8. Second maintainer.** Who has repo access and can run this if the author is
unavailable?

**D9. Kill criteria.** What happens if the pilot fails? What is the rollback?

---

## Needed before full rollout

**D10. Parent access.** Login, or contact-only? If login: read-only view of next
event, kit list, own child's progress? One account per family or per child? Can a
parent submit an excused absence?

**D11. Consent form.** Who drafts it, what does it cover, per-season or once at
enrollment?

**D12. Safeguarding policy on photographing minors.** Does a written policy exist?
**Photo galleries are not built until it does.**

**D13. Safeguarding lead.** Who does the app route concerns to?

**D14. Committee approval.** Is sign-off needed, and on what timeline?

---

## Smaller, but decide before the affected task

**D15.** Numeral convention — Western or Arabic-Indic? _(Task 11)_
**D16.** Patrols self-selected or leader-assigned? _(Task 14)_
**D17.** Scout moving units mid-season — what happens to their patrol history?
_(Task 14)_
**D18.** Do leaders need a desktop view, or is mobile sufficient? _(cross-cutting)_
**D19.** Any public page at all, or is everything behind login? _(Task 15)_
