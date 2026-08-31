# Architecture of the first vertical slice

## Trust boundary

The planner is a browser-only application. Calendar data is stored in the
`digitable-planner` IndexedDB database and is never sent by product code. The
service worker caches only its explicit shell allowlist (document, manifest,
canonical icons and local JavaScript/CSS assets). `.ics`, `.dplan`, JSON
and `/provider/**` paths do not match the cache allowlist.
Shell bundle names are revisioned when the cache namespace changes, so an old
cache-first worker cannot pin a new document to stale JavaScript or CSS.

The Courses embed contract accepts only version 1 messages from the exact
`https://courses.digitable.life` origin. Its payload is limited to theme,
height and the request to open the full view. Calendar data is not a message
type. The top-level app remains fully usable without an embed.

## Layers

- `src/domain/**`: local-date arithmetic, event/calendar types, bounded
  recurrence expansion, and city-event aggregation. It has no DOM, storage or
  provider dependencies.
- `src/storage/**`: IndexedDB adapter with an explicit versioned migration
  boundary and a single read-write transaction for whole-state commits. A
  `BroadcastChannel` carries only an invalidation signal; each tab reloads the
  actual state from IndexedDB, so no calendar payload crosses the channel.
- `src/data/**`: deterministic RFC 5545 subset, checked `.dplan` recovery, and
  the fixed offline city catalogue.
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
local IDs. Restored calendar copies are made visible and the UI moves to the
earliest restored event so a successful restore is observable immediately.

## City map

Events may reference a stable ID from the bundled city catalogue. Coordinates
and time-zone identifiers live in product code and never enter a backup. The
map is a schematic equirectangular SVG with HTML buttons and a textual event
timeline: it uses no geolocation, geocoder, tile server, SDK, iframe or network
image. Unknown city IDs are rejected by backup and IndexedDB validation; an
unknown external ICS location stays unbound. ICS content lines are folded by
UTF-8 octets so Cyrillic city and event names remain RFC 5545-compatible.

## Future sync

An adapter must implement `CalendarProviderPort` and stay outside the domain
and storage layers. CalDAV and iCloud remain `UNVERIFIED / NOT IMPLEMENTED`.
No adapter may become supported until real-origin browser probes, conflict
retention and redacted evidence pass the initiative gates.
