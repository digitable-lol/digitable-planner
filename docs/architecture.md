# Architecture of the first vertical slice

## Trust boundary

The planner is a browser-only application. Calendar data is stored in the
`digitable-planner` IndexedDB database and is never sent by product code. The
service worker caches only its explicit shell allowlist (document, manifest,
canonical icons and local JavaScript/CSS/map assets). `.ics`, `.dplan`, JSON
and `/provider/**` paths do not match the cache allowlist.

The Courses embed contract accepts only version 1 messages from the exact
`https://courses.digitable.life` origin. Its payload is limited to theme,
height and the request to open the full view. Calendar data is not a message
type. The top-level app remains fully usable without an embed.

## Layers

- `src/domain/**`: local-date arithmetic, event/calendar types and bounded
  recurrence expansion. It has no DOM, storage or provider dependencies.
- `src/storage/**`: IndexedDB adapter with an explicit versioned migration
  boundary and a single read-write transaction for whole-state commits.
- `src/data/**`: deterministic RFC 5545 subset and checked `.dplan` recovery.
- `src/sync/provider.ts`: provider port and honest capability records. There is
  deliberately no network adapter in this milestone.
- `src/planner-app.ts`: DOM presentation and application coordination. All
  imported/user text enters through `textContent`, not HTML parsing.
- `public/sw.js`: explicit app-shell caching. Provider responses and user data
  are excluded by construction.

## Recovery semantics

`.dplan` parsing validates magic, version, structure, dates, calendar
references and checksum before returning a preview. The exposed restore action
creates new calendar and event IDs and never overwrites existing state. ICS
imports are parsed completely before commit and conflicting UIDs receive new
local IDs.

## Future sync

An adapter must implement `CalendarProviderPort` and stay outside the domain
and storage layers. CalDAV and iCloud remain `UNVERIFIED / NOT IMPLEMENTED`.
No adapter may become supported until real-origin browser probes, conflict
retention and redacted evidence pass the initiative gates.
