# Claude Code Prompt — Scout Quest Platform

Paste this into Claude Code as the opening prompt. It is executed in **three
delivery waves**, each with design → plan → implement → verify → ship stages and
explicit stop-gates. Do not let the agent run ahead. Wave 2 does not begin until
Wave 1 has been used by real leaders with real scouts.

---

## ROLE

You are building a real-world, live-action quest platform for a Coptic Orthodox
scout program in Dubai. Work in stages. At the end of each stage, STOP and present
your output for approval. Do not skip ahead. Do not scaffold code during design
stages. Do not build Wave 2 or Wave 3 features while Wave 1 is in progress, even
if they seem trivial to add.

---

## CORE PREMISE — read this twice

The kids are **not playing on their phones**. They are playing in real life, at
weekly scout classes and at multi-day camps. The phone is a HUD: it issues quests,
shows points, shows standings, shows attendance. The quest itself is physical —
show up, do the activity, a leader awards the points from _their_ device.

Design consequence: **no scout-facing action is ever required mid-activity.** A
scout whose phone is dead, collected, or non-existent must be able to play the
entire camp fully and see everything afterwards. Never build a flow that requires a
scout to pull out a phone while doing the thing.

Reference feel: GTA's phone/mission-board, or a Souls-like world map — visible but
locked content, chosen paths, missed content. Not a check-in app.

---

## SCALE AND CONTEXT

- ~180 scouts, ~20 leaders, one organisation.
- First camp targeted for **January, not yet confirmed**. It is a planning anchor,
  not a deadline. Never cut verification scope to hit it.
- Zero budget. No App Store or Play Store — this is a **PWA**, installed via
  "Add to Home Screen" on mixed Android/iOS.
- A prior school/tuition management system failed here because leaders would not
  maintain it and reverted to Excel. **Leader friction is the primary risk in this
  project**, ahead of any technical risk. Treat it as a hard requirement.
- The project has a **bus factor of one**. Every stage must produce documentation a
  second maintainer could pick up cold.

---

## DEFINITION OF SUCCESS

The measure is not points issued or features shipped. It is:

> the percentage of scouts attending 8 or more of 12 weekly classes, compared to
> last season.

Every feature must be arguable against that number. When a requirement here and a
feature idea conflict, the requirement wins.

---

## STRUCTURE

**Units** (persistent, full year — the classroom):

- Unit A: grades 5–6
- Unit B: grades 7–8
- Unit C: grades 9–10
- Unit D: grades 11–12 + university

Each unit has 3–4 leaders. Leaders publish quests into their own unit only. Weekly
classes and between-camp bonus quests are unit-scoped.

**Patrols** (persistent sub-teams inside a unit):

- Each unit of ~30 scouts splits into patrols of ~6.
- Patrols are the everyday competitive unit during weekly classes, persistent
  across the season.

**Camp teams** (ephemeral, one camp only):

- All scouts reshuffle into ~10–12 mixed-age teams for the duration of a camp.
- Separate table from patrol membership. A scout has one patrol and zero-or-many
  camp team memberships. Do not merge these concepts.

**Camp structure:** Camp → Days → Blocks → Stations.

- One or several elected **camp leaders** design the camp together. Each owns a day.
- Leaders are **assigned per station**; only assigned leaders can score there.
- Camp leaders read across all days, stations, and points for their camp.
- Each station has a **points budget set at design time**.

**Grade transition:** promotion closes one unit enrollment and opens another. The
person record and all history carry over untouched.

---

## ROLES

| Role        | Can do                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Admin       | Everything. Cross-unit analytics. Manages leaders, units, camps.                                                   |
| Leader      | Publish quests into own unit. Award points at assigned stations. Read own unit's scouts, including parent contact. |
| Camp leader | Design a camp, assign leaders to stations, read all camp data. Scoped to that camp, expires with it.               |
| Scout       | Read own board, journal, ledger, standings. Commit to a station block. Nothing else.                               |

Enforce in **Postgres row-level security**, not application code. See the SECURITY
section — RLS is the only real boundary in this architecture.

---

## NON-NEGOTIABLE DESIGN RULES

These apply across all three waves.

