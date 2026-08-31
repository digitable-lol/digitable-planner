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

Manual browser evidence recorded on 2026-09-01:

- at 1440 × 900 and 1280 × 800 the classic view rendered all 12 months as
  four columns by three rows with document height equal to the viewport;
- at 390 × 844 the planner rendered one column without horizontal overflow,
  preserved the original 22 × 22 date controls, and logged no console errors;
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
