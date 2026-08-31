# Initial probes

Recorded before implementation on branch `feat/year-planner-mvp`, based on
`master@740232ef10690e60dd567def2cb18b87c8978394`.

| Probe | Baseline | Completion signal |
| --- | --- | --- |
| `npm test` | `package.json` absent | deterministic domain/data tests pass |
| `npm run build` | app/toolchain absent | production `dist/` builds |
| offline launch | manifest and service worker absent | installable local shell reloads offline |
| persistence | IndexedDB layer absent | reload preserves committed events |
| recovery | import/export absent | corrupt input is rejected before mutation |
| keyboard | no interface | dates and controls are reachable with visible focus |
| provider claims | no capability surface | CalDAV and iCloud visibly say `UNVERIFIED / NOT IMPLEMENTED` |

The baseline had only `README.md` and `LICENSE`; therefore each product probe
was absent rather than failing an existing implementation.