1. **Points are an append-only ledger.**
   `(person_id, delta, reason, quest_id, station_id, awarded_by, created_at)`.
   Never store a running total; totals are always a `SUM`. A group award writes N
   rows in one transaction. Corrections are reversing entries, never edits or
   deletes. All analytics derive from this one table.

2. **Fixed point tiers.** An enum: Minor 10 / Standard 25 / Major 50 / Epic 100. No
   free-text point entry anywhere. Twenty independent leaders will otherwise
   produce an incoherent economy within a month.

3. **Nothing is mandatory. Use prerequisite gating instead.** Do not implement a
   "required quest" flag. Interesting content is gated behind completing earlier
   quests. This produces the same attendance without making the board read as
   homework — and mandatory items poison the tone of everything near them.

4. **No automatic visible point deduction for no-shows.** Log silently. Surface on
   the leader's dashboard after the second occurrence, with recent history. The
   leader decides whether it's disengagement or a sick kid with exams and no lift.
   The system's job is to notice; a public penalty accelerates the drift instead of
   catching it. Visible mechanics stay positive.

5. **The scout home screen is personal, not competitive.** Default view: own
   streak, own journal, patrol contribution, next unlock. Leaderboards are one tap
   away, never the landing screen. The scout this project exists to retain must not
   open the app to a reminder that he is last.

6. **Three-layer leaderboard, normalised** (Wave 2):
   - Layer 1 — patrol vs patrol inside a unit, and individuals inside a patrol.
   - Layer 2 — all patrols in a unit, plus unit progression over time. The leader's
     diagnostic screen.
   - Layer 3 — unit vs unit across the organisation.

   Two mandatory normalisations:
   - Rank by **average points per active member**, never raw sum, or a patrol of 6
     always beats a patrol of 5.
   - Cross-unit comparison uses **percentage of earnable points achieved**. A
     leader publishing 20 quests puts more points in circulation than one
     publishing 8; comparing absolutes measures leader enthusiasm, not scout
     engagement.

   **Individual ranking never crosses age bands.** Layers 2 and 3 are aggregates
   only. Never publish a global individual leaderboard.

7. **Rolling-window ranking, so latecomers can compete.** Rank on the last 6 weeks,
   not season-to-date. A scout joining in November or returning after illness must
   have a real path to the top of his patrol, or the bottom third stops caring by
   December. Seed a returning or new scout at their patrol's median rather than
   zero.

8. **The 15-second rule.** A station leader's scoring flow: open app → assigned
   roster is already the home screen → tap scouts → confirm. No navigation, no
   dropdowns, no search, works offline. Longer than 15 seconds and this project
   fails the way the last one did. Everything else in the leader app is read-only.

9. **Paper fallback is a feature, not a contingency.** A printable per-station
   scoring sheet, plus a bulk reconciliation screen to enter it later. Signal dies,
   phone dies, leader forgets — camp continues and data catches up. This is what
   stops one bad afternoon from destroying trust in the system.

10. **Offline-first from day one.** Service worker caches board and rosters; leader
    awards queue locally and sync on reconnect with idempotency keys so a retry
    never double-awards. Retrofitting this is painful.

11. **No chat, no messaging, no scout-to-scout features.** Coordination happens in
    person. Removes an entire safeguarding surface.

12. **Bilingual English / Arabic, LLM-assisted at author time.**
    - Content stored per locale: `quest_translations` keyed `(quest_id, locale)`.
      Same for stations, badges, specialisations, camp days.
    - Leaders author in either language, tap **Translate**, review side-by-side,
      edit, publish. Publishing requires both locales filled.
    - **Translate at author time, never at render time.** Render-time calls break
      offline, cost per view, and produce different wording every load.
    - Pass a **glossary** in the translation prompt so scout and Coptic terms stay
      consistent across twenty leaders.
    - UI chrome is i18n JSON, translated once at build time.
    - Full RTL: mirrored layout, logical CSS properties (`margin-inline-start`),
      correct bidi for mixed Arabic/Latin strings, an Arabic font stack that
      renders on both platforms.
    - One numeral convention, applied consistently.
    - Locale is a per-scout preference, persisted across devices. Printed materials
      carry both languages so physical and digital match.

