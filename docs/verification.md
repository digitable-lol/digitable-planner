# Verification

Run from the repository root with Node.js 22 or newer:

```sh
npm ci
npm run check
npm run test:e2e
npm run test:a11y
npm run test:falsifiers
```

`npm run check` type-checks, runs the domain/data/storage/accessibility/cache
contracts, creates `dist/`, and checks the built artifact. `test:e2e` is an
artifact-level offline-shell smoke test in this milestone; cross-browser
Playwright and automated WCAG audits remain a later rollout gate.

Manual browser evidence recorded on 2026-09-01:

- desktop and 390 × 844 responsive layouts rendered without console errors;
- a three-day event appeared in the year and selected-day surfaces;
- the event survived a full reload through IndexedDB;
- the capability screen showed two `UNVERIFIED` provider labels and an install
  affordance.

This is not evidence of CalDAV, iCloud, production deployment, true offline
browser execution, or WCAG 2.2 AA conformance. Those claims remain open.
