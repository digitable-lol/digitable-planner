# Verification

Run from the repository root with Node.js 22 or newer:

```sh
npm ci
npm run check
npm run test:e2e
npm run test:a11y
npm run test:falsifiers
```

`npm run check` type-checks, runs the domain/data/storage/city-map/accessibility/cache
contracts, creates `dist/`, and checks the built artifact. `test:e2e` is an
artifact-level offline-shell smoke test in this milestone; cross-browser
Playwright and automated WCAG audits remain a later rollout gate.

Manual browser evidence recorded on 2026-09-01 against the local release candidate:

- at 1440 × 900 and 1280 × 800 the classic view rendered all 12 months as
  four columns by three rows with document height equal to the viewport;
- at 1440 × 900 the standalone light theme resolved to `#f4f7f8` / `#172126`,
  persisted in a fresh tab, and the classic view measured 252 × 246 px per month;
- the compact flow used 1001 × 164 px bounded month cards in a 754 px internal
  scroll area, with explicit day and stronger weekend borders and no document overflow;
- the offline Leaflet map rendered 177 bundled country paths and event markers,
  with zero tile elements and Natural Earth attribution;
- a custom January+March scope rendered exactly two cards in two columns;
  future-only on 2026-09-01 rendered September through December;
- an event at 09:30–11:00 in Иваново appeared with its time in the all-events
  agenda; the city selector exposed 74 Russian options including Иваново and Чебоксары;
- calendar deletion opened the product confirmation dialog inside the same
  strict iframe contract that blocks system `confirm` prompts;
- at 390 × 844 the planner rendered one column without horizontal overflow,
  preserved the original 22 × 22 date controls, and logged no console errors;
- at 1168 × 2048 the embedded year stayed a bounded 3 × 4 grid of 268 × 250 px
  cards with document height exactly equal to the viewport instead of stretching rows;
- dark/light colours use the measured Courses tokens and the four PWA/header
  logos are byte-identical to the canonical Courses assets;
- a three-day event appeared in the year and selected-day surfaces;
- the event survived a full reload through IndexedDB;
- the capability screen showed two `UNVERIFIED` provider labels and an install
  affordance.

The persistence/map repair adds automated evidence for visible restore copies,
strict city IDs, a payload-free cross-tab invalidation envelope, two live
IndexedDB connections, recurrence-aware city grouping, valid offline
coordinates/time zones, keyboard map markers, and absence of external map
origins. Browser re-verification is recorded with the release commit.

This is not evidence of CalDAV, iCloud, production deployment, true offline
browser execution, or WCAG 2.2 AA conformance. Those claims remain open.