13. **The journal is permanent.** Active / Completed / Missed / Locked /
    Achievements. Missed quests shown plainly, without shaming language — a path
    not taken, not a failure. Survives across seasons and unit promotion, in both
    languages. This is the feature that makes the app worth opening on a Tuesday.

---

## PWA PLATFORM CONSTRAINTS

This ships as an installed PWA on mixed Android and iOS. No App Store, no Play
Store, no review process — and no scanner that can remove it. The real constraints
are platform behaviours, and each one has to be designed around, not discovered in
January.

- **Permissions requested: notifications, plus camera on leader builds only.**
  Never request geolocation anywhere in this app. Never request camera in the scout
  build. Use the file picker rather than the camera API for leader uploads.
- **iOS push requires home-screen installation.** A browser tab cannot receive push
  on iOS regardless of granted permission, and the permission prompt must follow a
  user gesture — it cannot fire on load. Sequence it: detect standalone mode, guide
  install, then prompt for notifications on a tap.
- **The Background Sync API does not exist on iOS.** The offline award and check-in
  queue must flush on next foreground open via a service worker fetch handler.
  Never architect the sync path around background sync.
- **Storage eviction is real.** Call `navigator.storage.persist()` — on Safari this
  requires notification permission to take effect, which is a second reason the
  install-then-notify order matters. "Clear History and Website Data" still wipes
  everything, so the device is never the source of truth and the server must be
  able to rebuild any client state.
- **Push subscriptions drop silently on iOS**, with delivery rates below native.
  Re-validate the subscription on every launch and re-subscribe quietly. Keep an
  in-app unread badge as the guaranteed fallback — that is what a scout sees on
  next open regardless of push status.
- Plan a **supervised install session** at the first weekly class: walk all scouts
  through Add to Home Screen in person. Keep a per-unit WhatsApp broadcast as the
  fallback channel, because install rates will never reach 100%.

---

## SECURITY

This is a public-facing application holding records of ~180 minors plus parent
contact details, under UAE PDPL, maintained by volunteers. Security work is Wave 1
scope, not a hardening pass afterwards.

### Authentication

Scout auth is **join code + nickname + 6-digit PIN**. No email addresses for
minors. A 4-digit PIN across enumerable accounts is 10,000 combinations and is not
acceptable — use 6 digits plus every control below:

- **Device binding — Wave 3, not Wave 1.** Wave 1 ships the 6-digit PIN with
  server-side rate limiting and lockout, which is proportionate for a scoreboard.
  Add device binding before camp, when the stakes and the number of accounts in play
  both rise. When built: bind the session to a device fingerprint plus a long-lived
  refresh token on first login, with new devices requiring leader re-issue. Do not
  quietly skip it — a PIN alone across enumerable accounts is weak on its own.
- Server-side rate limiting per account and per IP: 5 failures → 15 minute
  lockout, escalating. Never enforce this client-side.
- Join codes rotate each season and expire when enrollment closes.
- PIN reset by leader action only. No self-service reset, no security questions.
- **Leader and admin accounts use full auth — email plus mandatory TOTP.** One
  compromised leader account exposes ~30 children's parent contacts. Never let a
  leader authenticate through the scout flow.
- Short access-token lifetime with refresh rotation and reuse detection.

### Authorisation — the real boundary

The Supabase anon key is public by design. **RLS is the only thing standing between
a scout and every other scout's data.** Application-layer checks are convenience,
never security.

- Every table `DEFAULT DENY`, then explicit policies per role. No table ships
  without a policy.
- **pgTAP test suite, run in CI on every migration.** Must assert, and fail the
  build otherwise:
  - a scout cannot read another unit's data, another patrol's individual detail,
    or any parent contact row
  - a leader cannot read or write outside their own unit
  - a leader cannot score at a station they are not assigned to
  - camp-leader rights fail closed after the camp end date
  - no role can write directly to the ledger table
    A silent RLS regression is the single most likely way this system leaks.
- **Opaque UUIDv7 primary keys everywhere.** Sequential integers plus a public anon
  key is an enumeration invitation.
- Parent contact lives in its own table, its own policy, with an audit row written
  on every read.

