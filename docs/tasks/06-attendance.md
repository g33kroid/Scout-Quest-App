# Task 06 — Attendance and excused absences

## Scope

Attendance recording, excused absences, and the leader-facing disengagement
signal.

## Architecture

- `attendance` rows are append-only per session. Status: present, absent,
  excused.
- Excuse categories are a fixed enum: unwell, exams, family, travel, transport,
  other, **none_given**. Optional short note, length-capped.
- A scout can submit an excuse in advance; a leader can record one after the fact.
- Attendance can be recorded from the same roster screen as Task 05 — a scout not
  marked present by session close defaults to absent.

## Rules — read carefully

- **No automatic visible point deduction for a no-show.** Log silently.
- An excused absence does not count toward no-show escalation and **freezes**
  rather than breaks a streak.
- **The pastoral signal ignores the excuse.** The leader dashboard counts total
  absences regardless of reason. A scout excused six times running is still
  drifting, and that is exactly what this must surface.
- After a second unexplained no-show following a sign-up, surface the scout on the
  leader dashboard with recent history. **No notification to the scout.** The
  leader decides what it means.
- `none_given` must be a first-class option. A scout must never have to disclose a
  family situation to protect a streak.
- **No free-text medical detail.** Show a visible warning in the note field.
- Analytics expose two rates: raw, and excluding excused. The success metric uses
  raw.

## Test cases

- [ ] marking present/absent/excused writes one row each, append-only
- [ ] correcting a status writes a new row; the original remains
- [ ] excused absence does not increment the no-show counter
- [ ] excused absence freezes rather than resets a streak
- [ ] two unexplained no-shows surface the scout on the leader dashboard
- [ ] the scout receives no notification about a no-show
- [ ] no code path deducts points for absence
- [ ] `none_given` is selectable and behaves identically to a stated category
- [ ] raw and excused-adjusted rates differ correctly on seeded data
- [ ] a scout cannot read another scout's attendance
- [ ] a scout can submit an excuse for themselves only

## Done when

All tests pass and a seeded scout with 6 excused absences still appears on the
leader dashboard as needing attention.
