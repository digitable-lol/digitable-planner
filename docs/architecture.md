# Architecture of the first vertical slice

## Trust boundary

The planner is a browser-only application. Calendar data is stored in the
`digitable-planner` IndexedDB database and is never sent by product code. The
service worker caches only its explicit shell allowlist (document, manifest,
canonical icons and local JavaScript/CSS assets). `.ics`, `.dplan`, JSON
and `/provider/**` paths do not match the cache allowlist.
Shell bundles use content hashes. Navigations are network-first with a cached
document fallback; immutable local assets are cache-first. A prior worker can
therefore discover a new document and new bundle URLs without a release query,
while a verified cached shell still launches offline.

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
Data actions live in a modal over the planner. Reset requires explicit product
confirmation in a `<dialog>` (system prompts are blocked by the intentionally
strict Courses iframe), replaces only the local Planner state with a fresh calendar, and
broadcasts the same payload-free invalidation used by ordinary commits.

## City map

Events may reference a stable ID from the bundled 106-city catalogue, including
74 Russian cities. Coordinates and time-zone identifiers live in product code
and never enter a backup. Leaflet renders bundled `world-atlas` Natural Earth
country boundaries and local event markers; there is deliberately no tile layer,
geolocation, geocoder, runtime fetch, iframe or network image. The textual event
timeline remains the accessible fallback. Unknown city IDs are rejected by backup and IndexedDB validation; an
unknown external ICS location stays unbound. ICS content lines are folded by
UTF-8 octets so Cyrillic city and event names remain RFC 5545-compatible.

Leaflet is BSD-2-Clause; `topojson-client` and `world-atlas` are ISC. They are
bundled at build time and remain compatible with the repository's BSD-2-Clause
licence. Natural Earth data is public domain.

## Time and period semantics

Legacy events remain `allDay: true`. A timed event stores a local `HH:mm` start
and an optional local end without silently converting it through the runtime
time zone. ICS uses floating local date-time values; `.dplan` and IndexedDB
validate the same timing invariant. The presentation scope is independent of
stored data: year, future, quarters and selected months only filter occurrences,
never delete or rewrite events.

## Future sync

An adapter must implement `CalendarProviderPort` and stay outside the domain
and storage layers. CalDAV and iCloud remain `UNVERIFIED / NOT IMPLEMENTED`.
No adapter may become supported until real-origin browser probes, conflict
retention and redacted evidence pass the initiative gates.