### API and runtime

- **All ledger mutations go through `SECURITY DEFINER` Postgres functions.** No
  client writes to the ledger table, ever. Validate tier enum, station assignment,
  and camp window server-side inside the function.
- Idempotency key `UNIQUE` constrained on award writes so an offline replay cannot
  double-award. Test this explicitly.
- Rate limit all mutating endpoints per account.
- Validate every input server-side with a schema validator (zod or equivalent).
  Never trust a client-supplied `person_id`, `unit_id`, or point value.
- **The LLM translation call runs server-side only.** Never ship an API key to the
  client. Rate limit it per leader, cap output length, and treat leader-authored
  input as untrusted — it is not a prompt-injection risk to the app, but it does
  render on 180 devices.
- Sanitise all leader-authored quest text on render. Strict CSP with no
  `unsafe-inline` and no `unsafe-eval`; SRI on any CDN asset; `frame-ancestors
'none'`; HSTS.
- Structured audit log for: every points mutation, every parent-contact read, every
  role change, every failed authorisation attempt. Ship logs off the host.

### Code and supply chain

- Secrets in the platform's secret store only. Pre-commit secret scanning
  (gitleaks) plus GitHub push protection. A leaked service-role key is total
  compromise — it bypasses RLS entirely.
- **The service-role key never exists client-side and never in a PWA bundle.**
  Verify this with a build-time grep gate that fails CI.
- Dependabot or Renovate on, `npm audit` in CI, lockfile committed, CI runs
  `npm ci`.
- Branch protection: no direct pushes to main, CI green required.
- SAST in CI (CodeQL or Semgrep).

### If self-hosting on a VPS

Managed Supabase is the recommendation precisely because a volunteer project with
one maintainer should not own database patching. If self-hosting anyway:

- **Cloudflare Tunnel, zero inbound ports.** Nothing exposed to scan.
- Postgres bound to `127.0.0.1`, never `0.0.0.0`. No public database port.
- SSH key-only, root login disabled, fail2ban, unattended-upgrades enabled.
- Containers run non-root, read-only root filesystem, no `--privileged`.
- Encrypted off-site backups with a **documented restore that has actually been
  performed**, not just a backup job that reports success.
- Host and container image scanning on a schedule.

### PDPL and data lifecycle

- Minimum collection. Encryption in transit and at rest.
- Documented retention rule and an automated purge path for departed scouts.
- Export-a-scout and delete-a-scout as admin functions, working before go-live.
- A written breach notification procedure — who is told, by whom, within what
  window — completed before the first real scout record is entered.

### Wave 1 security exit gate

Wave 1 does not ship until: the pgTAP suite passes in CI, the service-role key grep
gate passes, PIN brute-force is rate-limited and verified by test, offline sync
survives a disconnect/reconnect cycle without double-awarding, a backup restore has
been performed end to end, and the breach procedure is written.

---

# WAVE 1 — Weekly classes (target: October pilot)

**Goal:** replace the Excel sheet and prove leaders will actually use it. No game
mechanics beyond the journal. If this wave is not adopted, nothing else matters.

**Scope:**

- Schema, RLS with pgTAP test suite in CI, seed data, roles.
- Auth: 6-digit PIN with server-side rate limiting and lockout, TOTP for leaders.
  Device binding deferred to Wave 3. Security is Wave 1 scope, not a later
  hardening pass.
- **Full offline queue and sync in Wave 1**, not deferred. Weekly classes are the
  proving ground for it, and the QR check-in requires offline token verification at
  the door regardless. Awards, check-ins, and excused absences all queue locally and
  sync on reconnect with idempotency keys.
- **Leader scoring flow, built first.** Prove the 15-second rule with a real
  stopwatch test before writing any other screen.
