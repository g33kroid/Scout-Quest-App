# Task 11 — Bilingual authoring, translation, RTL

## Scope

English and Arabic as equals, throughout.

## Architecture

- Content: `quest_translations (quest_id, locale, title, flavour, description)`.
  Same pattern for units, patrols, badges.
- UI chrome: i18n message files, translated once at build time. Not generated at
  runtime.
- Authoring flow: leader writes in either language → taps **Translate** → an LLM
  call returns the other locale → shown side-by-side → **leader edits and saves**.
  Publishing requires both locales present.
- **Translate at author time only.** No render-time translation calls anywhere —
  they break offline, cost per view, and produce different wording each load.
- The translation call runs **server-side**. The API key never reaches the client.
- Pass a **glossary** in the prompt: unit names, ranks, specialisations, badge
  names, scouting and Coptic terms. Consistency across 20 leaders depends on it.

## RTL

- Logical CSS properties throughout: `margin-inline-start`, `padding-inline-end`,
  `text-align: start`. No `left`/`right` in layout CSS.
- `dir` attribute driven by locale at the document root.
- Correct bidi handling where Arabic text contains Latin names or digits.
- An Arabic font stack that renders acceptably on both iOS and Android.
- One numeral convention, applied consistently across scores, dates, standings.
  **Decide and document it** — see open questions.

## Test cases

- [ ] a quest cannot be published with only one locale
- [ ] the translate action produces an editable draft, not a saved record
- [ ] editing the machine draft and saving persists the edit, not the original
- [ ] no network call to the LLM occurs on any read path (assert in E2E)
- [ ] the LLM API key is absent from the client bundle (CI grep gate)
- [ ] glossary terms render identically across three separately translated quests
- [ ] every screen renders mirrored in Arabic (visual snapshot per route)
- [ ] a grep for `margin-left`/`margin-right` in layout CSS returns nothing
- [ ] mixed "Ahmed scored 25 points" renders with correct bidi ordering
- [ ] locale preference persists across devices for the same scout
- [ ] no hardcoded user-facing string outside message files (lint rule)

## Done when

All tests pass and an Arabic-reading reviewer has walked every Wave 1 screen and
signed off in the PR.
