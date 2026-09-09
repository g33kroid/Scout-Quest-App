# Cross-Cutting — Responsiveness, Layout, and Performance

**Applies to every task that renders UI.** Read alongside the task file. These are
acceptance criteria, not suggestions: a PR that ships a screen failing any of them
is not done.

---

## 1. Device reality

The real devices in this program are mixed and mostly not new. Design for the
worst of them, not your phone.

- **Baseline target: 360×640, mid-range Android, 3-year-old hardware, throttled
  4G.** If it works there it works everywhere.
- Breakpoints: 360 (baseline phone), 414 (large phone), 768 (tablet), 1024+
  (leader laptop). Do not add more.
- Test on real hardware, not just devtools emulation. Emulated scroll and touch
  latency lie.
- Support both orientations. A leader scanning QR codes will rotate the phone.

## 2. Layout rules

- **Mobile-first CSS.** Base styles are the 360px case; breakpoints add, never
  subtract.
- **Logical properties only** — `margin-inline-start`, `padding-block`,
  `text-align: start`. Never `left`/`right` in layout CSS. This is what makes RTL
  work without a second stylesheet.
- **Container queries** for components that appear in more than one context (a
  scout card in a roster vs a standings row). Media queries for page layout.
- **Fluid type** with `clamp()`. No fixed pixel font sizes.
- **Safe-area insets** — `env(safe-area-inset-*)` on any fixed bottom bar. The
  scoring screen's tier bar sits exactly where the iPhone home indicator is.
- **Dynamic viewport units** — `dvh` not `vh`. Mobile browser chrome collapses on
  scroll and `100vh` will cut off your confirm button.
- Tap targets **≥ 48×48px** with ≥ 8px spacing. Enforced by an automated check.
- One-handed reach: primary actions in the lower third of the screen. Leaders hold
  a clipboard in the other hand.
- **No horizontal scroll at any breakpoint.** Automated assertion.
- Long Arabic strings and long names must not break layout — test with a 40-char
  name in both locales.

## 3. Loading and perceived speed

- **Never a full-page spinner.** Skeleton screens matching the final layout, so
  nothing shifts when data lands.
- **Server Components for the initial payload**, client components only where
  interaction demands. The leader roster should arrive rendered, not fetched.
- **Streaming with Suspense boundaries** per region, so the roster paints before
  analytics resolve.
- **Optimistic UI on every mutation.** An award, a check-in, an excuse — all
  appear instantly and reconcile after. A leader must never wait on a network
  round-trip to tap the next name.
- **Stale-while-revalidate** for anything cached: show the cached roster
  immediately, refresh behind it.
- Route-level prefetch for the two or three screens a leader actually goes to next.
- Debounce nothing that matters — tier taps and name selection are immediate,
  local state only.

## 4. Caching strategy

| Data                         | Strategy                                                        |
| ---------------------------- | --------------------------------------------------------------- |
| App shell, JS, CSS           | Cache-first, versioned by build hash                            |
| Leader roster                | Stale-while-revalidate, refreshed on foreground                 |
| Quest content + translations | Cache-first, invalidated on publish                             |
| Ledger / totals              | Network-first, cached fallback with a visible "as of" timestamp |
| Avatars                      | Rendered from JSONB config, no network at all                   |
| Pending mutations            | IndexedDB outbox (Task 08), never cache-evicted silently        |

- Show an explicit **"showing cached data from HH:MM"** marker whenever displaying
  stale content. A leader must never be misled about whether a score is current.
- Cache versioning must be automatic on deploy. A stale service worker serving an
  old bundle against a new schema is the classic PWA outage, and users have no
  obvious way to recover.
- Provide a hard-refresh escape hatch in settings — "reload app data" — because
  they will need it once.

## 5. Performance budgets

Enforce in CI with Lighthouse CI. Fail the build on regression.

- LCP < 2.5s on throttled 4G, mid-range Android
- CLS < 0.1 — skeletons must match final dimensions
- INP < 200ms
- Initial JS bundle < 200KB gzipped for the scout app
- Leader roster of 30 scouts renders in < 200ms after data
- **Virtualise any list over 50 rows** (org-wide views, ledger history)

## 6. Images and assets

- Avatars render from JSONB config — no image requests at all. This is most of the
  budget saved.
- `next/image` with explicit dimensions everywhere else. No layout shift.
- SVG for icons, inlined and tree-shaken. No icon font.
- Self-host fonts including the Arabic stack, `font-display: swap`, subset to the
  characters actually used.

## 7. Accessibility (not optional, and it overlaps with all of the above)

- Semantic HTML first, ARIA only where semantics run out.
- Full keyboard operability — leaders may use a laptop for authoring.
- Visible focus states.
- Contrast ≥ 4.5:1. Camps happen outdoors in bright sun; test the scoring screen
  in daylight on a real phone.
- Respect `prefers-reduced-motion`.
- Never encode meaning in colour alone — locked vs available quests need a shape
  or icon difference too.

## 8. Test cases — add these to every UI task

- [ ] renders correctly at 360, 414, 768, 1024 with no horizontal scroll
- [ ] renders correctly in portrait and landscape
- [ ] renders correctly in Arabic RTL at every breakpoint
- [ ] all tap targets ≥ 48px (automated)
- [ ] fixed bottom bars clear the iOS safe area on a real device
- [ ] no `100vh` in the codebase (grep assertion)
- [ ] no `margin-left`/`margin-right` in layout CSS (grep assertion)
- [ ] skeleton dimensions match loaded content (CLS < 0.1)
- [ ] Lighthouse CI meets all budgets above
- [ ] a 40-character name does not break layout in either locale
- [ ] stale cached data displays an "as of" timestamp
- [ ] a new deploy invalidates the service worker cache without a manual clear
- [ ] visual regression snapshots at each breakpoint, both locales

## 9. The rule that overrides the rest

The leader scoring flow (Task 05) is measured against a **stopwatch on real
hardware**, not against these budgets. If a rule here conflicts with hitting 15
seconds, the stopwatch wins — and say so in the PR.