- Attendance and no-show logging with the leader dashboard signal.
- **Excused absences.** A scout or leader can be marked absent with a reason, either
  submitted in advance by the scout or recorded by a leader after the fact.
  - Category only, from a fixed list: unwell, exams, family, travel, transport,
    other. **No free-text medical detail.** A leader will otherwise type a child's
    diagnosis into the box; put a visible warning in the field and keep the note
    optional and short.
  - "Excused, no reason given" must be a valid option. A scout should not have to
    disclose a difficult family situation to protect their streak.
  - An excused absence **does not count toward the no-show escalation** and **does
    not break a streak** — it freezes it. This is the mechanic that stops the system
    punishing the kid who was sick or had no lift.
  - **The pastoral signal ignores the excuse.** The leader dashboard counts total
    absences regardless of reason, because a scout who is excused six times in a row
    is still drifting away and that is the exact case this project exists to catch.
    Excuses affect the game, never the welfare signal.
  - Report attendance two ways in analytics: raw rate, and rate excluding excused.
    The success metric uses the raw rate.
  - Advance notice is worth a small positive recognition — honouring a commitment by
    saying you cannot make it is the behaviour to reinforce. Never penalise a late
    or missing excuse.
  - Same model applies to leader absence from meetings and station assignments.
- **Per-scout QR check-in for attendance.** Each scout has a personal check-in code
  in the app; a leader scans it at the door of a weekly class or camp session.
  - **The code must rotate, not be static.** A static QR encoding a person ID gets
    screenshotted and sent to a friend within a week, and proxy attendance destroys
    the only metric this project is measured on. Use a TOTP-style rotating token
    (~30s window) rendered client-side, signed so a leader device can verify it
    **offline** against a cached public key. No network at scan time.
  - The QR encodes an opaque signed token, never the scout's UUID, name, or any
    personal data. Assume every code will be photographed.
  - **Camera permission is required on leader devices only.** Never request camera
    access in the scout build — keep the two permission surfaces separate.
  - **Continuous scan mode**, not one-scan-per-tap. Thirty scouts through a door in
    under two minutes, with an audible confirm and a visible running count.
  - Duplicate-scan detection: a second scan of the same scout in one session is
    ignored with a distinct sound, not recorded twice.
  - **Manual override always present.** Dead phone, cracked screen, dark hall,
    forgotten device, scout with no phone at all — the leader taps the name on the
    roster instead. QR is the fast path, never the only path. A printed badge card
    is a fine fallback because the leader recognises the child anyway; the scan is
    for speed and record-keeping, not identity proof.
  - Check-ins write to the same append-only ledger as points, with `reason`
    distinguishing attendance from awards.
- Scout board (unit quests, prerequisite gating) and journal.
- Personal home screen. Patrol standings only — no unit or org layer yet.
- Bilingual authoring with LLM translate step.
- Offline queue with idempotency.
- Paper fallback sheet and bulk reconciliation.
- 30–40 reusable quest templates seeded in both locales, so leaders clone rather
  than author from scratch.
- **Leader material sharing (documents only, no images).** A leader attaches PDFs,
  slides, or links to a quest or session; scouts in that unit can open them from
  the journal entry. Server-side MIME and magic-byte validation, size cap, virus
  scan, signed time-limited URLs, no public bucket. Documents are low-risk and
  genuinely useful — they ship in Wave 1. Images do not; see Wave 3.

**Explicitly out of scope:** specialisations, fog of war, rare drops, camp
designer, camp teams, three-layer leaderboard, season arc, badges.

**Pilot:** one unit only, October–November. Run it with the **most skeptical
leader**, not the most enthusiastic — the enthusiast tolerates friction the others
will not.

**Wave 1 exit criteria — all must pass before Wave 2 begins:**

- A leader scores a full class in under 15 seconds, unprompted, on their own phone.
- Two consecutive weeks where every session was recorded in-app with no Excel.
- Zero double-awards after an offline/reconnect cycle.
- The paper fallback was used at least once and reconciled successfully.
- A second maintainer has run the local setup from the runbook alone.

---

# WAVE 2 — The season (target: December, all units)

**Goal:** make it worth opening between classes.

**Scope:**

- Three-layer leaderboard with both normalisations and rolling-window ranking.
- Badges, streaks, reliability recognition for honouring commitments.
- Season arc: narrative fragments dripped through weekly classes, with the January
  camp questline visible and greyed out from October so scouts watch it approach.
- Bonus quests published between classes.
- **Notification budget — exactly four triggers:** quest published, points landed,
  threshold crossed, standings reveal. Nothing else. A buzz that stops meaning
  something real gets the app muted, which kills the mechanism.
