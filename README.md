# Digitable Planner

BSD-licensed, local-first year planner for Digitable. Calendar data stays in
the browser: the first release has no account, analytics, backend, or hidden
provider connection.

## Current milestone

- classic 12-month desktop view and continuous flow view;
- banners and heatmap, multiple local calendars, event CRUD and recurrence;
- IndexedDB persistence, `.ics` import/export and checked `.dplan` backups;
- installable PWA, full-view mode and a narrow Courses embed contract;
- exact Digitable dark/light palette and canonical Digitable PWA icons.

CalDAV and iCloud are **UNVERIFIED / NOT IMPLEMENTED**. The repository contains
only a provider port and capability labels; it does not request or store
provider credentials.

## Development

Requires Node.js 22 or newer.

```sh
npm ci
npm run check
npm run dev
```

See [`docs/verification.md`](docs/verification.md) for the current evidence and
known limits.

## Licence

The code is BSD 2-Clause; see [`LICENSE`](LICENSE). [`LICENSE-RU.md`](LICENSE-RU.md)
explains the voluntary request that companies earning substantial money from
the project invest back in it. That request is not an additional licence term.