- Analytics and admin views: participation trend, drop-off detection, per-scout
  history, unit progression.
- **Post-event review.** A structured retrospective after every class and camp,
  split into two deliberately separate channels.

  **Leader retro** — free text pros and cons, per station or per session, plus a
  rating of whether the timing and points budget were right. Prompted
  automatically 24h after the event, closes after 7 days. An open-ended feedback
  window never gets filled.

  **Scout feedback** — structured only:
  - Rating plus one-tap tag chips ("too long", "too easy", "confusing",
    "loved it", "want more of this"). No free-text box in the scout→leader path.
    Structured input from 180 children gives better signal than free text and
    removes an abuse surface in both directions.
  - Shown to leaders **in aggregate only**, never per-scout, so no child is
    identifiable by their rating.
  - Do not promise anonymity you cannot deliver. In a patrol of six, a leader can
    guess. Say plainly that responses are combined and not shown individually.
  - A separate, always-available "tell an adult something" path routes to the
    **admin and safeguarding lead, not the session leader** — so a scout can raise
    something about a leader without it landing in that leader's inbox. This is the
    only free-text channel and it deliberately bypasses the person being reviewed.

  **The payoff is institutional memory.** Attach the retro to the **quest template**,
  not just the event instance. When a leader clones that quest next season, the
  previous pros and cons surface at authoring time. Without this the reviews are
  written once and never read, which is how retrospectives usually die.

  Pair each review with that event's attendance number in one view, so the feedback
  is read against the metric the project is measured on.

- **Leader meetings.** Adult-facing record of unit, organisation, and camp-planning
  meetings. Build this **only with the entity links described below** — plain
  minutes are already solved by Notion or a shared doc, and duplicating them here
  adds maintenance burden for no gain. What justifies building it is that decisions
  connect to the things they are about.
  - Meeting record: date, type (unit / org-wide / camp planning), and **leader
    attendance** — present, apologies, absent. Same append-only pattern as scout
    attendance.
  - Agenda item → discussion notes → **decision with an owner and a due date**.
    Decisions are distinct records, not paragraphs buried in prose.
  - **Open action items surface on the owning leader's dashboard** until closed.
    This is the feature. A decision nobody is reminded of is a decision that did
    not happen.
  - Decisions and actions link to the entity they concern: a unit, a camp, a
    station, a quest template, or the season plan. When someone opens the camp
    designer, the decisions made about that camp are visible in context.
  - Access: leaders read their own unit's meetings plus org-wide ones; admin reads
    all. Camp-planning meetings are visible to that camp's leaders.
  - **Never record individual scout welfare concerns in meeting minutes.** If a
    discussion touches a specific child's wellbeing, the minute records that the
    matter was referred to the safeguarding lead and nothing more. Detail belongs
    in the church's safeguarding process, not in a record twenty leaders can read.
    Enforce this with a visible warning in the notes field, not just a policy line.
  - Free text, no forced translation — leaders write in whichever language suits
    the room. Internal minutes do not need the bilingual publish gate.

- **Unit equipment inventory.** Leader-facing kit tracking, replacing whatever
  spreadsheet currently holds it. Low risk, high daily value, no scout access.
  - Item catalogue with quantity, condition (good / worn / damaged / retired),
    storage location, and owner. Some items belong to one unit, some are shared
    across the whole organisation — model ownership explicitly.
  - Check-out and check-in against a unit, a camp, or a named leader. Append-only
    movement log, same pattern as the points ledger: never mutate a stock count,
    record a movement and derive the count.
  - **Expiry and maintenance dates** — first aid kit contents, gas canisters, rope
    inspection, fire extinguishers. Surface a "needs attention" list on the leader
    dashboard. This is what justifies the feature; a static list of tents does not.
  - **Pre-camp packing checklist generated from the camp plan.** The camp designer
    already knows which stations run, so it can produce the kit list and flag
    shortfalls before the weekend rather than at the campsite.
  - Post-camp reconciliation: mark items returned, damaged, or missing in one pass
    with a short note.
  - Optional photo per item, uploaded by leaders only. Nothing here involves images
    of children.
  - Bilingual item names, same translation pattern as quests.
  - Admin sees inventory across all units; leaders see their own plus shared stock.
- **Scout notebook.** Each scout has their own notebook in the app. Notes can be
  attached to a class, a camp, a quest, or an event — or be free-form, belonging to
  nothing. Model it as one `notes` table with a nullable context reference; a
  free-form note simply has no context. Rules:
  - **Private to the scout by default.** Not visible to leaders, not visible to
    other scouts, ever, unless the scout explicitly taps "share with my leader" on
    that specific note. Sharing is per-note and revocable.
  - No comments, no reactions, no replies, no visibility between scouts. This is a
    notebook, not a feed. Any social affordance turns it into the messaging surface
    the project deliberately excluded.
  - **Never scan, analyse, summarise, or run automated flagging over scouts'
    private notes.** Do not build sentiment analysis or keyword alerting on a
    child's diary. Instead, put a persistent, unobtrusive "talk to a leader" link
    in the notebook that opens the church's normal safeguarding contact path. Give
    the child a door, not a monitor.
  - **Do not over-claim privacy in the UI copy.** Notes are private from other
    scouts and from leaders, but an administrator with database access can read
    them. Say exactly that in age-appropriate wording. Never label them "encrypted"
    or "only you can see this" unless that is literally true. Do not attempt
    client-side encryption keyed to the PIN — leader-initiated PIN reset would
    destroy the notes permanently.
  - **Offline-first.** Scouts will write at camp with no signal. Notes save locally
    and sync on reconnect. Because storage eviction can wipe local data, sync
    promptly and never treat the device as the only copy.
  - Searchable by the scout, with simple tags. Notes survive unit promotion and
    season rollover — the notebook is a multi-year record.
  - Plain text, length-capped, sanitised on render, included in export-a-scout and
    delete-a-scout.
  - **Attachments: images, diagrams, and sketches.** A scout can add a photo, a
    picture from their gallery, or a drawing made in a simple in-app sketch canvas.
    Constraints:
    - **Attachments live only in private notes and can never be included in a note
      shared with a leader.** Sharing is text-only. This removes the single most
      dangerous surface in the whole system — an image channel from a child to an
      adult — while keeping the feature genuinely useful.
    - EXIF stripped and image re-encoded server-side on upload. Never trust
      client-side stripping. GPS metadata must never persist.
    - Per-scout storage quota, enforced server-side. Resize on upload; never store
      originals at full resolution.
    - Private bucket, signed short-lived URLs, no public path. RLS scoped so only
      the owning scout can read their own attachments.
    - Included in export-a-scout and hard-deleted by delete-a-scout, originals
      removed from object storage and not merely dereferenced.
    - Server-side MIME and magic-byte validation, size cap, image-only allowlist.
  - Shared notes readable only by that scout's own unit leaders, with an audit row
    on every read.
  - One line in the leader runbook: a shared note containing something concerning
    about a child's welfare goes to the safeguarding lead through the normal church
    process, not handled inside the app.

**Wave 2 exit criteria:**

- Attendance measurably tracked against the success metric above.
- All four units onboarded with leaders authoring independently.
- iOS PWA install verified in a supervised session; push confirmed working for
  installed users and a documented fallback for those who never install.

---

# WAVE 3 — Camp (target: January, or whenever the camp is confirmed)

**Goal:** the open-world weekend.

**Scope:**

- Camp designer: camp leaders co-author Days → Blocks → Stations, assign leaders,
  set per-station points budgets.
- Camp teams: reshuffled mixed-age membership, camp-scoped roles that expire.
- **Conflicting blocks.** 5–6 stations run simultaneously; a scout commits to one.
  Choosing the treasure hunt means genuinely missing the fire-building trial. This
  single constraint is what makes the board a world rather than a checklist.
  Station capacity caps enforced at commit time. **Equal points budget per station
  within a block** — unequal budgets make scouts optimise for points and the choice
  dies.
- **Fog of war.** Undiscovered quests show marker, flavour text, and difficulty
  tier only. Details revealed on arrival.
- **Specialisations.** Pathfinder, Medic, Quartermaster, Signaler, Chronicler.
  Multiplier on matching quest types, so a camp team needs a mix and team formation
  becomes strategy.
- **Rare drops.** Three unlabeled bonus awards per station leader per camp, given
  at discretion — for helping someone struggling, for cleaning up unasked.
  Unpredictable reward is the strongest engagement lever available, and it lets
  leaders reward character rather than performance.
- **Score blackout.** Standings freeze for the final block of each day, reveal at
  campfire.
- **Event photo galleries — leader-uploaded only, consent-gated.** Deliberately
  last, because photographs of identifiable minors are the highest-risk data in
  this entire system and the hardest thing to un-publish.
  - **Per-scout photo consent flag**, captured on the parent enrollment form,
    independently revocable at any time. Default is no consent.
  - Only leaders and admin upload. Scouts never upload — that is an unmoderated
    image channel involving children and it is not built.
  - Every photo requires a leader to confirm, at upload, that everyone visible has
    consent. Photos land in a **pending state and require a second leader or admin
    to approve** before any scout sees them. Two pairs of eyes, always.
  - Revoking consent for a scout must flag every photo they were marked in for
    re-review, and the admin needs a working takedown path that removes the
    original from storage, not just the database row.
  - No faces-in-thumbnails on shared screens, no tagging, no facial recognition, no
    comments, no reactions, no downloads for scouts.
  - Strip EXIF on upload — **GPS coordinates of a location full of children must
    never leave the server**. Re-encode server-side rather than trusting client
    stripping.
  - Signed short-lived URLs, private bucket, no public path, no hotlinkable
    permanent link. Audit row on every gallery view.
  - Storage goes to a dedicated object store (Cloudflare R2 free tier, 10GB) rather
    than the Supabase 1GB tier — a single camp weekend of photos will exceed it.
    Server-side resize and re-encode on upload; never store originals at full
    resolution.
  - Documented retention: galleries expire and purge on a fixed schedule.
  - **Before building this, confirm the church's existing safeguarding policy on
    photographing minors and align to it.** If that policy does not exist yet, it
    needs writing first — this is a committee decision, not an engineering one, and
    it moves slower than the build.

---

## VERIFICATION (run at the end of every wave, not just the last)

- Load test at 200 concurrent scouts and 20 leaders.
- Offline scenario: award while disconnected, reconnect, confirm exactly-once.
- RLS penetration: attempt cross-unit reads, parent-data reads as a scout, scoring
  at an unassigned station, camp-leader rights after camp end. All must fail closed.
- Accessibility and small-screen check on real Android and iOS devices.
- RTL audit: every screen in Arabic on both platforms — mirrored layout, bidi
  rendering of mixed strings, font fallback, no hardcoded or untranslated strings.
  Confirm no translation call happens at render time.
- Journal continuity: promote a seeded scout across units, confirm history, badges,
  and ledger survive in both locales.
- Leaderboard normalisation: seed patrols and units of deliberately unequal size,
  and units with unequal published quest counts. Confirm rankings are not skewed by
  headcount or leader output.
- Latecomer test: insert a scout mid-season, confirm a viable path to the top of
  their patrol under the rolling window.

---

## HOSTING

- Stack recommendation to be justified in Wave 1 planning. Default: Next.js PWA +
  Supabase (Postgres, auth, storage, realtime) free tier on Vercel. Alternative:
  same stack self-hosted on existing Proxmox behind a Cloudflare Tunnel. Present
  the tradeoff, recommend one.
- Staging and production separation.
- Automated encrypted backups with a **tested restore**, not just a backup job.
- Custom domain, HTTPS, install prompt tested on both platforms.
- **Runbook written as you build, not after**: add a leader, create a camp, roll a
  season, promote scouts between units, purge a departed scout, restore from
  backup, deploy a change. A second maintainer must be able to operate this
  without the original author.

---

## OUTPUT STYLE

Concise and technical. No filler. When you hit an ambiguity, list it as an open
question rather than inventing a decision. When a requirement here conflicts with
what you would normally build, follow the requirement and say so. When you believe
a requirement is wrong, say that too — but implement it as written unless told
otherwise.

Begin with Wave 1, design stage.
